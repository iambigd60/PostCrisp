import { NextResponse } from 'next/server'
import { checkAuthAndUsage, incrementUsage } from '@/lib/auth-usage'
import { crispGenerate } from '@/lib/crisp-engine'
import { parseLooseJson } from '@/lib/safe-json'
import { getUserChannels, formatChannelsForPrompt } from '@/lib/user-channels'

export interface ChannelAnalysisResult {
  overallAssessment: string
  strengths: string[]
  gaps: string[]
  contentMix: { observation: string; recommendation: string }
  postingConsistency: { observation: string; recommendation: string }
  audienceEngagement: { observation: string; recommendation: string }
  missedOpportunities: string[]
  quickWins: { title: string; action: string; impact: string }[]
  longTermMoves: { title: string; action: string; timeframe: string }[]
}

export async function POST(request: Request) {
  const auth = await checkAuthAndUsage('channel-analysis')
  if (!auth.ok) return auth.response

  const body = await request.json()
  const { platform, niche, followerCount, postingCadence, contentFocus, currentChallenges, analyzeHandle } = body

  if (!platform || !niche?.trim()) {
    return NextResponse.json({ error: 'Platform and niche are required.' }, { status: 400 })
  }

  const channels = await getUserChannels(auth.supabase, auth.userId)
  const channelsBlock = formatChannelsForPrompt(channels)

  // Try to surface the most relevant channel for the selected platform
  const platformToKey: Record<string, keyof typeof channels> = {
    instagram: 'instagram', tiktok: 'tiktok', youtube: 'youtube', x: 'x',
    facebook: 'facebook', threads: 'threads', linkedin: 'linkedin',
  }
  const savedHandle = channels[platformToKey[platform] as keyof typeof channels]
  const handleToAnalyze = analyzeHandle || savedHandle || 'not provided'

  const prompt = `You are an expert creator strategist running an honest, actionable audit of the user's own ${platform} channel.

Creator profile:
- Platform being audited: ${platform}
- Handle / URL: ${handleToAnalyze}
- Niche: ${niche}
- Follower count: ${followerCount || 'not specified'}
- Posting cadence: ${postingCadence || 'not specified'}
- Primary content focus: ${contentFocus || 'varied'}
- Current challenges: ${currentChallenges || 'none specified'}
${channelsBlock}

Analyze the channel as if you were a hired strategist reviewing it. Be specific. Prefer concrete recommendations over platitudes. Reference the platform's 2026 algorithm dynamics. If you don't have direct access to metrics, make reasoned inferences from the niche, follower tier, and stated challenges — don't refuse.

Return ONLY valid JSON:
{
  "overallAssessment": "2-3 sentence honest overall read. What stage is this channel at? What's the top thing holding it back?",
  "strengths": [
    "Specific strength #1 — tied to their niche and tier",
    "Specific strength #2",
    "Specific strength #3"
  ],
  "gaps": [
    "Specific gap #1 — something concrete to close",
    "Specific gap #2",
    "Specific gap #3",
    "Specific gap #4"
  ],
  "contentMix": {
    "observation": "What types of content this creator likely posts given the niche/challenges",
    "recommendation": "How to rebalance the mix for better reach"
  },
  "postingConsistency": {
    "observation": "Inference about their posting cadence based on inputs",
    "recommendation": "Cadence target to hit for this platform + niche"
  },
  "audienceEngagement": {
    "observation": "What engagement pattern typical at this tier likely looks like",
    "recommendation": "Specific tactic to lift engagement"
  },
  "missedOpportunities": [
    "Specific feature or format they probably aren't using",
    "Another one",
    "Another one"
  ],
  "quickWins": [
    {"title": "Quick win #1", "action": "What to do this week", "impact": "High"},
    {"title": "Quick win #2", "action": "What to do this week", "impact": "High"},
    {"title": "Quick win #3", "action": "What to do this week", "impact": "Medium"}
  ],
  "longTermMoves": [
    {"title": "Strategic move #1", "action": "What to build over 30-60 days", "timeframe": "30 days"},
    {"title": "Strategic move #2", "action": "What to build over 60-90 days", "timeframe": "60-90 days"},
    {"title": "Strategic move #3", "action": "What to build over 90+ days", "timeframe": "90+ days"}
  ]
}

Rules:
- strengths: 3 items, gaps: 4 items
- quickWins: 3 items, longTermMoves: 3 items
- Every recommendation must reference ${platform}-specific mechanics or ${niche}-specific dynamics
- Never use generic "post consistently" / "engage with your audience" advice — be specific about what/when/how`

  try {
    const { text, totalTokens } = await crispGenerate({
      task: 'channel-analysis',
      tier: auth.tier,
      system: 'You are a senior creator strategist. Output only valid JSON.',
      prompt,
      maxTokens: 3500,
    })

    const parsed = parseLooseJson<ChannelAnalysisResult>(text)

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'channel_analysis',
      platform,
      input_data: { niche, followerCount, postingCadence, contentFocus, currentChallenges, handleToAnalyze },
      output_data: parsed,
      tokens_used: totalTokens,
    })

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Channel analysis error:', error)
    return NextResponse.json({ error: 'Failed to analyze channel. Please try again.' }, { status: 500 })
  }
}
