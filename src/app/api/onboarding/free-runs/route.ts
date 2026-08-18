import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { hasUsedTutorialBypass } from '@/lib/tutorial-bypass'

/**
 * How many of the first session's free runs remain.
 *
 * Reads the same server-authoritative source the routes enforce (the redemption
 * ledger, via hasUsedTutorialBypass) rather than counting anything client-side.
 *
 * Copy note for callers: these are session-only coupons, one per feature, not a
 * credit balance. Do not render them as "credits in your account".
 */

const PACK_FEATURES = ['captions', 'hashtags', 'viral_ideas'] as const

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const used = await Promise.all(
    PACK_FEATURES.map((feature) => hasUsedTutorialBypass(supabase, user.id, feature)),
  )

  return NextResponse.json({ remaining: used.filter((u) => !u).length, total: PACK_FEATURES.length })
}
