/**
 * Crisp Engine — server-side runtime.
 *
 * Imports server-only modules (Supabase server client). Do NOT import this
 * from a client component — use `crisp-engine-config.ts` for client-safe
 * types, labels, and constants.
 */

import { createClient as createSupabaseServer } from '@/utils/supabase/server'
import { getProvider, type ProviderId } from './providers'
import { systemPromptFor } from './system-prompts'
import { parseLooseJson } from './safe-json'
import { estimateAiCallCostUsd } from './ai-costs'
import type { AiCallLedgerEntry } from './ai-call-ledger'
import {
  type CrispTask,
  type PowerProfile,
  type ProfileConfig,
  type Tier,
  type ConfigurableTier,
  DEFAULT_PROFILE_CONFIG,
  TASK_TIER_PROFILE,
} from './crisp-engine-config'

// Re-export client-safe pieces so existing imports from crisp-engine still work
export {
  ALL_TASKS,
  CONFIGURABLE_TIERS,
  DEFAULT_PROFILE_CONFIG,
  MODEL_CATALOG,
  TASK_TIER_PROFILE,
  TIER_LABELS,
  TIER_BADGE_LABEL,
  tierFromDbValue,
} from './crisp-engine-config'
export type {
  CrispTask,
  PowerProfile,
  ProfileConfig,
  Tier,
  ConfigurableTier,
} from './crisp-engine-config'

// ─── Override cache (10s) ───────────────────────────────────────────────────
// Keyed by `${task}::${tier}` to scope overrides per-tier.
//
// TTL reduced 60s → 10s in 2026-04-28 because Vercel's horizontal scaling
// means each function instance has its own in-memory cache, and a single
// invalidateOverrideCache() call from the admin save route only clears the
// instance that handled the save. Other instances kept serving stale config
// for up to 60s. With a 10s TTL the worst-case staleness is brief enough
// that admin-config edits feel responsive without the DB-load tradeoff of
// disabling caching entirely. (Per-request DB cost is ~10ms, dwarfed by AI
// call latency — could remove the cache entirely if this still feels stale.)

interface CacheEntry {
  overrides: Map<string, ProfileConfig>
  fetchedAt: number
}
let _cache: CacheEntry | null = null
const CACHE_TTL_MS = 10_000

function cacheKey(task: CrispTask, tier: ConfigurableTier): string {
  return `${task}::${tier}`
}

async function loadOverrides(): Promise<Map<string, ProfileConfig>> {
  if (_cache && Date.now() - _cache.fetchedAt < CACHE_TTL_MS) return _cache.overrides

  try {
    const supabase = await createSupabaseServer()
    const { data, error } = await supabase
      .from('ai_config_overrides')
      .select('task, tier, provider, model')
    if (error) {
      console.error('[crisp-engine] failed to load overrides:', error.message)
      return new Map()
    }
    const map = new Map<string, ProfileConfig>()
    for (const row of data ?? []) {
      map.set(
        `${row.task}::${row.tier}`,
        { provider: row.provider as ProviderId, model: row.model }
      )
    }
    _cache = { overrides: map, fetchedAt: Date.now() }
    return map
  } catch (e) {
    console.error('[crisp-engine] override load threw:', e)
    return new Map()
  }
}

