import { describe, it, expect } from 'vitest'
import { computeBrandReadiness, gradeFor, type BrsInputs } from '@/lib/brand-readiness'

const blankInput: BrsInputs = {
  channelCount: 0,
  voiceProfileExists: false,
  voiceSamples: 0,
  voiceAnalyzed: false,
  uniqueFeaturesUsed: 0,
  savedCount: 0,
  weekGenerations: 0,
}

describe('gradeFor', () => {
  it('maps thresholds to letter grades correctly', () => {
    expect(gradeFor(95)).toBe('A')
    expect(gradeFor(90)).toBe('A')
    expect(gradeFor(89)).toBe('B')
    expect(gradeFor(75)).toBe('B')
    expect(gradeFor(74)).toBe('C')
    expect(gradeFor(60)).toBe('C')
    expect(gradeFor(59)).toBe('D')
    expect(gradeFor(40)).toBe('D')
    expect(gradeFor(39)).toBe('F')
    expect(gradeFor(0)).toBe('F')
  })
})

describe('computeBrandReadiness — totals', () => {
  it('returns 0 + grade F + all-unset for a brand-new account', () => {
    const result = computeBrandReadiness(blankInput)
    expect(result.score).toBe(0)
    expect(result.grade).toBe('F')
    expect(result.dimensions.every((d) => d.status === 'unset')).toBe(true)
    // All dimensions should produce action candidates since none are maxed.
    expect(result.actions.length).toBe(3)  // capped at 3
    expect(result.actions.every((a) => a.priority === 'high')).toBe(true)
  })

  it('returns 100 + grade A for a maxed-out power user', () => {
    const result = computeBrandReadiness({
      channelCount: 5,
      voiceProfileExists: true,
      voiceSamples: 10,
      voiceAnalyzed: true,
      uniqueFeaturesUsed: 12,
      savedCount: 30,
      weekGenerations: 50,
    })
    expect(result.score).toBe(100)
    expect(result.grade).toBe('A')
    expect(result.dimensions.every((d) => d.score === d.max)).toBe(true)
    // No actions when everything is maxed out — nextActionFor returns null
    // for any dimension with remaining=0.
    expect(result.actions.length).toBe(0)
  })

  it('voice dimension does NOT credit points until samples ≥ 3 even when profile exists', () => {
    const result = computeBrandReadiness({
      ...blankInput,
      voiceProfileExists: true,
      voiceSamples: 2,
      voiceAnalyzed: false,
    })
    const voiceDim = result.dimensions.find((d) => d.key === 'voice')
    expect(voiceDim?.score).toBe(0)
    expect(voiceDim?.status).toBe('developing')
  })

  it('voice dimension awards 10 for samples-only and 20 for samples+analyzed', () => {
    const samplesOnly = computeBrandReadiness({
      ...blankInput,
      voiceProfileExists: true,
      voiceSamples: 3,
      voiceAnalyzed: false,
    })
    const samplesPlusAnalyzed = computeBrandReadiness({
      ...blankInput,
      voiceProfileExists: true,
      voiceSamples: 3,
      voiceAnalyzed: true,
    })
    expect(samplesOnly.dimensions.find((d) => d.key === 'voice')?.score).toBe(10)
    expect(samplesPlusAnalyzed.dimensions.find((d) => d.key === 'voice')?.score).toBe(20)
  })

  it('actions are sorted by expectedPoints descending, capped at 3', () => {
    const result = computeBrandReadiness({
      channelCount: 1,           // 5/20  → 15 remaining
      voiceProfileExists: true,
      voiceSamples: 3,           // voice 10/20 → 10 remaining
      voiceAnalyzed: false,
      uniqueFeaturesUsed: 4,     // 15/25 → 10 remaining
      savedCount: 6,             // 10/15 → 5 remaining
      weekGenerations: 16,       // 15/20 → 5 remaining
    })
    expect(result.actions).toHaveLength(3)
    // First action should be the dimension with most points-to-gain (channels at 15)
    expect(result.actions[0].expectedPoints).toBe(15)
    // Subsequent points should be non-increasing
    for (let i = 1; i < result.actions.length; i++) {
      expect(result.actions[i].expectedPoints).toBeLessThanOrEqual(result.actions[i - 1].expectedPoints)
    }
  })
})
