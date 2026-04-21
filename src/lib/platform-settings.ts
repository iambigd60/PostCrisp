import 'server-only'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export type SignupMode = 'open' | 'invite' | 'closed'

export interface AccessControl {
  signup_mode: SignupMode
  invite_code: string | null
  login_enabled: boolean
  updated_at?: string
}

const DEFAULT_ACCESS_CONTROL: AccessControl = {
  signup_mode: 'open',
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
    const { data } = await admin
      .from('platform_settings')
      .select('value, updated_at')
      .eq('key', 'access_control')
      .maybeSingle()

    const value: AccessControl = data?.value
      ? { ...DEFAULT_ACCESS_CONTROL, ...(data.value as Partial<AccessControl>) }
      : DEFAULT_ACCESS_CONTROL
    _cache = { value, expiresAt: Date.now() + CACHE_TTL_MS }
    return value
  } catch {
    return DEFAULT_ACCESS_CONTROL
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
