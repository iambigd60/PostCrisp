import { NextResponse } from 'next/server'
import { checkAuthAndUsage, incrementUsage } from '@/lib/auth-usage'
import { crispGenerate } from '@/lib/crisp-engine'
import { parseLooseJson } from '@/lib/safe-json'
import { consumeCredits } from '@/lib/credits'
import { validateInputs } from '@/lib/input-limits'
import { loadVoicePromptSnippet } from '@/lib/voice-profile'

// Vercel function timeout. Default 60s on Pro plan; AI calls (especially
// Opus on long outputs) regularly hit 30-60s with variance to ~90s. 120s
// gives headroom while bounding the worst case.
export const maxDuration = 120

export interface ReplyResult {
  short: string
  medium: string
  detailed: string
}

export async function POST(request: Request) {
  const auth = await checkAuthAndUsage('comment-reply')
  if (!auth.ok) return auth.response

  const body = await request.json()
  const { comment, postContext, replyTone, replyGoal } = body

  if (!comment?.trim()) {
    return NextResponse.json({ error: 'Comment is required.' }, { status: 400 })
  }

  const sizeError = validateInputs([[comment, 'comment'], [postContext, 'topic']])
  if (sizeError) return sizeError

  const prompt = `You are an expert at engaging replies that feel authentic and drive algorithm engagement.

Original post context: ${postContext || 'not provided'}
Incoming comment: """${comment}"""

Tone: ${replyTone || 'friendly'}
Goal: ${replyGoal || 'Build relationship'}

Return THREE reply options — short (1 sentence), medium (2-3 sentences), detailed (3-5 sentences).
Each should:
- Feel authentic, not canned
- Include a follow-up question or hook to encourage further engagement (the comment reply algorithm boost needs a reply chain)
- Never start with "Thanks for commenting" or similar cliches

Return ONLY valid JSON:
{
  "short": "...",
  "medium": "...",
  "detailed": "..."
}`

  try {
    const voiceSnippet = await loadVoicePromptSnippet(auth.supabase, auth.userId)
    const { text, totalTokens } = await crispGenerate({
      task: 'comment-reply',
      tier: auth.tier,
      voiceSnippet,
      prompt,
      maxTokens: 1200,
    })

    const parsed = parseLooseJson<ReplyResult>(text)

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'comment_reply',
      platform: null,
      input_data: { comment: comment.slice(0, 500), postContext, replyTone, replyGoal },
      output_data: parsed,
      tokens_used: totalTokens,
    })

    await consumeCredits(auth.supabase, auth.userId, auth.creditCost, 'comment-reply')

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Comment reply error:', error)
    return NextResponse.json({ error: 'Failed to generate replies. Please try again.' }, { status: 500 })
  }
}
