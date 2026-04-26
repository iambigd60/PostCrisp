import { NextResponse } from 'next/server'
import { checkAuthAndUsage, incrementUsage } from '@/lib/auth-usage'
import { crispGenerate } from '@/lib/crisp-engine'
import { parseLooseJson } from '@/lib/safe-json'
import { consumeCredits } from '@/lib/credits'

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
  const auth = await checkAuthAndUsage('trend-radar', { request })
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

  let text = ''
  let totalTokens = 0
  try {
    const result = await crispGenerate({
      task: 'trend-radar',
      tier: auth.tier,
      prompt,
      // Bumped from 4000 → 6000. The prompt asks for 20 trends × ~8 fields
      // each, which can easily exceed 4000 tokens of output and produce
      // truncated JSON that crashes parseLooseJson downstream.
      maxTokens: 6000,
    })
    text = result.text
    totalTokens = result.totalTokens
  } catch (error) {
    console.error('Trend radar — model call failed:', error)
    return NextResponse.json(
      { error: 'AI provider error. Please try again in a moment.' },
      { status: 502 },
    )
  }

  let parsed: { trending: Trend[]; rising: Trend[]; niche: Trend[] }
  try {
    parsed = parseLooseJson<{ trending: Trend[]; rising: Trend[]; niche: Trend[] }>(text)
  } catch (error) {
    console.error('Trend radar — JSON parse failed. First 500 chars of model output:', text.slice(0, 500), error)
    return NextResponse.json(
      { error: 'AI returned malformed output. Please try again.' },
      { status: 502 },
    )
  }

  // Defensive: even if parse succeeds, the shape may be wrong. Surface a
  // clear error rather than silently rendering empty arrays on the client.
  if (!Array.isArray(parsed.trending) || !Array.isArray(parsed.rising) || !Array.isArray(parsed.niche)) {
    console.error('Trend radar — unexpected response shape:', { keys: Object.keys(parsed ?? {}), preview: text.slice(0, 300) })
    return NextResponse.json(
      { error: 'AI returned an unexpected response. Please try again.' },
      { status: 502 },
    )
  }

  try {
    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'trend_radar',
      platform: null,
      input_data: { niche, platforms },
      output_data: parsed,
      tokens_used: totalTokens,
    })

    await consumeCredits(auth.supabase, auth.userId, auth.creditCost, 'trend-radar')
  } catch (error) {
    // Persistence failed but we have the trends — return them anyway. The
    // user gets value; we lose the audit row + skip the credit debit. Logged
    // to Sentry via instrumentation.ts onRequestError.
    console.error('Trend radar — persistence failed (non-fatal, returning trends):', error)
  }

  return NextResponse.json(parsed)
}
