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

  it('grants bypass when user is on a valid tutorial step and not yet completed', async () => {
    const tables = setupTables({
      tutorial_progress: { step: 'captions', completed: false },
    })
    const supabase = createFakeSupabase({ tables })
    expect(await isInActiveTutorial(supabase as any, 'user-1')).toBe(true)
  })

  it('denies bypass for an unknown step value (defensive against client spoofing)', async () => {
    const tables = setupTables({
      tutorial_progress: { step: 'arbitrary-fake-step', completed: false },
    })
    const supabase = createFakeSupabase({ tables })
    expect(await isInActiveTutorial(supabase as any, 'user-1')).toBe(false)
  })
})
