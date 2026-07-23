/**
 * Rate limiting via Upstash Redis (REST API — works in any Vercel runtime,
 * no persistent connection required).
 *
 * We use sliding-window counters keyed by user ID for authenticated routes
 * and by IP for public routes. Limits are sized so a normal alpha tester
 * never sees a 429, but a bot or runaway loop hits the wall fast.
 *
 * If UPSTASH env vars are not configured, every limiter no-ops (returns
 * `success: true`) so local development and unconfigured forks keep working.
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN

const redis = url && token ? new Redis({ url, token }) : null

// Vercel sets VERCEL_ENV to 'production' only on the production deployment
// (preview/dev get 'preview'/'development'). We treat a missing Upstash
// config as fatal ONLY in production so local dev and previews stay usable.
const IS_PRODUCTION = process.env.VERCEL_ENV === 'production'

function createLimiter(window: `${number} ${'s' | 'm' | 'h' | 'd'}`, max: number, prefix: string) {
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, window),
    analytics: false,
    prefix,
  })
}

// 30/min per user on AI generation routes. Tuned so the dashboard's
// "burst-and-pause" usage pattern stays well under the cap, but a held-down
// button or a bot maxes out within seconds and stops burning Anthropic / OpenAI.
const aiUserLimiter = createLimiter('60 s', 30, 'rl:ai:user')

// 60/min per IP backstop on AI routes. Catches abuse from one IP cycling
// across multiple authenticated accounts, and unauthenticated attempts
// before the auth check completes.
const aiIpLimiter = createLimiter('60 s', 60, 'rl:ai:ip')

// 10/hour per user on feedback. Real users submit feedback occasionally;
// 10/hour is generous. Spam scripts hit the wall.
const feedbackLimiter = createLimiter('1 h', 10, 'rl:feedback')

export interface RateLimitResult {
  ok: boolean
  /** When ok=false, how many seconds until the user can try again. */
  retryAfterSec: number
  /** When ok=false, the reason — for surfacing in the 429 body. */
  reason?: 'user' | 'ip'
}

/**
 * Result to use when Upstash is not configured. LOW-1: in production this
 * must FAIL CLOSED — never silently disable rate limiting — so a misconfig
 * can't quietly remove the AI-abuse backstop. In dev/preview it no-ops so
 * local development keeps working without Upstash secrets.
 */
function unconfiguredResult(): RateLimitResult {
  if (IS_PRODUCTION) {
    console.error(
      '[rate-limit] Upstash is not configured in production — failing closed. ' +
        'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.',
    )
    return { ok: false, retryAfterSec: 30, reason: 'ip' }
  }
  return { ok: true, retryAfterSec: 0 }
}

/**
 * Extract a best-effort client IP from a Next.js request. Falls back to a
 * stable placeholder if nothing's discoverable so the limiter still keys on
 * something. Vercel sets x-forwarded-for; local dev usually has nothing.
 */
function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

/**
 * Check the AI route limiter. Pass userId if known (post-auth), otherwise
 * only the IP limiter applies. Returns ok=true and a no-op result when
 * Upstash isn't configured — never blocks local dev on missing env vars.
 */
export async function checkAiRateLimit(
  request: Request,
  userId: string | null,
): Promise<RateLimitResult> {
  if (!redis) return unconfiguredResult()

  const ip = clientIp(request)

  // Run both limiters in parallel so the slower one doesn't dominate latency.
  const [userResult, ipResult] = await Promise.all([
    userId && aiUserLimiter ? aiUserLimiter.limit(userId) : Promise.resolve(null),
    aiIpLimiter ? aiIpLimiter.limit(ip) : Promise.resolve(null),
  ])

  if (userResult && !userResult.success) {
    const retryAfterSec = Math.max(1, Math.ceil((userResult.reset - Date.now()) / 1000))
    return { ok: false, retryAfterSec, reason: 'user' }
  }
  if (ipResult && !ipResult.success) {
    const retryAfterSec = Math.max(1, Math.ceil((ipResult.reset - Date.now()) / 1000))
    return { ok: false, retryAfterSec, reason: 'ip' }
  }
  return { ok: true, retryAfterSec: 0 }
}

/**
 * Check the feedback limiter. Pass userId post-auth.
 */
export async function checkFeedbackRateLimit(userId: string): Promise<RateLimitResult> {
  if (!feedbackLimiter) return unconfiguredResult()
  const result = await feedbackLimiter.limit(userId)
  if (!result.success) {
    const retryAfterSec = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
    return { ok: false, retryAfterSec, reason: 'user' }
  }
  return { ok: true, retryAfterSec: 0 }
}
