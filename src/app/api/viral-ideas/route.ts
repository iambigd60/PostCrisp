import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { checkAuthAndUsage, incrementUsage, CLAUDE_MODEL } from '@/lib/auth-usage'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

export interface ViralIdea {
  title: string
  whyViral: string
  format: string
  platform: string
  difficulty: 'Easy' | 'Medium' | 'Advanced'
  hook: string
  outline: string[]
  hashtags: string[]
  bestTime: string
  engagement: 'Low' | 'Medium' | 'High' | 'Viral Potential'
}

export async function POST(request: Request) {
  const auth = await checkAuthAndUsage()
  if (!auth.ok) return auth.response

  const body = await request.json()
  const {
    niche,
    platforms = ['Instagram', 'TikTok'],
    formats = ['Video', 'Carousel'],
    trendSource = 'Current Trends',
    audience = 'general audience',
    count = 10,
  } = body

  if (!niche?.trim()) {
    return NextResponse.json({ error: 'Niche is required.' }, { status: 400 })
  }

  const safeCount = Math.min(Math.max(Number(count) || 10, 5), 15)

  const prompt = `You are a viral content strategist with deep knowledge of social media algorithms.

Generate ${safeCount} specific, actionable viral content ideas for a creator in the "${niche}" niche.

Platform focus: ${platforms.join(', ')}
Preferred formats: ${formats.join(', ')}
Content angle: ${trendSource}
Target audience: ${audience}

Return ONLY a valid JSON object with this exact structure — no markdown, no explanation:
{
  "ideas": [
    {
      "title": "Specific, catchy headline — not generic",
      "whyViral": "1-2 sentences on why this specific idea has strong viral potential",
      "format": "Video",
      "platform": "TikTok",
      "difficulty": "Easy",
      "hook": "The exact opening line or visual hook for the first 3 seconds",
      "outline": ["Intro hook", "Main point 1", "Main point 2", "Main point 3", "CTA"],
      "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
      "bestTime": "Tuesday-Thursday, 7-9pm",
      "engagement": "High"
    }
  ]
}

Rules:
- "format" must be one of: Video, Carousel, Photo, Text Post, Story, Live
- "difficulty" must be: Easy, Medium, or Advanced
- "engagement" must be: Low, Medium, High, or Viral Potential
- Make ideas SPECIFIC to the niche — avoid generic platitudes
- Vary difficulty and format across ideas
- Each idea must have exactly 5 outline points and 5-8 hashtags`

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      system: 'You are a viral content expert. Output only valid JSON, no markdown.',
      messages: [{ role: 'user', content: prompt }],
    })

    const content = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content)
    const ideas: ViralIdea[] = parsed.ideas || []

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    return NextResponse.json({ ideas, generatedAt: new Date().toISOString() })
  } catch (error) {
    console.error('Viral ideas generation error:', error)
    return NextResponse.json({ error: 'Failed to generate ideas. Please try again.' }, { status: 500 })
  }
}
