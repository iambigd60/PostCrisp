import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/utils/supabase/server'
import { tierFromDbValue, type CrispTask, type Tier } from './crisp-engine-config'
import { resolveFeatureAccess, featureBlockedResponse } from './feature-access'
import { ensureCreditsCurrent, creditCostFor } from './credits'
import { checkAiRateLimit } from './rate-limit'

// Legacy — kept for admin feature access UI only. Credits are now the primary cap.
export const FREE_DAILY_LIMIT = 10

// createClient is async on Next.js 15 (cookies() is now async). Unwrap the
// Promise so callers receive the actual client type, not a Promise.
type ServerClient = Awaited<ReturnType<typeof createClient>>

type AuthUsageOk = {
  ok: true
  userId: string
  tier: Tier
  role: 'user' | 'admin'
  dailyUsed: number
  creditCost: number        // how many credits this task costs (0 for admins)
  creditsBalance: number    // user's balance AFTER the preflight / allowance refresh
  supabase: ServerClient
}

type AuthUsageDenied = {
  ok: false
  response: NextResponse
}

export interface CheckAuthOptions {
  /** When true, skip the credit balance check + cost. Used by the onboarding
   *  tutorial so step 1's Channel Analysis runs on PostCrisp's dime — the
   *  user's 10 starter credits stay intact for genuine post-tutorial use.
   *  The Anthropic/OpenAI cost still gets billed; we just don't debit the
   *  user's allowance. Verified server-side via tutorial state. */
  bypassCredits?: boolean
  /** When true, skip the tier feature-access gate. Paired with bypassCredits
   *  for the tutorial: Channel Analysis is normally Creator+, but starter
   *  users still need a one-time guided run during onboarding. Caller must
   *  validate the tutorial-state guard before passing this. */
  bypassFeatureGate?: boolean
  /** When provided, applies the AI rate-limit (per-user + per-IP) before
   *  the auth/credit checks. Routes should pass the inbound Request so the
   *  limiter can extract the client IP. Without this, rate limiting is
   *  skipped — unconfigured Upstash also no-ops. */
  request?: Request
}

export async function checkAuthAndUsage(task?: CrispTask, opts: CheckAuthOptions = {}): Promise<AuthUsageOk | AuthUsageDenied> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  // Rate limit: per-user + per-IP sliding window. Caller must pass the
  // Request to enable this; without it, limiting silently no-ops (covers
  // local dev and any route not yet migrated to pass `request`).
  if (opts.request) {
    const rl = await checkAiRateLimit(opts.request, user.id)
    if (!rl.ok) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: rl.reason === 'ip'
              ? 'Too many requests from this network. Slow down and try again shortly.'
              : 'You\'re generating too quickly. Give it a moment and try again.',
            code: 'RATE_LIMITED',
            retryAfterSec: rl.retryAfterSec,
          },
          {
            status: 429,
            headers: { 'Retry-After': String(rl.retryAfterSec) },
          },
        ),
      }
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('subscription_tier, role, daily_generations_used, daily_generations_reset_at')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return { ok: false, response: NextResponse.json({ error: 'Profile not found' }, { status: 404 }) }
  }

  // Reset counter if it's a new calendar day
  const resetAt = new Date(profile.daily_generations_reset_at)
  let dailyUsed = profile.daily_generations_used

  if (resetAt.toDateString() !== new Date().toDateString()) {
    await supabase
      .from('profiles')
      .update({ daily_generations_used: 0, daily_generations_reset_at: new Date().toISOString() })
      .eq('id', user.id)
    dailyUsed = 0
  }

  const tier = tierFromDbValue(profile.subscription_tier)
  const role: 'user' | 'admin' = profile.role === 'admin' ? 'admin' : 'user'

  // Tag the active Sentry scope with the authenticated user so any error
  // captured during this request lands in Sentry attributed to them. Tier
  // + role + task surface as searchable tags for triage. PII is limited to
  // user_id (we don't pass the email — sendDefaultPii stays off in config).
  Sentry.setUser({ id: user.id })
  Sentry.setTag('tier', tier)
  Sentry.setTag('role', role)
  if (task) Sentry.setTag('task', task)

  // Admins bypass every gate (tier + usage cap + feature access + credits)
  const isAdmin = role === 'admin'

  // Feature access (tier gating) — admins bypass; tutorial run also bypasses
  // when the route has validated its tutorial-state guard.
  if (task && !isAdmin && !opts.bypassFeatureGate) {
    const access = await resolveFeatureAccess(task, tier)
    if (!access.allowed) {
      return { ok: false, response: featureBlockedResponse(access) }
    }
  }

  // Credit preflight — ensure allowance is current, then check balance.
  // bypassCredits (used by the onboarding tutorial) skips both the cost
  // and the balance check; the user's credit allowance stays untouched.
  let creditCost = 0
  let creditsBalance = 0
  if (task) {
    const { balance } = await ensureCreditsCurrent(supabase, user.id, tier)
    creditsBalance = balance
    creditCost = (isAdmin || opts.bypassCredits) ? 0 : creditCostFor(task)

    if (!isAdmin && !opts.bypassCredits && balance < creditCost) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: `Not enough credits. This action costs ${creditCost} credits and you have ${balance}.`,
            code: 'INSUFFICIENT_CREDITS',
            creditCost,
            creditsBalance: balance,
          },
          { status: 402 }
        ),
      }
    }
  }

  return { ok: true, userId: user.id, tier, role, dailyUsed, creditCost, creditsBalance, supabase }
}

export async function incrementUsage(supabase: ServerClient, userId: string, currentCount: number) {
  await supabase
    .from('profiles')
    .update({ daily_generations_used: currentCount + 1 })
    .eq('id', userId)
}
