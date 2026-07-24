import { NextResponse } from 'next/server'
import { checkAuthAndUsage, incrementUsage, reserveCredits, refundCredits } from '@/lib/auth-usage'
import { crispGenerate } from '@/lib/crisp-engine'
import { parseLooseJson } from '@/lib/safe-json'
import { loadVoicePromptSnippet } from '@/lib/voice-profile'

// Vercel function timeout. Default 60s on Pro plan; AI calls (especially
// Opus on long outputs) regularly hit 30-60s with variance to ~90s. 120s
// gives headroom while bounding the worst case.
export const maxDuration = 120

export interface ScriptResult {
  hook: string
  intro: string
  sections: { timestamp: string; title: string; body: string; bRoll?: string }[]
  cta: string
  outro: string
  estimatedReadTime: string
  wordCount: number
}

export async function POST(request: Request) {
  const auth = await checkAuthAndUsage('script')
  if (!auth.ok) return auth.response

  const body = await request.json()
  const { topic, platform, length, tone, audience, keyPoints } = body

  if (!topic?.trim() || !platform || !length) {
    return NextResponse.json({ error: 'Topic, platform, and length are required.' }, { status: 400 })
  }

  const prompt = `You are a professional video scriptwriter for ${platform}.

Write a ${length} script about "${topic}".
Tone: ${tone || 'casual and engaging'}
Target audience: ${audience || 'general viewers'}
${keyPoints ? `Key points to cover:\n${keyPoints}\n` : ''}

Return ONLY valid JSON — no markdown:
{
  "hook": "A 3-second attention-grabber spoken on camera. Pattern-interrupting, curiosity-driven.",
  "intro": "Brief intro setting up the video (5-10 seconds). Reinforces what the viewer will get.",
  "sections": [
    {
      "timestamp": "0:15",
      "title": "Section title",
      "body": "What the host says during this section — natural spoken language, not formal prose",
      "bRoll": "Suggested B-roll or visual during this section (e.g., 'close-up of product', 'screen recording of app')"
    }
  ],
  "cta": "Clear call to action near the end (subscribe, follow, comment, click link in bio).",
  "outro": "Brief sign-off that invites the next video/post.",
  "estimatedReadTime": "${length}",
  "wordCount": 0
}

Rules:
- Split the main content into 3-6 sections with timestamps that progress through the target length
- Each section's body is HOST-SPOKEN copy — natural, not written-article tone
- Include [stage directions in brackets] sparingly where helpful
- Hook must grab attention in first 3 seconds — specific to the topic, not generic ("today I'll tell you about...")
- bRoll suggestions are short phrases, not full sentences
- wordCount: actual spoken word count across hook + intro + sections + cta + outro`

  try {
    const denied = await reserveCredits(auth)
    if (denied) return denied

    const voiceSnippet = await loadVoicePromptSnippet(auth.supabase, auth.userId)
    const { text, totalTokens } = await crispGenerate({
      task: 'script',
      tier: auth.tier,
      voiceSnippet,
      prompt,
      maxTokens: 3000,
    })

    const parsed = parseLooseJson<ScriptResult>(text)

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'script',
      platform,
      input_data: { topic, length, tone, audience, keyPoints },
      output_data: parsed,
      tokens_used: totalTokens,
    })

    return NextResponse.json(parsed)
  } catch (error) {
    await refundCredits(auth)
    console.error('Script generation error:', error)
    return NextResponse.json({ error: 'Failed to generate script. Please try again.' }, { status: 500 })
  }
}
