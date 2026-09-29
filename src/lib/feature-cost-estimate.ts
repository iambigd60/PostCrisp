import { DEFAULT_PROFILE_CONFIG, TASK_TIER_PROFILE, type CrispTask } from './crisp-engine-config'
import { blendedPricePer1M } from './ai-costs'

/**
 * Map a stored `generations.feature` value (underscores) to a CrispTask, or
 * null when it isn't one. Stored feature values are written with the user's
 * own Supabase client, so this must be an own-property check: `in` would
 * accept inherited names like "constructor" and hand back a non-task.
 */
export function featureToTask(feature: string): CrispTask | null {
  const hyphenated = feature.replace(/_/g, '-')
  return Object.hasOwn(TASK_TIER_PROFILE, hyphenated) ? (hyphenated as CrispTask) : null
}

/**
 * Rough $ cost for a feature + token count, priced at the CURRENT creator-tier
 * routing. An approximation for generations with no ledger row: it ignores the
 * tier the user was on and any mid-window routing change. Returns 0 for
 * anything it can't price — unknown feature, unknown profile, or a token
 * count that isn't a positive finite number.
 */
export function estimateFeatureCostUsd(feature: string, totalTokens: number): number {
  if (!Number.isFinite(totalTokens) || totalTokens <= 0) return 0
  const task = featureToTask(feature)
  if (!task) return 0
  const config = DEFAULT_PROFILE_CONFIG[TASK_TIER_PROFILE[task].creator]
  if (!config) return 0
  return (totalTokens / 1_000_000) * blendedPricePer1M(config.model)
}
