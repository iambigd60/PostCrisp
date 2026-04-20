import { NextResponse } from 'next/server'
import { checkAuthAndUsage, incrementUsage } from '@/lib/auth-usage'
import { crispGenerate } from '@/lib/crisp-engine'
import { parseLooseJson } from '@/lib/safe-json'
import { consumeCredits } from '@/lib/credits'

export interface CollabStrategy {
  partnerProfiles: { description: string; whyItWorks: string }[]
  howToFind: string[]
  outreachTemplate: string
  contentIdeas: string[]
  dosDonts: { dos: string[]; donts: string[] }
  crossPromotionTips: string[]
}

export async function POST(request: Request) {
  const auth = await checkAuthAndUsage('collab-finder')
  if (!auth.ok) return auth.response

  const body = await request.json()
  const { niche, followerRange, platforms, collabType, lookingFor } = body

  if (!niche?.trim()) {
    return NextResponse.json({ error: 'Niche is required.' }, { status: 400 })
  }

  const prompt = `You are a creator collaboration strategist.

Creator profile:
- Niche: ${niche}
- Follower tier: ${followerRange || 'not specified'}
- Active platforms: ${Array.isArray(platforms) ? platforms.join(', ') : 'multiple'}
- Collaboration type sought: ${collabType || 'Content Collab'}
- Looking for in partner: ${Array.isArray(lookingFor) ? lookingFor.join(', ') : 'Similar Audience'}

Return ONLY valid JSON:
{
  "partnerProfiles": [
    {"description": "Type of creator to partner with — DESCRIPTION not specific handles", "whyItWorks": "Why this pairing creates 1+1=3 audience overlap"}
  ],
  "howToFind": [
    "Specific search strategy 1 (hashtags, platform features, communities)",
    "Specific search strategy 2",
    "Specific search strategy 3"
  ],
  "outreachTemplate": "A ready-to-customize DM/email to send (100-150 words). Should feel warm, specific, and propose a concrete collab idea.",
  "contentIdeas": [
    "Specific content collab idea 1",
    "Specific content collab idea 2",
    "Specific content collab idea 3",
    "Specific content collab idea 4"
  ],
  "dosDonts": {
    "dos": ["Do #1", "Do #2", "Do #3", "Do #4"],
    "donts": ["Don't #1", "Don't #2", "Don't #3"]
  },
  "crossPromotionTips": [
    "Cross-promotion tip 1",
    "Cross-promotion tip 2",
    "Cross-promotion tip 3"
  ]
}

Rules:
- partnerProfiles MUST have exactly 4 items
- Never name specific creators — describe the type
- contentIdeas should be actionable, format-specific (e.g., "Joint Reel: X does intro, you do payoff")
- outreachTemplate should be customizable with placeholders like [creator name]`

  try {
    const { text, totalTokens } = await crispGenerate({
      task: 'collab-finder',
      tier: auth.tier,
      prompt,
      maxTokens: 3000,
    })

    const parsed = parseLooseJson<CollabStrategy>(text)

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'collab_finder',
      platform: null,
      input_data: { niche, followerRange, platforms, collabType, lookingFor },
      output_data: parsed,
      tokens_used: totalTokens,
    })

    await consumeCredits(auth.supabase, auth.userId, auth.creditCost, 'collab-finder')

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Collab finder error:', error)
    return NextResponse.json({ error: 'Failed to build collab strategy. Please try again.' }, { status: 500 })
  }
}
