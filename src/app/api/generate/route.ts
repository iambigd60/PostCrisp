import { NextResponse } from 'next/server'
import { checkAuthAndUsage, incrementUsage } from '@/lib/auth-usage'
import { crispGenerate } from '@/lib/crisp-engine'
import { parseLooseJson } from '@/lib/safe-json'
import { consumeCredits } from '@/lib/credits'
import { loadVoicePromptSnippet } from '@/lib/voice-profile'
import { isInActiveTutorial } from '@/lib/tutorial-bypass'

const platformLimits: Record<string, string> = {
  instagram: 'optimal 125-150 chars, max 2,200',
  tiktok:    'optimal 80-100 chars, max 4,000',
  youtube:   'description optimal 150-300 chars, max 5,000',
  x:         'max 280 chars',
  facebook:  'optimal 40-80 chars',
  threads:   'max 500 chars',
  linkedin:  'optimal 150-200 chars, max 3,000',
}

const contentTypeGuidance: Record<string, string> = {
  'post':          'standard feed caption — attention-grabbing opener, value in the middle, clear CTA at the end',
  'reel-hook':     'short punchy hook designed for the first 3 seconds of a short-form vertical video — pattern-interrupting, curiosity-driven, under 80 characters ideal',
  'story':         'casual, conversational, designed to invite quick engagement (tap, reply, swipe up) — keep very short',
  'thread-opener': 'opening post of a thread — irresistible hook that makes readers click "show more" or expand the thread',
  'script-hook':   'opening line of a video script — spoken out loud, hooks viewer in first 3 seconds, under 60 chars',
}

export async function POST(request: Request) {
  const body = await request.json()
  const {
    topic,
    platform,
    tone,
    contentType = 'post',
    audience,
    count = 5,
    avoid,
    tutorialMode,
  }: {
    topic?: string
    platform?: string
    tone?: string
    contentType?: string
    audience?: string
    count?: number
    avoid?: string[]
    tutorialMode?: boolean
  } = body

  // Tutorial mode: PostCrisp absorbs the credit + tier cost so testers
  // finish onboarding with their starter credits intact. Server-validated.
  let allowBypass = false
  if (tutorialMode) {
    const supabase = (await import('@/utils/supabase/server')).createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) allowBypass = await isInActiveTutorial(supabase, user.id)
  }

  const auth = await checkAuthAndUsage('captions', {
    bypassCredits: allowBypass,
    bypassFeatureGate: allowBypass,
  })
  if (!auth.ok) return auth.response

  if (!topic || !platform || !tone) {
    return NextResponse.json({ error: 'Please fill in all fields: topic, platform, and tone.' }, { status: 400 })
  }

  const safeCount = Math.max(1, Math.min(10, count))
  const avoidList = Array.isArray(avoid) && avoid.length > 0
    ? `\n\nIMPORTANT: Do NOT repeat or paraphrase any of these existing captions — the user already has them:\n${avoid.map((c, i) => `${i + 1}. ${c.slice(0, 200)}`).join('\n')}\nGenerate completely different angles and approaches.`
    : ''

  const audienceLine = audience ? `Target audience: ${audience}\n` : ''

  const prompt = `You are an expert social media content creator. Generate ${safeCount} distinct caption ${safeCount === 1 ? 'variation' : 'variations'} for a ${platform} ${contentType} about "${topic}".

Tone: ${tone}
${audienceLine}Content type guidance: ${contentTypeGuidance[contentType] || contentTypeGuidance.post}
Platform character guidance: ${platformLimits[platform] || 'keep it concise'}${avoidList}

Requirements:
- Vary the style across the ${safeCount} options — include short punchy options and longer storytelling options
- Include a strong hook in the first line of each caption
- Add relevant emojis naturally (don't force them)
- Include a call-to-action where appropriate
- Respect platform character limits

Return ONLY valid JSON with this structure — no markdown:
{"captions": [${Array.from({ length: safeCount }, (_, i) => `"caption ${i + 1}"`).join(', ')}]}`

  try {
    const voiceSnippet = await loadVoicePromptSnippet(auth.supabase, auth.userId)
    const { text, totalTokens } = await crispGenerate({
      task: 'captions',
      tier: auth.tier,
      voiceSnippet,
      prompt,
      maxTokens: 2000,
    })

    const parsed = parseLooseJson<{ captions?: string[] }>(text)
    const captions: string[] = parsed.captions || []

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'captions',
      platform,
      input_data: { topic, tone, contentType, audience: audience ?? null, count: safeCount },
      output_data: { captions },
      tokens_used: totalTokens,
    })

    await consumeCredits(auth.supabase, auth.userId, auth.creditCost, 'captions')

    return NextResponse.json({ captions, platform, tone, contentType, generatedAt: new Date().toISOString() })
  } catch (error) {
    console.error('Caption generation error:', error)
    return NextResponse.json({ error: 'Failed to generate captions. Please try again.' }, { status: 500 })
  }
}
