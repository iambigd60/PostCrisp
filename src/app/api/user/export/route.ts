import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [profileRes, generationsRes, savedRes, usageRes] = await Promise.all([
    supabase.from('profiles').select('id, email, full_name, subscription_tier, preferences, daily_generations_used, created_at').eq('id', user.id).single(),
    supabase.from('generations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('saved_content').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('usage_stats').select('*').eq('user_id', user.id).order('date', { ascending: false }),
  ])

  const profile = profileRes.data ?? null

  const exportData = {
    exported_at: new Date().toISOString(),
    profile,
    generations: generationsRes.data ?? [],
    saved_content: savedRes.data ?? [],
    usage_stats: usageRes.data ?? [],
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="postcrisp-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
