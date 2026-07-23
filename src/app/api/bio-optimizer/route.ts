import { NextResponse } from 'next/server'
import { checkAuthAndUsage, incrementUsage } from '@/lib/auth-usage'
import { crispGenerate } from '@/lib/crisp-engine'
import { parseLooseJson } from '@/lib/safe-json'
import { consumeCredits } from '@/lib/credits'
import { loadVoicePromptSnippet } from '@/lib/voice-profile'
import { loadCreatorContext } from '@/lib/creator-context-block'

// Vercel function timeout. Default 60s on Pro plan; AI calls (especially
// Opus on long outputs) regularly hit 30-60s with variance to ~90s. 120s
// gives headroom while bounding the worst case.
export const maxDuration = 120

export interface BioOption {
  text: string
  charCount: number
  approach: string
  keywords: string[]
  ctaStrength: 'Weak' | 'Medium' | 'Strong'
  emojiCount: number
}

const PLATFORM_BIO_LIMITS: Record<string, number> = {
  instagram: 150,
  tiktok:    80,
  youtube:   1000,
  x:         160,
  threads:   150,
  linkedin:  220,
  facebook:  101,
}

export async function POST(request: Request) {
  const auth = await checkAuthAndUsage('bio-optimizer')
  if (!auth.ok) return auth.response

  const body = await request.json()
  const { currentBio, platform, niche, communicate, tone } = body

  if (!platform || !niche?.trim()) {
    return NextResponse.json({ error: 'Platform and niche are required.' }, { status: 400 })
  }

  const charLimit = PLATFORM_BIO_LIMITS[platform] ?? 150
  const communicateList = Array.isArray(communicate) && communicate.length > 0 ? communicate.join(', ') : 'what you do and who you help'

  const creatorContext = await loadCreatorContext(auth.supabase, auth.userId, [
    'monetization_position',
    'differentiators',
    'audience_persona',
    'growth_stage',
  ])

  const promptBody = `You are a bio-writing specialist who knows each platform's conventions.

Generate 5 bio options for ${platform} (limit: ${charLimit} characters).

Niche: ${niche}
Things to communicate: ${communicateList}
Tone: ${tone || 'casual but confident'}
${currentBio ? `Current bio (for comparison):\n"${currentBio}"\n` : ''}

Each bio should take a DIFFERENT approach:
1. CTA-focused (leads with the action you want)
2. Personality-focused (voice and vibe forward)
3. Authority-focused (credentials and proof)
4. Benefit-focused (what the reader gets from following)
5. Hook-focused (curiosity-driven one-liner)

Return ONLY valid JSON:
{
  "options": [
    {
      "text": "The bio text",
      "charCount": 142,
      "approach": "CTA-focused",
      "keywords": ["keyword1", "keyword2"],
      "ctaStrength": "Strong",
      "emojiCount": 2
    }
  ]
}

Rules:
- EVERY option must fit under ${charLimit} characters (hard limit)
- charCount must be accurate
- ctaStrength: "Strong" = clear action verb + benefit, "Medium" = implicit, "Weak" = no CTA
- Keywords are for discoverability on ${platform}
- Use line breaks (\\n) where natural for that platform — IG allows them, Twitter/X doesn't
- Don't just say "creator" or "social media expert" — be specific to the niche`

  const prompt = [creatorContext, promptBody].filter(Boolean).join('\n\n')

  try {
    const voiceSnippet = await loadVoicePromptSnippet(auth.supabase, auth.userId)
    const { text, totalTokens } = await crispGenerate({
      task: 'bio-optimizer',
      tier: auth.tier,
      voiceSnippet,
      prompt,
      maxTokens: 1800,
    })

    const parsed = parseLooseJson<{ options: BioOption[] }>(text)

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'bio_optimizer',
      platform,
      input_data: { niche, communicate, tone, hasCurrentBio: !!currentBio },
      output_data: parsed,
      tokens_used: totalTokens,
    })

    await consumeCredits(auth.supabase, auth.userId, auth.creditCost, 'bio-optimizer')

    return NextResponse.json({ options: parsed.options ?? [], charLimit })
  } catch (error) {
    console.error('Bio optimizer error:', error)
    return NextResponse.json({ error: 'Failed to optimize bio. Please try again.' }, { status: 500 })
  }
}
