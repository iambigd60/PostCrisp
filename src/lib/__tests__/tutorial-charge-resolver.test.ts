import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeSupabase, type FakeSupabaseTables } from './fake-supabase'

// resolveTutorialCharge is the I/O wrapper that actually runs in production:
// it resolves userPresent via supabase.auth.getUser(), passes the route's
// feature key to shouldGrantTutorialBypass (the real implementation, backed
// here by a fake Supabase client), builds the 409 on refusal, and maps the
// decision to { bypassCredits, bypassFeatureGate }. decideTutorialCharge
// (the pure policy it wraps) already has an exhaustive table test in
// tutorial-charge-policy.test.ts — this file covers the wiring around it.
//
// Mocking strategy mirrors auth-usage.test.ts: mock '@/utils/supabase/server'
// so resolveTutorialCharge's internal `createClient()` call (it does its own
// I/O, same as checkAuthAndUsage) returns a fake client. No dependency-
// injection seam was needed in production code — module mocking already
// works for this shape of function, per that precedent.
//
// hasUsedTutorialBypass (called transitively via shouldGrantTutorialBypass)
// does NOT read through that session client — tutorial_redemptions has no
// client grants at all, so a session/anon client would read count: null and
// silently grant the bypass forever. It builds its own service-role client
// via `createClient` from '@supabase/supabase-js' instead (same pattern as
// recordTutorialRedemption's writer). We mock that import too, pointed at
// the SAME fake `tables` object as the session client, so a test can set up
// tutorial_redemptions rows once and have both the write-side and read-side
// mocks agree on what's been redeemed.

let currentUser: { id: string } | null

const getUserMock = vi.fn(async () => ({ data: { user: currentUser }, error: null }))
let supabaseInstance: ReturnType<typeof buildSupabase>
const createClientMock = vi.fn(async () => supabaseInstance)

vi.mock('@/utils/supabase/server', () => ({
  createClient: () => createClientMock(),
}))

// hasUsedTutorialBypass's service-role reader — see comment above. Resolves
// to whatever `supabaseInstance` currently is, same fake tables as the
// session client, so tutorial_redemptions fixtures apply to both.
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => supabaseInstance,
}))

function buildSupabase(tables: FakeSupabaseTables) {
  const fake = createFakeSupabase({ tables })
  return { ...fake, auth: { getUser: getUserMock } }
}

function setupTables(overrides: Partial<FakeSupabaseTables> = {}): FakeSupabaseTables {
  return {
    profiles: new Map(),
    credit_transactions: [],
    generations: [],
    generation_ai_calls: [],
    creator_profiles: new Map(),
    ...overrides,
  }
}

// The four literal feature keys the AI routes actually pass to
// resolveTutorialCharge AND write into generations.feature on insert
// (channel-analysis/route.ts, hashtags/route.ts, generate/route.ts,
// viral-ideas/route.ts). No shared constant exists today — each route
// hardcodes its own literal independently in both places, which is the
// drift hazard this suite guards against. Restructuring the four routes to
// derive both call sites from one shared constant is beyond this fix
// (resolveTutorialCharge's signature and the resolver file are the scope
// here), so this test drives the guard off the same four literals instead.
const FEATURE_KEYS = ['captions', 'hashtags', 'viral_ideas', 'channel_analysis'] as const

beforeEach(() => {
  currentUser = { id: 'user-1' }
  getUserMock.mockClear()
  createClientMock.mockClear()
})

