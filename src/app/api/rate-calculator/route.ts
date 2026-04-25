import { NextResponse } from 'next/server'
import { checkAuthAndUsage, incrementUsage } from '@/lib/auth-usage'
import { crispGenerate } from '@/lib/crisp-engine'
import { parseLooseJson } from '@/lib/safe-json'
import { consumeCredits } from '@/lib/credits'

export interface RateResult {
  currency: string
  suggestedRate: { min: number; mid: number; premium: number }
  breakdown: { label: string; value: string }[]
  comparison: string
  rateCard: { contentType: string; min: number; mid: number; premium: number }[]
  negotiationTips: string[]
}

export async function POST(request: Request) {
  const auth = await checkAuthAndUsage('rate-calculator', { request })
  if (!auth.ok) return auth.response

  const body = await request.json()
  const { platform, followerCount, engagementRate, contentType, niche, usageRights, deliverables } = body

  if (!platform || !followerCount || !contentType || !niche) {
    return NextResponse.json({ error: 'Platform, follower count, content type, and niche are required.' }, { status: 400 })
  }

  const prompt = `You are an influencer pricing expert with deep knowledge of 2026 sponsorship rates.

Calculate a fair rate range for this creator and scope:
- Platform: ${platform}
- Follower count: ${followerCount}
- Engagement rate: ${engagementRate || 'unspecified (assume industry average ~3%)'}
- Content type being quoted: ${contentType}
- Niche: ${niche} (some niches command premiums — finance, tech, B2B > lifestyle)
- Usage rights: ${usageRights || 'standard — no exclusivity, no repurposing rights'}
- Deliverables count: ${deliverables || '1 piece of content'}

Return ONLY valid JSON — no markdown:
{
  "currency": "USD",
  "suggestedRate": { "min": 250, "mid": 400, "premium": 650 },
  "breakdown": [
    { "label": "Base rate (${followerCount} followers on ${platform})", "value": "$X" },
    { "label": "Engagement multiplier", "value": "+15%" },
    { "label": "Niche premium (${niche})", "value": "+20%" },
    { "label": "Usage rights premium", "value": "+X%" },
    { "label": "Bundle adjustment", "value": "-10% (multiple deliverables)" }
  ],
  "comparison": "Creators with similar stats typically charge between $X and $Y",
  "rateCard": [
    { "contentType": "Feed Post",    "min": 200, "mid": 350, "premium": 550 },
    { "contentType": "Reel / Short", "min": 350, "mid": 550, "premium": 850 },
    { "contentType": "Story (set)",  "min": 150, "mid": 250, "premium": 400 },
    { "contentType": "YouTube Integration", "min": 800, "mid": 1500, "premium": 3000 },
    { "contentType": "Live Stream",  "min": 500, "mid": 900, "premium": 1500 },
    { "contentType": "Thread / Carousel", "min": 300, "mid": 500, "premium": 800 }
  ],
  "negotiationTips": [
    "Specific tip about negotiating usage rights",
    "Specific tip about bundling deliverables",
    "Specific tip for this creator's tier/niche"
  ]
}

Rules:
- Numbers MUST be realistic 2026 rates for the creator's tier
- Factor in all inputs — don't generate generic ranges
- rateCard covers all major content formats so user has a full menu to quote from
- Negotiation tips must be specific to this creator's situation, not generic`

  try {
    const { text, totalTokens } = await crispGenerate({
      task: 'rate-calculator',
      tier: auth.tier,
      prompt,
      maxTokens: 2000,
    })

    const parsed = parseLooseJson<RateResult>(text)

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'rate_calculator',
      platform,
      input_data: { followerCount, engagementRate, contentType, niche, usageRights, deliverables },
      output_data: parsed,
      tokens_used: totalTokens,
    })

    await consumeCredits(auth.supabase, auth.userId, auth.creditCost, 'rate-calculator')

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Rate calculator error:', error)
    return NextResponse.json({ error: 'Failed to calculate rates. Please try again.' }, { status: 500 })
  }
}
