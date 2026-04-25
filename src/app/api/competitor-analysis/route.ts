import { NextResponse } from 'next/server'
import { checkAuthAndUsage, incrementUsage } from '@/lib/auth-usage'
import { crispGenerate } from '@/lib/crisp-engine'
import { parseLooseJson } from '@/lib/safe-json'
import { consumeCredits } from '@/lib/credits'

export interface CompetitorAnalysisResult {
  contentStrategy: string
  strengths: string[]
  weaknesses: string[]
  hashtagStrategy: string
  engagementTactics: string[]
  keyTakeaways: string[]
  contentIdeas: { title: string; why: string }[]
}

export async function POST(request: Request) {
  const auth = await checkAuthAndUsage('competitor-analysis', { request })
  if (!auth.ok) return auth.response

  const body = await request.json()
  const { competitor, platform, yourNiche, focusAreas } = body

  if (!competitor?.trim() || !platform || !yourNiche?.trim()) {
    return NextResponse.json({ error: 'Competitor, platform, and your niche are required.' }, { status: 400 })
  }

  const focusList = Array.isArray(focusAreas) && focusAreas.length > 0
    ? focusAreas.join(', ')
    : 'content strategy, posting frequency, hashtag usage, engagement tactics, content themes, growth tactics'

  const prompt = `You are a strategic competitor-intelligence analyst for creators.

Analyze "${competitor}" on ${platform}, from the perspective of a ${yourNiche} creator looking to compete with or learn from them.

Focus areas requested: ${focusList}

Base the analysis on publicly observable patterns and general platform knowledge. Be strategic and specific — avoid generic advice.

Return ONLY valid JSON — no markdown:
{
  "contentStrategy": "2-3 sentence summary of what types of content they post and how often. Reference specific formats and cadence.",
  "strengths": [
    "Specific strength #1 — what they do exceptionally well on ${platform}",
    "Specific strength #2",
    "Specific strength #3"
  ],
  "weaknesses": [
    "Specific gap or weakness where they underperform — opportunity for you to exploit",
    "Another gap",
    "Another gap"
  ],
  "hashtagStrategy": "Observation about their hashtag approach — count, mix of broad vs niche, branded hashtags, etc.",
  "engagementTactics": [
    "How they interact with their audience #1",
    "How they interact with their audience #2",
    "How they interact with their audience #3"
  ],
  "keyTakeaways": [
    "Actionable lesson #1 for a ${yourNiche} creator",
    "Actionable lesson #2",
    "Actionable lesson #3",
    "Actionable lesson #4",
    "Actionable lesson #5"
  ],
  "contentIdeas": [
    {"title": "Content idea inspired by (not copied from) their strategy", "why": "Short reason this works for you"},
    {"title": "Another idea", "why": "Why it works"},
    {"title": "Another idea", "why": "Why it works"},
    {"title": "Another idea", "why": "Why it works"},
    {"title": "Another idea", "why": "Why it works"}
  ]
}

Rules:
- Everything must be ${platform}-specific and ${yourNiche}-relevant
- keyTakeaways and contentIdeas arrays must each have exactly 5 items
- contentIdeas must be INSPIRED BY their strategy, never direct copies
- If you don't know the competitor specifically, make defensible inferences from their niche and follower tier — don't refuse`

  try {
    const { text, totalTokens } = await crispGenerate({
      task: 'competitor-analysis',
      tier: auth.tier,
      prompt,
      maxTokens: 3000,
    })

    const parsed = parseLooseJson<CompetitorAnalysisResult>(text)

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'competitor_analysis',
      platform,
      input_data: { competitor, yourNiche, focusAreas },
      output_data: parsed,
      tokens_used: totalTokens,
    })

    await consumeCredits(auth.supabase, auth.userId, auth.creditCost, 'competitor-analysis')

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Competitor analysis error:', error)
    return NextResponse.json({ error: 'Failed to analyze competitor. Please try again.' }, { status: 500 })
  }
}
