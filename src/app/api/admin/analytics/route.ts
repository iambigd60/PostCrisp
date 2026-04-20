import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { tierFromDbValue, type Tier } from '@/lib/crisp-engine-config'

// Monthly prices in USD. Mirror of values in src/lib/stripe.ts — kept local
// so this route doesn't pull in Stripe SDK server deps.
const TIER_MRR: Record<Tier, number> = {
  starter: 0,
  creator: 19,
  team:    49,
  elite:   79,
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

  const featureMap: Record<string, { feature: string; count: number; tokens: number }> = {}
  const userUsageMap: Record<string, { user_id: string; count: number; tokens: number }> = {}

  for (const g of gens) {
    const created = new Date(g.created_at)
    const tokens = g.tokens_used ?? 0
    totalTokens30d += tokens
    totalGenerations30d += 1
    monthUserIds.add(g.user_id)
    if (created >= dayStart) todayUserIds.add(g.user_id)

    const dayKey = g.created_at.slice(0, 10)
    if (dailyMap[dayKey]) {
      dailyMap[dayKey].count += 1
      dailyMap[dayKey].tokens += tokens
    }

    const feat = g.feature ?? 'unknown'
    if (!featureMap[feat]) featureMap[feat] = { feature: feat, count: 0, tokens: 0 }
    featureMap[feat].count += 1
    featureMap[feat].tokens += tokens

    if (!userUsageMap[g.user_id]) userUsageMap[g.user_id] = { user_id: g.user_id, count: 0, tokens: 0 }
    userUsageMap[g.user_id].count += 1
    userUsageMap[g.user_id].tokens += tokens
  }

  // ─── Top 10 users by tokens — join against profiles for display ────
  const topUserIds = Object.values(userUsageMap)
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 10)

  let topUsers: { user_id: string; email: string; full_name: string | null; tier: Tier; count: number; tokens: number }[] = []
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
      creditsConsumed30d,
      tierCounts,
    },
    daily: Object.values(dailyMap),
    featureBreakdown: Object.values(featureMap).sort((a, b) => b.count - a.count),
    topUsers,
  })
}
