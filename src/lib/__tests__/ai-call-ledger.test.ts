import { describe, expect, it } from 'vitest'
import { recordGenerationAiCalls, saveGenerationWithLedger, type AiCallLedgerEntry } from '@/lib/ai-call-ledger'
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

describe('saveGenerationWithLedger', () => {
  const call: AiCallLedgerEntry = {
    requestRole: 'primary',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    inputTokens: 400,
    outputTokens: 200,
    totalTokens: 600,
    estimatedCostUsd: 0.0042,
  }
  const row = { user_id: 'user-1', feature: 'hashtags', platform: 'tiktok', tokens_used: 600 }

  /** generations insert().select('id').single() and a plain ledger insert. */
  function fakeClient(opts: { generationError?: { message: string }; ledgerThrows?: boolean } = {}) {
    const written: Record<string, unknown[]> = { generations: [], generation_ai_calls: [] }
    const client = {
      from(table: string) {
        return {
          insert(payload: unknown) {
            if (table === 'generation_ai_calls') {
              if (opts.ledgerThrows) throw new Error('network down')
              written.generation_ai_calls.push(...(payload as unknown[]))
              return Promise.resolve({ error: null })
            }
            return {
              select: () => ({
                single: () => {
                  if (opts.generationError) return Promise.resolve({ data: null, error: opts.generationError })
                  written.generations.push(payload)
                  return Promise.resolve({ data: { id: 'gen-9' }, error: null })
                },
              }),
            }
          },
        }
      },
    }
    return { client: client as never, written }
  }

  it('saves the generation, then a ledger row per call tied to its id', async () => {
    const { client, written } = fakeClient()
    const result = await saveGenerationWithLedger(client, row, { tier: 'creator', aiCalls: [call] })

    expect(result).toEqual({ data: { id: 'gen-9' }, error: null })
    expect(written.generations).toEqual([row])
    expect(written.generation_ai_calls).toEqual([
      expect.objectContaining({ generation_id: 'gen-9', user_id: 'user-1', feature: 'hashtags', tier: 'creator', total_tokens: 600 }),
    ])
  })

  it('returns the insert error and writes no ledger rows when the generation is not saved', async () => {
    const { client, written } = fakeClient({ generationError: { message: 'rls' } })
    const result = await saveGenerationWithLedger(client, row, { tier: 'creator', aiCalls: [call] })

    expect(result.error).toEqual({ message: 'rls' })
    expect(written.generation_ai_calls).toHaveLength(0)
  })

  it('does not throw when recording the ledger throws', async () => {
    const { client } = fakeClient({ ledgerThrows: true })
    await expect(saveGenerationWithLedger(client, row, { tier: 'creator', aiCalls: [call] }))
      .resolves.toEqual({ data: { id: 'gen-9' }, error: null })
  })
})
