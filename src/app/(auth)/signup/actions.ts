'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { readAccessControl, matchesInviteCode } from '@/lib/platform-settings'
import { isInviteCodeAvailable, claimInviteCode, normalizeCode } from '@/lib/invite-codes'

function serviceRoleClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string
  const rawInvite = (formData.get('invite_code') as string | null)?.trim() ?? ''
  const inviteCode = normalizeCode(rawInvite)

  // ─── Access control gate ──────────────────────────────────────────────
  const access = await readAccessControl()

  if (access.signup_mode === 'closed') {
    return { error: 'Signups are currently closed. Please check back later.' }
  }

  let admin: ReturnType<typeof serviceRoleClient> | null = null

  if (access.signup_mode === 'invite') {
    if (!inviteCode) {
      return { error: 'An invite code is required to sign up.' }
    }

    admin = serviceRoleClient()

    // Single-use codes (invite_codes table) take precedence. Fall back to
    // the legacy shared code from access_control.invite_code so any pre-
    // existing testers still get in while we migrate.
    const singleUseAvailable = await isInviteCodeAvailable(admin, inviteCode)
    const sharedMatches = matchesInviteCode(inviteCode, access.invite_code)

    if (!singleUseAvailable && !sharedMatches) {
      return { error: 'That invite code is not valid or has already been used.' }
    }
  }

  // ─── Proceed with signup ──────────────────────────────────────────────
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  })

  if (error) {
    return { error: error.message }
  }

  // ─── Claim the single-use code (post-signup, atomic) ─────────────────
  // Skip if the user got in via the legacy shared code (no row to claim).
  if (access.signup_mode === 'invite' && admin && data.user) {
    const claimed = await claimInviteCode(admin, inviteCode, data.user.id)
    if (!claimed) {
      // Race: code was claimed between validation and signup, OR the
      // user got in via the legacy shared code. Either is acceptable —
      // user account exists, no further action needed.
      console.info('[signup] Invite code claim skipped — likely shared-code path or race', { codeMasked: inviteCode.slice(0, 2) + '****' })
    }
  }

  revalidatePath('/', 'layout')
  // New users land on /onboarding for the guided setup; existing users
  // (login flow) never hit this path. The wizard itself can be skipped,
  // so this doesn't trap anyone.
  redirect('/onboarding')
}
