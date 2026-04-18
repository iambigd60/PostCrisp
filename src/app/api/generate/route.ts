import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { checkAuthAndUsage, incrementUsage, CLAUDE_MODEL } from '@/lib/auth-usage'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

export async function POST(request: Request) {
  const auth = await checkAuthAndUsage()
  if (!auth.ok) return auth.response

  const body = await request.json()
  const { topic, platform, tone } = body

  if (!topic || !platform || !tone) {
    return NextResponse.json({ error: 'Please fill in all fields: topic, platform, and tone.' }, { status: 400 })
  }

  const platformLimits: Record<string, string> = {
    instagram: 'optimal 125-150 chars, max 2200',
    tiktok: 'optimal 80-100 chars, max 4000',
    youtube: 'description optimal 150-300 chars',
    x: 'max 280 chars',
    facebook: 'optimal 40-80 chars',
    threads: 'max 500 chars',
  }

  const prompt = `You are an expert social media content creator. Generate 5 distinct caption variations for a ${platform} post about "${topic}".
Tone: ${tone}
Platform character guidance: ${platformLimits[platform] || 'keep it concise'}

Requirements:
- Vary the style: include short punchy options and longer storytelling options
- Include a strong hook in the first line of each caption
- Add relevant emojis naturally (don't force them)
- Include a call-to-action where appropriate
- Respect platform character limits

Return ONLY valid JSON with this structure — no markdown:
{"captions": ["caption 1", "caption 2", "caption 3", "caption 4", "caption 5"]}`

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      system: 'You are a social media expert. Output only valid JSON.',
      messages: [{ role: 'user', content: prompt }],
    })

    const content = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content)
    const captions: string[] = parsed.captions || []

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    return NextResponse.json({ captions, platform, tone, generatedAt: new Date().toISOString() })
  } catch (error) {
    console.error('Caption generation error:', error)
    return NextResponse.json({ error: 'Failed to generate captions. Please try again.' }, { status: 500 })
  }
}
