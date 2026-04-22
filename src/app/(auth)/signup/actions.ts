'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { readAccessControl, matchesInviteCode } from '@/lib/platform-settings'

export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string
  const inviteCode = (formData.get('invite_code') as string | null)?.trim() ?? ''

  // ─── Access control gate ──────────────────────────────────────────────
  const access = await readAccessControl()

  if (access.signup_mode === 'closed') {
    return { error: 'Signups are currently closed. Please check back later.' }
  }

  if (access.signup_mode === 'invite') {
    if (!inviteCode) {
      return { error: 'An invite code is required to sign up.' }
    }
    if (!matchesInviteCode(inviteCode, access.invite_code)) {
      return { error: 'That invite code is not valid.' }
    }
  }

  // ─── Proceed with signup ──────────────────────────────────────────────
  const supabase = createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  // New users land on /onboarding for the guided setup; existing users
  // (login flow) never hit this path. The wizard itself can be skipped,
  // so this doesn't trap anyone.
  redirect('/onboarding')
}
