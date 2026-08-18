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
  bypassGranted: boolean
}): TutorialChargeDecision {
  if (!input.tutorialModeRequested) return 'charge'
  return input.bypassGranted ? 'bypass' : 'refuse'
}
