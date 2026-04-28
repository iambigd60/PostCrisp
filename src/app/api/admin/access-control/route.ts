import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { readAccessControl, writeAccessControl, type AccessControl, type SignupMode } from '@/lib/platform-settings'

const VALID_MODES: SignupMode[] = ['open', 'invite', 'closed']

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const settings = await readAccessControl()
  return NextResponse.json(settings)
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = (await request.json()) as Partial<AccessControl>
  const current = await readAccessControl()

  const next: AccessControl = {
    signup_mode: body.signup_mode ?? current.signup_mode,
    invite_code: body.invite_code ?? current.invite_code,
    login_enabled: body.login_enabled ?? current.login_enabled,
  }

  if (!VALID_MODES.includes(next.signup_mode)) {
    return NextResponse.json({ error: 'Invalid signup_mode' }, { status: 400 })
  }
  // Note: invite_code is now optional in invite-only mode — single-use codes
  // (invite_codes table) can stand alone. The shared code is the legacy
  // fallback path.

  await writeAccessControl(next, auth.userId)

  // Log the change to admin_actions so it shows on the Audit Log page
  await auth.supabaseAdmin.from('admin_actions').insert({
    actor_id: auth.userId,
    target_user_id: auth.userId,  // self-target since it's a global setting
    action: 'access_control_change',
    from_value: JSON.stringify({
      signup_mode: current.signup_mode,
      login_enabled: current.login_enabled,
      has_invite_code: !!current.invite_code,
    }),
    to_value: JSON.stringify({
      signup_mode: next.signup_mode,
      login_enabled: next.login_enabled,
      has_invite_code: !!next.invite_code,
    }),
    reason: null,
  })

  return NextResponse.json({ ok: true, settings: next })
}
