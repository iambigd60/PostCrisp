import { describe, expect, it, vi } from 'vitest'

// Next resolves 'server-only' at build time; vitest has no such package.
vi.mock('server-only', () => ({}))

import { finalizeInviteCode, releaseInviteCode, reserveInviteCode } from '@/lib/invite-codes'

type Filter = [op: 'eq' | 'is', column: string, value: unknown]

/**
 * Records the single update chain a helper issues and resolves it with the
 * given result. Enough to pin the filters that make each write safe.
 */
function fakeAdmin(result: { data: unknown; error: unknown } = { data: null, error: null }) {
  const calls: { table?: string; payload?: Record<string, unknown>; filters: Filter[]; selected?: string } = { filters: [] }
  const chain = {
    update(payload: Record<string, unknown>) { calls.payload = payload; return chain },
    eq(column: string, value: unknown) { calls.filters.push(['eq', column, value]); return chain },
    is(column: string, value: unknown) { calls.filters.push(['is', column, value]); return chain },
    select(cols: string) { calls.selected = cols; return chain },
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (r: unknown) => unknown) => Promise.resolve(result).then(resolve),
  }
  const client = { from(table: string) { calls.table = table; return chain } }
  return { client: client as never, calls }
}

describe('reserveInviteCode', () => {
  it('reserves only an unused code and returns the reservation time', async () => {
    const { client, calls } = fakeAdmin({ data: { code: 'ABCD1234' }, error: null })
    const reservedAt = await reserveInviteCode(client, 'abcd-1234')

    expect(reservedAt).toEqual(calls.payload?.used_at)
    expect(calls.table).toBe('invite_codes')
    expect(Object.keys(calls.payload ?? {})).toEqual(['used_at'])
    expect(calls.filters).toContainEqual(['eq', 'code', 'ABCD1234'])
    expect(calls.filters).toContainEqual(['is', 'used_at', null])
  })

  it('returns null when the code is missing or already used', async () => {
    const { client } = fakeAdmin({ data: null, error: null })
    expect(await reserveInviteCode(client, 'ABCD1234')).toBeNull()
  })

  it('returns null on a database error', async () => {
    const { client } = fakeAdmin({ data: null, error: { message: 'boom' } })
    expect(await reserveInviteCode(client, 'ABCD1234')).toBeNull()
  })
})

describe('finalizeInviteCode', () => {
  it('attaches the account only where used_by is still empty', async () => {
    const { client, calls } = fakeAdmin({ data: { code: 'ABCD1234' }, error: null })
    expect(await finalizeInviteCode(client, 'ABCD1234', 'user-1')).toBe(true)
    expect(calls.payload).toEqual({ used_by: 'user-1' })
    expect(calls.filters).toContainEqual(['is', 'used_by', null])
  })
})

describe('releaseInviteCode', () => {
  it('clears only this signup’s own reservation', async () => {
    const { client, calls } = fakeAdmin()
    await releaseInviteCode(client, 'abcd1234', '2026-09-29T03:00:00.000Z')
    expect(calls.payload).toEqual({ used_at: null })
    expect(calls.filters).toContainEqual(['eq', 'code', 'ABCD1234'])
    expect(calls.filters).toContainEqual(['eq', 'used_at', '2026-09-29T03:00:00.000Z'])
    expect(calls.filters).toContainEqual(['is', 'used_by', null])
  })
})
