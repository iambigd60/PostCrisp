import { NextResponse } from 'next/server'
import {
  loadVoiceProfile,
  analyzeVoiceProfile,
  MIN_SAMPLES_FOR_ANALYSIS,
} from '@/lib/voice-profile'
import { checkAuthAndUsage, incrementUsage, reserveCredits, refundCredits } from '@/lib/auth-usage'

// Vercel function timeout. Default 60s on Pro plan; AI calls (especially
// Opus on long outputs) regularly hit 30-60s with variance to ~90s. 120s
// gives headroom while bounding the worst case.
export const maxDuration = 120

export const dynamic = 'force-dynamic'

// POST — run trait extraction on the user's current samples. Saves traits
// to the voice_profiles row. Idempotent — safe to re-run after adding
// more samples.
//
// This is a real LLM generation, so it MUST be gated + metered like every
// other AI route. It routes through the 'bio-optimizer' engine config
// internally (see analyzeVoiceProfile), so we meter it as that task — all
// tiers, 2 credits — rather than leaving it as a free, unbounded call.
export async function POST() {
  const auth = await checkAuthAndUsage('bio-optimizer')
  if (!auth.ok) return auth.response

  const profile = await loadVoiceProfile(auth.supabase, auth.userId)
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

  // Reserve credits atomically BEFORE the model call — do not run (or re-run)
  // the analysis for free under concurrency.
  const denied = await reserveCredits(auth)
  if (denied) return denied

  try {
    const traits = await analyzeVoiceProfile(profile.samples, auth.tier)

    const { error } = await auth.supabase
      .from('voice_profiles')
      .update({
        traits,
        last_analyzed_at: new Date().toISOString(),
      })
      .eq('user_id', auth.userId)

    if (error) {
      await refundCredits(auth)
      return NextResponse.json({ error: 'Failed to save analysis. Please try again.' }, { status: 500 })
    }

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    return NextResponse.json({ ok: true, traits })
  } catch (err) {
    await refundCredits(auth)
    const msg = err instanceof Error ? err.message : 'Analysis failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
