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
import {
  type CrispTask,
  type PowerProfile,
  type ProfileConfig,
  type Tier,
  type ConfigurableTier,
  DEFAULT_PROFILE_CONFIG,
  TASK_TIER_PROFILE,
  effectiveTier,
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
  effectiveTier,
  tierFromDbValue,
} from './crisp-engine-config'
export type {
  CrispTask,
  PowerProfile,
  ProfileConfig,
  Tier,
  ConfigurableTier,
} from './crisp-engine-config'

// ─── Override cache (60s) ───────────────────────────────────────────────────
// Keyed by `${task}::${tier}` to scope overrides per-tier.

interface CacheEntry {
  overrides: Map<string, ProfileConfig>
  fetchedAt: number
}
let _cache: CacheEntry | null = null
const CACHE_TTL_MS = 60_000

function cacheKey(task: CrispTask, tier: ConfigurableTier): string {
  return `${task}::${tier}`
}

async function loadOverrides(): Promise<Map<string, ProfileConfig>> {
  if (_cache && Date.now() - _cache.fetchedAt < CACHE_TTL_MS) return _cache.overrides

  try {
    const supabase = createSupabaseServer()
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
  prompt: string
  maxTokens: number
}

export interface CrispGenerateResult {
  text: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  providerUsed: ProviderId
  modelUsed: string
  tierUsed: ConfigurableTier
}

export async function resolveTaskConfig(
  task: CrispTask,
  tier: Tier
): Promise<{ config: ProfileConfig; effective: ConfigurableTier }> {
  const effective = effectiveTier(tier)

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
  const { config, effective } = await resolveTaskConfig(args.task, args.tier)
  const providerImpl = getProvider(config.provider)

  const result = await providerImpl.generate({
    model: config.model,
    system: args.system ?? systemPromptFor(args.task),
    prompt: args.prompt,
    maxTokens: args.maxTokens,
  })

  return {
    ...result,
    totalTokens: result.inputTokens + result.outputTokens,
    providerUsed: config.provider,
    modelUsed: config.model,
    tierUsed: effective,
  }
}
