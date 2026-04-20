import Anthropic from '@anthropic-ai/sdk'
import type { AIProvider, GenerateArgs, GenerateResult } from './types'

let _client: Anthropic | undefined
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
  return _client
}

// Only cache system prompts large enough for Anthropic's minimum cacheable
// block (1,024 tokens ≈ ~4,000 characters is a safe heuristic). Marking a
// tiny system prompt as cacheable wastes a cache-control breakpoint without
// benefit.
const CACHE_MIN_CHARS = 4000

export const anthropicProvider: AIProvider = {
  id: 'anthropic',
  async generate(args: GenerateArgs): Promise<GenerateResult> {
    const shouldCacheSystem = args.system.length >= CACHE_MIN_CHARS

    const response = await getClient().messages.create({
      model: args.model,
      max_tokens: args.maxTokens,
      // When system is large enough, send it as a structured block with
      // cache_control so Anthropic caches and reuses it (up to 90% off
      // input token cost on cache hits).
      system: shouldCacheSystem
        ? [{ type: 'text', text: args.system, cache_control: { type: 'ephemeral' } }]
        : args.system,
      messages: [{ role: 'user', content: args.prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const usage = response.usage as {
      input_tokens: number
      output_tokens: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
    // input_tokens from Anthropic is already the "newly processed" count —
    // cache_read_input_tokens is separate and bills ~90% cheaper. We expose
    // the sum as our "input cost" for analytics, but the billable amount is
    // already discounted by Anthropic server-side.
    const inputTokens =
      usage.input_tokens +
      (usage.cache_creation_input_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0)

    return {
      text,
      inputTokens,
      outputTokens: usage.output_tokens,
    }
  },
}
