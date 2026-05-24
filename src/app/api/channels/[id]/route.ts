import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { isValidPlatform } from '@/lib/channels'
import { isKnownSocialPlatform, isSocialPlatformUrl, socialPlatformLabel } from '@/lib/social-url'

export const dynamic = 'force-dynamic'

const MAX_HANDLE_LEN = 120
const MAX_LABEL_LEN = 80
const MAX_URL_LEN = 500

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const updates: Record<string, string | number | null> = {}

  if ('platform' in body) {
    const p = (body.platform as string | undefined)?.trim() ?? ''
    if (!isValidPlatform(p)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
    }
    updates.platform = p
  }
  if ('handle' in body) {
    const h = (body.handle as string | undefined)?.trim() ?? ''
    if (!h) return NextResponse.json({ error: 'Handle cannot be empty' }, { status: 400 })
    if (h.length > MAX_HANDLE_LEN) return NextResponse.json({ error: 'Handle too long' }, { status: 400 })
    updates.handle = h
  }
  if ('label' in body) {
    const l = (body.label as string | null | undefined)
    const trimmed = typeof l === 'string' ? l.trim() : ''
    if (trimmed.length > MAX_LABEL_LEN) return NextResponse.json({ error: 'Label too long' }, { status: 400 })
    updates.label = trimmed || null
  }
  if ('url' in body) {
    const u = (body.url as string | null | undefined)
    const trimmed = typeof u === 'string' ? u.trim() : ''
    if (trimmed.length > MAX_URL_LEN) return NextResponse.json({ error: 'URL too long' }, { status: 400 })
    updates.url = trimmed || null
  }
  if ('sort_order' in body && typeof body.sort_order === 'number') {
    updates.sort_order = body.sort_order
  }

  if (updates.url) {
    let platform = typeof updates.platform === 'string' ? updates.platform : null
    if (!platform) {
      const { data: current } = await supabase
        .from('channels')
        .select('platform')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()
      platform = typeof current?.platform === 'string' ? current.platform : null
    }
    if (isKnownSocialPlatform(platform) && typeof updates.url === 'string' && !isSocialPlatformUrl(platform, updates.url)) {
      return NextResponse.json({ error: `URL must match the selected ${socialPlatformLabel(platform)}.` }, { status: 400 })
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, action: 'no-change' })
  }

  const { error } = await supabase
    .from('channels')
    .update(updates)
    .eq("id", id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('channels')
    .delete()
    .eq("id", id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
