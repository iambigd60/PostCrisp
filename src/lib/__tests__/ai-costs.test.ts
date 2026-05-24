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
    })).toBeCloseTo(110.25, 6)
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
