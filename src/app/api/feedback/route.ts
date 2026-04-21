import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// POST — submit feedback. Auth required (we attach user_id automatically).
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const message = (body.message as string | undefined)?.trim() ?? ''
  const category = body.category as string | undefined
  const url = (body.url as string | undefined)?.slice(0, 500) ?? null
  const userAgent = (body.user_agent as string | undefined)?.slice(0, 500) ?? null

  if (!message) {
    return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
  }
  if (message.length > 5000) {
    return NextResponse.json({ error: 'Message too long (max 5000 characters).' }, { status: 400 })
  }
  if (category && !['bug', 'feature', 'general'].includes(category)) {
    return NextResponse.json({ error: 'Invalid category.' }, { status: 400 })
  }

  const { error } = await supabase.from('feedback').insert({
    user_id: user.id,
    message,
    category: category ?? null,
    url,
    user_agent: userAgent,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
