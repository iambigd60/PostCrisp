import { NextResponse } from 'next/server'
import { checkAuthAndUsage, incrementUsage } from '@/lib/auth-usage'
import { crispGenerate } from '@/lib/crisp-engine'
import { parseLooseJson } from '@/lib/safe-json'
import { consumeCredits } from '@/lib/credits'

export interface SoundTrend {
  name: string
  artist?: string
  platforms: string[]
  usesEstimate: string
  stage: 'New' | 'Rising' | 'Peak' | 'Declining'
  bestFor: string[]
  contentIdeas: string[]
  timingAdvice: string
}

export async function POST(request: Request) {
  const auth = await checkAuthAndUsage('sound-tracker')
  if (!auth.ok) return auth.response

  const body = await request.json()
  const { niche, category } = body

  const prompt = `You are an expert on short-form video sounds and audio trends on TikTok and Instagram Reels.

${niche ? `Creator niche: ${niche}` : 'Cover a broad range of niches'}
${category ? `Category focus: ${category}` : ''}

Return ONLY valid JSON:
{
  "trending": [8 currently popular sounds],
  "rising": [5 sounds gaining traction],
  "niche": [5 sounds popular in specific niches / ${niche || 'varied'}]
}

Each sound shape:
{
  "name": "Sound title",
  "artist": "Artist or source (if known)",
  "platforms": ["TikTok", "Instagram Reels"],
  "usesEstimate": "Approx. number of uses (e.g., '2.4M uses' or 'tens of thousands')",
  "stage": "Rising",
  "bestFor": ["lip sync", "transitions", "storytelling", "educational"],
  "contentIdeas": ["Specific idea 1", "Specific idea 2"],
  "timingAdvice": "Use now / wait / still has runway"
}

Rules:
- "stage" one of: New, Rising, Peak, Declining
- Based on training knowledge — acknowledge this is approximate and evolves fast
- Vary sound types across genres and use cases`

  try {
    const { text, totalTokens } = await crispGenerate({
      task: 'sound-tracker',
      tier: auth.tier,
      system: 'You track short-form video audio trends. Output only valid JSON.',
      prompt,
      maxTokens: 3500,
    })

    const parsed = parseLooseJson<{ trending: SoundTrend[]; rising: SoundTrend[]; niche: SoundTrend[] }>(text)

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'sound_tracker',
      platform: 'tiktok',
      input_data: { niche, category },
      output_data: parsed,
      tokens_used: totalTokens,
    })

    await consumeCredits(auth.supabase, auth.userId, auth.creditCost, 'sound-tracker')

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Sound tracker error:', error)
    return NextResponse.json({ error: 'Failed to load sounds. Please try again.' }, { status: 500 })
  }
}
