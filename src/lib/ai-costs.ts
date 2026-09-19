import type { ProviderId } from './providers/types'

// List prices, USD per 1M tokens. Keep in step with MODEL_CATALOG in
// crisp-engine-config.ts; engine-catalog.test.ts fails on any gap. A model
// missing here is costed at $0, which silently hides spend in the ledger.
export const MODEL_PRICING_USD_PER_1M: Record<string, { input: number; output: number }> = {
  // Anthropic
  'claude-opus-5':             { input: 5,    output: 25 },
  'claude-opus-4-8':           { input: 5,    output: 25 },
  'claude-opus-4-7':           { input: 5,    output: 25 },
  'claude-sonnet-5':           { input: 2,    output: 10 },
  'claude-sonnet-4-6':         { input: 3,    output: 15 },
  'claude-haiku-4-5':          { input: 1,    output: 5 },
  'claude-haiku-4-5-20251001': { input: 1,    output: 5 },
  // OpenAI
  'gpt-5':                     { input: 1.25, output: 10 },
  'gpt-5-mini':                { input: 0.25, output: 2 },
  'gpt-5-nano':                { input: 0.05, output: 0.40 },
  'gpt-4o':                    { input: 2.50, output: 10 },
  'gpt-4o-mini':               { input: 0.15, output: 0.60 },
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
