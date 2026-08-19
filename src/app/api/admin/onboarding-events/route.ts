import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { serviceRoleClient } from '@/lib/supabase-admin'
import { logOnboardingEvent, SELFTEST_EVENT_NAME } from '@/lib/onboarding-events'

/**
 * Admin-only funnel probe.
 *
 * Why this exists: onboarding_events sat at 0 rows with no way to tell a dead
 * pipeline from an idle product. Nobody had signed in for two weeks, so
 * "wait for a real user" was not a verification strategy — it was a hope.
 *
 * POST writes a tagged row through the REAL write path (same
 * logOnboardingEvent the funnel uses, same service-role client, same table)
 * and then reads it back, which is what makes it proof rather than a
 * self-assessment: a lost grant or a dropped table shows up as a readback
 * miss even if the insert reported success.
 *
 * GET returns recent counts by name so the manual walkthrough can be confirmed
 * without database access.
 *
 * The probe row is left in place deliberately. The migration grants service_role
 * only SELECT and INSERT on this table (no DELETE), and widening that for a
 * test's convenience would weaken the append-only property the table exists to
 * have. `name = 'selftest'` and `detail.selftest = true` make the rows trivial
 * to exclude from funnel queries — and 'selftest' is deliberately absent from
 * ONBOARDING_EVENT_NAMES, so the public route rejects it and no client can
 * forge one.
 */

const LOOKBACK_HOURS = 24

type CountRow = { name: string }

export async function POST() {
  let gate
  try {
    gate = await requireAdmin()
  } catch {
    // requireAdmin builds a service-role client with non-null assertions, so a
    // missing key throws here rather than returning. Report it as the
    // configuration problem it is — an opaque 500 is what this route exists to
    // eliminate. Unauthenticated callers are refused before that point, so this
    // cannot leak configuration state to anyone but an authenticated admin.
    return NextResponse.json({ ok: false, wrote: false, readBack: false, reason: 'env' }, { status: 500 })
  }

  if (!gate.ok) return gate.response

  const nonce = crypto.randomUUID()
  const written = await logOnboardingEvent(gate.userId, SELFTEST_EVENT_NAME, {
    selftest: true,
    nonce,
  })

  if (!written.ok) {
    return NextResponse.json(
      { ok: false, wrote: false, readBack: false, reason: written.reason },
      { status: 500 },
    )
  }

  const client = serviceRoleClient()
  if (!client) {
    return NextResponse.json(
      { ok: false, wrote: true, readBack: false, reason: 'env' },
      { status: 500 },
    )
  }

  const { data, error } = await client
    .from('onboarding_events')
    .select('id')
    .contains('detail', { nonce })
    .limit(1)

  if (error) {
    return NextResponse.json(
      { ok: false, wrote: true, readBack: false, reason: 'readback-error', message: error.message },
      { status: 500 },
    )
  }

  if (!data || data.length === 0) {
    // The insert reported success but the row is not there: the write path and
    // the read path disagree. Worth surfacing loudly — it is the signature of a
    // grant or policy change rather than an outage.
    return NextResponse.json(
      { ok: false, wrote: true, readBack: false, reason: 'readback-missing' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, wrote: true, readBack: true, nonce })
}

export async function GET() {
  let gate
  try {
    gate = await requireAdmin()
  } catch {
    return NextResponse.json({ ok: false, reason: 'env' }, { status: 500 })
  }

  if (!gate.ok) return gate.response

  const client = serviceRoleClient()
  if (!client) return NextResponse.json({ ok: false, reason: 'env' }, { status: 500 })

  const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString()

  const { data, error } = await client.from('onboarding_events').select('name').gte('created_at', since)

  if (error) {
    return NextResponse.json({ ok: false, reason: 'read', message: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as CountRow[]
  const counts: Record<string, number> = {}
  for (const row of rows) counts[row.name] = (counts[row.name] ?? 0) + 1

  return NextResponse.json({ ok: true, since, total: rows.length, counts })
}
