import { describe, it, expect, vi, beforeEach } from 'vitest'

// The brief supplies no test for this route, but it is the number the "N free
// runs left" UI renders directly — getting the accounting wrong here is user
// visible in a way the pure state-helper tests can't catch. These exercise the
// route handler itself: auth gate, per-feature tally via hasUsedTutorialBypass,
// and the fixed `total`.

let currentUser: { id: string } | null

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
  })),
}))

const hasUsedTutorialBypass = vi.fn()
vi.mock('@/lib/tutorial-bypass', () => ({
  hasUsedTutorialBypass: (...args: unknown[]) => hasUsedTutorialBypass(...args),
}))

beforeEach(() => {
  currentUser = { id: 'user-1' }
  hasUsedTutorialBypass.mockReset()
})

describe('GET /api/onboarding/free-runs', () => {
  it('returns 401 when unauthenticated', async () => {
    currentUser = null
    const { GET } = await import('../route')

    const response = await GET()

    expect(response.status).toBe(401)
    expect(hasUsedTutorialBypass).not.toHaveBeenCalled()
  })

  it('reports all three remaining when nothing has been redeemed', async () => {
    hasUsedTutorialBypass.mockResolvedValue(false)
    const { GET } = await import('../route')

    const body = await (await GET()).json()

    expect(body).toEqual({ remaining: 3, total: 3 })
  })

  it('reports zero remaining once every feature has been redeemed', async () => {
    hasUsedTutorialBypass.mockResolvedValue(true)
    const { GET } = await import('../route')

    const body = await (await GET()).json()

    expect(body).toEqual({ remaining: 0, total: 3 })
  })

  it('counts partial redemption correctly, per feature', async () => {
    hasUsedTutorialBypass.mockImplementation(async (_supabase: unknown, _userId: string, feature: string) =>
      feature === 'hashtags',
    )
    const { GET } = await import('../route')

    const body = await (await GET()).json()

    expect(body).toEqual({ remaining: 2, total: 3 })
  })

  it('checks the authenticated user id, never a client-supplied one', async () => {
    currentUser = { id: 'user-42' }
    hasUsedTutorialBypass.mockResolvedValue(false)
    const { GET } = await import('../route')

    await GET()

    for (const call of hasUsedTutorialBypass.mock.calls) {
      expect(call[1]).toBe('user-42')
    }
    expect(hasUsedTutorialBypass.mock.calls.map((c) => c[2]).sort()).toEqual([
      'captions',
      'hashtags',
      'viral_ideas',
    ])
  })
})
