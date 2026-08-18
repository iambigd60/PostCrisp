/**
 * Single source of truth for where a freshly authenticated user should land.
 *
 * Why this exists: three sign-in paths each independently defaulted to
 * /dashboard and so skipped onboarding — Google OAuth (no `next` passed at
 * either call site), email confirmation (callback default), and the alpha
 * agreement hop. Production data showed 10 of 13 users never obtained a
 * tutorial record at all. Centralising the decision means a future fourth
 * path cannot quietly regress it.
 */

/**
 * True when `next` is a safe same-origin relative path. Mirrors the guard
 * previously inlined in the auth callback: reject protocol-relative URLs and
 * anything carrying a scheme, either of which would be an open redirect.
 */
export function isSafeRelativePath(next: string | null): boolean {
  if (!next) return false
  if (!next.startsWith('/')) return false
  if (next.startsWith('//')) return false
  if (next.includes('://')) return false
  return true
}

export function chooseDestination(input: {
  /** A `next` query param, if any. Honoured first when safe. */
  explicitNext: string | null
  /** preferences.tutorial_progress.completed === true */
  tutorialCompleted: boolean
  /** preferences.onboarded_at, or null. */
  onboardedAt: string | null
}): string {
  // An explicit safe next wins — password recovery relies on this.
  if (isSafeRelativePath(input.explicitNext)) return input.explicitNext as string

  // Users who finished the wizard, or pre-tutorial testers already marked
  // onboarded, must not be sent back through it.
  if (input.tutorialCompleted || input.onboardedAt) return '/dashboard'

  return '/onboarding'
}
