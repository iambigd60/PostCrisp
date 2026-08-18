/**
 * Decides how to bill a generation request that may be part of the onboarding
 * tutorial.
 *
 * Why this exists: the four AI routes previously computed `allowBypass` and
 * passed it straight to checkAuthAndUsage as `bypassCredits`. When a user
 * requested a tutorial run whose per-feature freebie was already spent,
 * allowBypass was false and the route charged them with no warning — directly
 * contradicting the wizard's "on us" promise. Worst case, ViralIdeasStep
 * auto-ran on mount, so the charge happened with no click at all.
 *
 * Splitting the decision out makes the three cases explicit and testable
 * without a Supabase client or an HTTP request.
 *
 * `userPresent` exists to fix a follow-on regression: when tutorial mode is
 * requested but the session has expired or is missing, there is no user to
 * resolve `bypassGranted` against. Treating that as "not granted" and
 * returning 'refuse' would wrongly tell the user they'd already burned a
 * freebie they never got to spend — pre-existing behavior (before this
 * policy existed) let that request fall through to checkAuthAndUsage's own
 * auth check, which returns 401 instead. `userPresent` restores that path.
 */

/** Stable code returned to clients so they can offer an explicit paid retry. */
export const TUTORIAL_RUN_SPENT_CODE = 'tutorial_run_spent'

export type TutorialChargeDecision =
  /** Run it; PostCrisp absorbs the cost. */
  | 'bypass'
  /** User asked for a free tutorial run they no longer have. Do NOT charge. */
  | 'refuse'
  /** Ordinary request — charge normal credits and apply tier gates. */
  | 'charge'

export function decideTutorialCharge(input: {
  tutorialModeRequested: boolean
  /** Whether an authenticated user was resolved for this request. */
  userPresent: boolean
  bypassGranted: boolean
}): TutorialChargeDecision {
  if (!input.tutorialModeRequested) return 'charge'

  // No authenticated user (e.g. an expired/missing session mid-onboarding).
  // Taking the normal 'charge' path here does NOT mean the request gets
  // billed — it means the request flows on to checkAuthAndUsage, which runs
  // its own supabase.auth.getUser() check and returns 401 Unauthorized
  // before any credit or feature-gate logic executes. Returning 'refuse'
  // here would be a lie: it would tell an unauthenticated user "you already
  // used your free run" when they never got the chance to spend it.
  if (!input.userPresent) return 'charge'

  return input.bypassGranted ? 'bypass' : 'refuse'
}
