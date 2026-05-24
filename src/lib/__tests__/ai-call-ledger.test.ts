import { describe, expect, it } from 'vitest'
import { recordGenerationAiCalls, type AiCallLedgerEntry } from '@/lib/ai-call-ledger'
import { createFakeSupabase, type FakeSupabaseTables } from './fake-supabase'

function setupTables(): FakeSupabaseTables {
  return {
    profiles: new Map(),
    credit_transactions: [],
    generations: [],
    creator_profiles: new Map(),
    generation_ai_calls: [],
  }
}

describe('recordGenerationAiCalls', () => {
  it('inserts one ledger row per model call with user, feature, and generation context', async () => {
    const tables = setupTables()
    const supabase = createFakeSupabase({ tables })
    const calls: AiCallLedgerEntry[] = [
      {
        requestRole: 'primary',
        provider: 'anthropic',
        model: 'claude-opus-4-7',
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        cacheReadInputTokens: 200,
        cacheCreationInputTokens: 100,
        estimatedCostUsd: 0.055875,
      },
      {
        requestRole: 'critic',
        provider: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 800,
        outputTokens: 300,
        totalTokens: 1100,
        estimatedCostUsd: 0.0003,
      },
    ]

    await recordGenerationAiCalls(supabase as any, {
      generationId: 'gen-1',
      userId: 'user-1',
      feature: 'foundation_analysis',
      tier: 'elite',
      calls,
    })

    expect(tables.generation_ai_calls).toHaveLength(2)
    expect(tables.generation_ai_calls[0]).toMatchObject({
      generation_id: 'gen-1',
      user_id: 'user-1',
      feature: 'foundation_analysis',
      tier: 'elite',
      request_role: 'primary',
      provider: 'anthropic',
      model: 'claude-opus-4-7',
      input_tokens: 1000,
      output_tokens: 500,
      total_tokens: 1500,
      cache_read_input_tokens: 200,
      cache_creation_input_tokens: 100,
      estimated_cost_usd: 0.055875,
    })
  })

  it('does nothing when there is no generation id or no calls', async () => {
    const tables = setupTables()
    const supabase = createFakeSupabase({ tables })

    await recordGenerationAiCalls(supabase as any, {
      generationId: null,
      userId: 'user-1',
      feature: 'captions',
      tier: 'creator',
      calls: [],
    })

    expect(tables.generation_ai_calls).toHaveLength(0)
  })
})
