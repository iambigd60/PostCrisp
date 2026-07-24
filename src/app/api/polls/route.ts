import { NextResponse } from 'next/server'
import { checkAuthAndUsage, incrementUsage, reserveCredits, refundCredits } from '@/lib/auth-usage'
import { crispGenerate } from '@/lib/crisp-engine'
import { parseLooseJson } from '@/lib/safe-json'
import { loadVoicePromptSnippet } from '@/lib/voice-profile'

// Vercel function timeout. Default 60s on Pro plan; AI calls (especially
// Opus on long outputs) regularly hit 30-60s with variance to ~90s. 120s
// gives headroom while bounding the worst case.
export const maxDuration = 120

export interface Poll {
  question: string
  format: 'this-or-that' | 'quiz' | 'open-question' | 'rating-scale' | 'emoji-slider' | 'ama-prompt'
  options?: string[]
  correctAnswer?: string
  expectedEngagement: 'Low' | 'Medium' | 'High'
}

export async function POST(request: Request) {
  const auth = await checkAuthAndUsage('polls')
  if (!auth.ok) return auth.response

  const body = await request.json()
  const { niche, platform, engagementType, count } = body

  if (!niche?.trim()) {
    return NextResponse.json({ error: 'Niche is required.' }, { status: 400 })
  }

  const safeCount = Math.min(Math.max(Number(count) || 8, 5), 15)

  const prompt = `Generate ${safeCount} engaging poll/question prompts for Stories on ${platform || 'Instagram Stories'}.

Niche: ${niche}
Engagement type: ${engagementType || 'mixed — vary the format'}

Return ONLY valid JSON:
{
  "polls": [
    {
      "question": "The question text",
      "format": "this-or-that",
      "options": ["Option A", "Option B"],
      "correctAnswer": "Only for quiz format",
      "expectedEngagement": "High"
    }
  ]
}

Rules:
- "format" must be one of: this-or-that, quiz, open-question, rating-scale, emoji-slider, ama-prompt
- "options" required for this-or-that (exactly 2) and quiz (3-4). Absent for other formats.
- "correctAnswer" ONLY for quiz format
- Vary formats across the set unless user specifically asked for one type
- Each question should be niche-specific and genuinely interesting to answer`

  try {
    const denied = await reserveCredits(auth)
    if (denied) return denied

    const voiceSnippet = await loadVoicePromptSnippet(auth.supabase, auth.userId)
    const { text, totalTokens } = await crispGenerate({
      task: 'polls',
      tier: auth.tier,
      voiceSnippet,
      prompt,
      maxTokens: 2500,
    })

    const parsed = parseLooseJson<{ polls: Poll[] }>(text)
    const polls = parsed.polls ?? []

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'polls',
      platform,
      input_data: { niche, engagementType, count: safeCount },
      output_data: { polls },
      tokens_used: totalTokens,
    })

    return NextResponse.json({ polls })
  } catch (error) {
    await refundCredits(auth)
    console.error('Polls error:', error)
    return NextResponse.json({ error: 'Failed to generate polls. Please try again.' }, { status: 500 })
  }
}
