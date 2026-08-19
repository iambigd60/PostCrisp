import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { emitOnboardingEvent } from '@/lib/onboarding-client'

// The three stages each had their own copy of this fetch, all of them
// `.catch(() => {})`. That swallowed 400s, 401s and 5xx alike, so the only
// signal a broken pipeline produced on the client was silence. One helper now,
// still fire-and-forget, but it says something when the request is rejected.

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  warn.mockRestore()
  vi.unstubAllGlobals()
})

describe('emitOnboardingEvent', () => {
  it('posts the name and detail to the event route', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)

    emitOnboardingEvent('stage_viewed', { stage: 'ask' })
    await flush()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/onboarding/event',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'stage_viewed', detail: { stage: 'ask' } }),
      }),
    )
  })

  it('defaults detail to an empty object', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)

    emitOnboardingEvent('first_session_started')
    await flush()

    expect(fetchMock.mock.calls[0][1].body).toBe(
      JSON.stringify({ name: 'first_session_started', detail: {} }),
    )
  })

  it('returns immediately without waiting on the request — telemetry must never block a stage transition', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

    expect(emitOnboardingEvent('pack_requested', {})).toBeUndefined()
  })

  it('warns when the route rejects the event, so devtools reveal a dead pipeline during the walkthrough', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))

    emitOnboardingEvent('stage_viewed', {})
    await flush()

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('onboarding'),
      expect.objectContaining({ name: 'stage_viewed', status: 500 }),
    )
  })

  it('warns when the request fails outright', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    emitOnboardingEvent('artifact_saved', {})
    await flush()

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('onboarding'),
      expect.objectContaining({ name: 'artifact_saved' }),
    )
  })

  it('NEVER throws when the request fails — an unhandled rejection here would surface inside a first session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    expect(() => emitOnboardingEvent('artifact_failed', {})).not.toThrow()
    await flush()
  })
})
