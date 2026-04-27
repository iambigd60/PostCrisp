'use server'

import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

export async function sendPasswordReset(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string

  // Derive origin so the recovery email link lands on this deployment's
  // /auth/callback, not a stale/missing NEXT_PUBLIC_SITE_URL.
  const h = await headers()
  const host = h.get('host')
  const proto = h.get('x-forwarded-proto') ?? (host?.includes('localhost') ? 'http' : 'https')
  const origin = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL ?? '')

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/reset-password`,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
