import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import {
  ALPHA_AGREEMENT_VERSION,
  type AlphaNdaAcceptance,
} from '@/lib/alpha-agreement'

/**
 * Dedicated server-only endpoint for recording Alpha Tester Agreement
 * acceptance. Replaces the prior pattern of writing alpha_nda through
 * /api/user/preferences (which is whitelisted for arbitrary client writes
 * and made the legal audit trail forgeable — security-review M-tier).
 *
 * What the server controls (not the client):
 *   - accepted_at  → server clock, not client clock
 *   - version      → canonical ALPHA_AGREEMENT_VERSION constant
 *   - user_agent   → captured from the request header server-side
 *
 * What the client supplies:
 *   - full_name    → the typed signature (validated, trimmed, length-bound)
 *
 * Idempotent: re-submitting refreshes the record (e.g. version bump).
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const fullNameRaw = typeof body?.full_name === 'string' ? body.full_name : ''
  const fullName = fullNameRaw.trim().slice(0, 200)

  if (fullName.length < 2) {
    return NextResponse.json(
      { error: 'Please type your full legal name to sign.' },
      { status: 400 },
    )
  }

  // ESIGN-Act-aligned signature: also require the client to confirm they're
  // typing the name as a signature. Client must opt-in explicitly.
  if (body?.agreed !== true) {
    return NextResponse.json(
      { error: 'You must check the agreement box to accept.' },
      { status: 400 },
    )
  }

  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null

  const acceptance: AlphaNdaAcceptance = {
    accepted_at: new Date().toISOString(),
    full_name: fullName,
    version: ALPHA_AGREEMENT_VERSION,
    user_agent: userAgent,
  }

  // Merge into preferences without disturbing other keys
  const { data: profile } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', user.id)
    .maybeSingle()

  const current: Record<string, unknown> = (profile?.preferences as Record<string, unknown>) ?? {}
  const next = { ...current, alpha_nda: acceptance }

  const { error } = await supabase
    .from('profiles')
    .update({ preferences: next })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'Acceptance recorded', alpha_nda: acceptance })
}
