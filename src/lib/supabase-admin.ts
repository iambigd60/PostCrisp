import { createClient as createAdminClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client for trusted server-side writes that must
 * bypass RLS and the column-level grants on `profiles` (credit/quota
 * mutations that are server-controlled, not user-editable).
 *
 * Returns `null` when the service-role key isn't configured (e.g. local dev
 * or unit tests without secrets) so callers can fall back to the passed
 * user-scoped client — mirrors the pattern already used in ai-call-ledger.ts.
 */
export function serviceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
