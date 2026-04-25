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
 * Prior-use detection reads the generations table — every tutorial run
 * is recorded with input_data.tutorialMode = true, so a single existence
 * query is enough. This gate is server-authoritative: even if a client
 * spoofs tutorial_progress.completed=false to extend the active window,
 * the per-feature lock still fires after the first run.
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

/**
 * Returns true when the bypass has already been consumed for this user
 * + feature pair. We detect this by querying the generations table for
 * any past row where input_data.tutorialMode === true. Server-authoritative
 * — the user can't reset this from the client.
 *
 * `feature` must match the value the route writes into generations.feature
 * (e.g. 'channel_analysis', 'captions', 'hashtags', 'viral_ideas').
 */
export async function hasUsedTutorialBypass(
  supabase: ServerClient,
  userId: string,
  feature: string,
): Promise<boolean> {
  const { count } = await supabase
    .from('generations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('feature', feature)
    .eq('input_data->>tutorialMode', 'true')

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
