import { NextResponse } from 'next/server'
import { betaSigningKey, sendBetaNotificationEmail, verifyToken } from '@/lib/beta-signup'

// Uses node:crypto — must run on the Node.js runtime, not edge.
export const runtime = 'nodejs'

// POST — verify the emailed code. On success, forwards the (now email-verified)
// signup to beta@postcrisp.com. Body: { token, code }.
export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const token = typeof body.token === 'string' ? body.token : ''
  const code = typeof body.code === 'string' ? body.code : ''
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

  const notify = await sendBetaNotificationEmail(result.value)
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
