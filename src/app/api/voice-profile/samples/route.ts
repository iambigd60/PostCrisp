import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { ensureVoiceProfile, type VoiceSample } from '@/lib/voice-profile'

export const dynamic = 'force-dynamic'

const MAX_SAMPLE_CHARS = 10_000
const MAX_SAMPLES = 25

// POST — append a new sample to the user's voice profile.
// Body: { content: string, label?: string, platform?: string }
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const content = (body.content as string | undefined)?.trim() ?? ''
  const label = (body.label as string | undefined)?.trim() || null
  const platform = (body.platform as string | undefined)?.trim() || null

  if (!content) {
    return NextResponse.json({ error: 'Sample content is required.' }, { status: 400 })
  }
  if (content.length > MAX_SAMPLE_CHARS) {
    return NextResponse.json(
      { error: `Sample is too long (max ${MAX_SAMPLE_CHARS.toLocaleString()} characters).` },
      { status: 400 }
    )
  }

  const profile = await ensureVoiceProfile(supabase, user.id)
  const existing = Array.isArray(profile.samples) ? profile.samples : []

  if (existing.length >= MAX_SAMPLES) {
    return NextResponse.json(
      { error: `You've hit the sample cap (${MAX_SAMPLES}). Remove an older one to add more.` },
      { status: 400 }
    )
  }

  const sample: VoiceSample = {
    id: crypto.randomUUID(),
    content,
    label,
    platform,
    added_at: new Date().toISOString(),
  }

  const updated = [...existing, sample]

  const { error } = await supabase
    .from('voice_profiles')
    .update({ samples: updated })
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, sample, total_samples: updated.length })
}
