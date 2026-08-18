import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { hasCurrentAcceptance, type AlphaNdaAcceptance } from './alpha-agreement'
import { isSafeRelativePath } from './post-auth-destination'

/**
 * Server-side guard for authenticated routes. Ensures the user has accepted
 * the current version of the Alpha Tester Agreement, or redirects them to
 * /accept-terms?next=<current-path>.
 *
 * Admins bypass the gate (they're the ones running the platform).
 *
 * Call this at the top of a server component (layout or page) to gate an
 * entire route tree. It's a no-op if the user has a valid acceptance.
 *
 * @param nextPath — path to return to after acceptance. Defaults to '/dashboard'.
 */
export async function requireAlphaAcceptance(nextPath: string = '/dashboard'): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // No user = not authenticated; let other guards (middleware/login) handle it.
  if (!user) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, preferences')
    .eq('id', user.id)
    .maybeSingle()

  // Admins bypass — they're the ones shipping the product.
  if (profile?.role === 'admin') return

  const prefs = (profile?.preferences ?? {}) as { alpha_nda?: AlphaNdaAcceptance | null }
  if (hasCurrentAcceptance(prefs.alpha_nda ?? null)) return

  // Missing or stale-version acceptance → redirect to the gate. Use the same
  // guard as every other post-auth redirect decision rather than a weaker
  // `startsWith('/')`-only check, which would let `//evil.example.com`
  // through as an open redirect. Not currently exploitable — both callers
  // pass a literal — but a fourth path quietly regressing this is exactly
  // the failure this centralisation exists to prevent.
  const safePath = isSafeRelativePath(nextPath) ? nextPath : '/dashboard'
  redirect(`/accept-terms?next=${encodeURIComponent(safePath)}`)
}
