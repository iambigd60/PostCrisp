import { NextResponse } from 'next/server'
import { checkAuthAndUsage, incrementUsage } from '@/lib/auth-usage'
import { crispGenerate } from '@/lib/crisp-engine'
import { parseLooseJson } from '@/lib/safe-json'
import { consumeCredits } from '@/lib/credits'
import { upsertCreatorProfile } from '@/lib/creator-profile'
import { recordGenerationAiCalls, type AiCallLedgerEntry } from '@/lib/ai-call-ledger'
import { isSocialPlatformUrl, looksLikeUrl, socialPlatformLabel, validateEvidencePostsForPlatform } from '@/lib/social-url'
import { buildFoundationPrompt, type FoundationInput } from './prompt'

export const maxDuration = 120

export interface FoundationAnalysisResult {
  overallAssessment: string
  strengths: string[]
  gaps: string[]
  contentMix: { observation: string; recommendation: string }
  postingConsistency: { observation: string; recommendation: string }
  audienceEngagement: { observation: string; recommendation: string }
  missedOpportunities: string[]
  quickWins: { title: string; action: string; impact: string }[]
  longTermMoves: { title: string; action: string; timeframe: string }[]
  topPostPatterns: string[]
  recommendedFormatLean: string
  repeatableHookStructures: { pattern: string; example: string }[]
  creatorProfile: {
    contentPillars: string[]
    voiceSignature: { adjectives: string[]; examplePhrasing: string }
    audiencePersona: { description: string; sophistication: 'beginner' | 'intermediate' | 'advanced' }
    growthStage: 'pre-traction' | 'early-traction' | 'scaling' | 'established'
    monetizationPosition: { stage: string; primaryStreams: string[] }
    formatStrengths: string[]
    differentiators: string[]
    topBlockers: string[]
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<FoundationInput>

  // Validate required fields
  const errors: string[] = []
  if (!body.platform) errors.push('platform is required')
  if (!body.niche?.trim()) errors.push('niche is required')
  if (!body.contentPillars?.filter((p) => p?.trim()).length) errors.push('at least 1 content pillar is required')
  if (!body.targetAudience?.description?.trim()) errors.push('targetAudience.description is required')
  if (!body.growthGoal) errors.push('growthGoal is required')
  if (!body.samplePosts?.filter((p) => p.caption?.trim()).length) errors.push('at least 1 sample post with caption text is required')
  if (body.platform && body.samplePosts) {
    errors.push(...validateEvidencePostsForPlatform(body.platform, body.samplePosts))
  }
  if (body.platform && body.analyzeHandle && looksLikeUrl(body.analyzeHandle) && !isSocialPlatformUrl(body.platform, body.analyzeHandle)) {
    errors.push(`Channel URL must be a ${socialPlatformLabel(body.platform)} link.`)
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const auth = await checkAuthAndUsage('foundation-analysis')
  if (!auth.ok) return auth.response

  const input = body as FoundationInput
  const prompt = buildFoundationPrompt(input)
  const useRefine = auth.tier === 'elite' && process.env.ENABLE_FOUNDATION_REFINE === 'true'

  let text = ''
  let totalTokens = 0
  let refined = false
  let aiCalls: AiCallLedgerEntry[] = []
  const tStart = Date.now()
  try {
    const result = await crispGenerate({
      task: 'foundation-analysis',
      tier: auth.tier,
      prompt,
      maxTokens: 6000,    // bigger output cap than channel-analysis (4500) to fit creator profile + evidence findings
      refine: useRefine,
    })
    text = result.text
    totalTokens = result.totalTokens
    refined = result.refined
    aiCalls = result.aiCalls
    console.log(`[foundation-analysis] crispGenerate done — tier=${auth.tier} refined=${refined} elapsedMs=${Date.now() - tStart} tokens=${totalTokens} model=${result.modelUsed}`)
  } catch (error) {
    console.error(`[foundation-analysis] model call failed after ${Date.now() - tStart}ms:`, error)
    return NextResponse.json({ error: 'AI provider error. Please try again in a moment.' }, { status: 502 })
  }

  let parsed: FoundationAnalysisResult
  try {
    parsed = parseLooseJson<FoundationAnalysisResult>(text)
  } catch (error) {
    console.error('Foundation analysis — JSON parse failed. First 500 chars:', text.slice(0, 500), error)
    return NextResponse.json({ error: 'AI returned malformed output. Please try again.' }, { status: 502 })
  }

  // Tight shape validation — protects the contract downstream tools (Captions,
  // Viral Ideas, Bio Optimizer in Phase 2) rely on. Half-formed profile rows
  // poison the table even when individual fields look reasonable in isolation.
  const cp = parsed?.creatorProfile
  if (
    !parsed?.overallAssessment ||
    !Array.isArray(parsed.strengths) ||
    !cp ||
    !Array.isArray(cp.contentPillars) ||
    !cp.voiceSignature ||
    !Array.isArray(cp.voiceSignature.adjectives) ||
    !cp.audiencePersona?.description ||
    !cp.growthStage ||
    !cp.monetizationPosition?.stage ||
    !Array.isArray(cp.formatStrengths) ||
    !Array.isArray(cp.differentiators) ||
    !Array.isArray(cp.topBlockers)
  ) {
    console.error('Foundation analysis — unexpected shape:', { keys: Object.keys(parsed ?? {}), profileKeys: Object.keys(cp ?? {}), preview: text.slice(0, 300) })
    return NextResponse.json({ error: 'AI returned an unexpected response. Please try again.' }, { status: 502 })
  }

  // Persist generation row + credit debit (best-effort).
  let analysisId: string | null = null
  try {
    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)
    const { data: inserted } = await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'foundation_analysis',
      platform: input.platform,
      input_data: input,
      output_data: parsed,
      tokens_used: totalTokens,
    }).select('id').single()
    analysisId = inserted?.id ?? null
    await recordGenerationAiCalls(auth.supabase, {
      generationId: analysisId,
      userId: auth.userId,
      feature: 'foundation_analysis',
      tier: auth.tier,
      calls: aiCalls,
    })
    await consumeCredits(auth.supabase, auth.userId, auth.creditCost, 'foundation-analysis')
  } catch (error) {
    console.error('[foundation-analysis] generation persist failed (non-fatal):', error)
  }

  // Creator Profile upsert is the integration contract — log under its own tag
  // so a failure here is greppable separately from generation/credit failures.
  // A failed generations insert above must NOT skip this; the profile is the
  // entire reason this feature exists.
  try {
    await upsertCreatorProfile(auth.supabase, auth.userId, {
      content_pillars: cp.contentPillars,
      voice_signature: cp.voiceSignature,
      audience_persona: cp.audiencePersona,
      growth_stage: cp.growthStage,
      monetization_position: cp.monetizationPosition,
      format_strengths: cp.formatStrengths,
      differentiators: cp.differentiators,
      top_blockers: cp.topBlockers,
    }, analysisId)
  } catch (error) {
    console.error('[foundation-analysis] creator profile upsert failed (non-fatal):', error)
  }

  return NextResponse.json({ ...parsed, analysis_id: analysisId })
}
