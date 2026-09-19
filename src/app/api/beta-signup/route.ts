import { NextResponse } from 'next/server'
import {
  betaSigningKey,
  generateCode,
  makeToken,
  sendVerificationCodeEmail,
  validateSignup,
} from '@/lib/beta-signup'

// Uses node:crypto — must run on the Node.js runtime, not edge.
export const runtime = 'nodejs'

// POST — start beta signup. Validates {name, email, channel}, emails a 6-digit
// verification code to the visitor, and returns an opaque signed token the
// client sends back to /api/beta-signup/verify along with the code.
// Edge per-IP rate limiting is handled by Vercel WAF — see docs/rate-limiting.md.
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  // Reject null / arrays / non-objects before reading fields (a JSON `null`
  // parses fine and would throw on property access → an unhandled 500).
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const fields = body as Record<string, unknown>

  // Honeypot: this hidden field is invisible to humans. Bots that fill it get a
  // fake success and no email is sent.
  if (typeof fields.company === 'string' && fields.company.trim() !== '') {
    return NextResponse.json({ ok: true, token: '' })
  }

  const validated = validateSignup({
    name: typeof fields.name === 'string' ? fields.name : undefined,
    email: typeof fields.email === 'string' ? fields.email : undefined,
    channel: typeof fields.channel === 'string' ? fields.channel : undefined,
  })
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  const key = betaSigningKey()
  if (!key) {
    console.error('[beta-signup] no signing key (BETA_SIGNUP_SECRET / SUPABASE_SERVICE_ROLE_KEY unset)')
    return NextResponse.json(
      { error: 'Beta signup is temporarily unavailable. Please try again later.' },
      { status: 503 },
    )
  }

  const code = generateCode()
  const emailResult = await sendVerificationCodeEmail(validated.value.email, code)
  if (!emailResult.ok) {
    console.error('[beta-signup] verification email failed:', emailResult.error)
    return NextResponse.json(
      { error: 'We couldn’t send the verification email. Please check the address and try again.' },
      { status: 502 },
    )
  }

  const token = makeToken(key, validated.value, code)
  return NextResponse.json({ ok: true, token })
}
