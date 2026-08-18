import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * Returns whatever the user has ALREADY generated during their first session.
 *
 * Why this exists: resolveTutorialCharge returns 409 for a spent freebie. A
 * resumed session that simply re-fired all three calls would receive three
 * 409s and a dead screen. Every route already persists its artifact to
 * generations.output_data, so resume rehydrates from there and only generates
 * what is genuinely missing.
 *
 * Reads only the caller's own rows — `generations` has an own-row SELECT policy,
 * so the user's session client is the right client here.
 */

type HashtagItem = { tag: string; score: number; posts: string; category: string }

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: rows } = await supabase
    .from('generations')
    .select('feature, output_data, created_at')
    .eq('user_id', user.id)
    .eq('input_data->>tutorialMode', 'true')
    .in('feature', ['captions', 'hashtags', 'viral_ideas'])
    .order('created_at', { ascending: false })

  const latest = new Map<string, Record<string, unknown>>()
  for (const row of rows ?? []) {
    const r = row as { feature: string; output_data: Record<string, unknown> }
    if (!latest.has(r.feature)) latest.set(r.feature, r.output_data ?? {})
  }

  const captionsOut = latest.get('captions')
  const hashtagsOut = latest.get('hashtags')
  const ideasOut = latest.get('viral_ideas')

  const captions = Array.isArray(captionsOut?.captions) ? (captionsOut!.captions as string[]) : []
  const hashtags = Array.isArray(hashtagsOut?.hashtags) ? (hashtagsOut!.hashtags as HashtagItem[]) : []
  const ideasArray = Array.isArray(ideasOut?.ideas) ? (ideasOut!.ideas as unknown[]) : []
  const idea = ideasArray.length ? ideasArray[0] : null

  return NextResponse.json({ captions, hashtags, idea })
}
