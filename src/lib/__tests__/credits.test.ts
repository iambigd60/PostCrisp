import { describe, it, expect } from 'vitest'
import { consumeCredits, creditCostFor, ensureCreditsCurrent } from '@/lib/credits'
import { createFakeSupabase, type FakeSupabaseTables } from './fake-supabase'

function setupTables(
  initialBalance: number,
  opts: { purchased?: number; resetAt?: string } = {},
): FakeSupabaseTables {
  return {
    profiles: new Map([
      [
        'user-1',
        {
          id: 'user-1',
          credits_balance: initialBalance,
          purchased_credits: opts.purchased ?? 0,
          // Default far in the future so ensureCreditsCurrent won't reset.
          credits_reset_at: opts.resetAt ?? new Date(Date.now() + 30 * 86400_000).toISOString(),
        },
      ],
    ]),
    credit_transactions: [],
    generations: [],
    generation_ai_calls: [],
    creator_profiles: new Map(),
  }
}

describe('creditCostFor', () => {
  it('returns the configured per-task cost', () => {
    expect(creditCostFor('captions')).toBe(1)
    expect(creditCostFor('viral-ideas')).toBe(3)
    expect(creditCostFor('channel-analysis')).toBe(5)
  })
})

describe('consumeCredits', () => {
  it('debits the user balance and records a credit_transactions row when balance is sufficient', async () => {
    const tables = setupTables(10)
    const supabase = createFakeSupabase({
      tables,
      rpcs: {
        consume_user_credits: ({ p_user_id, p_amount }) => {
          const row = tables.profiles.get(p_user_id) as { credits_balance: number }
          if (row.credits_balance < p_amount) return null
          row.credits_balance -= p_amount
          return row.credits_balance
        },
      },
    })

    const result = await consumeCredits(supabase as any, 'user-1', 3, 'viral-ideas')

    expect(result).toEqual({ balanceAfter: 7 })
    expect(tables.credit_transactions).toHaveLength(1)
    expect(tables.credit_transactions[0]).toMatchObject({
      user_id: 'user-1',
      type: 'consume',
      amount: -3,
      balance_after: 7,
      task: 'viral-ideas',
    })
  })

  it('returns null and does NOT record a transaction when balance is insufficient', async () => {
    const tables = setupTables(2)
    const supabase = createFakeSupabase({
      tables,
      rpcs: {
        consume_user_credits: ({ p_user_id, p_amount }) => {
          const row = tables.profiles.get(p_user_id) as { credits_balance: number }
          if (row.credits_balance < p_amount) return null
          row.credits_balance -= p_amount
          return row.credits_balance
        },
      },
    })

    const result = await consumeCredits(supabase as any, 'user-1', 5, 'channel-analysis')

    expect(result).toBeNull()
    expect(tables.credit_transactions).toHaveLength(0)
    // Balance is unchanged — no debit happened.
    expect((tables.profiles.get('user-1') as { credits_balance: number }).credits_balance).toBe(2)
  })

  it('falls back to a conditional UPDATE (with row-count check) when the RPC is unavailable', async () => {
    const tables = setupTables(10)
    // No rpcs provided → the RPC call errors → consumeCredits uses the
    // read-then-conditional-update fallback. The fake now returns the affected
    // rows for update().select(), so a real debit is detected as success.
    const supabase = createFakeSupabase({ tables })

    const result = await consumeCredits(supabase as any, 'user-1', 3, 'viral-ideas')

    expect(result).toEqual({ balanceAfter: 7 })
    expect((tables.profiles.get('user-1') as { credits_balance: number }).credits_balance).toBe(7)
    expect(tables.credit_transactions).toHaveLength(1)
  })

  it('fallback returns null when the balance is already too low (no debit, no txn)', async () => {
    const tables = setupTables(2)
    const supabase = createFakeSupabase({ tables })

    const result = await consumeCredits(supabase as any, 'user-1', 5, 'channel-analysis')

    expect(result).toBeNull()
    expect((tables.profiles.get('user-1') as { credits_balance: number }).credits_balance).toBe(2)
    expect(tables.credit_transactions).toHaveLength(0)
  })

  it('fallback returns null on a lost race — conditional UPDATE affects 0 rows, no ledger row', async () => {
    const tables = setupTables(10)
    // Balance passes the pre-read (10 >= 3) but the conditional UPDATE matches
    // zero rows (a concurrent request already moved the balance).
    const supabase = createFakeSupabase({ tables, conditionalUpdateMisses: true })

    const result = await consumeCredits(supabase as any, 'user-1', 3, 'viral-ideas')

    expect(result).toBeNull()
    expect((tables.profiles.get('user-1') as { credits_balance: number }).credits_balance).toBe(10)
    expect(tables.credit_transactions).toHaveLength(0)
  })

  it('treats cost <= 0 as a no-op debit (admin / tutorial-bypass path)', async () => {
    const tables = setupTables(10)
    const supabase = createFakeSupabase({
      tables,
      rpcs: {
        // Asserts the RPC is NOT called for cost=0
        consume_user_credits: () => {
          throw new Error('consume_user_credits should not be called when cost is 0')
        },
      },
    })

    const result = await consumeCredits(supabase as any, 'user-1', 0, 'captions')

    expect(result).toEqual({ balanceAfter: 10 })
    expect(tables.credit_transactions).toHaveLength(0)
    expect((tables.profiles.get('user-1') as { credits_balance: number }).credits_balance).toBe(10)
  })
})

describe('purchased-credits bucket', () => {
  const profile = (t: FakeSupabaseTables) => t.profiles.get('user-1') as { credits_balance: number; purchased_credits: number }

  it('allowance reset refills on top of purchased credits (packs never expire)', async () => {
    // Creator (allowance 500) who spent down to 200 and holds a 1500 pack, past reset.
    const tables = setupTables(200, { purchased: 1500, resetAt: new Date(Date.now() - 86400_000).toISOString() })
    const supabase = createFakeSupabase({ tables })

    const { balance } = await ensureCreditsCurrent(supabase as any, 'user-1', 'creator')

    expect(balance).toBe(2000)               // 500 fresh allowance + 1500 preserved purchased
    expect(profile(tables).credits_balance).toBe(2000)
    expect(profile(tables).purchased_credits).toBe(1500)  // unchanged
    expect(tables.credit_transactions.some((t) => t.type === 'reset')).toBe(true)
  })

  it('consume spends the allowance portion first (purchased untouched)', async () => {
    // balance 2000 = 500 allowance + 1500 purchased; spend 300 (< allowance).
    const tables = setupTables(2000, { purchased: 1500 })
    const supabase = createFakeSupabase({ tables })  // no RPC → fallback path

    const result = await consumeCredits(supabase as any, 'user-1', 300, 'viral-ideas')

    expect(result).toEqual({ balanceAfter: 1700 })
    expect(profile(tables).credits_balance).toBe(1700)
    expect(profile(tables).purchased_credits).toBe(1500)  // allowance covered it
  })

  it('consume draws down purchased once the allowance is exhausted', async () => {
    // balance 2000 = 500 allowance + 1500 purchased; spend 700 (> allowance).
    const tables = setupTables(2000, { purchased: 1500 })
    const supabase = createFakeSupabase({ tables })

    const result = await consumeCredits(supabase as any, 'user-1', 700, 'viral-ideas')

    expect(result).toEqual({ balanceAfter: 1300 })
    expect(profile(tables).credits_balance).toBe(1300)
    expect(profile(tables).purchased_credits).toBe(1300)  // clamped to the new balance
  })
})
