/**
 * Server-side guard for the onboarding tutorial credit bypass.
 *
 * When a tutorial step calls a generation API with `tutorialMode: true`,
 * the route must validate two things before honoring the bypass:
 *   1. The user is genuinely in the active tutorial flow
 *   2. They have not already used the bypass for this specific feature
 *
 * Together these turn the tutorial into a one-time-per-feature freebie:
 * each tester gets exactly one free Channel Analysis, one free Captions
 * generation, one free Hashtags lookup, and one free Viral Ideas batch.
 * After that, the feature charges normal credits and respects tier gates.
 *
 * Prior-use detection reads the append-only tutorial_redemptions ledger
 * (see recordTutorialRedemption), NOT the generations table. It used to read
 * generations, but users hold own-row DELETE on generations and the
 * generations detail page exposes a Delete button — so that count reset from
 * ordinary UI, with no console. tutorial_redemptions has RLS enabled with no
 * permissive policy and no client grants at all, so nothing short of
 * service_role can read or write it; that is what makes the per-feature cap
 * real instead of advisory. This gate is server-authoritative: even if a
 * client spoofs tutorial_progress.completed=false to extend the active
 * window, the per-feature lock still fires after the first run.
 */

import type { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

type ServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Returns true when the user is in an active tutorial run — i.e. they
 * either have no tutorial record yet (first-time onboarding) or their
 * tutorial record exists and is not yet marked completed.
 */
export async function isInActiveTutorial(
  supabase: ServerClient,
  userId: string,
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', userId)
    .maybeSingle()

  const prefs = (profile?.preferences ?? {}) as {
    tutorial_progress?: { step?: string; completed?: boolean }
  }
  const tp = prefs.tutorial_progress

  // No record yet — first-time tutorial run is allowed
  if (!tp) return true

  // Already completed — no more free runs
  if (tp.completed) return false

  // Any non-completed record counts as an active tutorial. We deliberately do
  // NOT gate on tp.step: goToStep fire-and-forgets its preferences write, so
  // the persisted step lags the UI, and gating on it raced that write — denying
  // the bypass and (before the charge-policy fix) silently billing the user.
  //
  // Step is advisory only. Spoofing it buys nothing — hasUsedTutorialBypass
  // enforces a per-feature lifetime lock, so total free exposure is unchanged
  // at one run per feature.
  return true
}

/**
 * Service-role client for reading the append-only redemption ledger. See the
 * doc comment on hasUsedTutorialBypass below for why this cannot be built
 * from the caller's session client.
 */
function redemptionReader() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

/**
 * Returns true when the bypass has already been consumed for this user
 * + feature pair. We detect this by querying the append-only
 * tutorial_redemptions ledger for a prior row. Server-authoritative — the
 * user can't reset this from the client, because tutorial_redemptions grants
 * no client access at all (RLS on, no policy, no anon/authenticated grants).
 *
 * That "no client grants" fact is also why this function cannot use the
 * `supabase` argument for the read, even though it still accepts it to keep
 * a stable signature for its caller (shouldGrantTutorialBypass). `supabase`
 * is the caller's session client — anon key plus the user's cookies — and an
 * anon/authenticated role reading a table with no permissive policy gets
 * `count: null`, not a permission error. `(count ?? 0) > 0` on that would
 * silently evaluate to false forever, granting the "free run" bypass on
 * every request, indefinitely. So this reads through its own service-role
 * client instead — the same pattern recordTutorialRedemption uses for the
 * write side of this same table.
 *
 * `feature` must match the value the route writes into generations.feature
 * (e.g. 'channel_analysis', 'captions', 'hashtags', 'viral_ideas').
 */
export async function hasUsedTutorialBypass(
  supabase: ServerClient,
  userId: string,
  feature: string,
): Promise<boolean> {
  void supabase // deliberately unused for the read — see doc comment above

  const { count, error } = await redemptionReader()
    .from('tutorial_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('feature', feature)

  if (error) {
    // FAIL CLOSED. `count` is also null on an error response (e.g. the
    // migration that creates tutorial_redemptions hasn't been applied to
    // this environment yet — "relation does not exist"), which is
    // indistinguishable from "zero rows" if we only look at count. Treating
    // that as "not used" would silently grant the tutorial freebie to every
    // request, forever, with no operational signal — the exact fail-open
    // hazard this ledger exists to close, just reached through the error
    // channel instead of a client-grants gap. So an unreadable ledger is
    // treated as "already used" instead: in a broken-migration environment
    // nobody gets a tutorial freebie and the wizard shows "already used" —
    // wrong, but bounded to onboarding UX, loud via the log below, and cheap
    // to notice and fix. The alternative is silent and costs real credits.
    // Do NOT soften this to `return false` — that reintroduces the hazard.
    console.error('[tutorial-bypass] tutorial_redemptions read failed — denying the bypass', { userId, feature, error })
    return true
  }

  return (count ?? 0) > 0
}

/**
 * Combined gate: grants tutorial bypass only when the user is in an
 * active tutorial AND has not already burned the bypass for this feature.
 * Routes should call this once they know which feature they represent.
 */
export async function shouldGrantTutorialBypass(
  supabase: ServerClient,
  userId: string,
  feature: string,
): Promise<boolean> {
  const [active, used] = await Promise.all([
    isInActiveTutorial(supabase, userId),
    hasUsedTutorialBypass(supabase, userId, feature),
  ])
  return active && !used
}
