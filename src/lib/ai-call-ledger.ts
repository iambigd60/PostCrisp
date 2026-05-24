import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { createClient } from '@/utils/supabase/server'
import type { ProviderId } from './providers/types'
import type { Tier } from './crisp-engine-config'

type ServerClient = Awaited<ReturnType<typeof createClient>>

export type AiCallRequestRole = 'primary' | 'critic' | 'vision'

export interface AiCallLedgerEntry {
  requestRole: AiCallRequestRole
  provider: ProviderId
  model: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheReadInputTokens?: number
  cacheCreationInputTokens?: number
  estimatedCostUsd: number
}

export interface RecordGenerationAiCallsArgs {
  generationId: string | null | undefined
  userId: string
  feature: string
  tier: Tier
  calls: AiCallLedgerEntry[]
}

export async function recordGenerationAiCalls(
  supabase: ServerClient,
  args: RecordGenerationAiCallsArgs,
): Promise<void> {
  if (!args.generationId || args.calls.length === 0) return

  const rows = args.calls.map((call) => ({
    generation_id: args.generationId,
    user_id: args.userId,
    feature: args.feature,
    tier: args.tier,
    request_role: call.requestRole,
    provider: call.provider,
    model: call.model,
    input_tokens: call.inputTokens,
    output_tokens: call.outputTokens,
    total_tokens: call.totalTokens,
    cache_read_input_tokens: call.cacheReadInputTokens ?? 0,
    cache_creation_input_tokens: call.cacheCreationInputTokens ?? 0,
    estimated_cost_usd: call.estimatedCostUsd,
  }))

  const writer = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } },
      )
    : supabase

  const { error } = await writer.from('generation_ai_calls').insert(rows)
  if (error) {
    console.error('[ai-call-ledger] failed to record generation AI calls:', error.message)
  }
}
