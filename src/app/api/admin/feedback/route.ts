import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

const FEEDBACK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET — paginated feedback list for admin review
export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'all'
  const category = searchParams.get('category') ?? 'all'
  if (!['all', 'new', 'in_progress', 'resolved', 'archived'].includes(status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 })
  }
  const requestedPage = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1
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

  if (status === 'all') q = q.neq('status', 'archived')
  else q = q.eq('status', status)
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

// PATCH — update feedback status/notes, or archive/restore a resolved entry.
export async function PATCH(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
  }
  const { id, status, admin_notes, action } = body as {
    id?: string
    status?: 'new' | 'in_progress' | 'resolved'
    admin_notes?: string
    action?: 'archive' | 'restore'
  }

  if (typeof id !== 'string' || !FEEDBACK_ID.test(id)) {
    return NextResponse.json({ error: 'valid id is required' }, { status: 400 })
  }

  if (action !== undefined) {
    if (!['archive', 'restore'].includes(action) || status !== undefined || admin_notes !== undefined) {
      return NextResponse.json({ error: 'invalid action' }, { status: 400 })
    }
    const fromStatus = action === 'archive' ? 'resolved' : 'archived'
    const toStatus = action === 'archive' ? 'archived' : 'resolved'
    const { data, error } = await auth.supabaseAdmin
      .from('feedback')
      .update({ status: toStatus })
      .eq('id', id)
      .eq('status', fromStatus)
      .select('id')
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Feedback status changed; refresh and try again' }, { status: 409 })
    return NextResponse.json({ ok: true })
  }

  const updates: Record<string, unknown> = {}
  if (status !== undefined) {
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

  let query = auth.supabaseAdmin
    .from('feedback')
    .update(updates)
    .eq('id', id)
  if (status !== undefined) query = query.neq('status', 'archived')

  const { data, error } = await query.select('id').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Feedback not found or archived; refresh and try again' }, { status: 409 })
  return NextResponse.json({ ok: true })
}

// DELETE — permanently remove one feedback entry and its private admin notes.
export async function DELETE(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const id = new URL(request.url).searchParams.get('id')
  if (!id || !FEEDBACK_ID.test(id)) {
    return NextResponse.json({ error: 'valid id is required' }, { status: 400 })
  }

  const { data, error } = await auth.supabaseAdmin
    .from('feedback')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
