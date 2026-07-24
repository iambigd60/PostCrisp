import { NextResponse } from 'next/server'
import { checkAuthAndUsage, incrementUsage, reserveCredits, refundCredits } from '@/lib/auth-usage'
import { crispGenerate } from '@/lib/crisp-engine'
import { parseLooseJson } from '@/lib/safe-json'
import { getUserChannels, formatChannelsForPrompt } from '@/lib/user-channels'
import { shouldGrantTutorialBypass } from '@/lib/tutorial-bypass'
import { recordGenerationAiCalls, type AiCallLedgerEntry } from '@/lib/ai-call-ledger'

// Vercel function timeout. Default is 10s (Hobby) / 60s (Pro). Channel
// Analysis with refine on for Elite tier needs more headroom — pass 1
// (Opus) can hit ~60s on long outputs alone, plus ~10s for the gpt-4o-mini
// critic. 120s gives comfortable headroom under the Vercel Pro 300s cap.
export const maxDuration = 120

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
  const body = await request.json()
  const { platform, niche, followerCount, postingCadence, contentFocus, currentChallenges, analyzeHandle, tutorialMode } = body

  // Tutorial mode bypasses the user's credit allowance — PostCrisp absorbs
  // the cost so testers finish the tutorial with their full starter credits
  // intact. Validated via the shared tutorial-state guard.
  let allowBypass = false
  if (tutorialMode) {
    const supabase = await (await import('@/utils/supabase/server')).createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) allowBypass = await shouldGrantTutorialBypass(supabase, user.id, 'channel_analysis')
  }

  const auth = await checkAuthAndUsage('channel-analysis', {
    bypassCredits: allowBypass,
    bypassFeatureGate: allowBypass,
  })
  if (!auth.ok) return auth.response

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

  // Refine pass: Elite tier only, gpt-4o-mini critic capped at 3500
  // tokens. Pass 1 (user-tier Opus) generates ~30-40s, pass 2 critic
  // adds ~5-10s. Total comfortably under 120s maxDuration.
  // crisp-engine logs per-pass timing — check Vercel logs to monitor.
  const useRefine = auth.tier === 'elite'

  const denied = await reserveCredits(auth)
  if (denied) return denied

  let text = ''
  let totalTokens = 0
  let refined = false
  let aiCalls: AiCallLedgerEntry[] = []
  const tStart = Date.now()
  try {
    const result = await crispGenerate({
      task: 'channel-analysis',
      tier: auth.tier,
      prompt,
      // Bumped 3500 → 4500. Output shape: 3 strengths + 4 gaps + 3 quick wins
      // + 3 long-term moves + observations + recommendations. Tight at 3500.
      maxTokens: 4500,
      refine: useRefine,
    })
    text = result.text
    totalTokens = result.totalTokens
    refined = result.refined
    aiCalls = result.aiCalls
    console.log(`[channel-analysis] crispGenerate done — tier=${auth.tier} refined=${refined} elapsedMs=${Date.now() - tStart} tokens=${totalTokens} model=${result.modelUsed}`)
  } catch (error) {
    console.error(`[channel-analysis] model call failed after ${Date.now() - tStart}ms:`, error)
    await refundCredits(auth)
    return NextResponse.json({ error: 'AI provider error. Please try again in a moment.' }, { status: 502 })
  }

  let parsed: ChannelAnalysisResult
  try {
    parsed = parseLooseJson<ChannelAnalysisResult>(text)
  } catch (error) {
    console.error('Channel analysis — JSON parse failed. First 500 chars:', text.slice(0, 500), error)
    await refundCredits(auth)
    return NextResponse.json({ error: 'AI returned malformed output. Please try again.' }, { status: 502 })
  }

  if (!parsed?.overallAssessment || !Array.isArray(parsed.strengths) || !Array.isArray(parsed.gaps)) {
    console.error('Channel analysis — unexpected shape:', { keys: Object.keys(parsed ?? {}), preview: text.slice(0, 300) })
    await refundCredits(auth)
    return NextResponse.json({ error: 'AI returned an unexpected response. Please try again.' }, { status: 502 })
  }

  // Persistence is best-effort — if the insert fails we still want to return
  // the analysis to the user. analysis_id falls back to null on persistence
  // failure (which means tutorial-mode "save to library" links won't work for
  // that one run, but the user gets value instead of a generic error).
  let analysisId: string | null = null
  try {
    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)
    const { data: inserted } = await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'channel_analysis',
      platform,
      input_data: { niche, followerCount, postingCadence, contentFocus, currentChallenges, handleToAnalyze, tutorialMode: allowBypass, refined },
      output_data: parsed,
      tokens_used: totalTokens,
    }).select('id').single()
    analysisId = inserted?.id ?? null
    await recordGenerationAiCalls(auth.supabase, {
      generationId: analysisId,
      userId: auth.userId,
      feature: 'channel_analysis',
      tier: auth.tier,
      calls: aiCalls,
    })
  } catch (error) {
    console.error('Channel analysis — persistence failed (non-fatal):', error)
  }

  // Tutorial mode: return the result with sections marked locked so the
  // client renders them through LockedSection. The full result is still
  // saved to generations (above) for post-upgrade reveal.
  if (tutorialMode && allowBypass) {
    const locked = {
      overallAssessment: parsed.overallAssessment,
      // Show 2 of 3 strengths and 1 of 4 gaps unlocked
      strengths: (parsed.strengths ?? []).slice(0, 2),
      gaps: (parsed.gaps ?? []).slice(0, 1),
      // Observations stay; recommendations get hidden behind the paywall
      contentMix: { observation: parsed.contentMix?.observation ?? '', recommendation: null },
      postingConsistency: { observation: parsed.postingConsistency?.observation ?? '', recommendation: null },
      audienceEngagement: { observation: parsed.audienceEngagement?.observation ?? '', recommendation: null },
      // Fully locked sections
      missedOpportunities: [],
      quickWins: [],
      longTermMoves: [],
      // Counts so the client knows how many items are hidden behind each lock
      _locked: {
        strengths_hidden: Math.max(0, (parsed.strengths?.length ?? 0) - 2),
        gaps_hidden: Math.max(0, (parsed.gaps?.length ?? 0) - 1),
        missedOpportunities_hidden: parsed.missedOpportunities?.length ?? 0,
        quickWins_hidden: parsed.quickWins?.length ?? 0,
        longTermMoves_hidden: parsed.longTermMoves?.length ?? 0,
        recommendations_hidden: 3, // contentMix, postingConsistency, audienceEngagement
      },
      analysis_id: analysisId,
    }
    return NextResponse.json(locked)
  }

  return NextResponse.json({ ...parsed, analysis_id: analysisId })
}
