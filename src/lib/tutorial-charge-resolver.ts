import { NextResponse } from 'next/server'
import { decideTutorialCharge, TUTORIAL_RUN_SPENT_CODE } from './tutorial-charge-policy'
import { shouldGrantTutorialBypass } from './tutorial-bypass'

/**
 * I/O wrapper around `decideTutorialCharge` — the single place that talks to
 * Supabase to figure out whether an AI-generation request should be billed
 * as a tutorial freebie, refused as an already-spent freebie, or charged
 * normally.
 *
 * This used to be ~15 lines duplicated near-verbatim across all four AI
 * routes (viral-ideas, generate, hashtags, channel-analysis), differing only
 * in the feature key and refusal message. Centralizing it here means a fix
 * to this policy (e.g. the session-expiry regression this file was
 * introduced to fix) lands once instead of needing the identical edit in
 * four files.
 */

export type TutorialChargeResolution =
  | { ok: false; response: NextResponse }
  | { ok: true; bypassCredits: boolean; bypassFeatureGate: boolean }

/**
 * Resolves how a route should bill this request.
 *
 * @param feature - The value the route writes into `generations.feature`
 *   and passes to `shouldGrantTutorialBypass` (e.g. `'channel_analysis'`,
 *   `'captions'`, `'hashtags'`, `'viral_ideas'`). This is intentionally a
 *   different vocabulary from the `checkAuthAndUsage` task key (e.g.
 *   `'channel-analysis'` with a hyphen) — callers pass that separately to
 *   `checkAuthAndUsage` themselves; this function never sees it.
 * @param tutorialModeRequested - The client-supplied request signal. This is
 *   NEVER sufficient on its own to grant a bypass — `bypassGranted` is
 *   always resolved server-side below, from `shouldGrantTutorialBypass`.
 * @param refusalMessage - The route-specific human-readable message returned
 *   in the 409 body when the tutorial freebie for this feature was already
 *   spent.
 */
export async function resolveTutorialCharge(
  feature: string,
  tutorialModeRequested: boolean,
  refusalMessage: string,
): Promise<TutorialChargeResolution> {
  let userPresent = false
  let bypassGranted = false

  if (tutorialModeRequested) {
    const supabase = await (await import('@/utils/supabase/server')).createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userPresent = !!user
    // bypassGranted is server-authoritative: it only ever comes from
    // shouldGrantTutorialBypass, never from the client's tutorialMode flag.
    if (user) bypassGranted = await shouldGrantTutorialBypass(supabase, user.id, feature)
  }

  const decision = decideTutorialCharge({ tutorialModeRequested, userPresent, bypassGranted })

  // A spent tutorial run must NEVER fall through to a silent charge. The client
  // shows an explicit "generate anyway for N credits?" prompt and re-requests
  // without tutorialMode if the user agrees.
  if (decision === 'refuse') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: refusalMessage, code: TUTORIAL_RUN_SPENT_CODE },
        { status: 409 },
      ),
    }
  }

  return {
    ok: true,
    bypassCredits: decision === 'bypass',
    bypassFeatureGate: decision === 'bypass',
  }
}
