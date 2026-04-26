import { NextResponse } from 'next/server'
import { checkAuthAndUsage, incrementUsage } from '@/lib/auth-usage'
import { crispGenerate } from '@/lib/crisp-engine'
import { parseLooseJson } from '@/lib/safe-json'
import { consumeCredits } from '@/lib/credits'
import { loadVoicePromptSnippet } from '@/lib/voice-profile'

export interface BrandPitchResult {
  formal: { subject: string; body: string }
  casual: { subject: string; body: string }
  followUp: string
}

export async function POST(request: Request) {
  const auth = await checkAuthAndUsage('brand-pitch', { request })
  if (!auth.ok) return auth.response

  const body = await request.json()
  const {
    brandName,
    brandIndustry,
    yourNiche,
    audience,
    followerCount,
    engagementRate,
    proposalType,
    uniqueValue,
    budgetExpectation,
  } = body

  if (!brandName?.trim() || !brandIndustry?.trim() || !yourNiche?.trim() || !proposalType) {
    return NextResponse.json({ error: 'Brand name, industry, your niche, and proposal type are required.' }, { status: 400 })
  }

  const prompt = `You are an expert at writing pitches to brands for influencer collaborations.

Create TWO versions of an outreach pitch to "${brandName}" (a ${brandIndustry} brand):
- FORMAL: professional email style — for established corporate brands
- CASUAL: conversational DM/email hybrid — for DTC, startups, and modern consumer brands

Plus a follow-up message (for when the brand doesn't reply to the initial pitch).

Creator profile:
- Niche: ${yourNiche}
- Audience: ${audience || 'general niche audience'}
- Follower count: ${followerCount || 'not specified'}
- Engagement rate: ${engagementRate || 'not specified'}
- Proposing: ${proposalType}
- Unique value proposition: ${uniqueValue || 'not specified'}
- Budget expectation: ${budgetExpectation || 'open to discussion'}

Return ONLY valid JSON — no markdown, no commentary:
{
  "formal": {
    "subject": "Email subject line",
    "body": "Full email body with line breaks as \\n. Include: personalized opener that shows you know ${brandName}, your value proposition, 2-3 specific content ideas for the partnership, social proof, clear CTA."
  },
  "casual": {
    "subject": "Short subject or opener",
    "body": "Conversational pitch body with \\n. Warmer tone, still specific content ideas, more direct CTA."
  },
  "followUp": "Short follow-up message to send if no reply after 5-7 days."
}

Rules:
- Make content ideas SPECIFIC to ${brandName} — reference actual products/audience/marketing trends they likely care about
- Formal version should be ~150-200 words
- Casual version should be ~100-150 words
- Follow-up should be 2-3 sentences
- Never use generic filler like "hope this finds you well"`

  try {
    const voiceSnippet = await loadVoicePromptSnippet(auth.supabase, auth.userId)
    const { text, totalTokens } = await crispGenerate({
      task: 'brand-pitch',
      tier: auth.tier,
      voiceSnippet,
      prompt,
      maxTokens: 2500,
    })

    const parsed = parseLooseJson<BrandPitchResult>(text)

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'brand_pitch',
      platform: null,
      input_data: { brandName, brandIndustry, yourNiche, proposalType, audience, followerCount, engagementRate, uniqueValue, budgetExpectation },
      output_data: parsed,
      tokens_used: totalTokens,
    })

    await consumeCredits(auth.supabase, auth.userId, auth.creditCost, 'brand-pitch')

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Brand pitch generation error:', error)
    return NextResponse.json({ error: 'Failed to generate pitch. Please try again.' }, { status: 500 })
  }
}
