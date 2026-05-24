import { describe, it, expect } from 'vitest'
import { buildFoundationPrompt, type FoundationInput } from '@/app/api/foundation-analysis/prompt'

const baseInput: FoundationInput = {
  platform: 'instagram',
  niche: 'AI productivity for solopreneurs',
  followerCount: '12K',
  postingCadence: '4-5x / week',
  contentPillars: ['AI tool reviews', 'founder workflow', 'behind the build'],
  targetAudience: { description: 'indie hackers shipping their first SaaS', sophistication: 'intermediate' },
  growthGoal: 'engagement',
  monetizationStage: 'digital-products',
  formatStrengths: ['Carousels', 'Short-form video'],
  currentChallenges: 'Reach stalled after 10K. Reels feel forced.',
  analyzeHandle: '@iambigd',
  samplePosts: [
    { caption: 'Top 3 AI tools I run my business on (a thread)', metric: '48K saves, 220K reach', whyItWorked: "Curiosity hook + 'thread' format", sourceUrl: 'https://instagram.com/p/C123/' },
    { caption: 'How I went from idea to $10K MRR in 60 days', metric: '12K likes', whyItWorked: 'Specific outcome' },
    { caption: 'I was wrong about Notion. Here\'s what changed.', metric: '8K likes' },
  ],
}

describe('buildFoundationPrompt', () => {
  it('includes the platform, niche, content pillars, and audience persona', () => {
    const prompt = buildFoundationPrompt(baseInput)
    expect(prompt).toContain('instagram')
    expect(prompt).toContain('AI productivity for solopreneurs')
    expect(prompt).toContain('AI tool reviews')
    expect(prompt).toContain('founder workflow')
    expect(prompt).toContain('indie hackers shipping their first SaaS')
    expect(prompt).toContain('intermediate')
  })

  it('includes the goal and monetization stage', () => {
    const prompt = buildFoundationPrompt(baseInput)
    expect(prompt).toContain('engagement')
    expect(prompt).toContain('digital-products')
  })

  it('includes each provided sample post with its metric and theory', () => {
    const prompt = buildFoundationPrompt(baseInput)
    expect(prompt).toContain('Top 3 AI tools')
    expect(prompt).toContain('https://instagram.com/p/C123/')
    expect(prompt).toContain('48K saves, 220K reach')
    expect(prompt).toContain("Curiosity hook + 'thread' format")
    expect(prompt).toContain('How I went from idea to $10K MRR')
    expect(prompt).toContain('I was wrong about Notion')
  })

  it('omits a sample-post slot when its caption is empty', () => {
    const trimmed = { ...baseInput, samplePosts: [baseInput.samplePosts[0]] }
    const prompt = buildFoundationPrompt(trimmed)
    expect(prompt).toContain('Top 3 AI tools')
    expect(prompt).not.toContain('How I went from idea')
  })

  it('asks for the structured Creator Profile in the JSON response shape', () => {
    const prompt = buildFoundationPrompt(baseInput)
    expect(prompt).toContain('creatorProfile')
    expect(prompt).toContain('contentPillars')
    expect(prompt).toContain('voiceSignature')
    expect(prompt).toContain('audiencePersona')
    expect(prompt).toContain('growthStage')
    expect(prompt).toContain('monetizationPosition')
    expect(prompt).toContain('formatStrengths')
    expect(prompt).toContain('differentiators')
    expect(prompt).toContain('topBlockers')
  })

  it('asks for evidence-layer findings (top patterns, format lean, hook structures)', () => {
    const prompt = buildFoundationPrompt(baseInput)
    expect(prompt).toContain('topPostPatterns')
    expect(prompt).toContain('recommendedFormatLean')
    expect(prompt).toContain('repeatableHookStructures')
  })
})
