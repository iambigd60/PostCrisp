import { NextResponse } from 'next/server'
import { betaSigningKey, sendBetaNotificationEmail, verifyToken } from '@/lib/beta-signup'

// Uses node:crypto — must run on the Node.js runtime, not edge.
export const runtime = 'nodejs'

// POST — verify the emailed code. On success, forwards the (now email-verified)
// signup to beta@postcrisp.com. Body: { token, code }.
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
    return NextResponse.json({ error: 'Missing verification details.' }, { status: 400 })
  }
  const fields = body as Record<string, unknown>

  const token = typeof fields.token === 'string' ? fields.token : ''
  const code = typeof fields.code === 'string' ? fields.code : ''
  if (!token || !code) {
    return NextResponse.json({ error: 'Missing verification details.' }, { status: 400 })
  }

  const key = betaSigningKey()
  if (!key) {
    return NextResponse.json(
      { error: 'Beta signup is temporarily unavailable. Please try again later.' },
      { status: 503 },
    )
  }

  const result = verifyToken(key, token, code)
  if (!result.ok) {
    const status = result.code === 'expired' ? 410 : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  // Idempotency key from the token signature: a duplicate verify (double-click
  // or network retry) reuses the same key + payload, so beta@ isn't emailed twice.
  const idempotencyKey = `beta-signup/${token.split('.')[1] ?? ''}`.slice(0, 256)
  const notify = await sendBetaNotificationEmail(result.value, idempotencyKey)
  if (!notify.ok) {
    console.error('[beta-signup] notification email failed:', notify.error)
    return NextResponse.json(
      {
        error:
          'Your email was verified, but we hit a snag notifying the team. Please email beta@postcrisp.com directly.',
      },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true })
}
