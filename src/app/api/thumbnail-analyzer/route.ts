import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { checkAuthAndUsage, incrementUsage } from '@/lib/auth-usage'
import { parseLooseJson } from '@/lib/safe-json'
import { consumeCredits } from '@/lib/credits'
import { effectiveTier, DEFAULT_PROFILE_CONFIG, TASK_TIER_PROFILE } from '@/lib/crisp-engine-config'
import { systemPromptFor } from '@/lib/system-prompts'

export interface ThumbnailAnalysisResult {
  clickPrediction: { score: number; reasoning: string }
  visualHierarchy: string
  textLegibility: { issues: string[]; score: number }
  emotionalHook: string
  subjectFraming: string
  colorContrast: string
  platformFit: string
  strengths: string[]
  improvements: { priority: 'high' | 'medium' | 'low'; change: string; why: string }[]
}

const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

// Claude's image limit is 5 MB. Base64 inflates by ~33%, so we cap the
// raw payload at ~6.7 MB to stay safely under the limit before decoding.
// Verified against Anthropic's vision-API documentation.
const MAX_BASE64_BYTES = 7_000_000

let _anthropic: Anthropic | undefined
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
  return _anthropic
}

export async function POST(request: Request) {
  const auth = await checkAuthAndUsage('thumbnail-analyzer', { request })
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({}))
  const {
    imageBase64,
    mediaType,
    platform,
    topic,
    audience,
  }: {
    imageBase64?: string
    mediaType?: string
    platform?: string
    topic?: string
    audience?: string
  } = body

  // ─── Validation ────────────────────────────────────────────────────
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return NextResponse.json({ error: 'Image is required.' }, { status: 400 })
  }
  if (!mediaType || !ALLOWED_MEDIA_TYPES.has(mediaType)) {
    return NextResponse.json(
      { error: 'Unsupported image type. Use JPEG, PNG, WebP, or GIF.' },
      { status: 400 },
    )
  }
  if (imageBase64.length > MAX_BASE64_BYTES) {
    return NextResponse.json(
      { error: 'Image too large. Maximum 5 MB.' },
      { status: 400 },
    )
  }
  if (!platform || typeof platform !== 'string') {
    return NextResponse.json({ error: 'Platform is required.' }, { status: 400 })
  }

  // ─── Resolve model from tier profile (Sonnet for most, Opus for Elite) ──
  // We don't go through crispGenerate here because the helper doesn't yet
  // accept image content blocks. Calling Anthropic SDK directly with the
  // same provider/model resolution we'd otherwise use.
  const cfgTier = effectiveTier(auth.tier)
  const profile = TASK_TIER_PROFILE['thumbnail-analyzer'][cfgTier]
  const { provider, model } = DEFAULT_PROFILE_CONFIG[profile]

  if (provider !== 'anthropic') {
    // OpenAI also supports vision, but we anchor on Anthropic for v1 image
    // quality. If/when we wire OpenAI vision, this branch picks it up.
    return NextResponse.json(
      { error: 'Vision provider not configured for this tier.' },
      { status: 500 },
    )
  }

  const userPrompt = `Analyze this thumbnail / hero image for a ${platform} post or video.

${topic ? `Topic / what it's about: ${topic}\n` : ''}${audience ? `Target audience: ${audience}\n` : ''}
Return ONLY valid JSON — no markdown fences, no commentary:
{
  "clickPrediction": {
    "score": <1-10>,
    "reasoning": "1-2 sentences on whether this would stop someone scrolling and why"
  },
  "visualHierarchy": "where the eye lands first, second, third — describe the path",
  "textLegibility": {
    "score": <1-10>,
    "issues": ["specific legibility issues — empty array if none"]
  },
  "emotionalHook": "what feeling/curiosity/tension the image creates (or fails to)",
  "subjectFraming": "framing critique — rule of thirds, headroom, focal point",
  "colorContrast": "subject vs background contrast critique",
  "platformFit": "does this work at ${platform}'s typical thumbnail size + context",
  "strengths": [
    "2-3 specific things working well — empty array if nothing"
  ],
  "improvements": [
    {
      "priority": "high",
      "change": "specific concrete change",
      "why": "what it fixes / what behavior it'll trigger"
    }
  ]
}

Rules:
- Be SPECIFIC. Reference what you see in the image — colors, text, faces, composition.
- "Increase text size" is bad. "Bump 'My First Million' from ~24% to 40% of frame width" is good.
- Score legibility against ${platform}'s typical thumbnail size (YouTube ~240px sidebar, IG ~120px grid, TikTok full-screen feed).
- Include 3-5 improvements. At least one MUST be priority: "high".
- If the image is genuinely good, say so — don't manufacture critique.`

  try {
    const response = await getAnthropic().messages.create({
      model,
      max_tokens: 2500,
      system: systemPromptFor('thumbnail-analyzer'),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
                data: imageBase64,
              },
            },
            { type: 'text', text: userPrompt },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const usage = response.usage as { input_tokens: number; output_tokens: number }
    const totalTokens = usage.input_tokens + usage.output_tokens

    const parsed = parseLooseJson<ThumbnailAnalysisResult>(text)
    if (!parsed) {
      return NextResponse.json(
        { error: 'Could not parse the analysis. Please try again.' },
        { status: 500 },
      )
    }

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'thumbnail_analyzer',
      platform,
      // Don't store the raw base64 — it bloats the JSONB column. Keep
      // metadata only.
      input_data: { platform, topic: topic ?? null, audience: audience ?? null, mediaType },
      output_data: parsed,
      tokens_used: totalTokens,
    })

    await consumeCredits(auth.supabase, auth.userId, auth.creditCost, 'thumbnail-analyzer')

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Thumbnail analyzer error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze thumbnail. Please try again.' },
      { status: 500 },
    )
  }
}
