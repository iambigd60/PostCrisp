'use server'

import { createClient } from '@/utils/supabase/server'

export async function sendPasswordReset(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string

  // Use the fixed, env-configured canonical origin for the recovery link.
  // NEVER derive it from the request Host header — that is attacker-controllable
  // and enables password-reset-link poisoning (HIGH-2). In local dev this is
  // http://localhost:3000 (see .env.local.example).
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '')
  if (!appUrl) {
    return { error: 'Password reset is temporarily unavailable. Please try again later.' }
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/reset-password`,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
