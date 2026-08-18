import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { isOnboardingEventName, logOnboardingEvent } from '@/lib/onboarding-events'

/**
 * The client stages' only way into onboarding_events.
 *
 * Three things bound what an authenticated caller can do here: the name must be
 * a member of the fixed union, the user_id comes from the session rather than
 * the body, and detail is size-capped. Worst case is a bounded volume of
 * well-formed rows from a real account — acceptable for a table only admins read.
 */

const MAX_DETAIL_BYTES = 2_000

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { name, detail } = (body ?? {}) as { name?: unknown; detail?: unknown }

  if (!isOnboardingEventName(name)) {
    return NextResponse.json({ error: 'Unknown event name' }, { status: 400 })
  }

  const safeDetail =
    detail && typeof detail === 'object' && !Array.isArray(detail)
      ? (detail as Record<string, unknown>)
      : {}

  if (JSON.stringify(safeDetail).length > MAX_DETAIL_BYTES) {
    return NextResponse.json({ error: 'Detail too large' }, { status: 400 })
  }

  // user.id, never a client-supplied id.
  await logOnboardingEvent(user.id, name, safeDetail)
  return NextResponse.json({ ok: true })
}
