import { describe, it, expect } from 'vitest'
import {
  isSnoozed,
  shouldOfferResume,
  snoozeUntil,
  SNOOZE_DAYS,
  FIRST_SESSION_STAGES,
} from '@/lib/first-session-state'

const NOW = new Date('2026-08-18T12:00:00.000Z')
const AFTER_LAUNCH = '2026-08-18T09:00:00.000Z'
const BEFORE_LAUNCH = '2026-05-01T09:00:00.000Z'

describe('isSnoozed', () => {
  it('is false with no progress record', () => {
    expect(isSnoozed(undefined, NOW)).toBe(false)
  })

  it('is false when no snooze was set', () => {
    expect(isSnoozed({ stage: 'ask' }, NOW)).toBe(false)
  })

  it('is true while the snooze is in the future', () => {
    expect(isSnoozed({ snoozed_until: '2026-08-25T12:00:00.000Z' }, NOW)).toBe(true)
  })

  it('is false once the snooze has elapsed', () => {
    expect(isSnoozed({ snoozed_until: '2026-08-11T12:00:00.000Z' }, NOW)).toBe(false)
  })

  it('is false for an unparseable value — fail open rather than hide the offer forever', () => {
    expect(isSnoozed({ snoozed_until: 'not-a-date' }, NOW)).toBe(false)
  })
})

describe('shouldOfferResume', () => {
  it('offers to someone who started and abandoned', () => {
    expect(shouldOfferResume({ stage: 'pack', completed: false }, null, BEFORE_LAUNCH, NOW)).toBe(true)
  })

  it('offers to a new account with no record at all', () => {
    expect(shouldOfferResume(undefined, null, AFTER_LAUNCH, NOW)).toBe(true)
  })

  it('does NOT offer to a long-standing account that never had a first session', () => {
    // Rev.1 regression: shouldOfferResume(undefined, null) was true for every
    // pre-existing user, so accounts months old would suddenly be told to
    // "finish" a session that did not exist when they signed up.
    expect(shouldOfferResume(undefined, null, BEFORE_LAUNCH, NOW)).toBe(false)
  })

  it('does NOT offer once completed', () => {
    expect(shouldOfferResume({ stage: 'own', completed: true }, null, AFTER_LAUNCH, NOW)).toBe(false)
  })

  it('does NOT offer to a pre-tutorial tester who already has onboarded_at', () => {
    expect(shouldOfferResume(undefined, '2026-04-19T00:00:00.000Z', AFTER_LAUNCH, NOW)).toBe(false)
  })

  it('does NOT offer while snoozed — skip means later, and later means quiet', () => {
    expect(
      shouldOfferResume({ stage: 'ask', snoozed_until: '2026-08-25T12:00:00.000Z' }, null, AFTER_LAUNCH, NOW),
    ).toBe(false)
  })

  it('offers again once the snooze elapses', () => {
    expect(
      shouldOfferResume({ stage: 'ask', snoozed_until: '2026-08-11T12:00:00.000Z' }, null, AFTER_LAUNCH, NOW),
    ).toBe(true)
  })

  it('completed wins over an un-elapsed snooze', () => {
    expect(
      shouldOfferResume(
        { stage: 'own', completed: true, snoozed_until: '2026-08-25T12:00:00.000Z' },
        null,
        AFTER_LAUNCH,
        NOW,
      ),
    ).toBe(false)
  })
})

describe('snoozeUntil', () => {
  it('returns an ISO timestamp SNOOZE_DAYS ahead', () => {
    expect(snoozeUntil(NOW)).toBe('2026-08-25T12:00:00.000Z')
    expect(SNOOZE_DAYS).toBe(7)
  })

  it('produces a value isSnoozed agrees is active', () => {
    expect(isSnoozed({ snoozed_until: snoozeUntil(NOW) }, NOW)).toBe(true)
  })
})

describe('FIRST_SESSION_STAGES', () => {
  it('is exactly the three stages, in order', () => {
    expect(FIRST_SESSION_STAGES).toEqual(['ask', 'pack', 'own'])
  })
})
