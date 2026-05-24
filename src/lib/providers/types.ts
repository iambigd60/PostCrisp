/**
 * Provider interface for the Crisp Engine.
 * Each underlying AI provider (Anthropic, OpenAI, Azure) implements this.
 * Engine never cares which provider is underneath — if the provider spec
 * changes, only the adapter changes.
 */

export type ProviderId = 'anthropic' | 'openai' | 'azure'

// Client-safe lists (no SDK imports here, so admin UI can import freely)
export const SUPPORTED_PROVIDERS: ProviderId[] = ['anthropic', 'openai', 'azure']
export const AVAILABLE_PROVIDERS: ProviderId[] = ['anthropic', 'openai']

export interface GenerateArgs {
  model: string
  system: string
  prompt: string
  maxTokens: number
}

export interface GenerateResult {
  text: string
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens?: number
  cacheCreationInputTokens?: number
}

export interface AIProvider {
  readonly id: ProviderId
  generate(args: GenerateArgs): Promise<GenerateResult>
}
