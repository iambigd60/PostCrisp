import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// GET — paginated feedback list for admin review
export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'all'
  const category = searchParams.get('category') ?? 'all'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let q = auth.supabaseAdmin
    .from('feedback')
    .select(
      'id, user_id, message, category, url, user_agent, status, admin_notes, resolved_at, created_at, user:user_id(email, full_name)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })

  if (status !== 'all') q = q.eq('status', status)
  if (category !== 'all') q = q.eq('category', category)

  const { data, error, count } = await q.range(from, to)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    feedback: data ?? [],
    page,
    pageSize,
    total: count ?? 0,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  })
}

// PATCH — update feedback status/notes. Body: { id, status?, admin_notes? }
export async function PATCH(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = await request.json()
  const { id, status, admin_notes } = body as {
    id?: string
    status?: 'new' | 'in_progress' | 'resolved'
    admin_notes?: string
  }

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (status) {
    if (!['new', 'in_progress', 'resolved'].includes(status)) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 })
    }
    updates.status = status
    if (status === 'resolved') {
      updates.resolved_at = new Date().toISOString()
      updates.resolved_by = auth.userId
    } else {
      updates.resolved_at = null
      updates.resolved_by = null
    }
  }
  if (typeof admin_notes === 'string') {
    updates.admin_notes = admin_notes.trim() || null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, action: 'no-change' })
  }

  const { error } = await auth.supabaseAdmin
    .from('feedback')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
