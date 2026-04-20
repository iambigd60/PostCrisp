import { NextResponse } from 'next/server'
import { checkAuthAndUsage, incrementUsage } from '@/lib/auth-usage'
import { crispGenerate } from '@/lib/crisp-engine'
import { parseLooseJson } from '@/lib/safe-json'

export interface Trend {
  name: string
  description: string
  platforms: string[]
  stage: 'Flash' | 'Short' | 'Sustained'
  viralityScore: number
  niche: boolean
  howToUse: string
  contentAngle: string
}

export async function POST(request: Request) {
  const auth = await checkAuthAndUsage('trend-radar')
  if (!auth.ok) return auth.response

  const body = await request.json()
  const { niche, platforms } = body

  const platformList = Array.isArray(platforms) && platforms.length > 0 ? platforms.join(', ') : 'Instagram, TikTok, YouTube, X'

  const prompt = `You are a social media trend analyst. Surface current trending topics, rising trends, and niche trends ${niche ? `relevant to ${niche}` : ''}.

Platforms to cover: ${platformList}

Return ONLY valid JSON:
{
  "trending": [8 trends currently peaking across these platforms],
  "rising": [6 trends gaining momentum — early opportunity],
  "niche": [6 trends specific to ${niche || 'varied creator niches'}]
}

Each trend is shaped like:
{
  "name": "Trend name or topic",
  "description": "1-sentence description of what the trend is",
  "platforms": ["TikTok", "Instagram"],
  "stage": "Short",
  "viralityScore": 85,
  "niche": false,
  "howToUse": "1-sentence specific action for a creator to participate authentically",
  "contentAngle": "A specific content idea using this trend"
}

Rules:
- stage: "Flash" (24-48hr), "Short" (1-2 weeks), "Sustained" (1 month+)
- viralityScore: 0-100, realistic
- trending array = 8 items, rising array = 6 items, niche array = 6 items
- Based on general knowledge and platform patterns as of training — acknowledge trend data is approximate`

  try {
    const { text, totalTokens } = await crispGenerate({
      task: 'trend-radar',
      tier: auth.tier,
      system: 'You analyze and surface social media trends. Output only valid JSON.',
      prompt,
      maxTokens: 4000,
    })

    const parsed = parseLooseJson<{ trending: Trend[]; rising: Trend[]; niche: Trend[] }>(text)

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'trend_radar',
      platform: null,
      input_data: { niche, platforms },
      output_data: parsed,
      tokens_used: totalTokens,
    })

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Trend radar error:', error)
    return NextResponse.json({ error: 'Failed to load trends. Please try again.' }, { status: 500 })
  }
}
