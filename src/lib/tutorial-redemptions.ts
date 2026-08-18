import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * Records that a user has consumed one of their onboarding free runs.
 *
 * SERVER ONLY — writes with the service-role key, because tutorial_redemptions
 * has RLS enabled with no permissive policy. Never import into a client
 * component.
 *
 * Two rules:
 *  1. Idempotent. UNIQUE(user_id, feature) plus onConflict-ignore, so a retry
 *     after a partial failure cannot double-count or error.
 *  2. Never throws. The user has already received the generation by the time
 *     this runs; failing the response over a ledger write would be worse than
 *     the (bounded, one-per-feature) risk of missing one.
 */

type RedemptionWriter = {
  from(table: string): {
    upsert(row: unknown, options: unknown): PromiseLike<{ error: { message: string } | null }>
  }
}

function serviceWriter(): RedemptionWriter {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  ) as unknown as RedemptionWriter
}

export async function recordTutorialRedemption(
  userId: string,
  feature: string,
  writer?: RedemptionWriter,
): Promise<void> {
  try {
    const client = writer ?? serviceWriter()
    const { error } = await client
      .from('tutorial_redemptions')
      .upsert({ user_id: userId, feature }, { onConflict: 'user_id,feature', ignoreDuplicates: true })
    if (error) {
      // supabase-js RESOLVES with { error } on a PostgREST failure (missing
      // relation, missing grant, etc.) rather than rejecting — that is the
      // realistic "migration not applied yet" failure mode, and it never
      // reaches the catch below. Log it here so a dead write leaves a trace.
      // Still never throws: the user already received the generation, so
      // failing the response over a ledger write would be worse than the
      // bounded, one-per-feature risk of missing a redemption record.
      console.error('[tutorial-redemptions] write returned an error', { userId, feature, error })
    }
  } catch (err) {
    // Covers a thrown/rejected client — e.g. a network error, or a test
    // double that throws synchronously instead of resolving with { error }.
    console.error('[tutorial-redemptions] failed to record redemption', { userId, feature, err })
  }
}
