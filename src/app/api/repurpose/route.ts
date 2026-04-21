import { NextResponse } from 'next/server'
import { checkAuthAndUsage, incrementUsage } from '@/lib/auth-usage'
import { crispGenerate } from '@/lib/crisp-engine'
import { parseLooseJson } from '@/lib/safe-json'
import { consumeCredits } from '@/lib/credits'
import { validateInputs } from '@/lib/input-limits'
import { loadVoicePromptSnippet } from '@/lib/voice-profile'

export interface RepurposedItem {
  targetPlatform: string
  content: string
  hashtags?: string[]
  notes?: string
}

export async function POST(request: Request) {
  const auth = await checkAuthAndUsage('repurpose')
  if (!auth.ok) return auth.response

  const body = await request.json()
  const { source, sourceType, targetPlatforms, toneAdjustment } = body

  if (!source?.trim() || !Array.isArray(targetPlatforms) || targetPlatforms.length === 0) {
    return NextResponse.json({ error: 'Source content and at least one target platform are required.' }, { status: 400 })
  }

  const sizeError = validateInputs([[source, 'longFormSource']])
  if (sizeError) return sizeError

  const prompt = `You are a content-repurposing expert. Transform the same idea into native content for each target platform — never just truncate or reformat.

SOURCE CONTENT (${sourceType || 'long-form content'}):
"""
${source.slice(0, 8000)}
"""

Target platforms: ${targetPlatforms.join(', ')}
${toneAdjustment ? `Tone adjustment: ${toneAdjustment}` : ''}

For each platform, generate content that would feel native there — respecting character limits, idiomatic format (hooks for video scripts, threads for X, etc.), and audience expectations.

Return ONLY valid JSON:
{
  "items": [
    {
      "targetPlatform": "Instagram Post",
      "content": "Full platform-optimized content including line breaks as \\n",
      "hashtags": ["#tag1", "#tag2"],
      "notes": "Quick note about why this version works for the platform"
    }
  ]
}

Rules:
- Each item MUST be a unique rewrite, not a truncated copy
- Match each platform's voice: X Threads are punchy + short posts, LinkedIn is insight-driven, TikTok caption teases video content, Instagram caption has hook + payoff + CTA, YouTube description has keywords + timestamps placeholder, Facebook is conversational
- Respect character limits: IG 2200 / TikTok 4000 / X 280 per post (thread = array of <=280-char posts joined with \\n) / LinkedIn 3000 / Facebook 500 / Threads 500 / YouTube description 5000
- hashtags: 5-15 for IG/TikTok, 0-3 for X/LinkedIn/Facebook/Threads
- notes: optional 1-sentence reason this version fits the platform`

  try {
    const voiceSnippet = await loadVoicePromptSnippet(auth.supabase, auth.userId)
    const { text, totalTokens } = await crispGenerate({
      task: 'repurpose',
      tier: auth.tier,
      voiceSnippet,
      prompt,
      maxTokens: 4000,
    })

    const parsed = parseLooseJson<{ items: RepurposedItem[] }>(text)
    const items = parsed.items ?? []

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'repurpose',
      platform: targetPlatforms[0] ?? null,
      input_data: { sourceType, targetPlatforms, toneAdjustment, sourceLength: source.length },
      output_data: { items },
      tokens_used: totalTokens,
    })

    await consumeCredits(auth.supabase, auth.userId, auth.creditCost, 'repurpose')

    return NextResponse.json({ items })
  } catch (error) {
    console.error('Repurpose error:', error)
    return NextResponse.json({ error: 'Failed to repurpose content. Please try again.' }, { status: 500 })
  }
}
