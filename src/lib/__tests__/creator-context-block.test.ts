import { describe, it, expect } from 'vitest'
import { formatCreatorContextBlock } from '@/lib/creator-context-block'
import type { CreatorProfile } from '@/lib/creator-profile'

const fakeProfile: CreatorProfile = {
  user_id: 'u',
  content_pillars: ['AI tools', 'founder workflow', 'behind the build'],
  voice_signature: { adjectives: ['plainspoken', 'contrarian', 'dry humor'], examplePhrasing: 'ship it ugly' },
  audience_persona: { description: 'indie hackers shipping their first SaaS', sophistication: 'intermediate' },
  growth_stage: 'early-traction',
  monetization_position: { stage: 'digital-products', primaryStreams: ['course'] },
  format_strengths: ['carousels', 'short-form video'],
  differentiators: ['builds in public', 'specifies actual prompts', 'anti-hype'],
  top_blockers: ['hook fatigue', 'reels feel forced'],
  source_analysis_id: null,
  created_at: '', updated_at: '',
}

describe('formatCreatorContextBlock', () => {
  it('returns null when profile is null', () => {
    expect(formatCreatorContextBlock(null, ['voice_signature'])).toBeNull()
  })

  it('includes only the requested fields', () => {
    const block = formatCreatorContextBlock(fakeProfile, ['voice_signature', 'audience_persona'])
    expect(block).toContain('plainspoken')
    expect(block).toContain('indie hackers')
    expect(block).not.toContain('AI tools')
    expect(block).not.toContain('digital-products')
  })

  it('starts with the standard header and ends with the standard reminder', () => {
    const block = formatCreatorContextBlock(fakeProfile, ['content_pillars'])
    expect(block?.startsWith('## Creator context')).toBe(true)
    expect(block).toContain('ground your output in the user')
  })

  it('formats list fields as comma-separated', () => {
    const block = formatCreatorContextBlock(fakeProfile, ['content_pillars', 'format_strengths'])
    expect(block).toContain('AI tools, founder workflow, behind the build')
    expect(block).toContain('carousels, short-form video')
  })
})
