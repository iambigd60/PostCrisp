import { describe, it, expect, vi } from 'vitest'
import { recordTutorialRedemption } from '@/lib/tutorial-redemptions'

function fakeWriter(
  calls: unknown[],
  opts: { throwOnInsert?: boolean; resolveWithError?: { message: string } } = {},
) {
  return {
    from(table: string) {
      return {
        upsert(row: unknown, options: unknown) {
          if (opts.throwOnInsert) throw new Error('simulated write failure')
          calls.push({ table, row, options })
          if (opts.resolveWithError) return Promise.resolve({ error: opts.resolveWithError })
          return Promise.resolve({ error: null })
        },
      }
    },
  }
}

describe('recordTutorialRedemption', () => {
  it('writes the redemption to tutorial_redemptions for the user and feature', async () => {
    const calls: unknown[] = []
    await recordTutorialRedemption('user-1', 'captions', fakeWriter(calls) as never)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      table: 'tutorial_redemptions',
      row: { user_id: 'user-1', feature: 'captions' },
    })
  })

  it('is idempotent — a replayed redemption must not error or double-count', async () => {
    // UNIQUE(user_id, feature) means the second write conflicts. The helper
    // must ignore the conflict rather than surface it, because a route may
    // legitimately retry after a partial failure.
    const calls: unknown[] = []
    await recordTutorialRedemption('user-1', 'captions', fakeWriter(calls) as never)
    await recordTutorialRedemption('user-1', 'captions', fakeWriter(calls) as never)
    expect(calls).toHaveLength(2)
    expect((calls[1] as { options: unknown }).options).toMatchObject({ onConflict: 'user_id,feature' })
  })

  it('NEVER throws when the write fails — a ledger error must not fail a generation the user already received', async () => {
    const calls: unknown[] = []
    await expect(
      recordTutorialRedemption('user-1', 'hashtags', fakeWriter(calls, { throwOnInsert: true }) as never),
    ).resolves.toBeUndefined()
  })

  it('also never throws AND logs it when the write resolves with a PostgREST error instead of throwing — the realistic failure mode, since supabase-js resolves rather than rejects on a query error (e.g. a missing relation before the migration is applied)', async () => {
    const calls: unknown[] = []
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      recordTutorialRedemption(
        'user-1',
        'viral_ideas',
        fakeWriter(calls, {
          resolveWithError: { message: 'relation "public.tutorial_redemptions" does not exist' },
        }) as never,
      ),
    ).resolves.toBeUndefined()

    expect(consoleError).toHaveBeenCalledWith(
      '[tutorial-redemptions] write returned an error',
      expect.objectContaining({ userId: 'user-1', feature: 'viral_ideas' }),
    )

    consoleError.mockRestore()
  })
})
