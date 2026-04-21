import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createClient } from '@/utils/supabase/server'

// POST — trigger Supabase's password recovery email for the target user.
// Uses the same flow as /forgot-password, just initiated by an admin.
// The user clicks the email link → /auth/callback exchanges the code for a
// recovery session → redirects to /auth/reset-password where they set a new pw.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const userId = params.id

  // Look up target email via service role (bypasses RLS on profiles)
  const { data: target, error: lookupError } = await auth.supabaseAdmin
    .from('profiles')
    .select('id, email')
    .eq('id', userId)
    .maybeSingle()

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 })
  }
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Derive origin from the request (works in any env without needing
  // NEXT_PUBLIC_SITE_URL). Falls back to env var then to an empty relative URL.
  const origin =
    request.headers.get('origin') ||
    (request.headers.get('host') ? `https://${request.headers.get('host')}` : '') ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    ''

  // Trigger the recovery email via user-scoped client (which respects the
  // configured SMTP — Resend in our case).
  const supabase = createClient()
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(target.email, {
    redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
  })

  if (resetError) {
    return NextResponse.json({ error: resetError.message }, { status: 500 })
  }

  // Log the admin action so it surfaces in the audit viewer
  await auth.supabaseAdmin.from('admin_actions').insert({
    actor_id: auth.userId,
    target_user_id: userId,
    action: 'password_reset',
    from_value: null,
    to_value: target.email,
    reason: null,
  })

  return NextResponse.json({ ok: true, email: target.email })
}
