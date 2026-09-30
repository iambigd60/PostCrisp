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

type UserClient = Awaited<ReturnType<typeof createClient>>

async function hasAdminMfa(supabase: UserClient): Promise<boolean> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) return false
    // Passing the JWT makes Supabase fetch the current user/factors rather
    // than trusting the factor list cached in the cookie session. A stale
    // aal2 token must not pass after the last factor is removed.
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(session.access_token)
    return !error && data.currentLevel === 'aal2' && data.nextLevel === 'aal2'
  } catch {
    return false
  }
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
  const supabase = await createClient()

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

  if (!(await hasAdminMfa(supabase))) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Admin MFA required', code: 'MFA_REQUIRED', setupUrl: '/mfa' },
        { status: 403 }
      ),
    }
  }

  return { ok: true as const, userId: user.id, supabase, supabaseAdmin: serviceRoleClient() }
}

/**
 * Use at the top of admin pages. The layout redirects non-admins to the app
 * and AAL1 admins to the TOTP setup/challenge page.
 */
export async function checkAdminAccess(): Promise<{ isAdmin: boolean; mfaVerified: boolean; userId: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { isAdmin: false, mfaVerified: false, userId: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = profile?.role === 'admin'
  return { isAdmin, mfaVerified: isAdmin && await hasAdminMfa(supabase), userId: user.id }
}
