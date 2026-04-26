import { NextResponse } from 'next/server'
import { checkAuthAndUsage, incrementUsage } from '@/lib/auth-usage'
import { crispGenerate } from '@/lib/crisp-engine'
import { parseLooseJson } from '@/lib/safe-json'
import { consumeCredits } from '@/lib/credits'
import { shouldGrantTutorialBypass } from '@/lib/tutorial-bypass'
import { loadVoicePromptSnippet } from '@/lib/voice-profile'

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

/**
 * Recover ideas from a possibly-truncated engine response.
 * Strategy: find the outermost JSON object; if it fails to parse, try to
 * trim to the last complete `}` inside the "ideas" array and close the array.
 */
function extractIdeas(content: string): ViralIdea[] {
  // Pass 1: try to parse the whole JSON object (tolerant of comments, trailing
  // commas, and markdown fences that some models sprinkle in)
  try {
    const parsed = parseLooseJson<{ ideas?: ViralIdea[] }>(content)
    if (Array.isArray(parsed?.ideas)) return parsed.ideas
  } catch {
    // fall through to pass 2 — truncated response recovery
  }

  // Pass 2: truncated response. Find the `"ideas": [` marker,
  // then walk forward collecting complete `{...}` objects until we can't.
  const ideasStart = content.indexOf('"ideas"')
  if (ideasStart === -1) return []
  const arrStart = content.indexOf('[', ideasStart)
  if (arrStart === -1) return []

  const ideas: ViralIdea[] = []
  let depth = 0
  let inString = false
  let escape = false
  let objStart = -1

  for (let i = arrStart + 1; i < content.length; i++) {
    const ch = content[i]
    if (escape) { escape = false; continue }
    if (ch === '\\') { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue

    if (ch === '{') {
      if (depth === 0) objStart = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && objStart !== -1) {
        const slice = content.slice(objStart, i + 1)
        try {
          // Use parseLooseJson, not JSON.parse — tolerates trailing commas,
          // raw newlines inside strings, and JS-style comments that Claude
          // occasionally emits inside idea objects.
          const obj = parseLooseJson<ViralIdea>(slice)
          if (obj) ideas.push(obj)
        } catch {
          // Skip this malformed object but keep trying — don't let one bad
          // object drop all the good ones after it.
        }
        objStart = -1
      }
    } else if (ch === ']' && depth === 0) {
      break
    }
  }
  return ideas
}

export async function POST(request: Request) {
  const body = await request.json()
  const {
    niche,
    platforms = ['Instagram', 'TikTok'],
    formats = ['Video', 'Carousel'],
    trendSource = 'Current Trends',
    audience = 'general audience',
    count = 10,
    tutorialMode,
  } = body

  // Tutorial mode: PostCrisp absorbs credit + tier cost. Server-validated.
  let allowBypass = false
  if (tutorialMode) {
    const supabase = (await import('@/utils/supabase/server')).createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) allowBypass = await shouldGrantTutorialBypass(supabase, user.id, 'viral_ideas')
  }

  const auth = await checkAuthAndUsage('viral-ideas', {
    bypassCredits: allowBypass,
    bypassFeatureGate: allowBypass,
    request,
  })
  if (!auth.ok) return auth.response

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
- Each idea must have exactly 5 outline points and 5-8 hashtags
- Keep whyViral under 200 characters, hook under 120 characters to stay within response limits`

  // Budget ~500 output tokens per idea. Cap at Opus's practical limit.
  const maxTokens = Math.min(8000, 800 + safeCount * 520)

  try {
    const voiceSnippet = await loadVoicePromptSnippet(auth.supabase, auth.userId)
    const { text, totalTokens } = await crispGenerate({
      task: 'viral-ideas',
      tier: auth.tier,
      voiceSnippet,
      prompt,
      maxTokens,
    })

    const ideas = extractIdeas(text)

    if (ideas.length === 0) {
      console.error('Viral ideas: got zero parseable ideas. Raw content:', text.slice(0, 500))
      return NextResponse.json(
        { error: 'The AI response could not be parsed. Please try again.' },
        { status: 502 }
      )
    }

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'viral_ideas',
      platform: platforms[0] ?? null,
      input_data: { niche, platforms, formats, trendSource, audience, count: safeCount, tutorialMode: allowBypass },
      output_data: { ideas },
      tokens_used: totalTokens,
    })

    await consumeCredits(auth.supabase, auth.userId, auth.creditCost, 'viral-ideas')

    return NextResponse.json({ ideas, generatedAt: new Date().toISOString() })
  } catch (error) {
    console.error('Viral ideas generation error:', error)
    return NextResponse.json({ error: 'Failed to generate ideas. Please try again.' }, { status: 500 })
  }
}
