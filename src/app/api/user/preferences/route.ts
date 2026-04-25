import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Whitelist of keys that clients can write under `preferences`. Any other keys
// are ignored to prevent arbitrary writes.
const ALLOWED_KEYS = new Set([
  'default_platform',
  'default_tone',
  'default_audience',
  'email_notifications',
  'usage_reminders',
  'channels',
  'onboarded_at',              // ISO timestamp set when user finishes /onboarding
  'getting_started_dismissed', // boolean set when user dismisses the dashboard checklist
  'alpha_nda',                 // structured record: {accepted_at, full_name, version, user_agent?}
  'tutorial_progress',         // structured record: {step, completed, analysis_id, saved_caption_topic}
])

export async function PUT(request: Request) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // Load current preferences so we merge instead of overwrite
  const { data: profile } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', user.id)
    .maybeSingle()

  const current: Record<string, unknown> = (profile?.preferences as Record<string, unknown>) ?? {}
  const next: Record<string, unknown> = { ...current }

  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_KEYS.has(key)) continue
    if (value === undefined) continue
    next[key] = value
  }

  const { error } = await supabase
    .from('profiles')
    .update({ preferences: next })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'Preferences saved', preferences: next })
}
