import { describe, it, expect, vi, beforeEach } from 'vitest'

// The brief supplies no test for this route, but it is the resume fix the
// whole redesign hinges on: re-firing all three generation calls against
// already-spent tutorial freebies returns three 409s and a dead screen. These
// tests exercise the route handler directly against a query-builder fake that
// actually honors .eq/.in/.order — not pre-sorted fixtures — so "latest row
// per feature" and "only this user's rows" are genuinely exercised rather than
// assumed from the shape of the seed data.

type Row = {
  user_id: string
  feature: string
  output_data: Record<string, unknown>
  created_at: string
  input_data?: Record<string, unknown>
}

let currentUser: { id: string } | null
let rows: Row[]

function fakeSupabase() {
  return {
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
    from(table: string) {
      if (table !== 'generations') throw new Error(`unexpected table: ${table}`)
      const eqs: [string, unknown][] = []
      let inFilter: [string, unknown[]] | null = null
      let orderCol: string | null = null
      let orderAscending = true

      const builder = {
        select() {
          return builder
        },
        eq(col: string, val: unknown) {
          eqs.push([col, val])
          return builder
        },
        in(col: string, vals: unknown[]) {
          inFilter = [col, vals]
          return builder
        },
        order(col: string, opts?: { ascending?: boolean }) {
          orderCol = col
          orderAscending = opts?.ascending ?? true
          return builder
        },
        then(resolve: (v: { data: Row[]; error: null }) => unknown) {
          let result = rows.filter((row) =>
            eqs.every(([col, val]) => {
              if (col.includes('->>')) {
                const [base, key] = col.split('->>')
                const container = (row as Record<string, unknown>)[base] as
                  | Record<string, unknown>
                  | undefined
                return container != null && String(container[key]) === String(val)
              }
              return (row as Record<string, unknown>)[col] === val
            }),
          )
          if (inFilter) {
            const [col, vals] = inFilter
            result = result.filter((row) => vals.includes((row as Record<string, unknown>)[col]))
          }
          if (orderCol) {
            const col = orderCol
            result = [...result].sort((a, b) => {
              const av = (a as Record<string, unknown>)[col] as string
              const bv = (b as Record<string, unknown>)[col] as string
              if (av === bv) return 0
              const cmp = av < bv ? -1 : 1
              return orderAscending ? cmp : -cmp
            })
          }
          return resolve({ data: result, error: null })
        },
      }
      return builder
    },
  }
}

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => fakeSupabase()),
}))

beforeEach(() => {
  currentUser = { id: 'user-1' }
  rows = []
})

describe('GET /api/onboarding/pack', () => {
  it('returns 401 when unauthenticated', async () => {
    currentUser = null
    const { GET } = await import('../route')

    const response = await GET()

    expect(response.status).toBe(401)
  })

  it('returns empty state when nothing has been generated yet', async () => {
    const { GET } = await import('../route')

    const body = await (await GET()).json()

    expect(body).toEqual({ captions: [], hashtags: [], idea: null })
  })

  it('returns the LATEST captions row, not an arbitrary one, when several exist', async () => {
    // Seeded oldest-first so a naive "first element" implementation (rather
    // than a real created_at ORDER BY) would return the wrong one.
    rows = [
      {
        user_id: 'user-1',
        feature: 'captions',
        output_data: { captions: ['old caption'] },
        created_at: '2026-08-01T00:00:00.000Z',
        input_data: { tutorialMode: true },
      },
      {
        user_id: 'user-1',
        feature: 'captions',
        output_data: { captions: ['new caption'] },
        created_at: '2026-08-10T00:00:00.000Z',
        input_data: { tutorialMode: true },
      },
    ]
    const { GET } = await import('../route')

    const body = await (await GET()).json()

    expect(body.captions).toEqual(['new caption'])
  })

  it('returns hashtags from the latest hashtags row', async () => {
    rows = [
      {
        user_id: 'user-1',
        feature: 'hashtags',
        output_data: { hashtags: [{ tag: '#old', score: 1, posts: '1', category: 'LOW_COMPETITION' }] },
        created_at: '2026-08-01T00:00:00.000Z',
        input_data: { tutorialMode: true },
      },
      {
        user_id: 'user-1',
        feature: 'hashtags',
        output_data: { hashtags: [{ tag: '#new', score: 99, posts: '1M', category: 'HIGH_REACH' }] },
        created_at: '2026-08-10T00:00:00.000Z',
        input_data: { tutorialMode: true },
      },
    ]
    const { GET } = await import('../route')

    const body = await (await GET()).json()

    expect(body.hashtags).toEqual([{ tag: '#new', score: 99, posts: '1M', category: 'HIGH_REACH' }])
  })

  it('returns the first idea from the latest viral_ideas row', async () => {
    rows = [
      {
        user_id: 'user-1',
        feature: 'viral_ideas',
        output_data: { ideas: [{ title: 'idea A' }, { title: 'idea B' }] },
        created_at: '2026-08-10T00:00:00.000Z',
        input_data: { tutorialMode: true },
      },
    ]
    const { GET } = await import('../route')

    const body = await (await GET()).json()

    expect(body.idea).toEqual({ title: 'idea A' })
  })

  it('does NOT leak another user\'s generations', async () => {
    rows = [
      {
        user_id: 'someone-else',
        feature: 'captions',
        output_data: { captions: ['not yours'] },
        created_at: '2026-08-10T00:00:00.000Z',
        input_data: { tutorialMode: true },
      },
    ]
    const { GET } = await import('../route')

    const body = await (await GET()).json()

    expect(body.captions).toEqual([])
  })

  it('ignores rows written outside tutorial mode — resume shows the free run, not later paid usage', async () => {
    rows = [
      {
        user_id: 'user-1',
        feature: 'captions',
        output_data: { captions: ['paid caption'] },
        created_at: '2026-08-10T00:00:00.000Z',
        input_data: { tutorialMode: false },
      },
    ]
    const { GET } = await import('../route')

    const body = await (await GET()).json()

    expect(body.captions).toEqual([])
  })

  it('falls back to empty/null on a malformed or missing output_data shape instead of throwing', async () => {
    rows = [
      {
        user_id: 'user-1',
        feature: 'captions',
        output_data: {},
        created_at: '2026-08-10T00:00:00.000Z',
        input_data: { tutorialMode: true },
      },
      {
        user_id: 'user-1',
        feature: 'viral_ideas',
        output_data: { ideas: [] },
        created_at: '2026-08-10T00:00:00.000Z',
        input_data: { tutorialMode: true },
      },
    ]
    const { GET } = await import('../route')

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ captions: [], hashtags: [], idea: null })
  })
})
