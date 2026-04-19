import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import {
  ALL_TASKS,
  TASK_PROFILE,
  DEFAULT_PROFILE_CONFIG,
  invalidateOverrideCache,
  type CrispTask,
} from '@/lib/crisp-engine'
import { SUPPORTED_PROVIDERS, type ProviderId } from '@/lib/providers/types'

// GET — returns, for every task, { default, override, effective }
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { data, error } = await auth.supabase
    .from('ai_config_overrides')
    .select('task, provider, model, updated_at')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const overrideMap = new Map(
    (data ?? []).map((row) => [row.task, { provider: row.provider, model: row.model, updatedAt: row.updated_at }])
  )

  const items = ALL_TASKS.map((task) => {
    const profile = TASK_PROFILE[task]
    const def = DEFAULT_PROFILE_CONFIG[profile]
    const override = overrideMap.get(task) ?? null
    return {
      task,
      defaultProfile: profile,
      default: def,
      override,
      effective: override ? { provider: override.provider, model: override.model } : def,
    }
  })

  return NextResponse.json({ items })
}

// PUT body: { task, provider, model } — upserts an override
// PUT body: { task, reset: true }     — deletes override, restoring default
export async function PUT(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = await request.json()
  const task = body.task as CrispTask | undefined

  if (!task || !ALL_TASKS.includes(task)) {
    return NextResponse.json({ error: 'Invalid task' }, { status: 400 })
  }

  // Reset → delete override, fall back to code default
  if (body.reset) {
    const { error } = await auth.supabase
      .from('ai_config_overrides')
      .delete()
      .eq('task', task)
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
      { task, provider, model, updated_at: new Date().toISOString(), updated_by: auth.userId },
      { onConflict: 'task' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidateOverrideCache()
  return NextResponse.json({ ok: true, action: 'saved', task, provider, model })
}

// POST body: { tasks: string[], provider, model }  — bulk upsert
// POST body: { tasks: string[], reset: true }      — bulk delete (reset to default)
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = await request.json()
  const tasks = body.tasks as string[] | undefined

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return NextResponse.json({ error: 'tasks[] is required' }, { status: 400 })
  }
  const invalidTasks = tasks.filter((t) => !ALL_TASKS.includes(t as CrispTask))
  if (invalidTasks.length > 0) {
    return NextResponse.json({ error: `Invalid tasks: ${invalidTasks.join(', ')}` }, { status: 400 })
  }

  if (body.reset) {
    const { error } = await auth.supabase
      .from('ai_config_overrides')
      .delete()
      .in('task', tasks)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    invalidateOverrideCache()
    return NextResponse.json({ ok: true, action: 'bulk-reset', count: tasks.length })
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
  const rows = tasks.map((task) => ({
    task,
    provider,
    model,
    updated_at: now,
    updated_by: auth.userId,
  }))

  const { error } = await auth.supabase
    .from('ai_config_overrides')
    .upsert(rows, { onConflict: 'task' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidateOverrideCache()
  return NextResponse.json({ ok: true, action: 'bulk-saved', count: tasks.length, provider, model })
}
