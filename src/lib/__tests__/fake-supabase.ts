/**
 * Lightweight in-memory Supabase fake for unit tests. Implements only the
 * subset of the query builder our credit + tutorial-bypass helpers actually
 * use. Tests can preload the `tables` map with rows, then assert on the same
 * map after the helper runs.
 *
 * Not exhaustive — if a helper uses an operator we haven't implemented,
 * the test will throw and we'll add it. Better to fail loudly than to
 * silently approximate.
 */

export interface FakeSupabaseTables {
  profiles: Map<string, Record<string, unknown>>
  credit_transactions: Record<string, unknown>[]
  generations: Record<string, unknown>[]
}

export interface FakeRpcResults {
  consume_user_credits?: (args: { p_user_id: string; p_amount: number }) => number | null
}

export function createFakeSupabase(opts: {
  tables: FakeSupabaseTables
  rpcs?: FakeRpcResults
}) {
  const { tables, rpcs = {} } = opts

  const fromBuilder = (table: keyof FakeSupabaseTables) => {
    type Filter = { col: string; val: unknown }
    const filters: Filter[] = []
    let updatePayload: Record<string, unknown> | null = null
    let selectCols: string | null = null
    let isInsert = false
    let insertPayload: Record<string, unknown> | Record<string, unknown>[] | null = null

    const matches = (row: Record<string, unknown>) =>
      filters.every((f) => row[f.col] === f.val)

    const builder: any = {
      select(cols?: string) {
        selectCols = cols ?? '*'
        return builder
      },
      eq(col: string, val: unknown) {
        filters.push({ col, val })
        return builder
      },
      update(payload: Record<string, unknown>) {
        updatePayload = payload
        return builder
      },
      insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
        isInsert = true
        insertPayload = payload
        return builder
      },
      maybeSingle() {
        if (table === 'profiles') {
          const rows = Array.from(tables.profiles.values())
          const found = rows.find(matches)
          return Promise.resolve({ data: found ?? null, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      },
      single() {
        return builder.maybeSingle().then((r: { data: unknown }) => {
          if (!r.data) return { data: null, error: { message: 'no rows' } }
          return r
        })
      },
      // Terminal: when caller awaits the chain (no .single/.maybeSingle).
      // This handles update().eq() and insert() patterns.
      then(resolve: (v: { error: null | { message: string } }) => unknown) {
        if (isInsert && insertPayload) {
          const rows = Array.isArray(insertPayload) ? insertPayload : [insertPayload]
          if (table === 'credit_transactions') tables.credit_transactions.push(...rows)
          if (table === 'generations') tables.generations.push(...rows)
          return resolve({ error: null })
        }
        if (updatePayload && table === 'profiles') {
          const entries = Array.from(tables.profiles.entries())
          for (const [key, row] of entries) {
            if (matches(row)) {
              tables.profiles.set(key, { ...row, ...updatePayload })
            }
          }
          return resolve({ error: null })
        }
        return resolve({ error: null })
      },
    }
    return builder
  }

  return {
    from: (table: string) => fromBuilder(table as keyof FakeSupabaseTables),
    rpc: (name: keyof FakeRpcResults, args: any) => {
      const fn = rpcs[name]
      if (!fn) return Promise.resolve({ data: null, error: { message: `rpc ${name} not mocked` } })
      const data = fn(args)
      return Promise.resolve({ data, error: null })
    },
  }
}
