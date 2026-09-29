import { describe, expect, it } from 'vitest'
import { estimateFeatureCostUsd, featureToTask } from '@/lib/feature-cost-estimate'

describe('featureToTask', () => {
  it('maps stored underscore feature names to tasks', () => {
    expect(featureToTask('captions')).toBe('captions')
    expect(featureToTask('blog_to_social')).toBe('blog-to-social')
  })

  it('rejects inherited object property names', () => {
    for (const name of ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf']) {
      expect(featureToTask(name)).toBeNull()
    }
  })

  it('rejects unknown features', () => {
    expect(featureToTask('not_a_feature')).toBeNull()
  })
})

describe('estimateFeatureCostUsd', () => {
  it('prices a known feature at its creator-tier model', () => {
    // captions → creator STANDARD → claude-sonnet-4-6: blended (3 + 3×15) / 4 = $12 per 1M
    expect(estimateFeatureCostUsd('captions', 1_000_000)).toBeCloseTo(12, 6)
  })

  it('returns 0 instead of throwing for an inherited property name', () => {
    expect(() => estimateFeatureCostUsd('constructor', 1000)).not.toThrow()
    expect(estimateFeatureCostUsd('constructor', 1000)).toBe(0)
  })

  it('returns 0 for token counts that are not positive finite numbers', () => {
    for (const tokens of [0, -5000, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(estimateFeatureCostUsd('captions', tokens)).toBe(0)
    }
  })
})
