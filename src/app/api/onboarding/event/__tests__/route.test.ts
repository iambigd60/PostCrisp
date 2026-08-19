import { describe, it, expect, vi, beforeEach } from 'vitest'

// This route had no test at all, and it is the only way client stages reach
// onboarding_events. The case that matters most is the last one: it used to
// return 200 {ok:true} unconditionally, including when the database write had
// just failed — so a manual walkthrough of a completely dead pipeline looked
// perfectly healthy in the network tab.

let currentUser: { id: string } | null

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
  })),
}))

const logOnboardingEvent = vi.fn()
vi.mock('@/lib/onboarding-events', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/onboarding-events')>()
  return {
    ...actual,
    logOnboardingEvent: (...args: unknown[]) => logOnboardingEvent(...args),
  }
})

function post(body: unknown) {
  return new Request('http://localhost/api/onboarding/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  currentUser = { id: 'user-1' }
  logOnboardingEvent.mockReset()
  logOnboardingEvent.mockResolvedValue({ ok: true })
})

describe('POST /api/onboarding/event', () => {
  it('returns 401 when unauthenticated, and writes nothing', async () => {
    currentUser = null
    const { POST } = await import('../route')

    const response = await POST(post({ name: 'stage_viewed' }))

    expect(response.status).toBe(401)
    expect(logOnboardingEvent).not.toHaveBeenCalled()
  })

  it('returns 400 for a name outside the fixed union', async () => {
    const { POST } = await import('../route')

    const response = await POST(post({ name: 'anything_a_client_invents' }))

    expect(response.status).toBe(400)
    expect(logOnboardingEvent).not.toHaveBeenCalled()
  })

  it('returns 400 for the admin self-test name — a client must not be able to forge probe rows', async () => {
    const { POST } = await import('../route')

    const response = await POST(post({ name: 'selftest' }))

    expect(response.status).toBe(400)
    expect(logOnboardingEvent).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed JSON', async () => {
    const { POST } = await import('../route')

    const response = await POST(post('{not json'))

    expect(response.status).toBe(400)
    expect(logOnboardingEvent).not.toHaveBeenCalled()
  })

  it('returns 400 when detail exceeds the size cap', async () => {
    const { POST } = await import('../route')

    const response = await POST(post({ name: 'stage_viewed', detail: { blob: 'x'.repeat(3000) } }))

    expect(response.status).toBe(400)
    expect(logOnboardingEvent).not.toHaveBeenCalled()
  })

  it('returns 200 {ok:true} when the write succeeds', async () => {
    const { POST } = await import('../route')

    const response = await POST(post({ name: 'stage_viewed', detail: { stage: 'ask' } }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('takes user_id from the session even when the body smuggles one', async () => {
    currentUser = { id: 'user-42' }
    const { POST } = await import('../route')

    await POST(post({ name: 'stage_viewed', user_id: 'attacker', userId: 'attacker' }))

    expect(logOnboardingEvent).toHaveBeenCalledWith('user-42', 'stage_viewed', {})
  })

  it('returns 500 when the write FAILS — the whole point: a dead pipeline must not report success', async () => {
    logOnboardingEvent.mockResolvedValue({ ok: false, reason: 'write' })
    const { POST } = await import('../route')

    const response = await POST(post({ name: 'stage_viewed' }))

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ ok: false, reason: 'write' })
  })

  it('returns 500 when telemetry is unconfigured, distinguishing it from a write failure', async () => {
    logOnboardingEvent.mockResolvedValue({ ok: false, reason: 'env' })
    const { POST } = await import('../route')

    const response = await POST(post({ name: 'stage_viewed' }))

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ ok: false, reason: 'env' })
  })
})
