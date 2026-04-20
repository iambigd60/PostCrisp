import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import {
  tierFromDbValue,
  TASK_TIER_PROFILE,
  DEFAULT_PROFILE_CONFIG,
  type Tier,
  type CrispTask,
} from '@/lib/crisp-engine-config'

// Monthly prices in USD. Mirror of values in src/lib/stripe.ts — kept local
// so this route doesn't pull in Stripe SDK server deps.
const TIER_MRR: Record<Tier, number> = {
  starter: 0,
  creator: 19,
  team:    49,
  elite:   79,
}

// ─── Model pricing ($ per 1M tokens) ─────────────────────────────────────
// Blended rate = (input + 3*output) / 4 — output dominates for generative tasks,
// and Anthropic cache reads reduce input cost further. Update when pricing shifts.
const MODEL_BLENDED_PRICE_PER_1M: Record<string, number> = {
  'gpt-4o-mini':      (0.15  + 3 * 0.60) / 4,  // ≈ $0.49
  'gpt-4o':           (2.50  + 3 * 10)    / 4, // ≈ $8.13
  'claude-sonnet-4-6':(3     + 3 * 15)    / 4, // ≈ $12
  'claude-opus-4-7':  (15    + 3 * 75)    / 4, // ≈ $60
}

// Feature names stored in `generations.feature` use underscores; CrispTask uses
// hyphens. Normalize both directions.
function featureToTask(feature: string): CrispTask | null {
  const hyphenated = feature.replace(/_/g, '-') as CrispTask
  return (hyphenated in TASK_TIER_PROFILE) ? hyphenated : null
}

// Estimated $ cost for a given feature + total tokens, using CURRENT creator-tier
// routing config. This is an approximation — it does not account for the tier the
// user was on at generation time, nor for routing changes mid-window.
function estimateCostUSD(feature: string, totalTokens: number): number {
  const task = featureToTask(feature)
  if (!task) return 0
  const profile = TASK_TIER_PROFILE[task].creator
  const { model } = DEFAULT_PROFILE_CONFIG[profile]
  const ratePerMillion = MODEL_BLENDED_PRICE_PER_1M[model] ?? 0
  return (totalTokens / 1_000_000) * ratePerMillion
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const now = new Date()
  const windowDays = 30
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000)
  const dayStart = new Date(now)
  dayStart.setUTCHours(0, 0, 0, 0)

  const [profilesRes, genRes, creditConsumeRes] = await Promise.all([
    auth.supabaseAdmin
      .from('profiles')
      .select('id, subscription_tier, created_at'),
    auth.supabaseAdmin
      .from('generations')
      .select('user_id, feature, tokens_used, created_at')
      .gte('created_at', windowStart.toISOString()),
    auth.supabaseAdmin
      .from('credit_transactions')
      .select('amount, created_at')
      .eq('type', 'consume')
      .gte('created_at', windowStart.toISOString()),
  ])

  if (profilesRes.error) return NextResponse.json({ error: profilesRes.error.message }, { status: 500 })
  if (genRes.error)      return NextResponse.json({ error: genRes.error.message }, { status: 500 })

  const profiles = profilesRes.data ?? []
  const gens = genRes.data ?? []
  const creditRows = creditConsumeRes.data ?? []

  // ─── User-level aggregates ──────────────────────────────────────────
  const totalUsers = profiles.length
  const tierCounts: Record<Tier, number> = { starter: 0, creator: 0, team: 0, elite: 0 }
  let newSignups30d = 0
  let paidUsers = 0
  let mrrEstimate = 0

  for (const p of profiles) {
    const tier = tierFromDbValue(p.subscription_tier)
    tierCounts[tier] += 1
    if (tier !== 'starter') paidUsers += 1
    mrrEstimate += TIER_MRR[tier]
    if (new Date(p.created_at) >= windowStart) newSignups30d += 1
  }

  // ─── Generation-level aggregates ────────────────────────────────────
  const todayUserIds = new Set<string>()
  const monthUserIds = new Set<string>()
  let totalTokens30d = 0
  let totalGenerations30d = 0

  const dailyMap: Record<string, { date: string; count: number; tokens: number }> = {}
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    dailyMap[key] = { date: key, count: 0, tokens: 0 }
  }

  const featureMap: Record<string, { feature: string; count: number; tokens: number; estCostUsd: number }> = {}
  const userUsageMap: Record<string, { user_id: string; count: number; tokens: number; estCostUsd: number }> = {}
  let totalEstCostUsd30d = 0

  for (const g of gens) {
    const created = new Date(g.created_at)
    const tokens = g.tokens_used ?? 0
    const feat = g.feature ?? 'unknown'
    const rowCost = estimateCostUSD(feat, tokens)
    totalTokens30d += tokens
    totalGenerations30d += 1
    totalEstCostUsd30d += rowCost
    monthUserIds.add(g.user_id)
    if (created >= dayStart) todayUserIds.add(g.user_id)

    const dayKey = g.created_at.slice(0, 10)
    if (dailyMap[dayKey]) {
      dailyMap[dayKey].count += 1
      dailyMap[dayKey].tokens += tokens
    }

    if (!featureMap[feat]) featureMap[feat] = { feature: feat, count: 0, tokens: 0, estCostUsd: 0 }
    featureMap[feat].count += 1
    featureMap[feat].tokens += tokens
    featureMap[feat].estCostUsd += rowCost

    if (!userUsageMap[g.user_id]) userUsageMap[g.user_id] = { user_id: g.user_id, count: 0, tokens: 0, estCostUsd: 0 }
    userUsageMap[g.user_id].count += 1
    userUsageMap[g.user_id].tokens += tokens
    userUsageMap[g.user_id].estCostUsd += rowCost
  }

  // ─── Top 10 users by tokens — join against profiles for display ────
  const topUserIds = Object.values(userUsageMap)
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 10)

  let topUsers: { user_id: string; email: string; full_name: string | null; tier: Tier; count: number; tokens: number; estCostUsd: number }[] = []
  if (topUserIds.length > 0) {
    const ids = topUserIds.map((u) => u.user_id)
    const { data: topProfiles } = await auth.supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, subscription_tier')
      .in('id', ids)
    const byId = new Map((topProfiles ?? []).map((p) => [p.id, p]))
    topUsers = topUserIds.map((u) => {
      const prof = byId.get(u.user_id)
      return {
        user_id: u.user_id,
        email: prof?.email ?? '(deleted user)',
        full_name: prof?.full_name ?? null,
        tier: tierFromDbValue(prof?.subscription_tier),
        count: u.count,
        tokens: u.tokens,
        estCostUsd: u.estCostUsd,
      }
    })
  }

  // ─── Credit consumption totals ──────────────────────────────────────
  const creditsConsumed30d = creditRows.reduce((acc, r) => acc + Math.abs(r.amount ?? 0), 0)

  return NextResponse.json({
    window: { days: windowDays, start: windowStart.toISOString(), end: now.toISOString() },
    kpi: {
      totalUsers,
      paidUsers,
      newSignups30d,
      mrrEstimate,
      dau: todayUserIds.size,
      mau: monthUserIds.size,
      totalGenerations30d,
      totalTokens30d,
      totalEstCostUsd30d,
      creditsConsumed30d,
      tierCounts,
    },
    daily: Object.values(dailyMap),
    featureBreakdown: Object.values(featureMap).sort((a, b) => b.count - a.count),
    topUsers,
  })
}
