import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { checkAuthAndUsage, incrementUsage, CLAUDE_MODEL } from '@/lib/auth-usage'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

// Split N hashtags across 3 categories based on mix (0=popular-heavy, 1=niche-heavy)
function splitCounts(total: number, mix: number): { high: number; medium: number; low: number } {
  // At mix=0:   60/30/10
  // At mix=0.5: 33/34/33
  // At mix=1:   10/30/60
  const highPct = 0.60 - 0.50 * mix
  const lowPct  = 0.10 + 0.50 * mix
  let high = Math.round(total * highPct)
  let low  = Math.round(total * lowPct)
  let medium = total - high - low
  if (medium < 1) { medium = 1; if (high > 1) high--; else low--; }
  return { high, medium, low }
}

export async function GET(request: Request) {
  const auth = await checkAuthAndUsage()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const platform = searchParams.get('platform') || 'instagram'
  const countParam = parseInt(searchParams.get('count') || '20', 10)
  const mixParam = parseFloat(searchParams.get('mix') || '0.5')

  if (!query) {
    return NextResponse.json({ error: 'Please provide a search query.' }, { status: 400 })
  }

  const count = Math.max(10, Math.min(30, isNaN(countParam) ? 20 : countParam))
  const mix = Math.max(0, Math.min(1, isNaN(mixParam) ? 0.5 : mixParam))
  const { high, medium, low } = splitCounts(count, mix)

  const prompt = `You are a social media growth expert. For the topic "${query}" on ${platform}, generate exactly ${count} relevant hashtags.

Categorize them into 3 groups:
- HIGH_REACH: ${high} hashtags — popular, millions of posts, broad audience, high competition
- MEDIUM_REACH: ${medium} hashtags — moderate competition, good discovery potential
- LOW_COMPETITION: ${low} hashtags — niche, targeted, easier to rank on, smaller but more engaged audiences

Return ONLY valid JSON — no markdown:
{
  "hashtags": [
    {"tag": "#example", "score": 85, "posts": "1.2M", "category": "HIGH_REACH"}
  ]
}

Rules:
- Include the # symbol
- "score" is 0-100 relevance/popularity
- "posts" is estimated post count as a string like "1.2M", "500K", "28K"
- Make hashtags genuinely relevant to "${query}" on ${platform}
- Avoid shadowbanned or overly generic hashtags
- Return EXACTLY ${count} total hashtags split ${high}/${medium}/${low}
- Sort each group by score descending`

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      system: 'You are a hashtag research expert. Output only valid JSON.',
      messages: [{ role: 'user', content: prompt }],
    })

    const content = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content)
    const hashtags = parsed.hashtags || []

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'hashtags',
      platform,
      input_data: { query, count, mix },
      output_data: { hashtags },
      tokens_used: response.usage.input_tokens + response.usage.output_tokens,
    })

    return NextResponse.json({ hashtags, query, platform, count, mix })
  } catch (error) {
    console.error('Hashtag generation error:', error)
    return NextResponse.json({ error: 'Failed to find hashtags. Please try again.' }, { status: 500 })
  }
}
