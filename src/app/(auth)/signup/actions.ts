'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { readAccessControl, matchesInviteCode } from '@/lib/platform-settings'
import { reserveInviteCode, finalizeInviteCode, releaseInviteCode, normalizeCode } from '@/lib/invite-codes'

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

  // Use the fixed, env-configured canonical origin for the confirmation
  // link. NEVER derive it from the request Host header — that is attacker-
  // controllable and enables link poisoning, same as the password-reset
  // flow. In local dev this is http://localhost:3000 (see .env.local.example).
  // Without this, the confirmation link falls back to whatever the Supabase
  // dashboard's Site URL resolves to, which may not point at /auth/callback —
  // silently skipping the onboarding-routing fix for the email-confirmation
  // path most production users take.
  // Checked before any invite code is reserved, so this early return can't
  // leave a code stuck in the reserved state.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '')
  if (!appUrl) {
    return { error: 'Signup is temporarily unavailable. Please try again later.' }
  }

  let admin: ReturnType<typeof serviceRoleClient> | null = null
  // Set when a single-use code is reserved for this signup (not the legacy
  // shared-code path). Released again if no account ends up being created.
  let reservedAt: string | null = null

  if (access.signup_mode === 'invite') {
    if (!inviteCode) {
      return { error: 'An invite code is required to sign up.' }
    }

    admin = serviceRoleClient()

    // Single-use codes (invite_codes table) take precedence and are reserved
    // atomically BEFORE the account exists, so a concurrent signup on the same
    // code is refused instead of also getting an account. The
    // legacy shared code from access_control.invite_code is a separate path
    // with nothing to reserve.
    reservedAt = await reserveInviteCode(admin, inviteCode)
    const sharedMatches = matchesInviteCode(inviteCode, access.invite_code)

    if (!reservedAt && !sharedMatches) {
      return { error: 'That invite code is not valid or has already been used.' }
    }
  }

  // ─── Proceed with signup ──────────────────────────────────────────────
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // invite_code is what the Auth before-user-created hook
      // (public.hook_enforce_signup_policy) checks in invite mode — it only
      // accepts a code this action has just reserved, or the shared code.
      data: access.signup_mode === 'invite'
        ? { full_name: fullName, invite_code: inviteCode }
        : { full_name: fullName },
      emailRedirectTo: `${appUrl}/auth/callback`,
    },
  })

  if (error) {
    if (admin && reservedAt) await releaseInviteCode(admin, inviteCode, reservedAt)
    return { error: error.message }
  }

  // ─── Settle the reservation ──────────────────────────────────────────
  // With email confirmation on, signUp on an existing email returns a user
  // with no identities and creates nothing — release the code in that case.
  if (admin && reservedAt) {
    const createdAccount = (data.user?.identities?.length ?? 0) > 0
    if (data.user && createdAccount) {
      const attached = await finalizeInviteCode(admin, inviteCode, data.user.id)
      if (!attached) {
        // The code stays consumed (used_at set) — only the audit link is missing.
        console.error('[signup] reserved invite code could not be attached to the new account', { codeMasked: inviteCode.slice(0, 2) + '****' })
      }
    } else {
      await releaseInviteCode(admin, inviteCode, reservedAt)
    }
  }

  revalidatePath('/', 'layout')
  // New users land on /onboarding for the guided setup; existing users
  // (login flow) never hit this path. The wizard itself can be skipped,
  // so this doesn't trap anyone.
  redirect('/onboarding')
}
