import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { tierFromDbValue, type CrispTask, type Tier } from './crisp-engine-config'
import { resolveFeatureAccess, featureBlockedResponse } from './feature-access'
import { ensureCreditsCurrent, creditCostFor } from './credits'

// Legacy — kept for admin feature access UI only. Credits are now the primary cap.
export const FREE_DAILY_LIMIT = 100

type ServerClient = ReturnType<typeof createClient>

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

export async function checkAuthAndUsage(task?: CrispTask): Promise<AuthUsageOk | AuthUsageDenied> {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
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

  // Admins bypass every gate (tier + usage cap + feature access + credits)
  const isAdmin = role === 'admin'

  // Feature access (tier gating) — admins bypass
  if (task && !isAdmin) {
    const access = await resolveFeatureAccess(task, tier)
    if (!access.allowed) {
      return { ok: false, response: featureBlockedResponse(access) }
    }
  }

  // Credit preflight — ensure allowance is current, then check balance
  let creditCost = 0
  let creditsBalance = 0
  if (task) {
    const { balance } = await ensureCreditsCurrent(supabase, user.id, tier)
    creditsBalance = balance
    creditCost = isAdmin ? 0 : creditCostFor(task)

    if (!isAdmin && balance < creditCost) {
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
