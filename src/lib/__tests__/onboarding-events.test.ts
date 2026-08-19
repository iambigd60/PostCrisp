import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// These pin the contract the funnel is monitored through. The pipeline shipped
// mute: a failed write was swallowed, logged to console and reported to the
// caller as nothing at all, so a dead table and an idle product were
// indistinguishable — which is exactly the ambiguity that cost a session to
// resolve against production. logOnboardingEvent now RETURNS why it failed
// while still never throwing, and reports to Sentry so the failure has a
// destination someone actually watches.

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}))

function fakeWriter(
  calls: unknown[],
  opts: { throwOnInsert?: boolean; resolveWithError?: { message: string } } = {},
) {
  return {
    from(table: string) {
      return {
        insert(row: unknown) {
          if (opts.throwOnInsert) throw new Error('simulated write failure')
          calls.push({ table, row })
          if (opts.resolveWithError) return Promise.resolve({ error: opts.resolveWithError })
          return Promise.resolve({ error: null })
        },
      }
    },
  }
}

// The Sentry once-flag is module state, so every test gets a fresh module.
async function freshModule() {
  vi.resetModules()
  const Sentry = await import('@sentry/nextjs')
  vi.mocked(Sentry.captureMessage).mockClear()
  const mod = await import('@/lib/onboarding-events')
  return { ...mod, Sentry }
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('logOnboardingEvent', () => {
  it('writes user, name and detail to onboarding_events', async () => {
    const { logOnboardingEvent } = await freshModule()
    const calls: unknown[] = []

    await logOnboardingEvent('user-1', 'stage_viewed', { stage: 'ask' }, fakeWriter(calls) as never)

    expect(calls[0]).toMatchObject({
      table: 'onboarding_events',
      row: { user_id: 'user-1', name: 'stage_viewed', detail: { stage: 'ask' } },
    })
  })

  it('defaults detail to an empty object', async () => {
    const { logOnboardingEvent } = await freshModule()
    const calls: unknown[] = []

    await logOnboardingEvent('user-1', 'first_session_completed', undefined, fakeWriter(calls) as never)

    expect(calls[0]).toMatchObject({ row: { detail: {} } })
  })

  it('reports success so the route can tell a real write from a swallowed one', async () => {
    const { logOnboardingEvent } = await freshModule()

    const result = await logOnboardingEvent('user-1', 'stage_viewed', {}, fakeWriter([]) as never)

    expect(result).toEqual({ ok: true })
  })

  it('reports reason "write" — and never throws — when supabase-js RESOLVES with an error, the realistic failure mode (missing relation, revoked grant)', async () => {
    const { logOnboardingEvent } = await freshModule()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await logOnboardingEvent(
      'user-1',
      'artifact_failed',
      {},
      fakeWriter([], {
        resolveWithError: { message: 'relation "public.onboarding_events" does not exist' },
      }) as never,
    )

    expect(result).toEqual({ ok: false, reason: 'write' })
    consoleError.mockRestore()
  })

  it('reports reason "thrown" — and never throws — when the client rejects outright', async () => {
    const { logOnboardingEvent } = await freshModule()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await logOnboardingEvent(
      'user-1',
      'pack_requested',
      {},
      fakeWriter([], { throwOnInsert: true }) as never,
    )

    expect(result).toEqual({ ok: false, reason: 'thrown' })
    consoleError.mockRestore()
  })

  it('reports reason "env" when the service-role key is absent, instead of dying inside the catch as an indistinguishable failure', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    const { logOnboardingEvent } = await freshModule()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await logOnboardingEvent('user-1', 'first_session_started', {})

    expect(result).toEqual({ ok: false, reason: 'env' })
    consoleError.mockRestore()
  })

  it('reports a failed write to Sentry, so a dead pipeline reaches something someone watches', async () => {
    const { logOnboardingEvent, Sentry } = await freshModule()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await logOnboardingEvent(
      'user-1',
      'stage_viewed',
      {},
      fakeWriter([], { resolveWithError: { message: 'permission denied for table onboarding_events' } }) as never,
    )

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('permission denied for table onboarding_events'),
    )
    consoleError.mockRestore()
  })

  it('reports missing configuration to Sentry too', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    const { logOnboardingEvent, Sentry } = await freshModule()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await logOnboardingEvent('user-1', 'stage_viewed', {})

    expect(Sentry.captureMessage).toHaveBeenCalledWith(expect.stringContaining('service-role'))
    consoleError.mockRestore()
  })

  it('captures a given failure reason only once per instance — a sustained outage must not become a Sentry flood', async () => {
    const { logOnboardingEvent, Sentry } = await freshModule()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const broken = fakeWriter([], { resolveWithError: { message: 'boom' } }) as never

    await logOnboardingEvent('user-1', 'stage_viewed', {}, broken)
    await logOnboardingEvent('user-2', 'stage_viewed', {}, broken)
    await logOnboardingEvent('user-3', 'stage_viewed', {}, broken)

    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    consoleError.mockRestore()
  })

  it('still logs every failure to console even when Sentry is suppressed, so nothing is lost', async () => {
    const { logOnboardingEvent } = await freshModule()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const broken = fakeWriter([], { resolveWithError: { message: 'boom' } }) as never

    await logOnboardingEvent('user-1', 'stage_viewed', {}, broken)
    await logOnboardingEvent('user-2', 'stage_viewed', {}, broken)

    expect(consoleError).toHaveBeenCalledTimes(2)
    consoleError.mockRestore()
  })
})

describe('isOnboardingEventName', () => {
  it('accepts every name in the union', async () => {
    const { isOnboardingEventName, ONBOARDING_EVENT_NAMES } = await freshModule()
    for (const name of ONBOARDING_EVENT_NAMES) {
      expect(isOnboardingEventName(name)).toBe(true)
    }
  })

  it("rejects an arbitrary string — this is the route's validation", async () => {
    const { isOnboardingEventName } = await freshModule()
    expect(isOnboardingEventName('anything_a_client_invents')).toBe(false)
  })

  it('rejects non-strings', async () => {
    const { isOnboardingEventName } = await freshModule()
    expect(isOnboardingEventName(42)).toBe(false)
    expect(isOnboardingEventName(null)).toBe(false)
  })

  it('rejects the self-test name, so a client cannot forge admin probe rows through the public route', async () => {
    const { isOnboardingEventName, SELFTEST_EVENT_NAME } = await freshModule()
    expect(isOnboardingEventName(SELFTEST_EVENT_NAME)).toBe(false)
  })
})
