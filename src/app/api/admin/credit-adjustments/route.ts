import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { grantCredits } from '@/lib/credits'

// GET — list recent credit transactions (across all users) for admin review
export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500)

  const { data, error } = await auth.supabaseAdmin
    .from('credit_transactions')
    .select('id, user_id, type, amount, balance_after, reason, task, created_at, profiles:user_id(email, full_name)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ transactions: data ?? [] })
}

// POST — grant or adjust credits for a user
// Body: { userEmail: string, amount: number (positive=grant, negative=revoke), reason: string }
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = await request.json()
  const { userEmail, amount, reason } = body as { userEmail?: string; amount?: number; reason?: string }

  if (!userEmail || typeof amount !== 'number' || amount === 0 || !reason?.trim()) {
    return NextResponse.json({ error: 'userEmail, non-zero amount, and reason are required' }, { status: 400 })
  }

  // Find user by email
  const { data: target } = await auth.supabaseAdmin
    .from('profiles')
    .select('id, email, credits_balance')
    .eq('email', userEmail)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ error: `User with email ${userEmail} not found` }, { status: 404 })
  }

  // Positive amount = grant. Negative amount = adjust (subtract).
  if (amount > 0) {
    const result = await grantCredits(auth.supabaseAdmin, target.id, amount, {
      type: 'grant',
      reason: `Admin grant: ${reason}`,
      actorId: auth.userId,
    })
    if (!result) return NextResponse.json({ error: 'Failed to grant credits' }, { status: 500 })
    return NextResponse.json({ ok: true, action: 'granted', amount, newBalance: result.balanceAfter })
  }

  // Negative amount — adjust down
  const newBalance = Math.max(0, target.credits_balance + amount)  // amount is negative

  const { error: updateError } = await auth.supabaseAdmin
    .from('profiles')
    .update({ credits_balance: newBalance })
    .eq('id', target.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  await auth.supabaseAdmin.from('credit_transactions').insert({
    user_id: target.id,
    type: 'adjust',
    amount,  // negative
    balance_after: newBalance,
    reason: `Admin adjust: ${reason}`,
    actor_id: auth.userId,
  })

  return NextResponse.json({ ok: true, action: 'adjusted', amount, newBalance })
}
