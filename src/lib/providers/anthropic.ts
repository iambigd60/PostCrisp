import Anthropic from '@anthropic-ai/sdk'
import type { AIProvider, GenerateArgs, GenerateResult } from './types'

let _client: Anthropic | undefined
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
  return _client
}

export const anthropicProvider: AIProvider = {
  id: 'anthropic',
  async generate(args: GenerateArgs): Promise<GenerateResult> {
    const response = await getClient().messages.create({
      model: args.model,
      max_tokens: args.maxTokens,
      system: args.system,
      messages: [{ role: 'user', content: args.prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return {
      text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    }
  },
}
