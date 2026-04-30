import { NextResponse } from 'next/server'
import { checkAuthAndUsage, incrementUsage } from '@/lib/auth-usage'
import { crispGenerate } from '@/lib/crisp-engine'
import { parseLooseJson } from '@/lib/safe-json'
import { consumeCredits } from '@/lib/credits'
import { loadVoicePromptSnippet } from '@/lib/voice-profile'

// Vercel function timeout. Default 60s on Pro plan; AI calls (especially
// Opus on long outputs) regularly hit 30-60s with variance to ~90s. 120s
// gives headroom while bounding the worst case.
export const maxDuration = 120

export interface CTAOption {
  cta: string
  placement: 'opening' | 'middle' | 'closing' | 'caption-end'
  reasoning: string
  expectedLift: 'high' | 'medium' | 'low'
  matchScore: number
}

export interface CTAOptimizerResult {
  recommended: CTAOption
  alternatives: CTAOption[]
  patterns: { name: string; description: string }[]
  warnings?: string[]
}

const ALLOWED_GOALS = new Set([
  'clicks',          // drive clicks to a link
  'comments',        // engagement comments
  'follows',         // get followers
  'shares',          // shares / reposts
  'signups',         // newsletter / waitlist signup
  'purchases',       // direct purchase intent
  'dms',             // start a DM conversation
  'other',           // free-text fallback
])

const MAX_CONTENT_LEN = 8000

export async function POST(request: Request) {
  const auth = await checkAuthAndUsage('cta-optimizer', { request })
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({}))
  const {
    content,
    platform,
    goal,
    goalDetail,
    audience,
    linkUrl,
  }: {
    content?: string
    platform?: string
    goal?: string
    goalDetail?: string
    audience?: string
    linkUrl?: string
  } = body

  if (!content?.trim()) {
    return NextResponse.json({ error: 'Source content is required.' }, { status: 400 })
  }
  if (content.length > MAX_CONTENT_LEN) {
    return NextResponse.json(
      { error: `Content too long (max ${MAX_CONTENT_LEN.toLocaleString()} chars).` },
      { status: 400 },
    )
  }
  if (!platform?.trim()) {
    return NextResponse.json({ error: 'Platform is required.' }, { status: 400 })
  }
  if (!goal || !ALLOWED_GOALS.has(goal)) {
    return NextResponse.json({ error: 'Invalid goal.' }, { status: 400 })
  }

  const goalLine = goal === 'other' && goalDetail?.trim()
    ? `Goal: ${goalDetail.trim()}`
    : `Goal: ${goal}`

  const prompt = `Generate a recommended CTA + 4 alternatives + 3 patterns for this content.

Platform: ${platform}
${goalLine}
${audience?.trim() ? `Audience: ${audience.trim()}` : ''}
${linkUrl?.trim() ? `Destination link: ${linkUrl.trim()}` : ''}

Source content:
"""
${content.trim()}
"""

Return ONLY valid JSON in this exact shape:
{
  "recommended": {
    "cta": "Ready-to-paste CTA text",
    "placement": "opening | middle | closing | caption-end",
    "reasoning": "1-2 sentences on why this wins",
    "expectedLift": "high | medium | low",
    "matchScore": 1-10
  },
  "alternatives": [
    { "cta": "...", "placement": "...", "reasoning": "...", "expectedLift": "...", "matchScore": N },
    ... (4 total — vary in approach: direct / curiosity / question / social-proof / urgency)
  ],
  "patterns": [
    { "name": "Pattern name", "description": "When to reach for this pattern next time" },
    ... (3 total)
  ],
  "warnings": ["Optional red flags about the source content that hurt CTA performance"]
}

Rules:
- Reference the user's actual content + goal in reasoning.
- CTA values must be ready-to-paste — no [bracketed placeholders] unless the user asked.
- Vary the 4 alternatives across approaches. No near-duplicates.
- matchScore reflects platform-convention match (1=mismatch, 10=perfect fit for ${platform}).
- expectedLift is qualitative ("high"/"medium"/"low") — not a fake percentage.
- warnings is optional. Include only if the source content has CONCRETE structural issues hurting conversion.`

  // Phase 1: model call
  let text = ''
  let totalTokens = 0
  try {
    const voiceSnippet = await loadVoicePromptSnippet(auth.supabase, auth.userId)
    const result = await crispGenerate({
      task: 'cta-optimizer',
      tier: auth.tier,
      voiceSnippet,
      prompt,
      maxTokens: 2500,
    })
    text = result.text
    totalTokens = result.totalTokens
  } catch (error) {
    console.error('CTA optimizer — model call failed:', error)
    return NextResponse.json({ error: 'AI provider error. Please try again in a moment.' }, { status: 502 })
  }

  // Phase 2: parse
  let parsed: CTAOptimizerResult
  try {
    parsed = parseLooseJson<CTAOptimizerResult>(text)
  } catch (error) {
    console.error('CTA optimizer — JSON parse failed. First 500 chars:', text.slice(0, 500), error)
    return NextResponse.json({ error: 'AI returned malformed output. Please try again.' }, { status: 502 })
  }

  // Phase 3: shape validation
  if (!parsed?.recommended?.cta || !Array.isArray(parsed.alternatives) || !Array.isArray(parsed.patterns)) {
    console.error('CTA optimizer — unexpected shape:', { keys: Object.keys(parsed ?? {}), preview: text.slice(0, 300) })
    return NextResponse.json({ error: 'AI returned an unexpected response. Please try again.' }, { status: 502 })
  }

  // Phase 4: persistence — non-fatal
  try {
    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)
    await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'cta_optimizer',
      platform,
      input_data: {
        platform,
        goal,
        goalDetail: goalDetail ?? null,
        audience: audience ?? null,
        linkUrl: linkUrl ?? null,
        contentLength: content.length,
      },
      output_data: parsed,
      tokens_used: totalTokens,
    })
    await consumeCredits(auth.supabase, auth.userId, auth.creditCost, 'cta-optimizer')
  } catch (error) {
    console.error('CTA optimizer — persistence failed (non-fatal):', error)
  }

  return NextResponse.json(parsed)
}
