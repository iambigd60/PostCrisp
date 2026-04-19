import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * Use in admin API routes. Returns { ok: true, userId, supabase } on success,
 * or { ok: false, response } with a 401/403 response.
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

  return { ok: true as const, userId: user.id, supabase }
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
