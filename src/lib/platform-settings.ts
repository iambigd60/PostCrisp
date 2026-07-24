import 'server-only'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export type SignupMode = 'open' | 'invite' | 'closed'

export interface AccessControl {
  signup_mode: SignupMode
  invite_code: string | null
  login_enabled: boolean
  updated_at?: string
}

// Fail-CLOSED default. Used only when the access_control row is missing or the
// read fails — never allow open, un-invited signup on a transient DB error /
// misconfiguration. Login stays enabled (it's credential-gated and we don't
// want a DB blip to lock out existing users); signup is the attack surface, so
// it defaults to 'closed' until a real config is read.
const FAILCLOSED_ACCESS_CONTROL: AccessControl = {
  signup_mode: 'closed',
  invite_code: null,
  login_enabled: true,
}

function serviceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// ─── Cache settings for 30s to avoid hammering the DB on every signup/login ─
let _cache: { value: AccessControl; expiresAt: number } | null = null
const CACHE_TTL_MS = 30_000

export async function readAccessControl(): Promise<AccessControl> {
  if (_cache && _cache.expiresAt > Date.now()) return _cache.value

  try {
    const admin = serviceClient()
    const { data, error } = await admin
      .from('platform_settings')
      .select('value, updated_at')
      .eq('key', 'access_control')
      .maybeSingle()

    // Read error or missing config row → fail closed, and do NOT cache the
    // fallback so the next call re-reads once the DB recovers.
    if (error) {
      console.error('[access-control] read failed — failing closed:', error.message)
      return FAILCLOSED_ACCESS_CONTROL
    }
    if (!data?.value) {
      return FAILCLOSED_ACCESS_CONTROL
    }

    // Merge onto the fail-closed base AND validate the security-relevant fields.
    // A spread alone isn't enough: a corrupt row with signup_mode null/unknown
    // would overwrite 'closed', and the signup action (which only special-cases
    // 'closed'/'invite') would then fall through to allowing signup. Coerce an
    // unrecognized mode back to 'closed', and a non-boolean login flag to true.
    const stored = data.value as Partial<AccessControl>
    const validMode =
      stored.signup_mode === 'open' ||
      stored.signup_mode === 'invite' ||
      stored.signup_mode === 'closed'
    const value: AccessControl = {
      ...FAILCLOSED_ACCESS_CONTROL,
      ...stored,
      signup_mode: validMode ? (stored.signup_mode as SignupMode) : FAILCLOSED_ACCESS_CONTROL.signup_mode,
      login_enabled:
        typeof stored.login_enabled === 'boolean'
          ? stored.login_enabled
          : FAILCLOSED_ACCESS_CONTROL.login_enabled,
    }
    _cache = { value, expiresAt: Date.now() + CACHE_TTL_MS }
    return value
  } catch (err) {
    console.error('[access-control] read threw — failing closed:', err)
    return FAILCLOSED_ACCESS_CONTROL
  }
}

export async function writeAccessControl(next: AccessControl, actorId: string): Promise<void> {
  const admin = serviceClient()
  const { error } = await admin
    .from('platform_settings')
    .upsert(
      { key: 'access_control', value: next, updated_by: actorId, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
  if (error) {
    throw new Error(`Failed to save access control settings: ${error.message}`)
  }
  _cache = null
}

export function clearAccessControlCache() {
  _cache = null
}

// ─── Invite code validation — constant-time compare to avoid timing attacks ──
export function matchesInviteCode(provided: string | null | undefined, expected: string | null): boolean {
  if (!expected) return false
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}
