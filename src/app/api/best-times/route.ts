import { NextResponse } from 'next/server'
import { checkAuthAndUsage, incrementUsage } from '@/lib/auth-usage'
import { crispGenerate } from '@/lib/crisp-engine'
import { parseLooseJson } from '@/lib/safe-json'
import { consumeCredits } from '@/lib/credits'

const contentTypeLabels: Record<string, string> = {
  post:     'standard feed posts',
  reel:     'short-form vertical video (Reels / Shorts / TikTok)',
  story:    'ephemeral Stories',
  carousel: 'multi-slide carousels',
  live:     'live streams',
  longform: 'long-form video content',
}

export async function GET(request: Request) {
  const auth = await checkAuthAndUsage('posting-times')
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const platform = searchParams.get('platform') || 'instagram'
  const niche = searchParams.get('niche') || 'general'
  const contentType = searchParams.get('contentType') || 'post'
  const region = searchParams.get('region') || 'North America'

  const contentLabel = contentTypeLabels[contentType] || 'posts'

  const prompt = `You are a social media analytics expert with deep knowledge of each platform's algorithm and audience behavior.

Provide best posting times for ${platform}, specifically for ${contentLabel}, targeting a ${niche} audience in ${region}.

Account for:
- ${platform}'s current algorithm preferences and feed-ranking behavior
- Typical daily rhythms of ${region} audiences (work hours, commute, evening scroll time)
- Content type nuances — e.g., Reels/Shorts peak at different times than feed posts
- ${niche}-specific audience behavior patterns
- Weekend vs weekday differences

Return ONLY valid JSON — no markdown, no commentary:
{
  "weekData": [[24 hourly scores Mon], [Tue], [Wed], [Thu], [Fri], [Sat], [Sun]],
  "topSlots": [
    {"day": "Tuesday", "time": "10:00 AM", "score": 95, "reason": "Peak lunch break engagement"},
    {"day": "Thursday", "time": "7:00 PM", "score": 92, "reason": "Evening scroll time"},
    {"day": "Wednesday", "time": "12:00 PM", "score": 88, "reason": "Midday break"},
    {"day": "Saturday", "time": "9:00 AM", "score": 85, "reason": "Weekend morning browsing"},
    {"day": "Monday", "time": "8:00 PM", "score": 82, "reason": "End of day wind-down"}
  ],
  "tips": [
    "Specific ${platform} algorithm insight for ${contentLabel}",
    "Platform-specific posting cadence tip",
    "Audience behavior tip for ${niche} creators in ${region}"
  ]
}

Rules:
- weekData: 7 arrays (Mon-Sun), each with 24 integers (hours 0-23), scores 0-100
- Reflect REAL engagement patterns — don't produce flat or random data
- Weekend patterns must differ meaningfully from weekdays
- topSlots must be exactly 5 items, sorted by score descending, with times in 12-hour format
- Each "reason" must reference the specific niche, platform, or content type (not generic)
- tips array must be exactly 3 items, each actionable and specific to the inputs above`

  try {
    const { text, totalTokens } = await crispGenerate({
      task: 'posting-times',
      tier: auth.tier,
      system: 'You are a social media timing expert. Output only valid JSON.',
      prompt,
      maxTokens: 2500,
    })

    const parsed = parseLooseJson<{ weekData: number[][]; topSlots: unknown[]; tips: string[] }>(text)

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'posting_times',
      platform,
      input_data: { niche, contentType, region },
      output_data: parsed,
      tokens_used: totalTokens,
    })

    await consumeCredits(auth.supabase, auth.userId, auth.creditCost, 'posting-times')

    return NextResponse.json({ platform, niche, contentType, region, ...parsed })
  } catch (error) {
    console.error('Best times generation error:', error)
    return NextResponse.json({ error: 'Failed to analyze posting times. Please try again.' }, { status: 500 })
  }
}
