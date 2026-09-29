import OpenAI from 'openai'
import type { AIProvider, GenerateArgs, GenerateResult } from './types'

let _client: OpenAI | undefined
function getClient(): OpenAI {
  if (!_client) _client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
    // Bound the per-request wait so a hung OpenAI call doesn't burn our
    // Vercel maxDuration budget. 110s leaves ~10s headroom under 120s.
    timeout: 110_000,
    // Default maxRetries is 2 (5xx / 429). Bump to 3 to absorb slightly
    // heavier transient blips before surfacing failure to the user.
    maxRetries: 3,
  })
  return _client
}

// ─── GPT-6 models ────────────────────────────────────────────────────────────
// GPT-6 Sol and Astra reason before answering, and reasoning tokens count
// against max_completion_tokens. Our per-route caps were sized for visible
// output only, so these models get extra headroom — otherwise a long reasoning
// pass can leave an empty answer. The cap is a ceiling; unused headroom is not
// billed. Effort is pinned to 'low' to keep latency near the non-reasoning
// models under our 110s client timeout. Raise it once real output has been
// compared.
const REASONING_MODEL = /^gpt-6(-|$)/
const REASONING_EFFORT = 'low' as const
const REASONING_HEADROOM_TOKENS = 8000

/**
 * Output-cap and effort fields for a Chat Completions request. GPT-6 models get
 * reasoning headroom and low effort; every other model gets the caller's cap.
 */
export function openaiModelTuning(model: string, maxTokens: number): {
  max_completion_tokens: number
  reasoning_effort?: typeof REASONING_EFFORT
} {
  if (!REASONING_MODEL.test(model)) return { max_completion_tokens: maxTokens }
  return {
    max_completion_tokens: maxTokens + REASONING_HEADROOM_TOKENS,
    reasoning_effort: REASONING_EFFORT,
  }
}

/**
 * Pull the answer text out of a Chat Completions choice. Throws on a refusal or
 * on an empty answer cut off by the token cap, so callers refund credits
 * instead of trying to parse nothing.
 */
export function extractOpenAIText(choice: {
  message?: { content?: string | null; refusal?: string | null } | null
  finish_reason?: string | null
} | undefined): string {
  if (choice?.message?.refusal) {
    throw new Error(`OpenAI declined the request: ${choice.message.refusal}`)
  }
  const text = choice?.message?.content ?? ''
  if (!text && choice?.finish_reason === 'length') {
    throw new Error('OpenAI used the whole max_completion_tokens budget before writing an answer')
  }
  return text
}

export const openaiProvider: AIProvider = {
  id: 'openai',
  /** Run one system + user prompt through Chat Completions and report token usage. */
  async generate(args: GenerateArgs): Promise<GenerateResult> {
    // Enable JSON mode when either prompt mentions JSON — avoids GPT returning
    // JS-style comments or trailing commas inside arrays.
    const wantsJson = /json/i.test(args.system) || /json/i.test(args.prompt)

    const response = await getClient().chat.completions.create({
      model: args.model,
      ...openaiModelTuning(args.model, args.maxTokens),
      messages: [
        { role: 'system', content: args.system },
        { role: 'user', content: args.prompt },
      ],
      ...(wantsJson ? { response_format: { type: 'json_object' as const } } : {}),
    })

    const text = extractOpenAIText(response.choices[0])
    return {
      text,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    }
  },
}
