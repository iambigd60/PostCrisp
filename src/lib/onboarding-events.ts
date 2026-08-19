import * as Sentry from '@sentry/nextjs'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  ONBOARDING_EVENT_NAMES,
  SELFTEST_EVENT_NAME,
  isOnboardingEventName,
  type OnboardingEventName,
  type OnboardingWriteName,
} from './onboarding-event-names'

/**
 * Onboarding funnel telemetry.
 *
 * SERVER ONLY — writes with the service-role key. Client stages reach it
 * through POST /api/onboarding/event, which authenticates the caller and
 * validates the name against the union in ./onboarding-event-names. That
 * validation is why an authenticated user cannot fill the table with
 * arbitrary names.
 *
 * Never throws: a telemetry failure must not abort a stage transition or
 * surface an error to someone in the middle of their first session.
 *
 * It does, however, always REPORT. The first cut swallowed every failure into
 * a console.error and returned nothing, which made a dead pipeline and an idle
 * product indistinguishable from the outside — the exact ambiguity that made
 * "is onboarding_events broken?" cost a full session to answer. So the result
 * is now returned to the caller (the route turns it into a 500) and the first
 * occurrence of each failure reason goes to Sentry.
 */

// Re-exported so existing importers of this module keep working unchanged.
export { ONBOARDING_EVENT_NAMES, SELFTEST_EVENT_NAME, isOnboardingEventName }
export type { OnboardingEventName, OnboardingWriteName }

/**
 * Why a write failed, when it did:
 * - `env`    — service-role credentials absent; nothing was attempted.
 * - `write`  — PostgREST resolved with an error (missing relation, lost grant).
 * - `thrown` — the client rejected outright (network, malformed config).
 */
export type OnboardingEventResult = { ok: true } | { ok: false; reason: 'env' | 'write' | 'thrown' }

type EventWriter = {
  from(table: string): { insert(row: unknown): PromiseLike<{ error: { message: string } | null }> }
}

/**
 * Returns null rather than non-null-asserting the env vars, mirroring
 * serviceRoleClient() in ./supabase-admin. The assertion form threw inside the
 * try below, where a missing key was indistinguishable from a failed insert.
 */
function serviceWriter(): EventWriter | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as EventWriter
}

/**
 * One Sentry event per failure reason per instance. A dropped table would
 * otherwise capture on every single event; one report per reason is enough to
 * reveal a dead pipeline, and console.error still records every occurrence.
 */
const reportedReasons = new Set<string>()

function reportOnce(reason: string, message: string) {
  if (reportedReasons.has(reason)) return
  reportedReasons.add(reason)
  Sentry.captureMessage(message)
}

export async function logOnboardingEvent(
  userId: string,
  name: OnboardingWriteName,
  detail: Record<string, unknown> = {},
  writer?: EventWriter,
): Promise<OnboardingEventResult> {
  try {
    const client = writer ?? serviceWriter()

    if (!client) {
      console.error('[onboarding-events] service-role credentials missing — telemetry disabled', {
        userId,
        name,
      })
      reportOnce(
        'env',
        'Onboarding telemetry disabled: Supabase service-role credentials are not configured',
      )
      return { ok: false, reason: 'env' }
    }

    const { error } = await client.from('onboarding_events').insert({ user_id: userId, name, detail })

    if (error) {
      // supabase-js RESOLVES with { error } on a PostgREST failure (missing
      // relation, missing grant, etc.) rather than rejecting — that failure
      // mode never reaches the catch below.
      console.error('[onboarding-events] write returned an error', { userId, name, error })
      reportOnce('write', `Onboarding telemetry write failed: ${error.message}`)
      return { ok: false, reason: 'write' }
    }

    return { ok: true }
  } catch (err) {
    // Covers a thrown/rejected client — e.g. a network error, or a test
    // double that throws synchronously instead of resolving with { error }.
    console.error('[onboarding-events] failed to log event', { userId, name, err })
    reportOnce('thrown', `Onboarding telemetry threw: ${err instanceof Error ? err.message : String(err)}`)
    return { ok: false, reason: 'thrown' }
  }
}
