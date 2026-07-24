import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// After migrating edge rate limiting to Vercel WAF, the app must NOT depend on
// Upstash at all: no UPSTASH_* env, no import of a rate-limit module, and
// crucially no 503/429 emitted merely because rate-limit config is absent.
// The per-user business control (credits/quota) must still be enforced.
//
// These tests drive checkAuthAndUsage with a fake Supabase client and assert
// the credit gate still returns 402 when the balance is short and passes when
// it's sufficient — with no Upstash environment configured.

const setUser = vi.fn()
const setTag = vi.fn()
vi.mock('@sentry/nextjs', () => ({ setUser, setTag }))

let profileRow: Record<string, unknown>
let currentUser: { id: string; email: string } | null

const fakeSupabase = {
  auth: {
    getUser: async () => ({ data: { user: currentUser }, error: null }),
  },
  from: () => ({
    select: () => ({
      eq: () => ({ single: async () => ({ data: profileRow, error: null }) }),
    }),
    update: () => ({ eq: async () => ({ error: null }) }),
  }),
}

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => fakeSupabase),
}))
vi.mock('@/lib/supabase-admin', () => ({ serviceRoleClient: () => null }))
vi.mock('@/lib/feature-access', () => ({
  resolveFeatureAccess: vi.fn(async () => ({ allowed: true })),
  featureBlockedResponse: vi.fn(),
}))

const ensureCreditsCurrent = vi.fn()
const creditCostFor = vi.fn(() => 5)
vi.mock('@/lib/credits', () => ({
  ensureCreditsCurrent: () => ensureCreditsCurrent(),
  creditCostFor: () => creditCostFor(),
}))

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  currentUser = { id: 'user-1', email: 'a@b.co' }
  profileRow = {
    subscription_tier: 'creator',
    role: 'user',
    daily_generations_used: 0,
    // fresh (today) so the daily-reset branch is skipped
    daily_generations_reset_at: new Date().toISOString(),
  }
  // Guarantee no Upstash config is present.
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
  ensureCreditsCurrent.mockReset()
  creditCostFor.mockReset().mockReturnValue(5)
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.clearAllMocks()
})

describe('checkAuthAndUsage — credit enforcement without Upstash', () => {
  it('denies with 402 INSUFFICIENT_CREDITS when balance is below cost (no 503/429)', async () => {
    ensureCreditsCurrent.mockResolvedValue({ balance: 2 })
    const { checkAuthAndUsage } = await import('@/lib/auth-usage')

    const result = await checkAuthAndUsage('hashtags')

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected denial')
    expect(result.response.status).toBe(402)
    const body = await result.response.json()
    expect(body.code).toBe('INSUFFICIENT_CREDITS')
  })

  it('passes when balance covers cost, returning the credit cost/balance', async () => {
    ensureCreditsCurrent.mockResolvedValue({ balance: 100 })
    const { checkAuthAndUsage } = await import('@/lib/auth-usage')

    const result = await checkAuthAndUsage('hashtags')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected success')
    expect(result.creditCost).toBe(5)
    expect(result.creditsBalance).toBe(100)
  })

  it('still returns 401 for an unauthenticated request (never a rate-limit 503/429)', async () => {
    currentUser = null
    const { checkAuthAndUsage } = await import('@/lib/auth-usage')

    const result = await checkAuthAndUsage('hashtags')

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected denial')
    expect(result.response.status).toBe(401)
  })
})
