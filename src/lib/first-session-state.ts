/**
 * Pure decisions about a user's first session.
 *
 * Three surfaces have to agree on these — the onboarding page, the dashboard
 * resume card and the preferences writer. Divergence between them is exactly
 * how the previous wizard ended up with a resume path nobody could reach.
 *
 * No I/O: every input is passed in, including `now`, so the logic is
 * deterministic and testable.
 */

export type FirstSessionStage = 'ask' | 'pack' | 'own'

export const FIRST_SESSION_STAGES: readonly FirstSessionStage[] = ['ask', 'pack', 'own'] as const

export const SNOOZE_DAYS = 7

/**
 * Accounts created before this did not have a first session to abandon, so we
 * never nag them about finishing one. Set to the redesign's ship date.
 */
export const FIRST_SESSION_LAUNCHED_AT = '2026-08-18T00:00:00.000Z'

/**
 * Persisted under preferences.tutorial_progress — the SAME key the old wizard
 * used, deliberately, because isInActiveTutorial, the sidebar link and the
 * dashboard all read `completed` from it.
 */
export interface FirstSessionProgress {
  stage?: FirstSessionStage
  completed?: boolean
  snoozed_until?: string | null
  niche?: string | null
  platform?: string | null
  tone?: string | null
  pack_saved?: boolean
}

/**
 * Whether a user has finished onboarding and must not be replayed through it.
 *
 * ONE definition, deliberately. Two hand-written copies of this predicate
 * previously drifted apart and shipped a bug — see post-auth-destination.ts.
 * Both the auth callback (chooseDestination) and the onboarding page's replay
 * gate consult this, so they cannot disagree about who is done.
 *
 * `onboardedAt != null` (not truthiness) is load-bearing: a stored empty
 * string must still count as onboarded, and post-auth-destination's tests
 * pin that. `!=` (loose) is deliberate too — it treats `undefined` the same
 * as `null` so callers don't need to normalise a possibly-absent field first.
 */
export function hasFinishedFirstSession(
  tutorialCompleted: boolean,
  onboardedAt: string | null | undefined,
): boolean {
  return tutorialCompleted || onboardedAt != null
}

export function isSnoozed(progress: FirstSessionProgress | undefined, now: Date): boolean {
  const raw = progress?.snoozed_until
  if (!raw) return false
  const until = new Date(raw).getTime()
  // Fail open on a corrupt value: hiding the offer forever is worse than
  // showing it a little early.
  if (Number.isNaN(until)) return false
  return until > now.getTime()
}

export function shouldOfferResume(
  progress: FirstSessionProgress | undefined,
  onboardedAt: string | null,
  accountCreatedAt: string,
  now: Date,
): boolean {
  // Finished the new session — nothing to resume.
  if (progress?.completed) return false
  // Finished the OLD wizard before this redesign existed. Leave them alone.
  if (onboardedAt != null) return false
  // Skip means later. Stay quiet until later arrives.
  if (isSnoozed(progress, now)) return false
  // Someone who has a first-session record is mid-session regardless of age.
  if (progress?.stage) return true
  // No record at all: only nag accounts that were offered a first session.
  const created = new Date(accountCreatedAt).getTime()
  const launched = new Date(FIRST_SESSION_LAUNCHED_AT).getTime()
  if (Number.isNaN(created)) return false
  return created >= launched
}

export function snoozeUntil(now: Date): string {
  return new Date(now.getTime() + SNOOZE_DAYS * 24 * 60 * 60 * 1000).toISOString()
}
