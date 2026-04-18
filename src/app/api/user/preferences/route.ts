import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function PUT(request: Request) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { default_platform, default_tone, default_audience, email_notifications, usage_reminders } = body

  const preferences: Record<string, unknown> = {}
  if (default_platform !== undefined) preferences.default_platform = default_platform
  if (default_tone !== undefined) preferences.default_tone = default_tone
  if (default_audience !== undefined) preferences.default_audience = default_audience
  if (email_notifications !== undefined) preferences.email_notifications = email_notifications
  if (usage_reminders !== undefined) preferences.usage_reminders = usage_reminders

  const { error } = await supabase
    .from('profiles')
    .update({ preferences })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'Preferences saved' })
}
