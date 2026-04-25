import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { checkFeedbackRateLimit } from '@/lib/rate-limit'

// POST — submit feedback. Auth required (we attach user_id automatically).
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit: 10/hour per user. Real testers send feedback occasionally;
  // a spam loop hits the wall fast.
  const rl = await checkFeedbackRateLimit(user.id)
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: 'Too much feedback in a short window. Try again in a bit.',
        code: 'RATE_LIMITED',
        retryAfterSec: rl.retryAfterSec,
      },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
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

  // ─── Notify admin via Resend — fire and log, but never block/fail the response
  // on an email error. Requires RESEND_API_KEY in env; if missing, skip silently.
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (apiKey) {
      const adminEmail = process.env.FEEDBACK_NOTIFICATION_EMAIL ?? 'captain@postcrisp.com'
      const origin = request.headers.get('origin') ||
        (request.headers.get('host') ? `https://${request.headers.get('host')}` : '')
      const catLabel = category ? category.toUpperCase() : 'GENERAL'
      const subject = `[PostCrisp ${catLabel}] feedback from ${user.email}`
      const text =
        `${message}\n\n` +
        `— From: ${user.email}\n` +
        `— Category: ${category ?? 'general'}\n` +
        `— Page: ${url ?? 'unknown'}\n` +
        `— User agent: ${userAgent ?? 'unknown'}\n\n` +
        `Triage in admin: ${origin}/admin/feedback`

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'PostCrisp Feedback <noreply@postcrisp.com>',
          to: [adminEmail],
          reply_to: user.email ?? undefined,
          subject,
          text,
        }),
      })
    }
  } catch (notifyErr) {
    console.error('feedback notification failed (non-fatal):', notifyErr)
  }

  return NextResponse.json({ ok: true })
}
