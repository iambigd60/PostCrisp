import { beforeEach, describe, expect, it, vi } from 'vitest'

// Users can insert and update their own generations rows, tokens_used
// included. These tests pin that admin token and cost totals come only from
// the service-role-written generation_ai_calls ledger.

let tableData: Record<string, { data: unknown[] | null; error: { message: string } | null }>

function fakeAdminClient() {
  return {
    from(table: string) {
      const result = () => Promise.resolve(tableData[table] ?? { data: [], error: null })
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: result,
        gte: result,
        then: (resolve: (r: unknown) => unknown) => result().then(resolve),
      }
      return chain
    },
  }
}

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: vi.fn(async () => ({ ok: true, userId: 'admin-1', supabase: {}, supabaseAdmin: fakeAdminClient() })),
}))

import { GET } from '../route'

const today = new Date().toISOString()

beforeEach(() => {
  tableData = {
    profiles: { data: [{ id: 'user-1', subscription_tier: 'free', created_at: today }], error: null },
    credit_transactions: { data: [], error: null },
    generations: {
      data: [
        { user_id: 'user-1', feature: 'captions', created_at: today },
        // A row the user inserted directly, claiming a huge token count.
        { user_id: 'user-1', feature: 'captions', created_at: today, tokens_used: 50_000_000 },
      ],
      error: null,
    },
    generation_ai_calls: {
      data: [
        { user_id: 'user-1', feature: 'captions', total_tokens: 1200, estimated_cost_usd: '0.0144', created_at: today },
        { user_id: 'user-1', feature: 'captions', total_tokens: 300, estimated_cost_usd: '0.0006', created_at: today },
      ],
      error: null,
    },
  }
})

describe('GET /api/admin/analytics', () => {
  it('reports tokens and cost from the AI-call ledger, not generations.tokens_used', async () => {
    const body = await (await GET()).json()

    expect(body.kpi.totalGenerations30d).toBe(2)
    expect(body.kpi.totalTokens30d).toBe(1500)
    expect(body.kpi.totalEstCostUsd30d).toBeCloseTo(0.015, 10)
    expect(body.featureBreakdown).toEqual([
      expect.objectContaining({ feature: 'captions', count: 2, tokens: 1500 }),
    ])
    expect(body.topUsers[0]).toMatchObject({ user_id: 'user-1', count: 2, tokens: 1500 })
  })

  it('fails instead of reporting zero cost when the ledger cannot be read', async () => {
    tableData.generation_ai_calls = { data: null, error: { message: 'permission denied' } }
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
