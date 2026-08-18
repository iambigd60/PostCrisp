import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * Onboarding funnel telemetry.
 *
 * SERVER ONLY — writes with the service-role key. Client stages reach it
 * through POST /api/onboarding/event, which authenticates the caller and
 * validates the name against the union below. That validation is why an
 * authenticated user cannot fill the table with arbitrary names.
 *
 * Never throws: a telemetry failure must not abort a stage transition or
 * surface an error to someone in the middle of their first session.
 */

export const ONBOARDING_EVENT_NAMES = [
  'first_session_started',
  'stage_viewed',
  'pack_requested',
  'pack_rehydrated',
  'artifact_returned',
  'artifact_failed',
  'artifact_saved',
  'first_session_snoozed',
  'first_session_resumed',
  'first_session_completed',
] as const

export type OnboardingEventName = (typeof ONBOARDING_EVENT_NAMES)[number]

export function isOnboardingEventName(value: unknown): value is OnboardingEventName {
  return typeof value === 'string' && (ONBOARDING_EVENT_NAMES as readonly string[]).includes(value)
}

type EventWriter = {
  from(table: string): { insert(row: unknown): PromiseLike<{ error: { message: string } | null }> }
}

function serviceWriter(): EventWriter {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  ) as unknown as EventWriter
}

export async function logOnboardingEvent(
  userId: string,
  name: OnboardingEventName,
  detail: Record<string, unknown> = {},
  writer?: EventWriter,
): Promise<void> {
  try {
    const client = writer ?? serviceWriter()
    const { error } = await client.from('onboarding_events').insert({ user_id: userId, name, detail })
    if (error) {
      // supabase-js RESOLVES with { error } on a PostgREST failure (missing
      // relation, missing grant, etc.) rather than rejecting — that failure
      // mode never reaches the catch below. Log it here so a dead write
      // leaves a trace. Still never throws: telemetry is genuinely
      // inconsequential here, so a failed write is logged and dropped, never
      // surfaced to someone in the middle of their first session.
      console.error('[onboarding-events] write returned an error', { userId, name, error })
    }
  } catch (err) {
    // Covers a thrown/rejected client — e.g. a network error, or a test
    // double that throws synchronously instead of resolving with { error }.
    console.error('[onboarding-events] failed to log event', { userId, name, err })
  }
}
