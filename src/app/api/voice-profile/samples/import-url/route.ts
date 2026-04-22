import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { importFromUrl } from '@/lib/voice-url-importer'

export const dynamic = 'force-dynamic'

// POST — given a URL (currently YouTube only), fetch the content and return
// a pre-filled sample the UI can show to the user for review before saving.
// We deliberately don't auto-save — we want the user to see the extracted
// content and optionally edit it before committing.
// Body: { url: string }
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const url = typeof body?.url === 'string' ? body.url : ''

  const result = await importFromUrl(url)

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, suggestion: result.suggestion, platform: result.platform, debug: result.debug },
      { status: 400 }
    )
  }

  return NextResponse.json({ ok: true, sample: result.sample, debug: result.debug })
}
