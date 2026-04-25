/**
 * Server-side guard for the onboarding tutorial credit bypass.
 *
 * When a tutorial step calls a generation API with `tutorialMode: true`,
 * the route must validate that the user is genuinely in the active
 * tutorial flow before honoring the bypass. This prevents a client
 * from spoofing the flag forever.
 *
 * The bypass covers Channel Analysis, Captions, Hashtags, and Viral
 * Ideas — i.e. the four AI-generation steps of the wizard. PostCrisp
 * absorbs ~$0.10 per tester to keep their starter credits intact for
 * genuine post-tutorial use.
 *
 * Security note: tutorial_progress is user-writeable via the
 * /api/user/preferences whitelist, so a determined attacker could
 * sit on `step='captions', completed=false` to keep getting free
 * generations. Acceptable for alpha (20 testers, ~$0.10/user); if
 * abuse shows up we'll move to a server-only used-features counter.
 */

import type { createClient } from '@/utils/supabase/server'

type ServerClient = ReturnType<typeof createClient>

const TUTORIAL_STEPS = new Set(['analyze', 'captions', 'hashtags', 'viral'])

/**
 * Returns true when the user is in an active tutorial run — i.e. they
 * either have no tutorial record yet (first-time onboarding) or their
 * recorded step matches one of the four AI-generation tutorial steps
 * AND the tutorial is not yet marked completed.
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

  // Step must be one of the AI-generation tutorial steps (or empty,
  // meaning user just landed on /onboarding and hasn't transitioned)
  return !tp.step || TUTORIAL_STEPS.has(tp.step)
}
