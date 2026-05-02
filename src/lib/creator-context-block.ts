import type { SupabaseClient } from '@supabase/supabase-js'
import { getCreatorProfile, type CreatorProfile } from './creator-profile'

export type ProfileField =
  | 'content_pillars'
  | 'voice_signature'
  | 'audience_persona'
  | 'growth_stage'
  | 'monetization_position'
  | 'format_strengths'
  | 'differentiators'
  | 'top_blockers'

export function formatCreatorContextBlock(
  profile: CreatorProfile | null,
  fields: ProfileField[],
): string | null {
  if (!profile) return null
  const lines: string[] = []
  for (const f of fields) {
    switch (f) {
      case 'content_pillars':
        lines.push(`- Content pillars: ${profile.content_pillars.join(', ')}`)
        break
      case 'voice_signature':
        lines.push(`- Voice: ${profile.voice_signature.adjectives.join(', ')} — phrases like "${profile.voice_signature.examplePhrasing}"`)
        break
      case 'audience_persona':
        lines.push(`- Audience: ${profile.audience_persona.description} (sophistication: ${profile.audience_persona.sophistication})`)
        break
      case 'growth_stage':
        lines.push(`- Growth stage: ${profile.growth_stage}`)
        break
      case 'monetization_position':
        lines.push(`- Monetization: ${profile.monetization_position.stage} (streams: ${profile.monetization_position.primaryStreams.join(', ') || 'none yet'})`)
        break
      case 'format_strengths':
        lines.push(`- Format strengths: ${profile.format_strengths.join(', ')}`)
        break
      case 'differentiators':
        lines.push(`- Differentiators: ${profile.differentiators.join(' · ')}`)
        break
      case 'top_blockers':
        lines.push(`- Top blockers: ${profile.top_blockers.join(' · ')}`)
        break
    }
  }
  return [
    `## Creator context (the user's saved Foundation Analysis profile):`,
    ...lines,
    ``,
    `Use this context to ground your output in the user's voice and audience. Do not generic-ify.`,
  ].join('\n')
}

/**
 * One-call helper for downstream tools (Captions, Viral Ideas, Bio Optimizer in
 * Phase 2). Reads the user's `use_foundation_in_generations` toggle, fetches the
 * Creator Profile if enabled, and formats the prompt block. Returns null when
 * the toggle is off, no profile exists, or any step fails — callers can splice
 * with `[ctx, body].filter(Boolean).join('\n\n')` and not crash.
 */
export async function loadCreatorContext(
  supabase: SupabaseClient,
  userId: string,
  fields: ProfileField[],
): Promise<string | null> {
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('use_foundation_in_generations')
    .eq('id', userId)
    .maybeSingle()
  const useFoundation = profileRow?.use_foundation_in_generations !== false
  if (!useFoundation) return null
  const profile = await getCreatorProfile(supabase, userId)
  return formatCreatorContextBlock(profile, fields)
}
