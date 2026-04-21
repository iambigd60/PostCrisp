import { NextResponse } from 'next/server'
import { readAccessControl } from '@/lib/platform-settings'

// Force dynamic rendering — without this, Next.js 14 caches the GET response
// at build time, so changes to access_control in the DB never surface until
// a redeploy. We still have the 30s in-process cache in readAccessControl
// for rate-limiting the DB hits.
export const dynamic = 'force-dynamic'

// Public endpoint — used by the signup page to know whether to show the
// invite-code field and whether signups are allowed at all.
// NEVER returns the invite_code value itself.
export async function GET() {
  const settings = await readAccessControl()
  return NextResponse.json({
    signup_mode: settings.signup_mode,
    login_enabled: settings.login_enabled,
    // invite_code is deliberately omitted — client only needs to know the mode
  })
}
