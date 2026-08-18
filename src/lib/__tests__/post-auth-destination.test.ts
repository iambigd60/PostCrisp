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
})
