import { describe, it, expect } from 'vitest'
import { chooseDestination, isSafeRelativePath } from '@/lib/post-auth-destination'

describe('isSafeRelativePath', () => {
  it('accepts a plain relative path', () => {
    expect(isSafeRelativePath('/auth/reset-password')).toBe(true)
  })

  it('rejects null', () => {
    expect(isSafeRelativePath(null)).toBe(false)
  })

  it('rejects a protocol-relative URL (open-redirect vector)', () => {
    expect(isSafeRelativePath('//evil.example.com')).toBe(false)
  })

  it('rejects an absolute URL', () => {
    expect(isSafeRelativePath('https://evil.example.com')).toBe(false)
  })

  it('rejects an embedded scheme', () => {
    expect(isSafeRelativePath('/redirect?to=javascript://evil')).toBe(false)
  })

  // Fix round 1: a prefix-only guard (reject `//`, reject `://`) still let
  // these through. WHATWG URL parsing treats a backslash as a path separator
  // and strips tab/newline/CR before parsing, so both turn what looks like a
  // same-origin path into a cross-origin authority reference once resolved
  // relatively — exactly what `router.replace` does. Validate-by-construction
  // (resolve against a sentinel base, compare origins) closes this.
  it('rejects a backslash-as-slash host (WHATWG URL parsing quirk)', () => {
    expect(isSafeRelativePath('/\\evil.example.com')).toBe(false)
  })

  it('rejects a real tab character before the host (control-char stripping quirk)', () => {
    expect(isSafeRelativePath('/\t/evil.example.com')).toBe(false)
  })

  it('rejects the empty string', () => {
    expect(isSafeRelativePath('')).toBe(false)
  })

  it('accepts a legitimate path with a query string', () => {
    expect(isSafeRelativePath('/dashboard?tab=billing')).toBe(true)
  })
})

describe('chooseDestination', () => {
  it('honours an explicit safe next above everything else (password recovery must not be hijacked)', () => {
    expect(chooseDestination({
      explicitNext: '/auth/reset-password',
      tutorialCompleted: false,
      onboardedAt: null,
    })).toBe('/auth/reset-password')
  })

  it('ignores an unsafe next and falls through to the onboarding decision', () => {
    expect(chooseDestination({
      explicitNext: '//evil.example.com',
      tutorialCompleted: false,
      onboardedAt: null,
    })).toBe('/onboarding')
  })

  it('sends a brand-new user to onboarding — this is the Google OAuth and email-confirmation fix', () => {
    expect(chooseDestination({
      explicitNext: null,
      tutorialCompleted: false,
      onboardedAt: null,
    })).toBe('/onboarding')
  })

  it('sends a user who completed the tutorial to the dashboard', () => {
    expect(chooseDestination({
      explicitNext: null,
      tutorialCompleted: true,
      onboardedAt: null,
    })).toBe('/dashboard')
  })

  it('sends a pre-tutorial alpha tester with onboarded_at to the dashboard, not back through the wizard', () => {
    expect(chooseDestination({
      explicitNext: null,
      tutorialCompleted: false,
      onboardedAt: '2026-04-19T00:00:00.000Z',
    })).toBe('/dashboard')
  })

  // Fix round 1: onboardedAt is now checked with `!= null`, not truthiness,
  // so a stored empty string (a degenerate but non-null value) still counts
  // as "has been onboarded" instead of being misread as absent.
  it('treats a stored empty-string onboarded_at as still onboarded', () => {
    expect(chooseDestination({
      explicitNext: null,
      tutorialCompleted: false,
      onboardedAt: '',
    })).toBe('/dashboard')
  })
})
