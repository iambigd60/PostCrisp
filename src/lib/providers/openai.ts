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

export const openaiProvider: AIProvider = {
  id: 'openai',
  async generate(args: GenerateArgs): Promise<GenerateResult> {
    // Enable JSON mode when either prompt mentions JSON — avoids GPT returning
    // JS-style comments or trailing commas inside arrays.
    const wantsJson = /json/i.test(args.system) || /json/i.test(args.prompt)

    const response = await getClient().chat.completions.create({
      model: args.model,
      max_completion_tokens: args.maxTokens,
      messages: [
        { role: 'system', content: args.system },
        { role: 'user', content: args.prompt },
      ],
      ...(wantsJson ? { response_format: { type: 'json_object' as const } } : {}),
    })

    const text = response.choices[0]?.message?.content ?? ''
    return {
      text,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    }
  },
}
