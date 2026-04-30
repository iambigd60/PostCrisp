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

export interface RepurposedItem {
  targetPlatform: string
  content: string
  hashtags?: string[]
  notes?: string
}

export async function POST(request: Request) {
  const auth = await checkAuthAndUsage('repurpose', { request })
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

  let text = ''
  let totalTokens = 0
  try {
    const voiceSnippet = await loadVoicePromptSnippet(auth.supabase, auth.userId)
    const result = await crispGenerate({
      task: 'repurpose',
      tier: auth.tier,
      voiceSnippet,
      prompt,
      // Bumped 4000 → 5000. Output scales with targetPlatforms.length × per-platform variant; tight at 4000 for 4+ platforms.
      maxTokens: 5000,
    })
    text = result.text
    totalTokens = result.totalTokens
  } catch (error) {
    console.error('Repurpose — model call failed:', error)
    return NextResponse.json({ error: 'AI provider error. Please try again in a moment.' }, { status: 502 })
  }

  let items: RepurposedItem[]
  try {
    const parsed = parseLooseJson<{ items: RepurposedItem[] }>(text)
    items = parsed.items ?? []
  } catch (error) {
    console.error('Repurpose — JSON parse failed. First 500 chars:', text.slice(0, 500), error)
    return NextResponse.json({ error: 'AI returned malformed output. Please try again.' }, { status: 502 })
  }

  if (!Array.isArray(items) || items.length === 0) {
    console.error('Repurpose — empty/invalid items array. Preview:', text.slice(0, 300))
    return NextResponse.json({ error: 'AI returned no repurposed items. Please try again.' }, { status: 502 })
  }

  try {
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
  } catch (error) {
    console.error('Repurpose — persistence failed (non-fatal):', error)
  }

  return NextResponse.json({ items })
}
