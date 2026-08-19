import { describe, it, expect, vi } from 'vitest'
import { isInActiveTutorial, hasUsedTutorialBypass } from '@/lib/tutorial-bypass'
import { createFakeSupabase, type FakeSupabaseTables } from './fake-supabase'

function setupTables(preferences: Record<string, unknown>): FakeSupabaseTables {
  return {
    profiles: new Map([['user-1', { id: 'user-1', preferences }]]),
    credit_transactions: [],
    generations: [],
    generation_ai_calls: [],
    creator_profiles: new Map(),
  }
}

// hasUsedTutorialBypass builds its own service-role client (via
// `createClient` from '@supabase/supabase-js') to read tutorial_redemptions
// — it never reads through the `supabase` argument callers pass in, because
// that table has no client grants at all. Mocking `@supabase/supabase-js`
// here lets these tests drive that internal client directly, independent of
// whatever fake object is passed as the (deliberately unused) first
// argument below.
let ledgerInstance: ReturnType<typeof createFakeSupabase>

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ledgerInstance,
}))

function emptyTables(): FakeSupabaseTables {
  return {
    profiles: new Map(),
    credit_transactions: [],
    generations: [],
    generation_ai_calls: [],
    creator_profiles: new Map(),
  }
}

describe('isInActiveTutorial', () => {
  it('grants bypass when the user has no tutorial record yet (first-time onboarding)', async () => {
    const tables = setupTables({})
    const supabase = createFakeSupabase({ tables })
    expect(await isInActiveTutorial(supabase as any, 'user-1')).toBe(true)
  })

  it('denies bypass once tutorial is marked completed (replay protection)', async () => {
    const tables = setupTables({
      tutorial_progress: { step: 'save', completed: true },
    })
    const supabase = createFakeSupabase({ tables })
    expect(await isInActiveTutorial(supabase as any, 'user-1')).toBe(false)
  })

  it('still grants bypass on a step the old gate already allowed (baseline)', async () => {
    // Baseline, not a regression pin: 'captions' was already a member of the
    // old TUTORIAL_STEPS allowlist, so this case returned true both before
    // and after the gate removal. See the 'channels' test below for the case
    // that actually demonstrates the write-ordering fix.
    const tables = setupTables({
      tutorial_progress: { step: 'captions', completed: false },
    })
    const supabase = createFakeSupabase({ tables })
    expect(await isInActiveTutorial(supabase as any, 'user-1')).toBe(true)
  })

  it('grants bypass on a pre-generation step (channels), which the old step gate refused', async () => {
    // Regression: goToStep fire-and-forgets the preferences PUT, so the step
    // recorded server-side lags the UI. The old step gate denied the bypass
    // to users who advanced (e.g. to 'channels') faster than that write
    // landed — this case flips false -> true with the fix.
    const tables = setupTables({
      tutorial_progress: { step: 'channels', completed: false },
    })
    const supabase = createFakeSupabase({ tables })
    expect(await isInActiveTutorial(supabase as any, 'user-1')).toBe(true)
  })

  it('grants bypass for an unrecognised step value as long as the tutorial is not completed', async () => {
    // Step is now advisory only. Spoofing it buys nothing: the per-feature
    // lifetime lock in hasUsedTutorialBypass still caps free runs at one each.
    const tables = setupTables({
      tutorial_progress: { step: 'arbitrary-fake-step', completed: false },
    })
    const supabase = createFakeSupabase({ tables })
    expect(await isInActiveTutorial(supabase as any, 'user-1')).toBe(true)
  })

  it('still denies bypass once completed, even on a generation step', async () => {
    // The completed flag remains the hard stop.
    const tables = setupTables({
      tutorial_progress: { step: 'viral', completed: true },
    })
    const supabase = createFakeSupabase({ tables })
    expect(await isInActiveTutorial(supabase as any, 'user-1')).toBe(false)
  })
})

describe('hasUsedTutorialBypass', () => {
  it('returns false — bypass available — when the ledger read succeeds with no prior redemption', async () => {
    ledgerInstance = createFakeSupabase({ tables: { ...emptyTables(), tutorial_redemptions: [] } })
    const result = await hasUsedTutorialBypass({} as never, 'user-1', 'captions')
    expect(result).toBe(false)
  })

  it('returns true — bypass already spent — when a matching redemption row exists', async () => {
    ledgerInstance = createFakeSupabase({
      tables: { ...emptyTables(), tutorial_redemptions: [{ user_id: 'user-1', feature: 'captions' }] },
    })
    const result = await hasUsedTutorialBypass({} as never, 'user-1', 'captions')
    expect(result).toBe(true)
  })

  it('FAILS CLOSED — treats the bypass as already used — when the ledger read errors (e.g. relation missing because the migration was never applied)', async () => {
    ledgerInstance = createFakeSupabase({
      tables: emptyTables(),
      readErrors: {
        tutorial_redemptions: { message: 'relation "public.tutorial_redemptions" does not exist' },
      },
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    // This is the case the ruling is about: `count` is null on an error
    // response just like it would be for a genuinely empty table, so the
    // only thing distinguishing "unreadable" from "no prior redemption" is
    // checking `error`. Denying (true) here — not granting (false) — is what
    // keeps a broken-migration environment bounded to "onboarding is broken"
    // instead of "every request gets a free run forever".
    const result = await hasUsedTutorialBypass({} as never, 'user-1', 'captions')

    expect(result).toBe(true)
    expect(consoleError).toHaveBeenCalledWith(
      '[tutorial-bypass] tutorial_redemptions read failed — denying the bypass',
      expect.objectContaining({ userId: 'user-1', feature: 'captions' }),
    )

    consoleError.mockRestore()
  })

  it('FAILS CLOSED — treats the bypass as already used — when the ledger read resolves with count: null and NO error', async () => {
    // Distinct from the "relation missing" case above: here `error` is null
    // too, e.g. an RLS policy that makes the table invisible without
    // erroring. `(null ?? 0) > 0` would have silently evaluated to false
    // forever, granting the bypass on every request — this pins that the
    // fail-closed check does not rely on `error` alone.
    ledgerInstance = createFakeSupabase({
      tables: emptyTables(),
      nullCountNoError: { tutorial_redemptions: true },
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await hasUsedTutorialBypass({} as never, 'user-1', 'captions')

    expect(result).toBe(true)
    expect(consoleError).toHaveBeenCalledWith(
      '[tutorial-bypass] tutorial_redemptions read failed — denying the bypass',
      expect.objectContaining({ userId: 'user-1', feature: 'captions', count: null }),
    )

    consoleError.mockRestore()
  })
})
