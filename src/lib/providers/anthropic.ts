import Anthropic from '@anthropic-ai/sdk'
import type { AIProvider, GenerateArgs, GenerateResult } from './types'

let _client: Anthropic | undefined
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    // Bound the per-request wait so a hung Anthropic call can't burn our
    // entire Vercel maxDuration budget. 110s leaves ~10s headroom for
    // response parsing + DB persistence under our 120s function timeout.
    timeout: 110_000,
    // SDK retries on 408 / 409 / 429 / 5xx — covers transient Anthropic
    // capacity blips that would otherwise surface as 'Request timed out'
    // for testers. Default is 2; 3 absorbs a slightly heavier blip
    // without exceeding our wall budget (each retry is fast — same call,
    // not slow latency variance).
    maxRetries: 3,
  })
  return _client
}

// Only cache system prompts large enough for Anthropic's minimum cacheable
// block (1,024 tokens ≈ ~4,000 characters is a safe heuristic). Marking a
// tiny system prompt as cacheable wastes a cache-control breakpoint without
// benefit.
const CACHE_MIN_CHARS = 4000

// ─── Claude 5-generation models ─────────────────────────────────────────────
// Opus 5.5 and Fable 5.1 think on every request (it can't be turned off), and
// Opus 5 / Sonnet 5 / Sonnet 5.5 think by default when `thinking` is omitted.
// Two consequences for us:
//   1. The response starts with a `thinking` block, so the answer is no longer
//      content[0] — read the text blocks instead (extractAnthropicText).
//   2. Thinking tokens count against max_tokens. Our per-route caps were sized
//      for visible output only, so these models get extra headroom or long
//      JSON outputs would be cut off. max_tokens is a ceiling, not a target —
//      unused headroom is not billed.
// Effort is pinned to 'low': these are short content-generation tasks, and it
// keeps latency close to the no-thinking models they replace under our 110s
// client timeout. Raise it per model once real output has been compared.
const THINKING_MODEL = /^claude-(opus|sonnet|fable|mythos)-5(-|$)/
const THINKING_EFFORT = 'low'
const THINKING_HEADROOM_TOKENS = 8000

// Models whose safety classifiers can decline a request. With server-side
// fallback on, a declined request is re-run on a fallback model chosen by the
// API inside the same call instead of coming back empty.
const REFUSAL_FALLBACK_MODELS = new Set([
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-fable-5-1',
  'claude-sonnet-5-5',
])
const REFUSAL_FALLBACK_BETA = 'server-side-fallback-2026-07-01'

export function thinksByDefault(model: string): boolean {
  return THINKING_MODEL.test(model)
}

/**
 * Request fields that depend on the model: max_tokens (with thinking headroom
 * for Claude 5-generation models), effort, and refusal fallback. Spread the
 * `body` into messages.create and pass `options` as its second argument.
 * Exported so routes that call the SDK directly (thumbnail analyzer) stay in
 * step with the engine.
 */
export function anthropicModelTuning(model: string, maxTokens: number): {
  body: Record<string, unknown>
  options: { headers?: Record<string, string> }
} {
  const body: Record<string, unknown> = { max_tokens: maxTokens }
  const options: { headers?: Record<string, string> } = {}
  if (thinksByDefault(model)) {
    body.max_tokens = maxTokens + THINKING_HEADROOM_TOKENS
    body.output_config = { effort: THINKING_EFFORT }
  }
  if (REFUSAL_FALLBACK_MODELS.has(model)) {
    body.fallbacks = 'default'
    options.headers = { 'anthropic-beta': REFUSAL_FALLBACK_BETA }
  }
  return { body, options }
}

interface LooseContentBlock {
  type: string
  text?: string
}

/**
 * Pull the answer text out of a Messages response. Skips thinking blocks and,
 * when a fallback ran, anything the declining model produced before the last
 * `fallback` switch point. Throws on a refusal or an empty answer so callers
 * refund credits instead of trying to parse nothing.
 */
export function extractAnthropicText(response: {
  content: unknown[]
  stop_reason?: string | null
  stop_details?: unknown
}): string {
  const blocks = response.content as LooseContentBlock[]
  let start = 0
  blocks.forEach((block, i) => {
    if (block.type === 'fallback') start = i + 1
  })
  const text = blocks
    .slice(start)
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('')

  if (response.stop_reason === 'refusal') {
    const category = (response.stop_details as { category?: string | null } | null | undefined)?.category
    throw new Error(`Anthropic declined the request (refusal${category ? `: ${category}` : ''})`)
  }
  if (!text && response.stop_reason === 'max_tokens') {
    throw new Error('Anthropic used the whole max_tokens budget before writing an answer')
  }
  return text
}

export const anthropicProvider: AIProvider = {
  id: 'anthropic',
  async generate(args: GenerateArgs): Promise<GenerateResult> {
    const shouldCacheSystem = args.system.length >= CACHE_MIN_CHARS
    const tuning = anthropicModelTuning(args.model, args.maxTokens)

    // output_config and fallbacks postdate our SDK version's types, so the
    // model-dependent fields go in untyped; the SDK sends the body as-is.
    const response = await getClient().messages.create({
      model: args.model,
      max_tokens: args.maxTokens,
      ...tuning.body,
      // When system is large enough, send it as a structured block with
      // cache_control so Anthropic caches and reuses it (up to 90% off
      // input token cost on cache hits). The `as` cast is required because
      // the SDK's TextBlockParam type doesn't declare cache_control yet,
      // even though the API accepts it.
      system: shouldCacheSystem
        ? ([{ type: 'text', text: args.system, cache_control: { type: 'ephemeral' } }] as unknown as string)
        : args.system,
      messages: [{ role: 'user', content: args.prompt }],
    }, tuning.options)

    const text = extractAnthropicText(response)
    const usage = response.usage as {
      input_tokens: number
      output_tokens: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
    return {
      text,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
      cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
    }
  },
}