describe('resolveTutorialCharge', () => {
  it('refuses with a 409 carrying code "tutorial_run_spent" when the freebie is already spent', async () => {
    const tables = setupTables({
      profiles: new Map([['user-1', { id: 'user-1', preferences: {} }]]),
      tutorial_redemptions: [
        { user_id: 'user-1', feature: 'channel_analysis' },
      ],
    })
    supabaseInstance = buildSupabase(tables)
    const { resolveTutorialCharge } = await import('@/lib/tutorial-charge-resolver')

    const result = await resolveTutorialCharge('channel_analysis', true, 'Your free tutorial run for Channel Analysis has already been used.')

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected refusal')
    expect(result.response.status).toBe(409)
    const body = await result.response.json()
    expect(body.code).toBe('tutorial_run_spent')
    expect(body.error).toBe('Your free tutorial run for Channel Analysis has already been used.')
  })

  it('grants bypass — both bypassCredits and bypassFeatureGate true — on a fresh tutorial run', async () => {
    const tables = setupTables({
      profiles: new Map([['user-1', { id: 'user-1', preferences: {} }]]),
    })
    supabaseInstance = buildSupabase(tables)
    const { resolveTutorialCharge } = await import('@/lib/tutorial-charge-resolver')

    const result = await resolveTutorialCharge('captions', true, 'already used')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.bypassCredits).toBe(true)
    expect(result.bypassFeatureGate).toBe(true)
  })

  it('returns both flags false when no authenticated user is present, so checkAuthAndUsage issues its own 401', async () => {
    currentUser = null
    const tables = setupTables()
    supabaseInstance = buildSupabase(tables)
    const { resolveTutorialCharge } = await import('@/lib/tutorial-charge-resolver')

    const result = await resolveTutorialCharge('captions', true, 'already used')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.bypassCredits).toBe(false)
    expect(result.bypassFeatureGate).toBe(false)
  })

  it('returns both flags false for a non-tutorial request, without touching Supabase at all', async () => {
    const tables = setupTables()
    supabaseInstance = buildSupabase(tables)
    const { resolveTutorialCharge } = await import('@/lib/tutorial-charge-resolver')

    const result = await resolveTutorialCharge('captions', false, 'already used')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.bypassCredits).toBe(false)
    expect(result.bypassFeatureGate).toBe(false)
    // tutorialModeRequested === false short-circuits before the resolver
    // ever creates a Supabase client — no DB round trip for ordinary requests.
    expect(createClientMock).not.toHaveBeenCalled()
  })

  describe('feature-key guard', () => {
    it.each(FEATURE_KEYS)(
      'detects a prior tutorial run recorded under the exact "%s" key and refuses a repeat',
      async (feature) => {
        const tables = setupTables({
          profiles: new Map([['user-1', { id: 'user-1', preferences: {} }]]),
          tutorial_redemptions: [
            { user_id: 'user-1', feature },
          ],
        })
        supabaseInstance = buildSupabase(tables)
        const { resolveTutorialCharge } = await import('@/lib/tutorial-charge-resolver')

        const result = await resolveTutorialCharge(feature, true, 'already used')

        expect(result.ok).toBe(false)
      },
    )

    it('demonstrates the hazard: a hyphenated key that does not match the stored feature grants an infinite repeat bypass', async () => {
      // The prior redemption is recorded under the correct underscore key,
      // exactly as channel-analysis/route.ts passes it to
      // recordTutorialRedemption (and writes it into generations.feature).
      const tables = setupTables({
        profiles: new Map([['user-1', { id: 'user-1', preferences: {} }]]),
        tutorial_redemptions: [
          { user_id: 'user-1', feature: 'channel_analysis' },
        ],
      })
      supabaseInstance = buildSupabase(tables)
      const { resolveTutorialCharge } = await import('@/lib/tutorial-charge-resolver')

      // If a route ever passed the hyphenated 'channel-analysis' instead,
      // hasUsedTutorialBypass's .eq('feature', ...) would never match the
      // row above, and the "already spent" freebie would incorrectly grant
      // again. This pins that failure mode so it shows up here — not as a
      // silently infinite freebie in production.
      const result = await resolveTutorialCharge('channel-analysis', true, 'already used')

      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('expected ok (this is the hazard, not the desired behavior)')
      expect(result.bypassCredits).toBe(true)
    })
  })
})
