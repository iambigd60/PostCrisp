import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { readAccessControl } from '@/lib/platform-settings'
import { isMaintenanceGatedPath, MAINTENANCE_MESSAGE } from '@/lib/maintenance-gate'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // If Supabase env vars aren't set (e.g. viewing /demo without real config),
  // skip auth entirely so public routes still render.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          supabaseResponse.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          supabaseResponse.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Maintenance pause — close signed-in app surfaces to non-admins. The login
  // form enforces this too, but a session can come straight from Supabase Auth
  // or predate the pause. Only reads settings for signed-in requests to gated
  // paths; readAccessControl caches for 30s and fails open on login.
  if (user && isMaintenanceGatedPath(path)) {
    const access = await readAccessControl()
    if (!access.login_enabled) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.role !== 'admin') {
        if (path.startsWith('/api/')) {
          return NextResponse.json({ error: MAINTENANCE_MESSAGE }, { status: 503 })
        }
        // Sign out so /login doesn't bounce them straight back to /dashboard;
        // signOut clears the auth cookies on supabaseResponse, which the
        // redirect must carry.
        await supabase.auth.signOut()
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.search = ''
        const redirect = NextResponse.redirect(url)
        for (const cookie of supabaseResponse.cookies.getAll()) redirect.cookies.set(cookie)
        return redirect
      }
    }
  }

  // Unauthenticated users hitting /dashboard or /admin → /login
  if (!user && (path.startsWith('/dashboard') || path.startsWith('/admin'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && path.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // /admin requires role = 'admin' — non-admin logged-in users go to dashboard
  if (user && path.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
