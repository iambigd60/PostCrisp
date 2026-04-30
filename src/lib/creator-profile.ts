import type { SupabaseClient } from '@supabase/supabase-js'

export interface CreatorProfile {
  user_id: string
  content_pillars: string[]
  voice_signature: { adjectives: string[]; examplePhrasing: string }
  audience_persona: { description: string; sophistication: 'beginner' | 'intermediate' | 'advanced' }
  growth_stage: 'pre-traction' | 'early-traction' | 'scaling' | 'established'
  monetization_position: { stage: string; primaryStreams: string[] }
  format_strengths: string[]
  differentiators: string[]
  top_blockers: string[]
  source_analysis_id: string | null
  created_at: string
  updated_at: string
}

export async function getCreatorProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<CreatorProfile | null> {
  const { data, error } = await supabase
    .from('creator_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.error('[creator-profile] getCreatorProfile failed:', error)
    return null
  }
  return (data as CreatorProfile) ?? null
}

export interface CreatorProfileInput {
  content_pillars: string[]
  voice_signature: { adjectives: string[]; examplePhrasing: string }
  audience_persona: { description: string; sophistication: 'beginner' | 'intermediate' | 'advanced' }
  growth_stage: 'pre-traction' | 'early-traction' | 'scaling' | 'established'
  monetization_position: { stage: string; primaryStreams: string[] }
  format_strengths: string[]
  differentiators: string[]
  top_blockers: string[]
}

export async function upsertCreatorProfile(
  supabase: SupabaseClient,
  userId: string,
  profile: CreatorProfileInput,
  sourceAnalysisId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from('creator_profiles').upsert({
    user_id: userId,
    ...profile,
    source_analysis_id: sourceAnalysisId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) {
    console.error('[creator-profile] upsertCreatorProfile failed:', error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
