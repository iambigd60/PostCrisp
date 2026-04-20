import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

// GET /api/admin/audit — paginated admin_actions log with filters.
// Query params: action, targetEmail, window (days), page
export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') ?? 'all'
  const targetEmail = (searchParams.get('targetEmail') ?? '').trim().toLowerCase()
  const windowDays = parseInt(searchParams.get('window') ?? '30', 10)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let q = auth.supabaseAdmin
    .from('admin_actions')
    .select(
      'id, actor_id, target_user_id, action, from_value, to_value, reason, created_at, actor:actor_id(email, full_name), target:target_user_id(email, full_name)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })

  if (action !== 'all') q = q.eq('action', action)

  if (windowDays > 0) {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()
    q = q.gte('created_at', since)
  }

  // Email filter: resolve email → user id (actor or target), then filter by target_user_id.
  // Keep it simple — only filter by target email since that's the primary review use case.
  if (targetEmail) {
    const { data: matchingProfiles } = await auth.supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('email', `%${targetEmail}%`)

    const ids = (matchingProfiles ?? []).map((p) => p.id)
    if (ids.length === 0) {
      return NextResponse.json({ actions: [], page, pageSize, total: 0, totalPages: 0 })
    }
    q = q.in('target_user_id', ids)
  }

  const { data, error, count } = await q.range(from, to)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    actions: data ?? [],
    page,
    pageSize,
    total: count ?? 0,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  })
}
