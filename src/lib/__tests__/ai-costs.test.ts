import { describe, expect, it } from 'vitest'
import { estimateAiCallCostUsd } from '@/lib/ai-costs'

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
      // Opus 4.7 list price is $5 / $25 per 1M: 5 + 25 + 0.5 (cache read at 10%) + 6.25 (cache write at 125%).
      // The table previously carried $15 / $75, which overstated every Opus call three-fold.
    })).toBeCloseTo(36.75, 6)
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
