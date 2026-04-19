import type { AIProvider, ProviderId } from './types'
import { anthropicProvider } from './anthropic'
import { openaiProvider } from './openai'

// Registry of available providers. Add Azure adapter here when built.
const PROVIDERS: Record<ProviderId, AIProvider> = {
  anthropic: anthropicProvider,
  openai:    openaiProvider,
  azure:     anthropicProvider,  // fallback — Azure adapter not yet implemented
}

export function getProvider(id: ProviderId): AIProvider {
  return PROVIDERS[id] ?? anthropicProvider
}

// Re-export client-safe pieces for backward compat
export { SUPPORTED_PROVIDERS, AVAILABLE_PROVIDERS } from './types'
export type { AIProvider, ProviderId, GenerateArgs, GenerateResult } from './types'
