import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { tierFromDbValue, type Tier } from '@/lib/crisp-engine-config'

// Monthly prices in USD. Mirror of values in src/lib/stripe.ts — kept local
// so this route doesn't pull in Stripe SDK server deps.
const TIER_MRR: Record<Tier, number> = {
  starter: 0,
  creator: 19,
  elite:   79,
}

/**
 * Admin analytics: user, revenue, usage, and estimated AI-cost rollups.
 *
 * Token and cost figures come only from generation_ai_calls, which the
 * service role writes as each AI call completes. generations.tokens_used is
 * not used: users can insert and update their own generations rows, so it
 * would let anyone inflate these numbers. Generation counts and active users
 * still come from generations.
 */
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
      .select('user_id, feature, created_at')
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

  const { data: aiCallRows, error: aiCallError } = await auth.supabaseAdmin
    .from('generation_ai_calls')
    .select('user_id, feature, total_tokens, estimated_cost_usd, created_at')
    .gte('created_at', windowStart.toISOString())

  if (aiCallError) return NextResponse.json({ error: aiCallError.message }, { status: 500 })
  const ledgerRows = aiCallRows ?? []

  // ─── User-level aggregates ──────────────────────────────────────────
  const totalUsers = profiles.length
  const tierCounts: Record<Tier, number> = { starter: 0, creator: 0, elite: 0 }
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

  const featureEntry = (feat: string) =>
    (featureMap[feat] ??= { feature: feat, count: 0, tokens: 0, estCostUsd: 0 })
  const userEntry = (userId: string) =>
    (userUsageMap[userId] ??= { user_id: userId, count: 0, tokens: 0, estCostUsd: 0 })

  for (const g of gens) {
    totalGenerations30d += 1
    monthUserIds.add(g.user_id)
    if (new Date(g.created_at) >= dayStart) todayUserIds.add(g.user_id)

    const dayKey = g.created_at.slice(0, 10)
    if (dailyMap[dayKey]) dailyMap[dayKey].count += 1

    featureEntry(g.feature ?? 'unknown').count += 1
    userEntry(g.user_id).count += 1
  }

  for (const call of ledgerRows) {
    const tokens = Number(call.total_tokens ?? 0)
    const cost = Number(call.estimated_cost_usd ?? 0)
    totalTokens30d += tokens
    totalEstCostUsd30d += cost

    const dayKey = String(call.created_at).slice(0, 10)
    if (dailyMap[dayKey]) dailyMap[dayKey].tokens += tokens

    const feature = featureEntry(call.feature ?? 'unknown')
    feature.tokens += tokens
    feature.estCostUsd += cost

    const user = userEntry(call.user_id)
    user.tokens += tokens
    user.estCostUsd += cost
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
