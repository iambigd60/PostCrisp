import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const FREE_DAILY_LIMIT = 100
export const CLAUDE_MODEL = 'claude-sonnet-4-6'

type ServerClient = ReturnType<typeof createClient>

type AuthUsageOk = {
  ok: true
  userId: string
  dailyUsed: number
  supabase: ServerClient
}

type AuthUsageDenied = {
  ok: false
  response: NextResponse
}

export async function checkAuthAndUsage(): Promise<AuthUsageOk | AuthUsageDenied> {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('subscription_tier, daily_generations_used, daily_generations_reset_at')
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

  if (profile.subscription_tier === 'free' && dailyUsed >= FREE_DAILY_LIMIT) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Daily generation limit reached. Upgrade to Pro for unlimited access.', code: 'LIMIT_REACHED' },
        { status: 429 }
      ),
    }
  }

  return { ok: true, userId: user.id, dailyUsed, supabase }
}

export async function incrementUsage(supabase: ServerClient, userId: string, currentCount: number) {
  await supabase
    .from('profiles')
    .update({ daily_generations_used: currentCount + 1 })
    .eq('id', userId)
}
