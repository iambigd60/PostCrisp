import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

interface UserRow {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  subscription_tier: string
  role: string
  credits_balance: number
  credits_reset_at: string
  daily_generations_used: number
  created_at: string
}

export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const search = (searchParams.get('search') ?? '').trim().toLowerCase()
  const tier = searchParams.get('tier') ?? 'all'
  const role = searchParams.get('role') ?? 'all'
  const sort = searchParams.get('sort') ?? 'newest'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let q = auth.supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, avatar_url, subscription_tier, role, credits_balance, credits_reset_at, daily_generations_used, created_at', { count: 'exact' })

  if (search) q = q.ilike('email', `%${search}%`)
  if (tier !== 'all') q = q.eq('subscription_tier', tier)
  if (role !== 'all') q = q.eq('role', role)

  switch (sort) {
    case 'oldest':  q = q.order('created_at', { ascending: true }); break
    case 'credits': q = q.order('credits_balance', { ascending: false }); break
    case 'usage':   q = q.order('daily_generations_used', { ascending: false }); break
    default:        q = q.order('created_at', { ascending: false }); break
  }

  const { data, error, count } = await q.range(from, to)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregate generations count this month for listed users
  const userIds = (data ?? []).map((u) => u.id)
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)

  let monthlyGenerations: Record<string, number> = {}
  if (userIds.length > 0) {
    const { data: gens } = await auth.supabaseAdmin
      .from('generations')
      .select('user_id')
      .in('user_id', userIds)
      .gte('created_at', monthStart.toISOString())

    if (gens) {
      monthlyGenerations = gens.reduce<Record<string, number>>((acc, row) => {
        acc[row.user_id] = (acc[row.user_id] ?? 0) + 1
        return acc
      }, {})
    }
  }

  const users = (data as UserRow[] | null ?? []).map((u) => ({
    ...u,
    generations_this_month: monthlyGenerations[u.id] ?? 0,
  }))

  return NextResponse.json({
    users,
    page,
    pageSize,
    total: count ?? 0,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  })
}
