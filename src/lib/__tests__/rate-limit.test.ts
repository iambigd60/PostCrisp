import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// These tests exercise the LOW-1 fail-closed behavior: when Upstash is not
// configured, the limiter must fail OPEN in dev/preview (so local work isn't
// blocked) but fail CLOSED in production (so a misconfig can't silently remove
// the AI-abuse backstop). The module reads env at import time, so each case
// resets the module registry and re-imports with a fresh environment.

const ORIGINAL_ENV = { ...process.env }

function clearUpstash() {
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('rate limiting fail-closed (LOW-1)', () => {
  it('fails OPEN when Upstash is unconfigured outside production', async () => {
    clearUpstash()
    process.env.VERCEL_ENV = 'preview'
    const { checkAiRateLimit, checkFeedbackRateLimit } = await import('@/lib/rate-limit')

    const ai = await checkAiRateLimit(new Request('https://x.test'), 'user-1')
    expect(ai.ok).toBe(true)

    const fb = await checkFeedbackRateLimit('user-1')
    expect(fb.ok).toBe(true)
  })

  it('fails CLOSED when Upstash is unconfigured in production', async () => {
    clearUpstash()
    process.env.VERCEL_ENV = 'production'
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { checkAiRateLimit, checkFeedbackRateLimit } = await import('@/lib/rate-limit')

    const ai = await checkAiRateLimit(new Request('https://x.test'), 'user-1')
    expect(ai.ok).toBe(false)
    expect(ai.retryAfterSec).toBeGreaterThan(0)

    const fb = await checkFeedbackRateLimit('user-1')
    expect(fb.ok).toBe(false)

    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })
})
