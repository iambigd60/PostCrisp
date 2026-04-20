import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'

function serviceRoleClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

/**
 * Use in admin API routes. Returns { ok: true, userId, supabase, supabaseAdmin } on success,
 * or { ok: false, response } with a 401/403 response.
 *
 * - `supabase`       — user-scoped client (subject to RLS). Safe for the caller's own data.
 * - `supabaseAdmin`  — service-role client that BYPASSES RLS. Use for cross-user reads/writes
 *                      (listing users, editing another user's profile, reading their generations).
 */
export async function requireAdmin() {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') {
    return { ok: false as const, response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
  }

  return { ok: true as const, userId: user.id, supabase, supabaseAdmin: serviceRoleClient() }
}

/**
 * Use at the top of admin pages. Returns `true` if admin, else `false`
 * (caller should redirect).
 */
export async function checkAdminAccess(): Promise<{ isAdmin: boolean; userId: string | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { isAdmin: false, userId: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  return { isAdmin: profile?.role === 'admin', userId: user.id }
}
