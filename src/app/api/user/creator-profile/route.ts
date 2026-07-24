import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json() as {
    profilePatch?: Partial<{
      content_pillars: string[]
      voice_signature: { adjectives: string[]; examplePhrasing: string }
      audience_persona: { description: string; sophistication: 'beginner' | 'intermediate' | 'advanced' }
      growth_stage: 'pre-traction' | 'early-traction' | 'scaling' | 'established'
      monetization_position: { stage: string; primaryStreams: string[] }
      format_strengths: string[]
      differentiators: string[]
      top_blockers: string[]
    }>
    useFoundationInGenerations?: boolean
  }

  if (body.profilePatch) {
    // Whitelist the editable columns — never spread the raw client object into
    // the update (mass-assignment: it could set user_id/source_analysis_id/
    // created_at or any future privileged column).
    const ALLOWED_FIELDS = [
      'content_pillars', 'voice_signature', 'audience_persona', 'growth_stage',
      'monetization_position', 'format_strengths', 'differentiators', 'top_blockers',
    ] as const
    const raw = body.profilePatch as Record<string, unknown>
    const patch: Record<string, unknown> = {}
    for (const key of ALLOWED_FIELDS) {
      if (key in raw) patch[key] = raw[key]
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from('creator_profiles')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  if (typeof body.useFoundationInGenerations === 'boolean') {
    const { error } = await supabase
      .from('profiles')
      .update({ use_foundation_in_generations: body.useFoundationInGenerations })
      .eq('id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
