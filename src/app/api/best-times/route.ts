import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { checkAuthAndUsage, incrementUsage, CLAUDE_MODEL } from '@/lib/auth-usage'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

export async function GET(request: Request) {
  const auth = await checkAuthAndUsage()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const platform = searchParams.get('platform') || 'instagram'
  const niche = searchParams.get('niche') || 'general'
  const contentType = searchParams.get('contentType') || 'post'
  const region = searchParams.get('region') || 'North America'

  const prompt = `You are a social media analytics expert. Provide best posting times for ${platform} for a ${niche} creator posting ${contentType} content targeting ${region}.

Return ONLY valid JSON — no markdown:
{
  "weekData": [[scores for Mon 0-23h], [Tue], [Wed], [Thu], [Fri], [Sat], [Sun]],
  "topSlots": [
    {"day": "Tuesday", "time": "10:00 AM", "score": 95, "reason": "Peak lunch break engagement"},
    {"day": "Thursday", "time": "7:00 PM", "score": 92, "reason": "Evening scroll time"},
    {"day": "Wednesday", "time": "12:00 PM", "score": 88, "reason": "Midday break"},
    {"day": "Saturday", "time": "9:00 AM", "score": 85, "reason": "Weekend morning browsing"},
    {"day": "Monday", "time": "8:00 PM", "score": 82, "reason": "End of day wind-down"}
  ],
  "tips": [
    "Platform-specific algorithm tip 1",
    "Tip about content type optimization",
    "Tip about audience behavior"
  ]
}

Rules for weekData:
- 7 arrays (Mon-Sun), each with 24 integers (hours 0-23), scores 0-100
- Reflect real engagement patterns for ${platform} and ${niche}
- Weekend patterns should differ from weekdays
- topSlots must have exactly 5 items, sorted by score descending`

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      system: 'You are a social media timing expert. Output only valid JSON.',
      messages: [{ role: 'user', content: prompt }],
    })

    const content = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content)

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    return NextResponse.json({ platform, ...parsed })
  } catch (error) {
    console.error('Best times generation error:', error)
    return NextResponse.json({ error: 'Failed to analyze posting times. Please try again.' }, { status: 500 })
  }
}
