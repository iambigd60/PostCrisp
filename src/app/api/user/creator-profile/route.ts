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
    const { error } = await supabase
      .from('creator_profiles')
      .update({ ...body.profilePatch, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
