import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST body: { enabled: boolean, reason?: string }
// enabled=false → bans the user in auth (can't log in)
// enabled=true  → unbans
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id: userId } = await params
  const { enabled, reason } = (await request.json()) as { enabled?: boolean; reason?: string }

  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled (boolean) is required' }, { status: 400 })
  }

  if (userId === auth.userId && !enabled) {
    return NextResponse.json({ error: "You can't disable your own admin account" }, { status: 400 })
  }

  const admin = getAdminClient()

  // `ban_duration: 'none'` unbans; a long duration effectively disables the account
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: enabled ? 'none' : '876000h',  // ~100 years
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await auth.supabaseAdmin.from('admin_actions').insert({
    target_user_id: userId,
    actor_id: auth.userId,
    action: enabled ? 'enable' : 'disable',
    from_value: enabled ? 'disabled' : 'active',
    to_value: enabled ? 'active' : 'disabled',
    reason: reason ?? null,
  })

  return NextResponse.json({ ok: true, enabled })
}
