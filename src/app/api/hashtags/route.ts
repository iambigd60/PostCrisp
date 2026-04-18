import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { checkAuthAndUsage, incrementUsage, CLAUDE_MODEL } from '@/lib/auth-usage'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

export async function GET(request: Request) {
  const auth = await checkAuthAndUsage()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: 'Please provide a search query.' }, { status: 400 })
  }

  const prompt = `You are a social media growth expert. For the topic "${query}", generate exactly 15 relevant hashtags.

Categorize them into 3 groups:
- HIGH_REACH: 5 hashtags — popular, millions of posts, broad audience
- MEDIUM_REACH: 5 hashtags — moderate competition, good discovery
- LOW_COMPETITION: 5 hashtags — niche, targeted, lower competition

Return ONLY valid JSON — no markdown:
{
  "hashtags": [
    {"tag": "#example", "score": 85, "posts": "1.2M", "category": "HIGH_REACH"},
    ...
  ]
}

Rules:
- Include the # symbol
- "score" is 0-100 relevance/popularity
- "posts" is estimated post count as a string like "1.2M", "500K"
- Make hashtags genuinely relevant to "${query}"
- Avoid shadowbanned or overly generic hashtags`

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      system: 'You are a hashtag research expert. Output only valid JSON.',
      messages: [{ role: 'user', content: prompt }],
    })

    const content = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content)

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    return NextResponse.json({ hashtags: parsed.hashtags || [], query })
  } catch (error) {
    console.error('Hashtag generation error:', error)
    return NextResponse.json({ error: 'Failed to find hashtags. Please try again.' }, { status: 500 })
  }
}
