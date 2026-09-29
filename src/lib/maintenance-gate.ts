/**
 * Maintenance pause (access_control.login_enabled = false).
 *
 * The login form enforces the pause, but a session can also come straight
 * from Supabase Auth (or predate the pause), so middleware re-checks it on
 * every signed-in request to an app surface. Pure helpers here; the database
 * read lives in middleware. Admins are always exempt.
 */

export const MAINTENANCE_MESSAGE = 'PostCrisp is temporarily paused for maintenance. Check back soon.'

const GATED_PAGE_PREFIXES = ['/dashboard', '/onboarding', '/accept-terms']

// Machine-to-machine endpoints that must keep working during a pause. (The
// Stripe webhook carries no user session anyway; listed so that stays true
// even if a signed-in browser ever hits it.)
const UNGATED_API_PREFIXES = ['/api/stripe/webhook']

/** True for the signed-in surfaces a maintenance pause should close. */
export function isMaintenanceGatedPath(path: string): boolean {
  if (path.startsWith('/api/')) {
    return !UNGATED_API_PREFIXES.some((prefix) => path.startsWith(prefix))
  }
  return GATED_PAGE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}
