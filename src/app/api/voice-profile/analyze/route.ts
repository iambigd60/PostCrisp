import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import {
  loadVoiceProfile,
  analyzeVoiceProfile,
  MIN_SAMPLES_FOR_ANALYSIS,
} from '@/lib/voice-profile'
import { tierFromDbValue } from '@/lib/crisp-engine-config'

export const dynamic = 'force-dynamic'

// POST — run trait extraction on the user's current samples. Saves traits
// to the voice_profiles row. Idempotent — safe to re-run after adding
// more samples.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await loadVoiceProfile(supabase, user.id)
  if (!profile) {
    return NextResponse.json({ error: 'No voice profile yet — add samples first.' }, { status: 400 })
  }

  if (!Array.isArray(profile.samples) || profile.samples.length < MIN_SAMPLES_FOR_ANALYSIS) {
    return NextResponse.json(
      {
        error: `Need at least ${MIN_SAMPLES_FOR_ANALYSIS} samples before we can analyze your voice.`,
      },
      { status: 400 }
    )
  }

  // Read user's current tier so analysis runs on the right model (Creator+
  // gets Sonnet quality; Starter gets cheaper).
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .maybeSingle()
  const tier = tierFromDbValue(profileRow?.subscription_tier)

  try {
    const traits = await analyzeVoiceProfile(profile.samples, tier)

    const { error } = await supabase
      .from('voice_profiles')
      .update({
        traits,
        last_analyzed_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, traits })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Analysis failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
