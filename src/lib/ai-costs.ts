import type { ProviderId } from './providers/types'

const MODEL_PRICING_USD_PER_1M: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-opus-4-7': { input: 15, output: 75 },
}

export interface AiCallCostInput {
  provider: ProviderId
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens?: number
  cacheCreationInputTokens?: number
}

export function estimateAiCallCostUsd(input: AiCallCostInput): number {
  const pricing = MODEL_PRICING_USD_PER_1M[input.model]
  if (!pricing) return 0

  const uncachedInputCost = (input.inputTokens / 1_000_000) * pricing.input
  const outputCost = (input.outputTokens / 1_000_000) * pricing.output

  if (input.provider !== 'anthropic') {
    return uncachedInputCost + outputCost
  }

  const cacheReadCost = ((input.cacheReadInputTokens ?? 0) / 1_000_000) * pricing.input * 0.1
  const cacheCreationCost = ((input.cacheCreationInputTokens ?? 0) / 1_000_000) * pricing.input * 1.25

  return uncachedInputCost + outputCost + cacheReadCost + cacheCreationCost
}
