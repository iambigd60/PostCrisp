import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Honor `next` so password recovery flows land on /auth/reset-password
      // instead of /dashboard. Only allow relative paths to avoid open-redirect
      // vulnerabilities — anything starting with // or containing :// is refused.
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') && !next.includes('://') ? next : '/dashboard'
      return NextResponse.redirect(`${origin}${safeNext}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`)
}
