import { describe, it, expect } from 'vitest'
import { decideTutorialCharge, TUTORIAL_RUN_SPENT_CODE } from '@/lib/tutorial-charge-policy'

describe('decideTutorialCharge', () => {
  it('bypasses when a tutorial run was requested by an authenticated user and granted', () => {
    expect(decideTutorialCharge({ tutorialModeRequested: true, userPresent: true, bypassGranted: true })).toBe('bypass')
  })

  it('REFUSES rather than charging when a tutorial run was requested by an authenticated user but already spent', () => {
    // This is the whole point of the task: the old code charged here.
    expect(decideTutorialCharge({ tutorialModeRequested: true, userPresent: true, bypassGranted: false })).toBe('refuse')
  })

  it('charges normally for an ordinary non-tutorial request', () => {
    expect(decideTutorialCharge({ tutorialModeRequested: false, userPresent: true, bypassGranted: false })).toBe('charge')
  })

  it('charges normally when bypassGranted is spuriously true outside tutorial mode', () => {
    // Defensive: a granted flag must never bypass without an explicit request.
    expect(decideTutorialCharge({ tutorialModeRequested: false, userPresent: true, bypassGranted: true })).toBe('charge')
  })

  it('regression: takes the normal charge path (never refuse) when tutorial mode is requested but no user session is present', () => {
    // Fix for a follow-on bug from this task: an expired/missing session
    // mid-onboarding must NOT be told "you already used your free run" —
    // that's false, they never got the chance to spend it. 'charge' here
    // does not mean the request gets billed: checkAuthAndUsage runs its own
    // supabase.auth.getUser() check first and returns 401 Unauthorized
    // before any credit or feature-gate logic runs.
    expect(decideTutorialCharge({ tutorialModeRequested: true, userPresent: false, bypassGranted: false })).toBe('charge')
  })

  it('exposes a stable error code for clients to branch on', () => {
    expect(TUTORIAL_RUN_SPENT_CODE).toBe('tutorial_run_spent')
  })
})
