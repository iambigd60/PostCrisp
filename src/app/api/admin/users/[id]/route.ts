import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
import { tierFromDbValue, TIER_LABELS, type Tier } from '@/lib/crisp-engine-config'

const VALID_TIERS = new Set(['free', 'creator', 'team', 'elite'])
const VALID_ROLES = new Set(['user', 'admin'])

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── GET — user detail with aggregates ────────────────────────────────────
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id: userId } = await params

  const [profileRes, genAggregateRes, recentGensRes, creditTxRes, adminActionsRes, savedCountRes] = await Promise.all([
    auth.supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, avatar_url, subscription_tier, role, stripe_customer_id, stripe_subscription_id, credits_balance, credits_reset_at, daily_generations_used, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle(),
    auth.supabaseAdmin
      .from('generations')
      .select('feature, tokens_used', { count: 'exact' })
      .eq('user_id', userId),
    auth.supabaseAdmin
      .from('generations')
      .select('id, feature, platform, created_at, tokens_used')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(15),
    auth.supabaseAdmin
      .from('credit_transactions')
      .select('id, type, amount, balance_after, reason, task, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    auth.supabaseAdmin
      .from('admin_actions')
      .select('id, actor_id, action, from_value, to_value, reason, created_at, actor:actor_id(email)')
      .eq('target_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    auth.supabaseAdmin
      .from('saved_content')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
  ])

  if (profileRes.error || !profileRes.data) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Try to read auth.users ban_duration via service role to infer disabled state
  let isDisabled = false
  try {
    const admin = getAdminClient()
    const { data: authUser } = await admin.auth.admin.getUserById(userId)
    const banned = authUser?.user?.banned_until
    isDisabled = !!banned && new Date(banned) > new Date()
  } catch {
    // If service role isn't available we just report undefined — UI handles gracefully
  }

  // Feature breakdown from generations
  const featureCounts: Record<string, { count: number; tokens: number }> = {}
  let totalTokens = 0
  for (const row of (genAggregateRes.data ?? []) as { feature: string; tokens_used: number }[]) {
    const f = row.feature
    if (!featureCounts[f]) featureCounts[f] = { count: 0, tokens: 0 }
    featureCounts[f].count += 1
    featureCounts[f].tokens += row.tokens_used ?? 0
    totalTokens += row.tokens_used ?? 0
  }

  const tier: Tier = tierFromDbValue(profileRes.data.subscription_tier)

  return NextResponse.json({
    profile: {
      ...profileRes.data,
      tier,
      tierLabel: TIER_LABELS[tier],
    },
    isDisabled,
    aggregates: {
      totalGenerations: genAggregateRes.count ?? 0,
      totalTokens,
      savedCount: savedCountRes.count ?? 0,
      featureBreakdown: Object.entries(featureCounts)
        .map(([feature, stats]) => ({ feature, ...stats }))
        .sort((a, b) => b.count - a.count),
    },
    recentGenerations: recentGensRes.data ?? [],
    creditTransactions: creditTxRes.data ?? [],
    adminActions: adminActionsRes.data ?? [],
  })
}

// ─── PATCH — change tier or role ──────────────────────────────────────────
// Body: { tier?: string, role?: string, reason?: string }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id: userId } = await params
  const body = await request.json()
  const { tier, role, reason } = body as { tier?: string; role?: string; reason?: string }

  if (!tier && !role) {
    return NextResponse.json({ error: 'tier or role is required' }, { status: 400 })
  }
  if (tier && !VALID_TIERS.has(tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  }
  if (role && !VALID_ROLES.has(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const { data: current } = await auth.supabaseAdmin
    .from('profiles')
    .select('id, subscription_tier, role')
    .eq('id', userId)
    .maybeSingle()

  if (!current) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const updates: Record<string, string> = {}
  if (tier && tier !== current.subscription_tier) updates.subscription_tier = tier
  if (role && role !== current.role) updates.role = role

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, action: 'no-change' })
  }

  const { error } = await auth.supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log each change
  const logs: { target_user_id: string; actor_id: string; action: string; from_value: string; to_value: string; reason: string | null }[] = []
  if (updates.subscription_tier) {
    logs.push({
      target_user_id: userId,
      actor_id: auth.userId,
      action: 'tier_change',
      from_value: current.subscription_tier,
      to_value: updates.subscription_tier,
      reason: reason ?? null,
    })
  }
  if (updates.role) {
    logs.push({
      target_user_id: userId,
      actor_id: auth.userId,
      action: 'role_change',
      from_value: current.role,
      to_value: updates.role,
      reason: reason ?? null,
    })
  }
  if (logs.length > 0) {
    await auth.supabaseAdmin.from('admin_actions').insert(logs)
  }

  return NextResponse.json({ ok: true, action: 'updated', updates })
}
