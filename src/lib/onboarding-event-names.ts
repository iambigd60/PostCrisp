/**
 * The onboarding funnel's event vocabulary — deliberately dependency-free.
 *
 * This lives apart from onboarding-events.ts so client components can import
 * the names (and the OnboardingEventName type that makes a typo a compile
 * error) without dragging @supabase/supabase-js into the browser bundle. A
 * value import from onboarding-events.ts would do exactly that.
 */

export const ONBOARDING_EVENT_NAMES = [
  'first_session_started',
  'stage_viewed',
  'pack_requested',
  'pack_rehydrated',
  'artifact_returned',
  'artifact_failed',
  'artifact_saved',
  'first_session_snoozed',
  'first_session_resumed',
  'first_session_completed',
] as const

export type OnboardingEventName = (typeof ONBOARDING_EVENT_NAMES)[number]

/**
 * Written only by the admin self-test probe, never by a client.
 *
 * It is deliberately NOT a member of ONBOARDING_EVENT_NAMES: that array is the
 * public route's allowlist, so keeping this name out of it is what stops an
 * authenticated user forging probe rows through POST /api/onboarding/event.
 */
export const SELFTEST_EVENT_NAME = 'selftest' as const

/** Every name the server may write — the funnel vocabulary plus the probe. */
export type OnboardingWriteName = OnboardingEventName | typeof SELFTEST_EVENT_NAME

export function isOnboardingEventName(value: unknown): value is OnboardingEventName {
  return typeof value === 'string' && (ONBOARDING_EVENT_NAMES as readonly string[]).includes(value)
}
