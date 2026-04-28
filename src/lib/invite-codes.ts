import 'server-only'
import { randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

// 32-char alphabet — excludes 0/O, 1/I/L, and lowercase to avoid copy-paste
// confusion when codes are read off DMs / email / printed pages.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

export interface InviteCode {
  code: string
  created_at: string
  created_by: string | null
  notes: string | null
  used_at: string | null
  used_by: string | null
}

// 8 random chars displayed as XXXX-XXXX (the dash is a display artifact —
// stored without it so case-insensitive lookups work cleanly).
export function generateCode(): string {
  const bytes = randomBytes(8)
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return out
}

export function formatCodeForDisplay(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code
}

// Strip dashes + uppercase. Testers paste codes with mixed case / dashes;
// we normalize before lookup so 'abcd-1234' and 'ABCD1234' both work.
export function normalizeCode(input: string): string {
  return input.replace(/[-\s]/g, '').toUpperCase()
}

/**
 * Atomically claim an invite code. Returns true on success, false if the
 * code is missing or already used. Uses an UPDATE with WHERE used_at IS NULL
 * so two simultaneous claims on the same code can't both succeed.
 */
export async function claimInviteCode(
  supabaseAdmin: SupabaseClient,
  code: string,
  userId: string,
): Promise<boolean> {
  const normalized = normalizeCode(code)

  const { data, error } = await supabaseAdmin
    .from('invite_codes')
    .update({
      used_at: new Date().toISOString(),
      used_by: userId,
    })
    .eq('code', normalized)
    .is('used_at', null)
    .select('code')
    .maybeSingle()

  if (error) {
    console.error('claimInviteCode failed:', error)
    return false
  }

  return !!data
}

/**
 * Read-only check — used to give the signup form a fast 'invalid code'
 * response before running the actual auth.signUp call. Note this is NOT
 * race-safe; the atomic claimInviteCode is the source of truth.
 */
export async function isInviteCodeAvailable(
  supabaseAdmin: SupabaseClient,
  code: string,
): Promise<boolean> {
  const normalized = normalizeCode(code)

  const { data, error } = await supabaseAdmin
    .from('invite_codes')
    .select('code, used_at')
    .eq('code', normalized)
    .maybeSingle()

  if (error || !data) return false
  return data.used_at === null
}

/**
 * Generate a batch of N unique codes and insert them. Retries once if
 * collision is detected (extraordinarily unlikely with 32^8 keyspace).
 */
export async function generateInviteCodeBatch(
  supabaseAdmin: SupabaseClient,
  count: number,
  createdBy: string,
  notes: string | null = null,
): Promise<InviteCode[]> {
  if (count < 1 || count > 100) {
    throw new Error('count must be between 1 and 100')
  }

  // Two passes max: extremely unlikely to collide with 32^8 = 1.1 trillion
  // possible codes per generation, but defensive.
  for (let attempt = 0; attempt < 2; attempt++) {
    const codes = new Set<string>()
    while (codes.size < count) codes.add(generateCode())

    const rows = Array.from(codes).map((code) => ({
      code,
      created_by: createdBy,
      notes,
    }))

    const { data, error } = await supabaseAdmin
      .from('invite_codes')
      .insert(rows)
      .select('*')

    if (!error && data) return data as InviteCode[]

    // Postgres unique-violation = retry the whole batch with new codes.
    if (error?.code === '23505' && attempt === 0) continue

    throw new Error(`Failed to generate invite codes: ${error?.message ?? 'unknown error'}`)
  }

  throw new Error('Failed to generate invite codes after retries')
}
