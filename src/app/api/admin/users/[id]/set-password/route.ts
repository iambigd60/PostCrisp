import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

// POST — admin directly sets a new password for a user via service role.
// Used to onboard testers who can't receive the normal recovery email
// (e.g., Outlook SafeLinks consuming the one-time token) or for support
// when a user is locked out. Admin shares the new password out-of-band.
// Body: { password: string }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id: userId } = await params

  if (userId === auth.userId) {
    return NextResponse.json(
      { error: "Use scripts/rotate-admin-password.mjs for your own account." },
      { status: 400 }
    )
  }

  const body = await request.json()
  const password = typeof body?.password === 'string' ? body.password : ''

  if (password.length < 12) {
    return NextResponse.json({ error: 'Password must be at least 12 characters.' }, { status: 400 })
  }
  if (password.length > 256) {
    return NextResponse.json({ error: 'Password too long.' }, { status: 400 })
  }

  // Look up target email (for the audit log — we deliberately do NOT log
  // the password anywhere).
  const { data: target } = await auth.supabaseAdmin
    .from('profiles')
    .select('id, email')
    .eq('id', userId)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { error } = await auth.supabaseAdmin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,  // in case tester's email was never confirmed, unblock login
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log the action — email goes in to_value for traceability. The password
  // itself never appears anywhere in logs, DB, or response.
  await auth.supabaseAdmin.from('admin_actions').insert({
    actor_id: auth.userId,
    target_user_id: userId,
    action: 'password_set',
    from_value: null,
    to_value: target.email,
    reason: null,
  })

  return NextResponse.json({ ok: true, email: target.email })
}
