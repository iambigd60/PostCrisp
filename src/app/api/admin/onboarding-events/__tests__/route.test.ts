import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

// The probe exists because the funnel could not be verified any other way.
// Production had 0 rows, nobody had signed in for two weeks, and waiting for
// organic traffic to prove the pipeline was the only option on offer. POST here
// writes a tagged row through the REAL write path and reads it back, so an
// admin can settle "is telemetry alive?" in seconds.
//
// The assertions that matter are the negative ones: a probe that reports
// success when the write failed would be worse than no probe at all.

let adminResult: unknown

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: vi.fn(async () => adminResult),
}))

const logOnboardingEvent = vi.fn()
vi.mock('@/lib/onboarding-events', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/onboarding-events')>()
  return { ...actual, logOnboardingEvent: (...args: unknown[]) => logOnboardingEvent(...args) }
})

let readBackRows: unknown[] | null
let readBackError: { message: string } | null
let recentRows: { name: string }[] | null
let serviceClient: unknown

vi.mock('@/lib/supabase-admin', () => ({
  serviceRoleClient: vi.fn(() => serviceClient),
}))

function fakeServiceClient() {
  return {
    from() {
      const chain = {
        select: () => chain,
        contains: () => chain,
        gte: () => Promise.resolve({ data: recentRows, error: null }),
        limit: () => Promise.resolve({ data: readBackRows, error: readBackError }),
      }
      return chain
    },
  }
}

beforeEach(() => {
  adminResult = { ok: true, userId: 'admin-1', supabase: {}, supabaseAdmin: {} }
  logOnboardingEvent.mockReset()
  logOnboardingEvent.mockResolvedValue({ ok: true })
  readBackRows = [{ id: 1 }]
  readBackError = null
  recentRows = []
  serviceClient = fakeServiceClient()
})

describe('POST /api/admin/onboarding-events (self-test)', () => {
  it('refuses a non-admin caller with the gate\'s own response', async () => {
    adminResult = { ok: false, response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
    const { POST } = await import('../route')

    const response = await POST()

    expect(response.status).toBe(403)
    expect(logOnboardingEvent).not.toHaveBeenCalled()
  })

  it('reports a healthy pipeline when the row is written and read back', async () => {
    const { POST } = await import('../route')

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ ok: true, wrote: true, readBack: true })
  })

  it('writes through the real path under the self-test name, which the public route rejects', async () => {
    const { POST } = await import('../route')

    await POST()

    expect(logOnboardingEvent).toHaveBeenCalledWith(
      'admin-1',
      'selftest',
      expect.objectContaining({ selftest: true }),
    )
  })

  it('reports failure — not success — when the write fails', async () => {
    logOnboardingEvent.mockResolvedValue({ ok: false, reason: 'write' })
    const { POST } = await import('../route')

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toMatchObject({ ok: false, wrote: false, reason: 'write' })
  })

  it('distinguishes missing configuration from a failed write', async () => {
    logOnboardingEvent.mockResolvedValue({ ok: false, reason: 'env' })
    const { POST } = await import('../route')

    const body = await (await POST()).json()

    expect(body).toMatchObject({ ok: false, reason: 'env' })
  })

  it('reports readback failure when the write claimed success but no row came back — the case that catches a silent RLS or grant change', async () => {
    readBackRows = []
    const { POST } = await import('../route')

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toMatchObject({ ok: false, wrote: true, readBack: false, reason: 'readback-missing' })
  })

  it('reports a readback error rather than pretending the probe passed', async () => {
    readBackRows = null
    readBackError = { message: 'permission denied for table onboarding_events' }
    const { POST } = await import('../route')

    const body = await (await POST()).json()

    expect(body).toMatchObject({ ok: false, readBack: false })
  })

  it('reports env failure when the service-role client is unavailable for readback', async () => {
    serviceClient = null
    const { POST } = await import('../route')

    const body = await (await POST()).json()

    expect(body).toMatchObject({ ok: false, reason: 'env' })
  })

  it('reports env failure when the admin gate itself cannot build a service client, instead of an opaque crash', async () => {
    const { requireAdmin } = await import('@/lib/admin-auth')
    vi.mocked(requireAdmin).mockRejectedValueOnce(new Error('supabaseKey is required.'))
    const { POST } = await import('../route')

    const response = await POST()

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ ok: false, reason: 'env' })
  })
})

describe('GET /api/admin/onboarding-events (funnel counts)', () => {
  it('refuses a non-admin caller', async () => {
    adminResult = { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    const { GET } = await import('../route')

    expect((await GET()).status).toBe(401)
  })

  it('counts recent events by name so the walkthrough can be confirmed without SQL access', async () => {
    recentRows = [
      { name: 'first_session_started' },
      { name: 'stage_viewed' },
      { name: 'stage_viewed' },
      { name: 'artifact_returned' },
    ]
    const { GET } = await import('../route')

    const body = await (await GET()).json()

    expect(body).toMatchObject({
      total: 4,
      counts: { first_session_started: 1, stage_viewed: 2, artifact_returned: 1 },
    })
  })

  it('reports an empty funnel as zero rather than failing', async () => {
    recentRows = []
    const { GET } = await import('../route')

    const body = await (await GET()).json()

    expect(body).toMatchObject({ total: 0, counts: {} })
  })
})
