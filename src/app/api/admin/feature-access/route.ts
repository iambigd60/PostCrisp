import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { ALL_TASKS, type CrispTask, type Tier } from '@/lib/crisp-engine'
import { DEFAULT_MIN_TIER, invalidateAccessCache } from '@/lib/feature-access'

const VALID_TIERS: Tier[] = ['starter', 'creator', 'team', 'elite']

interface AccessRow {
  feature: string
  min_tier: Tier
  enabled: boolean
  updated_at: string
}

// GET — returns each feature's current min_tier + enabled + default
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { data, error } = await auth.supabase
    .from('feature_access')
    .select('feature, min_tier, enabled, updated_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const overrideMap = new Map<string, AccessRow>()
  for (const row of (data as AccessRow[] | null) ?? []) {
    overrideMap.set(row.feature, row)
  }

  const items = ALL_TASKS.map((task) => {
    const override = overrideMap.get(task) ?? null
    return {
      feature: task,
      defaultMinTier: DEFAULT_MIN_TIER[task],
      minTier: override?.min_tier ?? DEFAULT_MIN_TIER[task],
      enabled: override?.enabled ?? true,
      override,
    }
  })

  return NextResponse.json({ items })
}

// PUT — upsert single: { feature, minTier, enabled }
// PUT — reset single: { feature, reset: true }
export async function PUT(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = await request.json()
  const feature = body.feature as CrispTask | undefined

  if (!feature || !ALL_TASKS.includes(feature)) {
    return NextResponse.json({ error: 'Invalid feature' }, { status: 400 })
  }

  if (body.reset) {
    const { error } = await auth.supabase
      .from('feature_access')
      .delete()
      .eq('feature', feature)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    invalidateAccessCache()
    return NextResponse.json({ ok: true, action: 'reset' })
  }

  const minTier = body.minTier as Tier | undefined
  const enabled = typeof body.enabled === 'boolean' ? body.enabled : true

  if (!minTier || !VALID_TIERS.includes(minTier)) {
    return NextResponse.json({ error: 'Invalid minTier' }, { status: 400 })
  }

  const { error } = await auth.supabase
    .from('feature_access')
    .upsert(
      { feature, min_tier: minTier, enabled, updated_at: new Date().toISOString(), updated_by: auth.userId },
      { onConflict: 'feature' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidateAccessCache()
  return NextResponse.json({ ok: true, action: 'saved', feature, minTier, enabled })
}
