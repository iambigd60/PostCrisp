import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { generateInviteCodeBatch, normalizeCode, type InviteCode } from '@/lib/invite-codes'

export interface InviteCodeListResponse {
  items: InviteCode[]
  stats: { total: number; used: number; available: number }
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { data, error } = await auth.supabaseAdmin
    .from('invite_codes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const items = (data ?? []) as InviteCode[]
  const used = items.filter((i) => i.used_at !== null).length

  return NextResponse.json<InviteCodeListResponse>({
    items,
    stats: {
      total: items.length,
      used,
      available: items.length - used,
    },
  })
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({})) as { count?: number; notes?: string }
  const count = Number(body.count ?? 1)
  const notes = body.notes?.trim() || null

  if (!Number.isInteger(count) || count < 1 || count > 100) {
    return NextResponse.json({ error: 'count must be an integer between 1 and 100' }, { status: 400 })
  }

  try {
    const items = await generateInviteCodeBatch(auth.supabaseAdmin, count, auth.userId, notes)
    return NextResponse.json({ ok: true, items })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const codeParam = searchParams.get('code')
  if (!codeParam) {
    return NextResponse.json({ error: 'code query param is required' }, { status: 400 })
  }

  const code = normalizeCode(codeParam)

  // Only allow deleting unused codes — used codes are part of the audit
  // trail and shouldn't disappear.
  const { data, error } = await auth.supabaseAdmin
    .from('invite_codes')
    .delete()
    .eq('code', code)
    .is('used_at', null)
    .select('code')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Code not found or already used' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
