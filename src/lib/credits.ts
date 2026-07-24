/**
 * Credit system — server-side helpers.
 *
 * Users have a `credits_balance` on their profile. Each generation debits the
 * per-task cost (see CREDITS_PER_TASK in crisp-engine-config). Balance resets
 * based on their tier's cycle (daily for Starter, monthly for paid tiers).
 *
 * Atomicity: debits use a conditional UPDATE that only succeeds if balance is
 * sufficient — prevents concurrent requests from overspending.
 */

import type { createClient } from '@/utils/supabase/server'
import {
  CREDITS_PER_TASK,
  TIER_ALLOWANCE,
  type CrispTask,
  type Tier,
} from './crisp-engine-config'
import { serviceRoleClient } from './supabase-admin'

type ServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Resolve the client used for server-controlled credit writes. Credit and
 * quota columns on `profiles` are no longer writable by the authenticated
 * role (see the pre-launch security migration), so debits/resets must run
 * as service_role. Falls back to the passed user-scoped client when the
 * service key isn't configured (local dev / unit tests).
 */
function writeClient(supabase: ServerClient): ServerClient {
  return (serviceRoleClient() ?? supabase) as ServerClient
}

export interface CreditProfile {
  balance: number
  resetAt: Date
  allowance: number
  cycle: 'daily' | 'monthly'
  costOfNext: number
}

export function creditCostFor(task: CrispTask): number {
  return CREDITS_PER_TASK[task] ?? 1
}

/**
 * Compute the next reset date from the current reset date and cycle.
 */
function nextResetDate(from: Date, cycle: 'daily' | 'monthly'): Date {
  const d = new Date(from)
  if (cycle === 'daily') {
    d.setUTCDate(d.getUTCDate() + 1)
    d.setUTCHours(0, 0, 0, 0)
  } else {
    // Set to first of next month at 00:00 UTC
    d.setUTCMonth(d.getUTCMonth() + 1)
    d.setUTCDate(1)
    d.setUTCHours(0, 0, 0, 0)
  }
  return d
}

/**
 * Ensure the user's credits_balance reflects their current cycle. If
 * credits_reset_at has passed, grant their tier allowance and advance the
 * reset timestamp. Called on every preflight check so users can't be locked
 * out by a stale reset date.
 */
export async function ensureCreditsCurrent(
  supabase: ServerClient,
  userId: string,
  tier: Tier
): Promise<{ balance: number; resetAt: Date }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits_balance, credits_reset_at')
    .eq('id', userId)
    .maybeSingle()

  const currentBalance = profile?.credits_balance ?? 0
  const resetAt = profile?.credits_reset_at ? new Date(profile.credits_reset_at) : new Date(0)
  const now = new Date()

  if (now < resetAt) {
    return { balance: currentBalance, resetAt }
  }

  // Reset time has passed — refresh allowance
  const { credits, cycle } = TIER_ALLOWANCE[tier]
  const newResetAt = nextResetDate(now, cycle)

  // Server-controlled write — must run as service_role (credits_balance is no
  // longer writable by the authenticated role).
  const writer = writeClient(supabase)

  const { error } = await writer
    .from('profiles')
    .update({
      credits_balance: credits,
      credits_reset_at: newResetAt.toISOString(),
    })
    .eq('id', userId)

  if (error) {
    console.error('[credits] failed to reset balance:', error.message)
    return { balance: currentBalance, resetAt }
  }

  await writer.from('credit_transactions').insert({
    user_id: userId,
    type: 'reset',
    amount: credits,
    balance_after: credits,
    reason: `${cycle} allowance reset (${tier})`,
    actor_id: userId,
  })

  return { balance: credits, resetAt: newResetAt }
}

/**
 * Atomically consume `cost` credits from the user's balance. Returns null if
 * the user didn't have enough (and no credits were debited). Records an audit
 * transaction on success.
 */
export async function consumeCredits(
  supabase: ServerClient,
  userId: string,
  cost: number,
  task: CrispTask,
  generationId?: string
): Promise<{ balanceAfter: number } | null> {
  if (cost <= 0) {
    const { data } = await supabase
      .from('profiles')
      .select('credits_balance')
      .eq('id', userId)
      .maybeSingle()
    return { balanceAfter: data?.credits_balance ?? 0 }
  }

  // Server-controlled write path — the RPC is SECURITY DEFINER and callable
  // only by service_role; the transaction ledger has no client INSERT policy.
  const writer = writeClient(supabase)

  // Conditional atomic decrement — only succeeds if balance is sufficient
  const { data: updated, error } = await writer.rpc('consume_user_credits', {
    p_user_id: userId,
    p_amount: cost,
  })

  if (error) {
    // RPC not installed — fall back to read-then-update (tiny race window)
    return consumeCreditsFallback(writer, userId, cost, task, generationId)
  }

  const newBalance = updated as number | null
  if (newBalance === null) return null  // insufficient balance

  await writer.from('credit_transactions').insert({
    user_id: userId,
    type: 'consume',
    amount: -cost,
    balance_after: newBalance,
    reason: `${task}`,
    task,
    generation_id: generationId ?? null,
    actor_id: userId,
  })

  return { balanceAfter: newBalance }
}

/**
 * Fallback for when the Postgres function isn't installed. Small race window
 * where two concurrent requests both pass the check, but at credit scale this
 * is acceptable — worst case one extra generation is granted.
 */
async function consumeCreditsFallback(
  supabase: ServerClient,
  userId: string,
  cost: number,
  task: CrispTask,
  generationId?: string
): Promise<{ balanceAfter: number } | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits_balance')
    .eq('id', userId)
    .maybeSingle()

  const current = profile?.credits_balance ?? 0
  if (current < cost) return null

  const newBalance = current - cost

  const { error } = await supabase
    .from('profiles')
    .update({ credits_balance: newBalance })
    .eq('id', userId)
    .eq('credits_balance', current)  // optimistic concurrency check

  if (error) return null

  await supabase.from('credit_transactions').insert({
    user_id: userId,
    type: 'consume',
    amount: -cost,
    balance_after: newBalance,
    reason: `${task}`,
    task,
    generation_id: generationId ?? null,
    actor_id: userId,
  })

  return { balanceAfter: newBalance }
}

/**
 * Grant credits to a user (admin action, purchase, promo, refund).
 */
export async function grantCredits(
  supabase: ServerClient,
  userId: string,
  amount: number,
  opts: { type: 'grant' | 'purchase' | 'refund' | 'adjust'; reason: string; actorId?: string; generationId?: string }
): Promise<{ balanceAfter: number } | null> {
  if (amount <= 0) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('credits_balance')
    .eq('id', userId)
    .maybeSingle()

  const current = profile?.credits_balance ?? 0
  const newBalance = current + amount

  const { error } = await supabase
    .from('profiles')
    .update({ credits_balance: newBalance })
    .eq('id', userId)

  if (error) return null

  await supabase.from('credit_transactions').insert({
    user_id: userId,
    type: opts.type,
    amount,
    balance_after: newBalance,
    reason: opts.reason,
    generation_id: opts.generationId ?? null,
    actor_id: opts.actorId ?? userId,
  })

  return { balanceAfter: newBalance }
}
