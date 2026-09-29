import { describe, expect, it } from 'vitest'
import { blendedPricePer1M, estimateAiCallCostUsd } from '@/lib/ai-costs'
import { MODEL_CATALOG } from '@/lib/crisp-engine-config'

describe('estimateAiCallCostUsd', () => {
  it('prices OpenAI calls from input and output tokens', () => {
    expect(estimateAiCallCostUsd({
      provider: 'openai',
      model: 'gpt-4o-mini',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    })).toBeCloseTo(0.75, 6)
  })

  it('prices Anthropic cache reads separately from uncached input', () => {
    expect(estimateAiCallCostUsd({
      provider: 'anthropic',
      model: 'claude-opus-4-7',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadInputTokens: 1_000_000,
      cacheCreationInputTokens: 1_000_000,
    })).toBeCloseTo(36.75, 6)
  })

  it('uses a model-specific cache-read price when the model has one', () => {
    // Opus 5.5 cache reads are $0.20/1M, not 10% of its $4 input price.
    expect(estimateAiCallCostUsd({
      provider: 'anthropic',
      model: 'claude-opus-5-5',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadInputTokens: 1_000_000,
      cacheCreationInputTokens: 1_000_000,
    })).toBeCloseTo(29.2, 6)
  })

  it('prices the GPT-6 models', () => {
    expect(estimateAiCallCostUsd({
      provider: 'openai',
      model: 'gpt-6-sol',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    })).toBeCloseTo(12, 6)
    expect(estimateAiCallCostUsd({
      provider: 'openai',
      model: 'gpt-6-astra',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    })).toBeCloseTo(60, 6)
  })

  it('returns zero for unknown models so analytics fail closed instead of inventing costs', () => {
    expect(estimateAiCallCostUsd({
      provider: 'openai',
      model: 'unknown-model',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    })).toBe(0)
  })
})

describe('blendedPricePer1M', () => {
  it('weights output 3:1 over input', () => {
    expect(blendedPricePer1M('claude-opus-4-7')).toBeCloseTo((5 + 3 * 25) / 4, 6)
  })

  it('returns zero for unknown models', () => {
    expect(blendedPricePer1M('unknown-model')).toBe(0)
  })
})

describe('model catalog pricing coverage', () => {
  // Legacy entries offered before cost telemetry existed. Price them or drop
  // them from the catalog; don't add to this list.
  const KNOWN_UNPRICED = new Set(['o1', 'o1-mini'])

  it('prices every Anthropic and OpenAI model offered in AI Engine Config', () => {
    const offered = [...MODEL_CATALOG.anthropic, ...MODEL_CATALOG.openai].map((m) => m.id)
    const unpriced = offered.filter((id) => !KNOWN_UNPRICED.has(id) && blendedPricePer1M(id) === 0)
    expect(unpriced).toEqual([])
  })
})
