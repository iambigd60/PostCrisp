import { describe, it, expect } from 'vitest'
import { isInActiveTutorial } from '@/lib/tutorial-bypass'
import { createFakeSupabase, type FakeSupabaseTables } from './fake-supabase'

function setupTables(preferences: Record<string, unknown>): FakeSupabaseTables {
  return {
    profiles: new Map([['user-1', { id: 'user-1', preferences }]]),
    credit_transactions: [],
    generations: [],
    generation_ai_calls: [],
    creator_profiles: new Map(),
  }
}

describe('isInActiveTutorial', () => {
  it('grants bypass when the user has no tutorial record yet (first-time onboarding)', async () => {
    const tables = setupTables({})
    const supabase = createFakeSupabase({ tables })
    expect(await isInActiveTutorial(supabase as any, 'user-1')).toBe(true)
  })

  it('denies bypass once tutorial is marked completed (replay protection)', async () => {
    const tables = setupTables({
      tutorial_progress: { step: 'save', completed: true },
    })
    const supabase = createFakeSupabase({ tables })
    expect(await isInActiveTutorial(supabase as any, 'user-1')).toBe(false)
  })

  it('grants bypass on any non-completed step — no dependency on the client write landing', async () => {
    // Regression: goToStep fire-and-forgets the preferences PUT, so the step
    // recorded server-side lags the UI. Gating on step value raced that write
    // and silently charged fast users.
    const tables = setupTables({
      tutorial_progress: { step: 'captions', completed: false },
    })
    const supabase = createFakeSupabase({ tables })
    expect(await isInActiveTutorial(supabase as any, 'user-1')).toBe(true)
  })

  it('grants bypass on a pre-generation step (channels), which the old step gate refused', async () => {
    const tables = setupTables({
      tutorial_progress: { step: 'channels', completed: false },
    })
    const supabase = createFakeSupabase({ tables })
    expect(await isInActiveTutorial(supabase as any, 'user-1')).toBe(true)
  })

  it('grants bypass for an unrecognised step value as long as the tutorial is not completed', async () => {
    // Step is now advisory only. Spoofing it buys nothing: the per-feature
    // lifetime lock in hasUsedTutorialBypass still caps free runs at one each.
    const tables = setupTables({
      tutorial_progress: { step: 'arbitrary-fake-step', completed: false },
    })
    const supabase = createFakeSupabase({ tables })
    expect(await isInActiveTutorial(supabase as any, 'user-1')).toBe(true)
  })

  it('still denies bypass once completed, even on a generation step', async () => {
    // The completed flag remains the hard stop.
    const tables = setupTables({
      tutorial_progress: { step: 'viral', completed: true },
    })
    const supabase = createFakeSupabase({ tables })
    expect(await isInActiveTutorial(supabase as any, 'user-1')).toBe(false)
  })
})
