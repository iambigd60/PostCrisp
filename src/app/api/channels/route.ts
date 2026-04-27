import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { loadChannels, isValidPlatform } from '@/lib/channels'

export const dynamic = 'force-dynamic'

const MAX_CHANNELS_PER_USER = 20
const MAX_HANDLE_LEN = 120
const MAX_LABEL_LEN = 80
const MAX_URL_LEN = 500

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const channels = await loadChannels(supabase, user.id)
  return NextResponse.json({ channels })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const platform = (body.platform as string | undefined)?.trim() ?? ''
  const handle = (body.handle as string | undefined)?.trim() ?? ''
  const label = (body.label as string | undefined)?.trim() || null
  const url = (body.url as string | undefined)?.trim() || null

  if (!isValidPlatform(platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
  }
  if (!handle) {
    return NextResponse.json({ error: 'Handle is required' }, { status: 400 })
  }
  if (handle.length > MAX_HANDLE_LEN) {
    return NextResponse.json({ error: `Handle too long (max ${MAX_HANDLE_LEN})` }, { status: 400 })
  }
  if (label && label.length > MAX_LABEL_LEN) {
    return NextResponse.json({ error: `Label too long (max ${MAX_LABEL_LEN})` }, { status: 400 })
  }
  if (url && url.length > MAX_URL_LEN) {
    return NextResponse.json({ error: `URL too long (max ${MAX_URL_LEN})` }, { status: 400 })
  }

  const existing = await loadChannels(supabase, user.id)
  if (existing.length >= MAX_CHANNELS_PER_USER) {
    return NextResponse.json(
      { error: `You've hit the channel cap (${MAX_CHANNELS_PER_USER}). Remove one to add more.` },
      { status: 400 }
    )
  }
  const nextSort = existing.length === 0 ? 0 : Math.max(...existing.map((c) => c.sort_order)) + 1

  const { data, error } = await supabase
    .from('channels')
    .insert({
      user_id: user.id,
      platform,
      handle,
      label,
      url,
      sort_order: nextSort,
    })
    .select('id, user_id, platform, handle, label, url, sort_order, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ channel: data })
}
