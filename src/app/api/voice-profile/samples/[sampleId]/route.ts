import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { loadVoiceProfile, type VoiceSample } from '@/lib/voice-profile'

export const dynamic = 'force-dynamic'

// DELETE — remove a single sample from the user's profile.
export async function DELETE(_request: Request, { params }: { params: Promise<{ sampleId: string }> }) {
  const { sampleId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await loadVoiceProfile(supabase, user.id)
  if (!profile) {
    return NextResponse.json({ error: 'Voice profile not found' }, { status: 404 })
  }

  const existing = Array.isArray(profile.samples) ? profile.samples : []
  const filtered = existing.filter((s: VoiceSample) => s.id !== sampleId)

  if (filtered.length === existing.length) {
    return NextResponse.json({ error: 'Sample not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('voice_profiles')
    .update({ samples: filtered })
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, remaining_samples: filtered.length })
}
