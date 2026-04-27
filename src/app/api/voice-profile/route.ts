import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { ensureVoiceProfile } from '@/lib/voice-profile'
import type { VoiceTraits } from '@/lib/voice-profile'

export const dynamic = 'force-dynamic'

// GET — return the current user's voice profile (creates empty row on first visit)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const profile = await ensureVoiceProfile(supabase, user.id)
    return NextResponse.json({ profile })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load voice profile'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PATCH — manual override of traits (admin/user adjustments like
// "I'm more sarcastic than this"). Body: { traits: VoiceTraits }
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const traits = body.traits as VoiceTraits | undefined
  if (!traits || typeof traits !== 'object') {
    return NextResponse.json({ error: 'traits object is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('voice_profiles')
    .update({ traits })
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// DELETE — wipe the whole profile (samples + traits). Useful if the user
// wants a fresh start.
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('voice_profiles')
    .delete()
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
