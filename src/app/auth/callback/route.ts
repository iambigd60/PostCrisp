import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { chooseDestination } from '@/lib/post-auth-destination'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Decide onboarding-vs-dashboard here rather than defaulting to
      // /dashboard. Google OAuth passes no `next` from either call site, and
      // the email-confirmation link doesn't either, so the old default skipped
      // onboarding for every user arriving by those routes.
      let tutorialCompleted = false
      let onboardedAt: string | null = null

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('preferences')
          .eq('id', user.id)
          .maybeSingle()
        if (profileError) {
          // Don't fail the sign-in over this — worst case a real read
          // failure silently routes a returning user into the wizard. But
          // that should never happen quietly: log it so a systemic outage
          // shows up instead of looking like a wave of confused new users.
          console.error('[auth callback] failed to read profile preferences', profileError)
        }
        const prefs = (profile?.preferences ?? {}) as {
          tutorial_progress?: { completed?: boolean }
          onboarded_at?: string | null
        }
        tutorialCompleted = prefs.tutorial_progress?.completed === true
        onboardedAt = prefs.onboarded_at ?? null
      }

      const destination = chooseDestination({ explicitNext: next, tutorialCompleted, onboardedAt })
      return NextResponse.redirect(`${origin}${destination}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`)
}
