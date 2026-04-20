/**
 * Feature access gating — which subscription tier unlocks each feature.
 *
 * Two layers:
 *  - Code defaults: DEFAULT_MIN_TIER below, safe baseline if the DB is empty.
 *  - Runtime overrides: `feature_access` table in Supabase, editable from
 *    /admin/feature-access. Overrides take precedence.
 *
 * Called by feature API routes to reject users whose tier is below the
 * feature's minimum.
 */

import { createClient } from '@/utils/supabase/server'
import { type CrispTask, type Tier } from './crisp-engine-config'
import { DEFAULT_MIN_TIER } from './feature-access-config'

export { DEFAULT_MIN_TIER }

const TIER_RANK: Record<Tier, number> = {
  starter: 0,
  creator: 1,
  team:    1, // Team is rank-equivalent to Creator for access purposes
  elite:   2,
}

// ─── Override cache (60s) ───────────────────────────────────────────────────

interface AccessRow {
  feature: string
  min_tier: Tier
  enabled: boolean
}

interface CacheEntry {
  rows: Map<string, AccessRow>
  fetchedAt: number
}
let _cache: CacheEntry | null = null
const CACHE_TTL_MS = 60_000

async function loadAccess(): Promise<Map<string, AccessRow>> {
  if (_cache && Date.now() - _cache.fetchedAt < CACHE_TTL_MS) return _cache.rows

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('feature_access')
      .select('feature, min_tier, enabled')
    if (error) {
      console.error('[feature-access] failed to load:', error.message)
      return new Map()
    }
    const map = new Map<string, AccessRow>()
    for (const row of (data as AccessRow[] | null) ?? []) {
      map.set(row.feature, row)
    }
    _cache = { rows: map, fetchedAt: Date.now() }
    return map
  } catch (e) {
    console.error('[feature-access] load threw:', e)
    return new Map()
  }
}

export function invalidateAccessCache() {
  _cache = null
}

export interface AccessResolution {
  allowed: boolean
  minTier: Tier
  enabled: boolean
  reason?: 'tier_too_low' | 'feature_disabled'
}

export async function resolveFeatureAccess(task: CrispTask, userTier: Tier): Promise<AccessResolution> {
  const overrides = await loadAccess()
  const row = overrides.get(task)
  const minTier = row?.min_tier ?? DEFAULT_MIN_TIER[task]
  const enabled = row?.enabled ?? true

  if (!enabled) {
    return { allowed: false, minTier, enabled: false, reason: 'feature_disabled' }
  }
  if (TIER_RANK[userTier] < TIER_RANK[minTier]) {
    return { allowed: false, minTier, enabled: true, reason: 'tier_too_low' }
  }
  return { allowed: true, minTier, enabled: true }
}

/**
 * Format an "upgrade required" response body for API routes.
 */
import { NextResponse } from 'next/server'
import { TIER_LABELS } from './crisp-engine-config'

export function featureBlockedResponse(access: AccessResolution): NextResponse {
  if (access.reason === 'feature_disabled') {
    return NextResponse.json(
      { error: 'This feature is temporarily disabled.', code: 'FEATURE_DISABLED' },
      { status: 403 }
    )
  }
  return NextResponse.json(
    {
      error: `This feature requires ${TIER_LABELS[access.minTier]}. Upgrade to unlock.`,
      code: 'UPGRADE_REQUIRED',
      minTier: access.minTier,
    },
    { status: 403 }
  )
}
