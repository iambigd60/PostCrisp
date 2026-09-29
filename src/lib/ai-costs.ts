import type { ProviderId } from './providers/types'

interface ModelPricing {
  input: number
  output: number
  // Anthropic cache-read price when it isn't the usual 10% of input.
  cacheRead?: number
}

// Standard-tier list prices, USD per 1M tokens (checked 2026-09-29). Thinking
// and reasoning tokens bill as output and are already inside output_tokens.
// Models missing here cost $0 in telemetry — add every model in
// MODEL_CATALOG (crisp-engine-config.ts).
const MODEL_PRICING_USD_PER_1M: Record<string, ModelPricing> = {
  // OpenAI
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10 },
  'gpt-6-sol': { input: 2, output: 10 },
  'gpt-6-astra': { input: 10, output: 50 },
  // Anthropic
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.20 },
  'claude-opus-4-7': { input: 5, output: 25 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.20 },
  'claude-fable-5-1': { input: 10, output: 50, cacheRead: 0.25 },
}

/**
 * Blended $/1M rate for rough per-feature estimates: (input + 3 × output) / 4,
 * since output dominates for generative tasks. 0 for unknown models.
 */
export function blendedPricePer1M(model: string): number {
  const pricing = MODEL_PRICING_USD_PER_1M[model]
  if (!pricing) return 0
  return (pricing.input + 3 * pricing.output) / 4
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

  const cacheReadPrice = pricing.cacheRead ?? pricing.input * 0.1
  const cacheReadCost = ((input.cacheReadInputTokens ?? 0) / 1_000_000) * cacheReadPrice
  const cacheCreationCost = ((input.cacheCreationInputTokens ?? 0) / 1_000_000) * pricing.input * 1.25

  return uncachedInputCost + outputCost + cacheReadCost + cacheCreationCost
}
