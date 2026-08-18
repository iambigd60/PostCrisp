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

  it('still grants bypass on a step the old gate already allowed (baseline)', async () => {
    // Baseline, not a regression pin: 'captions' was already a member of the
    // old TUTORIAL_STEPS allowlist, so this case returned true both before
    // and after the gate removal. See the 'channels' test below for the case
    // that actually demonstrates the write-ordering fix.
    const tables = setupTables({
      tutorial_progress: { step: 'captions', completed: false },
    })
    const supabase = createFakeSupabase({ tables })
    expect(await isInActiveTutorial(supabase as any, 'user-1')).toBe(true)
  })

  it('grants bypass on a pre-generation step (channels), which the old step gate refused', async () => {
    // Regression: goToStep fire-and-forgets the preferences PUT, so the step
    // recorded server-side lags the UI. The old step gate denied the bypass
    // to users who advanced (e.g. to 'channels') faster than that write
    // landed — this case flips false -> true with the fix.
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
