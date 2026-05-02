import { describe, it, expect } from 'vitest'
import { getCreatorProfile, upsertCreatorProfile } from '@/lib/creator-profile'
import { createFakeSupabase, type FakeSupabaseTables } from './fake-supabase'

function emptyTables(): FakeSupabaseTables {
  return {
    profiles: new Map(),
    credit_transactions: [],
    generations: [],
    creator_profiles: new Map(),
  }
}

describe('getCreatorProfile', () => {
  it('returns null when the user has no profile row', async () => {
    const tables = emptyTables()
    const supabase = createFakeSupabase({ tables })
    const profile = await getCreatorProfile(supabase as any, 'user-1')
    expect(profile).toBeNull()
  })
})

describe('getCreatorProfile (existing row)', () => {
  it('returns the row when one exists for the user', async () => {
    const tables = emptyTables()
    tables.creator_profiles.set('user-1', {
      user_id: 'user-1',
      content_pillars: ['AI tools', 'founder workflow'],
      voice_signature: { adjectives: ['plainspoken'], examplePhrasing: 'ship it ugly' },
      audience_persona: { description: 'indie hackers', sophistication: 'intermediate' },
      growth_stage: 'early-traction',
      monetization_position: { stage: 'digital-products', primaryStreams: ['course'] },
      format_strengths: ['carousels'],
      differentiators: ['builds in public'],
      top_blockers: ['hook fatigue'],
      source_analysis_id: 'gen-abc',
      created_at: '2026-04-30T00:00:00Z',
      updated_at: '2026-04-30T00:00:00Z',
    })
    const supabase = createFakeSupabase({ tables })
    const profile = await getCreatorProfile(supabase as any, 'user-1')
    expect(profile).not.toBeNull()
    expect(profile?.content_pillars).toEqual(['AI tools', 'founder workflow'])
    expect(profile?.growth_stage).toBe('early-traction')
  })
})

describe('upsertCreatorProfile', () => {
  it('writes the profile row with source_analysis_id and updated_at', async () => {
    const tables = emptyTables()
    const supabase = createFakeSupabase({ tables })
    const result = await upsertCreatorProfile(supabase as any, 'user-1', {
      content_pillars: ['p1', 'p2'],
      voice_signature: { adjectives: ['dry'], examplePhrasing: 'just ship' },
      audience_persona: { description: 'devs', sophistication: 'advanced' },
      growth_stage: 'scaling',
      monetization_position: { stage: 'services', primaryStreams: ['consulting'] },
      format_strengths: ['threads'],
      differentiators: ['anti-hype'],
      top_blockers: ['burnout'],
    }, 'gen-xyz')
    expect(result).toEqual({ ok: true })
    const row = tables.creator_profiles.get('user-1') as Record<string, unknown>
    expect(row).toBeDefined()
    expect(row.source_analysis_id).toBe('gen-xyz')
    expect(row.growth_stage).toBe('scaling')
    expect(typeof row.updated_at).toBe('string')
  })
})
