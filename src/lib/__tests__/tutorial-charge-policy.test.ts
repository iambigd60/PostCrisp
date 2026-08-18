import { describe, it, expect } from 'vitest'
import { decideTutorialCharge, TUTORIAL_RUN_SPENT_CODE } from '@/lib/tutorial-charge-policy'

describe('decideTutorialCharge', () => {
  it('bypasses when a tutorial run was requested and granted', () => {
    expect(decideTutorialCharge({ tutorialModeRequested: true, bypassGranted: true })).toBe('bypass')
  })

  it('REFUSES rather than charging when a tutorial run was requested but already spent', () => {
    // This is the whole point of the task: the old code charged here.
    expect(decideTutorialCharge({ tutorialModeRequested: true, bypassGranted: false })).toBe('refuse')
  })

  it('charges normally for an ordinary non-tutorial request', () => {
    expect(decideTutorialCharge({ tutorialModeRequested: false, bypassGranted: false })).toBe('charge')
  })

  it('charges normally when bypassGranted is spuriously true outside tutorial mode', () => {
    // Defensive: a granted flag must never bypass without an explicit request.
    expect(decideTutorialCharge({ tutorialModeRequested: false, bypassGranted: true })).toBe('charge')
  })

  it('exposes a stable error code for clients to branch on', () => {
    expect(TUTORIAL_RUN_SPENT_CODE).toBe('tutorial_run_spent')
  })
})