export function invalidateOverrideCache() {
  _cache = null
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface CrispGenerateArgs {
  task: CrispTask
  tier: Tier
  system?: string           // optional — if omitted, uses systemPromptFor(task)
  voiceSnippet?: string     // optional — user voice profile, appended to system prompt
  prompt: string
  maxTokens: number
  /**
   * If true, runs a second "critique + rewrite" pass that takes the first
   * output, identifies weaknesses (vague claims, generic advice, missing
   * specifics), and rewrites it. Costs 2 model calls instead of 1.
   *
   * Falls back to the first-pass output silently if the critique pass
   * throws or returns malformed JSON, so enabling refine never makes a
   * task strictly worse than the single-pass version.
   *
   * Designed for analytical tasks where insight depth matters
   * (channel analysis, brand pitch, CTA optimizer). Skip for short-output
   * tasks (hashtags, polls) — no perceptible quality lift, just latency.
   */
  refine?: boolean
}

export interface CrispGenerateResult {
  text: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  providerUsed: ProviderId
  modelUsed: string
  tierUsed: ConfigurableTier
  /** True if the output went through a second critique + rewrite pass. */
  refined: boolean
  aiCalls: AiCallLedgerEntry[]
}

const CRITIC_SYSTEM = `You are a strict expert critic and rewriter for a creator-tool platform.

You will receive:
1. The original task instructions
2. A first-pass output someone produced for that task

Internally critique the first-pass output for these weaknesses, then rewrite the ENTIRE output fixing every one. Return ONLY the rewritten output in the same shape — no preamble, no explanation, no critique text.

Weaknesses to catch + fix:
- Vague or generic claims (e.g. "post consistently", "engage with your audience") — replace with concrete tactics
- Missing concrete examples, numbers, or platform-specific details
- Recommendations that don't tie back to the user's stated niche, platform, or situation
- Surface-level analysis where one more level of depth would land harder
- Repetition or redundancy across sections
- Generic advice that could apply to ANY creator — delete or rewrite as niche-specific
- Insights from the input the first pass overlooked

Rewrite rules:
- Keep the EXACT same shape (same JSON keys, same array sizes)
- Make every claim more specific to the user's inputs
- Replace any generic advice with a tactic the user can act on this week
- Tone stays the same as first pass

Return ONLY the rewritten JSON. No prefix, no suffix.`

function totalTokensFor(result: { inputTokens: number; outputTokens: number; cacheReadInputTokens?: number; cacheCreationInputTokens?: number }): number {
  return result.inputTokens + result.outputTokens + (result.cacheReadInputTokens ?? 0) + (result.cacheCreationInputTokens ?? 0)
}

function ledgerEntry(
  requestRole: AiCallLedgerEntry['requestRole'],
  provider: ProviderId,
  model: string,
  result: { inputTokens: number; outputTokens: number; cacheReadInputTokens?: number; cacheCreationInputTokens?: number },
): AiCallLedgerEntry {
  return {
    requestRole,
    provider,
    model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    totalTokens: totalTokensFor(result),
    cacheReadInputTokens: result.cacheReadInputTokens ?? 0,
    cacheCreationInputTokens: result.cacheCreationInputTokens ?? 0,
    estimatedCostUsd: estimateAiCallCostUsd({
      provider,
      model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cacheReadInputTokens: result.cacheReadInputTokens ?? 0,
      cacheCreationInputTokens: result.cacheCreationInputTokens ?? 0,
    }),
  }
}

export async function resolveTaskConfig(
  task: CrispTask,
  tier: Tier
): Promise<{ config: ProfileConfig; effective: ConfigurableTier }> {
  const effective: ConfigurableTier = tier

  // 1. DB override takes top priority, scoped to this specific (task, tier)
  const overrides = await loadOverrides()
  const override = overrides.get(cacheKey(task, effective))
  if (override) return { config: override, effective }

  // 2. Env-level force (handy for dev)
  const forced = process.env.DEV_FORCE_PROFILE as PowerProfile | undefined
  if (forced && forced in DEFAULT_PROFILE_CONFIG) {
    return { config: DEFAULT_PROFILE_CONFIG[forced], effective }
  }

  // 3. Code default for this (task, tier) cell
  const profile = TASK_TIER_PROFILE[task][effective]
  return { config: DEFAULT_PROFILE_CONFIG[profile], effective }
}

export async function crispGenerate(args: CrispGenerateArgs): Promise<CrispGenerateResult> {
  const tStart = Date.now()
  const { config, effective } = await resolveTaskConfig(args.task, args.tier)
  const providerImpl = getProvider(config.provider)

  // Build the final system prompt. Caller can override with `system`; otherwise
  // we use the task default. Voice snippet (user's analyzed writing style) is
  // appended when provided so feature output sounds like the user rather than
  // a generic AI.
  const baseSystem = args.system ?? systemPromptFor(args.task)
  const finalSystem = args.voiceSnippet ? `${baseSystem}${args.voiceSnippet}` : baseSystem

  const firstPass = await providerImpl.generate({
    model: config.model,
    system: finalSystem,
    prompt: args.prompt,
    maxTokens: args.maxTokens,
  })

  if (!args.refine) {
    const primaryCall = ledgerEntry('primary', config.provider, config.model, firstPass)
    console.log(`[crisp-engine] task=${args.task} done (no refine) — model=${config.model} tokens=${primaryCall.totalTokens} elapsedMs=${Date.now() - tStart}`)
    return {
      ...firstPass,
      totalTokens: primaryCall.totalTokens,
      providerUsed: config.provider,
      modelUsed: config.model,
      tierUsed: effective,
      refined: false,
      aiCalls: [primaryCall],
    }
  }

  // ─── Refine pass: critique + rewrite ──────────────────────────────────────
  // Wrapped in try/catch + JSON validation so any failure here silently
  // falls back to first-pass output. Refinement is additive value, never
  // gating — enabling refine should never make a request fail that would
  // have succeeded without it.
  //
  // Critic uses gpt-4o-mini regardless of caller tier — fast (~5-10s on
  // 3500-token rewrites), instruction-following, cheap. The job is QA +
  // rewriting against criteria, not deep reasoning. Pass 1 still uses the
  // user-tier model, so Elite users still get Opus on the actual content.
  // Critic maxTokens capped at 3500: rewriting an existing JSON doesn't
  // need the full first-pass budget, and the cap keeps total wall-clock
  // bounded even if pass 1 was generous.
  const tFirstDone = Date.now()
  const primaryCall = ledgerEntry('primary', config.provider, config.model, firstPass)
  console.log(`[crisp-engine] task=${args.task} pass1 done — model=${config.model} tokens=${primaryCall.totalTokens} elapsedMs=${tFirstDone - tStart}`)

  try {
    const criticConfig: ProfileConfig = { provider: 'openai', model: 'gpt-4o-mini' }
    const criticProvider = getProvider(criticConfig.provider)
    // Hard cap critic output at 2500 — rewriting an existing JSON doesn't
    // need a bigger budget than the original output. Real-world data on
    // channel-analysis showed the critic generating ~3800 total tokens
    // (input+output), with output around 2500-3000. Capping at 2500 trims
    // ~20-30% off pass 2 wall-clock. If a feature ever genuinely needs
    // more critic output, lift this cap per-task in a future change.
    const criticMaxTokens = Math.min(args.maxTokens, 2500)

    const critiquePrompt = `Original task instructions:\n${args.prompt}\n\n────────\n\nFirst-pass output to critique and rewrite:\n${firstPass.text}`

    const refinedPass = await criticProvider.generate({
      model: criticConfig.model,
      system: CRITIC_SYSTEM,
      prompt: critiquePrompt,
      maxTokens: criticMaxTokens,
    })

    console.log(`[crisp-engine] task=${args.task} pass2 done — critic=${criticConfig.model} tokens=${refinedPass.inputTokens + refinedPass.outputTokens} elapsedMs=${Date.now() - tFirstDone}`)
    const criticCall = ledgerEntry('critic', criticConfig.provider, criticConfig.model, refinedPass)

    // Refine target tasks all return JSON. If the critic's rewrite isn't
    // loose-parseable, drop it and keep the first pass — better to ship
    // good-enough than risk a malformed-output error.
    try {
      parseLooseJson(refinedPass.text)
    } catch {
      console.warn(`[crisp-engine] refine pass for task=${args.task} produced non-JSON output, falling back to first pass`)
      return {
        ...firstPass,
        totalTokens: primaryCall.totalTokens + criticCall.totalTokens,
        providerUsed: config.provider,
        modelUsed: config.model,
        tierUsed: effective,
        refined: false,
        aiCalls: [primaryCall, criticCall],
      }
    }

    return {
      text: refinedPass.text,
      inputTokens: firstPass.inputTokens + refinedPass.inputTokens,
      outputTokens: firstPass.outputTokens + refinedPass.outputTokens,
      totalTokens: primaryCall.totalTokens + criticCall.totalTokens,
      // providerUsed/modelUsed reflect pass 1 (the user-tier model). The
      // critic (Sonnet) is an internal QA layer not exposed in analytics.
      providerUsed: config.provider,
      modelUsed: config.model,
      tierUsed: effective,
      refined: true,
      aiCalls: [primaryCall, criticCall],
    }
  } catch (error) {
    console.warn(`[crisp-engine] refine pass for task=${args.task} threw, falling back to first pass:`, error)
    return {
      ...firstPass,
      totalTokens: primaryCall.totalTokens,
      providerUsed: config.provider,
      modelUsed: config.model,
      tierUsed: effective,
      refined: false,
      aiCalls: [primaryCall],
    }
  }
}
