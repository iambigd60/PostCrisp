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
 * True when `next` is a safe same-origin relative path. This is validate-by-
 * construction rather than a prefix blocklist: a prefix-only check (reject
 * `//`, reject `://`) still lets `/\evil.example.com` and control-character
 * variants like `/\t/evil.example.com` through, because WHATWG URL parsing
 * treats a backslash as a path separator and strips tab/newline/CR before
 * parsing — both of which turn what looks like a path into a scheme-relative
 * authority reference. Resolving `next` against a sentinel base and checking
 * the resulting origin catches those; the origin check alone doesn't catch a
 * scheme string embedded inertly inside a query value (e.g.
 * `/redirect?to=javascript://evil`), so that substring check stays too.
 *
 * This guard is used both where the destination is later interpolated into
 * an absolute URL (`${origin}${destination}`, where the host is already
 * pinned) and where it is handed directly to a relative navigation API like
 * `router.replace`, which resolves the href against `location.href` and will
 * hard-navigate off-site if the resolved origin differs — so the guard must
 * hold under relative resolution, not just origin-prefixed interpolation.
 */
export function isSafeRelativePath(next: string | null): next is string {
  if (!next) return false
  if (!next.startsWith('/')) return false
  if (next.startsWith('//')) return false
  if (next.includes('://')) return false
  try {
    const sentinel = 'https://guard.invalid'
    const resolved = new URL(next, sentinel)
    return resolved.origin === sentinel
  } catch {
    return false
  }
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
  if (isSafeRelativePath(input.explicitNext)) return input.explicitNext

  // Users who finished the wizard, or pre-tutorial testers already marked
  // onboarded, must not be sent back through it. `!= null` (not truthiness)
  // so a stored empty string still counts as "has been onboarded" rather
  // than being misread as absent and routed back into the wizard.
  if (input.tutorialCompleted || input.onboardedAt != null) return '/dashboard'

  return '/onboarding'
}
