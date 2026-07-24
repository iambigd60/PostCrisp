import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/utils/supabase/server'
import { tierFromDbValue, type CrispTask, type Tier } from './crisp-engine-config'
import { resolveFeatureAccess, featureBlockedResponse } from './feature-access'
import { ensureCreditsCurrent, creditCostFor, consumeCredits, grantCredits } from './credits'
import { serviceRoleClient } from './supabase-admin'

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
  task?: CrispTask          // the task being gated (used by reserve/refund)
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
}

export async function checkAuthAndUsage(task?: CrispTask, opts: CheckAuthOptions = {}): Promise<AuthUsageOk | AuthUsageDenied> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  // Edge rate limiting (per-IP) is handled by Vercel WAF — see
  // docs/rate-limiting.md. Per-user abuse is bounded by the credit/quota
  // checks below, which remain the primary business control.
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
    // Server-controlled quota write — run as service_role (daily_generations_*
    // are no longer writable by the authenticated role).
    await (serviceRoleClient() ?? supabase)
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
    let balance: number
    try {
      // ensureCreditsCurrent may run a service-role write on the reset path;
      // if that write client is misconfigured it throws. Fail CLOSED with the
      // same clean 503 reserveCredits uses, rather than an unhandled 500.
      balance = (await ensureCreditsCurrent(supabase, user.id, tier)).balance
    } catch (err) {
      console.error('[credits] preflight failed:', err)
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Unable to verify credits right now. Please try again.' },
          { status: 503 },
        ),
      }
    }
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

  return { ok: true, userId: user.id, tier, role, dailyUsed, task, creditCost, creditsBalance, supabase }
}

/**
 * Atomically reserve (debit) this request's credit cost BEFORE the expensive
 * model call. Returns a 402 response when the balance is insufficient — this
 * closes the concurrency gap that a preflight-only balance check misses (N
 * parallel requests all passing the read, then all generating). Call it right
 * before invoking the model, after input validation; on generation failure
 * call refundCredits() so the user is never charged for output they didn't get.
 *
 * No-ops (returns null) for admins / tutorial bypass / task-less calls, where
 * creditCost is 0.
 */
export async function reserveCredits(auth: AuthUsageOk): Promise<NextResponse | null> {
  if (auth.creditCost <= 0 || !auth.task) return null
  let res: Awaited<ReturnType<typeof consumeCredits>>
  try {
    res = await consumeCredits(auth.supabase, auth.userId, auth.creditCost, auth.task)
  } catch (err) {
    // A hard failure debiting credits (e.g. a misconfigured service-role key
    // in production) must fail CLOSED — deny the request rather than run the
    // model for free. Returning a response (never throwing) also guarantees
    // the caller's catch/refund path only runs for a debit that DID happen.
    console.error('[credits] reserve failed:', err)
    return NextResponse.json(
      { error: 'Unable to verify credits right now. Please try again.' },
      { status: 503 },
    )
  }
  if (!res) {
    return NextResponse.json(
      {
        error: `Not enough credits. This action costs ${auth.creditCost} credits.`,
        code: 'INSUFFICIENT_CREDITS',
        creditCost: auth.creditCost,
      },
      { status: 402 },
    )
  }
  return null
}

/**
 * Refund a credit cost reserved by reserveCredits(). Call in the failure path
 * of a route whose generation threw after the reservation succeeded.
 */
export async function refundCredits(auth: AuthUsageOk): Promise<void> {
  if (auth.creditCost <= 0 || !auth.task) return
  // Best-effort compensation. grantCredits runs the protected write as
  // service_role; swallow any failure (logged) so a refund error can never
  // bubble out of the route's catch and replace its intended error response.
  try {
    await grantCredits(auth.supabase, auth.userId, auth.creditCost, {
      type: 'refund',
      reason: `refund: ${auth.task} generation failed`,
    })
  } catch (err) {
    console.error('[credits] refund failed:', err)
  }
}

export async function incrementUsage(supabase: ServerClient, userId: string, currentCount: number) {
  // Server-controlled quota write — run as service_role (daily_generations_used
  // is no longer writable by the authenticated role). Falls back to the passed
  // client when the service key isn't configured (local dev / tests).
  await (serviceRoleClient() ?? supabase)
    .from('profiles')
    .update({ daily_generations_used: currentCount + 1 })
    .eq('id', userId)
}
