import type { CreatorProfile } from './creator-profile'

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
