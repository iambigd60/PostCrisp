import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import {
  ALL_TASKS,
  CONFIGURABLE_TIERS,
  TASK_TIER_PROFILE,
  DEFAULT_PROFILE_CONFIG,
  invalidateOverrideCache,
  type CrispTask,
  type ConfigurableTier,
} from '@/lib/crisp-engine'
import { SUPPORTED_PROVIDERS, type ProviderId } from '@/lib/providers/types'

interface OverrideRow {
  task: string
  tier: string
  provider: string
  model: string
  updated_at: string
}

// GET — returns, for every (task × configurable tier) cell, { default, override, effective }
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { data, error } = await auth.supabase
    .from('ai_config_overrides')
    .select('task, tier, provider, model, updated_at')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const overrideMap = new Map<string, OverrideRow>()
  for (const row of (data as OverrideRow[] | null) ?? []) {
    overrideMap.set(`${row.task}::${row.tier}`, row)
  }

  const items = ALL_TASKS.map((task) => {
    const tiers: Record<ConfigurableTier, {
      defaultProfile: string
      default: { provider: ProviderId; model: string }
      override: { provider: string; model: string; updatedAt: string } | null
      effective: { provider: string; model: string }
    }> = {} as never

    for (const tier of CONFIGURABLE_TIERS) {
      const profile = TASK_TIER_PROFILE[task][tier]
      const def = DEFAULT_PROFILE_CONFIG[profile]
      const override = overrideMap.get(`${task}::${tier}`) ?? null
      tiers[tier] = {
        defaultProfile: profile,
        default: def,
        override: override
          ? { provider: override.provider, model: override.model, updatedAt: override.updated_at }
          : null,
        effective: override
          ? { provider: override.provider, model: override.model }
          : def,
      }
    }

    return { task, tiers }
  })

  return NextResponse.json({ items })
}

// PUT body: { task, tier, provider, model }  — single upsert
// PUT body: { task, tier, reset: true }      — single reset (delete)
export async function PUT(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = await request.json()
  const task = body.task as CrispTask | undefined
  const tier = body.tier as ConfigurableTier | undefined

  if (!task || !ALL_TASKS.includes(task)) {
    return NextResponse.json({ error: 'Invalid task' }, { status: 400 })
  }
  if (!tier || !CONFIGURABLE_TIERS.includes(tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  }

  if (body.reset) {
    const { error } = await auth.supabase
      .from('ai_config_overrides')
      .delete()
      .eq('task', task)
      .eq('tier', tier)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    invalidateOverrideCache()
    return NextResponse.json({ ok: true, action: 'reset' })
  }

  const provider = body.provider as ProviderId | undefined
  const model = body.model as string | undefined

  if (!provider || !SUPPORTED_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }
  if (!model || typeof model !== 'string' || model.length < 3) {
    return NextResponse.json({ error: 'Invalid model' }, { status: 400 })
  }

  const { error } = await auth.supabase
    .from('ai_config_overrides')
    .upsert(
      { task, tier, provider, model, updated_at: new Date().toISOString(), updated_by: auth.userId },
      { onConflict: 'task,tier' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidateOverrideCache()
  return NextResponse.json({ ok: true, action: 'saved', task, tier, provider, model })
}

// POST body: { tasks: string[], tiers: string[], provider, model }  — bulk upsert
// POST body: { tasks: string[], tiers: string[], reset: true }      — bulk delete
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = await request.json()
  const tasks = body.tasks as string[] | undefined
  const tiers = body.tiers as string[] | undefined

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return NextResponse.json({ error: 'tasks[] is required' }, { status: 400 })
  }
  if (!Array.isArray(tiers) || tiers.length === 0) {
    return NextResponse.json({ error: 'tiers[] is required (pick which tiers to apply)' }, { status: 400 })
  }

  const invalidTasks = tasks.filter((t) => !ALL_TASKS.includes(t as CrispTask))
  if (invalidTasks.length > 0) {
    return NextResponse.json({ error: `Invalid tasks: ${invalidTasks.join(', ')}` }, { status: 400 })
  }
  const invalidTiers = tiers.filter((t) => !CONFIGURABLE_TIERS.includes(t as ConfigurableTier))
  if (invalidTiers.length > 0) {
    return NextResponse.json({ error: `Invalid tiers: ${invalidTiers.join(', ')}` }, { status: 400 })
  }

  if (body.reset) {
    const { error } = await auth.supabase
      .from('ai_config_overrides')
      .delete()
      .in('task', tasks)
      .in('tier', tiers)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    invalidateOverrideCache()
    return NextResponse.json({ ok: true, action: 'bulk-reset', taskCount: tasks.length, tierCount: tiers.length })
  }

  const provider = body.provider as ProviderId | undefined
  const model = body.model as string | undefined
  if (!provider || !SUPPORTED_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }
  if (!model || typeof model !== 'string' || model.length < 3) {
    return NextResponse.json({ error: 'Invalid model' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const rows: { task: string; tier: string; provider: string; model: string; updated_at: string; updated_by: string }[] = []
  for (const task of tasks) {
    for (const tier of tiers) {
      rows.push({ task, tier, provider, model, updated_at: now, updated_by: auth.userId })
    }
  }

  const { error } = await auth.supabase
    .from('ai_config_overrides')
    .upsert(rows, { onConflict: 'task,tier' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidateOverrideCache()
  return NextResponse.json({
    ok: true,
    action: 'bulk-saved',
    rowCount: rows.length,
    provider,
    model,
  })
}
