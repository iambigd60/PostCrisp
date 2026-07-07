/**
 * Lightweight in-memory Supabase fake for unit tests. Implements only the
 * subset of the query builder our credit, tutorial-bypass, and stripe-webhook
 * helpers actually use. Tests can preload the `tables` map with rows, then
 * assert on the same map after the helper runs.
 *
 * Not exhaustive — if a helper uses an operator we haven't implemented,
 * the test will throw and we'll add it. Better to fail loudly than to
 * silently approximate.
 */

export interface FakeSupabaseTables {
  profiles: Map<string, Record<string, unknown>>
  credit_transactions: Record<string, unknown>[]
  generations: Record<string, unknown>[]
  generation_ai_calls: Record<string, unknown>[]
  creator_profiles: Map<string, Record<string, unknown>>
  // Optional — omit to simulate the table missing (migration not yet run),
  // which the fake surfaces as a "relation does not exist" query error.
  processed_stripe_events?: Map<string, Record<string, unknown>>
}

export interface FakeRpcResults {
  consume_user_credits?: (args: { p_user_id: string; p_amount: number }) => number | null
}

// Optional per-table write-error injection: any insert/update/upsert/delete
// against a listed table resolves with { error } instead of writing (reads
// are untouched). Consulted at execution time, so tests holding a reference
// can clear an entry between deliveries to simulate a transient failure.
export type FakeWriteErrors = Partial<Record<keyof FakeSupabaseTables, { message: string } | undefined>>

// Same idea for reads: select().maybeSingle()/.single() against a listed
// table resolves with { data: null, error } instead of reading.
export type FakeReadErrors = FakeWriteErrors

export function createFakeSupabase(opts: {
  tables: FakeSupabaseTables
  rpcs?: FakeRpcResults
  writeErrors?: FakeWriteErrors
  readErrors?: FakeReadErrors
}) {
  const { tables, rpcs = {}, writeErrors, readErrors } = opts

  const fromBuilder = (table: keyof FakeSupabaseTables) => {
    type Filter = { col: string; val: unknown }
    const filters: Filter[] = []
    let updatePayload: Record<string, unknown> | null = null
    let selectCols: string | null = null
    let isInsert = false
    let insertPayload: Record<string, unknown> | Record<string, unknown>[] | null = null
    let isUpsert = false
    let upsertPayload: Record<string, unknown> | Record<string, unknown>[] | null = null
    let upsertOnConflict: string | null = null
    let upsertIgnoreDuplicates = false
    let isDelete = false

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
      upsert(
        payload: Record<string, unknown> | Record<string, unknown>[],
        opts?: { onConflict?: string; ignoreDuplicates?: boolean },
      ) {
        isUpsert = true
        upsertPayload = payload
        upsertOnConflict = opts?.onConflict ?? null
        upsertIgnoreDuplicates = opts?.ignoreDuplicates ?? false
        return builder
      },
      delete() {
        isDelete = true
        return builder
      },
      maybeSingle() {
        // Injected read failure — consulted at execution time, like writeErrors.
        const injected = readErrors?.[table]
        if (injected) return Promise.resolve({ data: null, error: injected })
        if (table === 'profiles') {
          const rows = Array.from(tables.profiles.values())
          const found = rows.find(matches)
          return Promise.resolve({ data: found ?? null, error: null })
        }
        if (table === 'creator_profiles') {
          const rows = Array.from(tables.creator_profiles.values())
          const found = rows.find(matches)
          return Promise.resolve({ data: found ?? null, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      },
      single() {
        return builder.maybeSingle().then((r: { data: unknown; error: null | { message: string } }) => {
          if (r.error) return r
          if (!r.data) return { data: null, error: { message: 'no rows' } }
          return r
        })
      },
      // Terminal: when caller awaits the chain (no .single/.maybeSingle).
      // This handles update().eq(), insert(), and upsert() patterns.
      then(resolve: (v: { data?: unknown; error: null | { message: string } }) => unknown) {
        // Injected write failure — reads are unaffected (they don't land here).
        const injected =
          isInsert || isUpsert || isDelete || updatePayload ? writeErrors?.[table] : undefined
        if (injected) {
          return resolve({ data: null, error: injected })
        }
        if (isDelete) {
          if (table === 'processed_stripe_events') {
            const map = tables.processed_stripe_events
            if (!map) {
              return resolve({
                data: null,
                error: { message: 'relation "public.processed_stripe_events" does not exist' },
              })
            }
            for (const [id, row] of Array.from(map.entries())) {
              if (matches(row)) map.delete(id)
            }
            return resolve({ error: null })
          }
          // Fail loudly (per the header contract) rather than pretend the
          // delete succeeded — add the table here when a helper needs it.
          throw new Error(`fake-supabase: delete() not implemented for table "${table}"`)
        }
        if (isInsert && insertPayload) {
          const rows = Array.isArray(insertPayload) ? insertPayload : [insertPayload]
          if (table === 'credit_transactions') tables.credit_transactions.push(...rows)
          if (table === 'generations') tables.generations.push(...rows)
          if (table === 'generation_ai_calls') tables.generation_ai_calls.push(...rows)
          return resolve({ error: null })
        }
        if (isUpsert && upsertPayload) {
          const rows = Array.isArray(upsertPayload) ? upsertPayload : [upsertPayload]
          if (table === 'creator_profiles') {
            // Default conflict key is 'user_id' for creator_profiles.
            const key = upsertOnConflict ?? 'user_id'
            for (const row of rows) {
              const id = row[key] as string
              const existing = tables.creator_profiles.get(id) ?? {}
              tables.creator_profiles.set(id, { ...existing, ...row })
            }
          }
          if (table === 'processed_stripe_events') {
            const map = tables.processed_stripe_events
            if (!map) {
              // Table not preloaded → behave like a missing relation, so tests
              // can exercise the webhook's fail-open path.
              return resolve({
                data: null,
                error: { message: 'relation "public.processed_stripe_events" does not exist' },
              })
            }
            const key = upsertOnConflict ?? 'event_id'
            // With ignoreDuplicates, conflicting rows are skipped and excluded
            // from the returned data — mirrors PostgREST's "0 rows affected".
            const affected: Record<string, unknown>[] = []
            for (const row of rows) {
              const id = row[key] as string
              if (map.has(id)) {
                if (upsertIgnoreDuplicates) continue
                map.set(id, { ...map.get(id), ...row })
              } else {
                map.set(id, row)
              }
              affected.push(row)
            }
            return resolve({ data: affected, error: null })
          }
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
