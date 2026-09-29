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
 * Atomically reserve a single-use invite code before the account exists.
 * Sets used_at on an unused row (used_by stays null until the account is
 * created) so two simultaneous signups on the same code can't both pass.
 * Returns the reservation timestamp, or null if the code is missing or
 * already used/reserved.
 */
export async function reserveInviteCode(
  supabaseAdmin: SupabaseClient,
  code: string,
): Promise<string | null> {
  const reservedAt = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('invite_codes')
    .update({ used_at: reservedAt })
    .eq('code', normalizeCode(code))
    .is('used_at', null)
    .select('code')
    .maybeSingle()

  if (error) {
    console.error('reserveInviteCode failed:', error)
    return null
  }
  return data ? reservedAt : null
}

/**
 * Attach the new account to a reserved code. Only fills an empty used_by,
 * so it can never reassign a code already tied to another account.
 */
export async function finalizeInviteCode(
  supabaseAdmin: SupabaseClient,
  code: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('invite_codes')
    .update({ used_by: userId })
    .eq('code', normalizeCode(code))
    .is('used_by', null)
    .select('code')
    .maybeSingle()

  if (error) {
    console.error('finalizeInviteCode failed:', error)
    return false
  }
  return !!data
}

/**
 * Undo a reservation when no account was created (signup error, or the email
 * already belonged to an account). Matches on the exact reservation time and
 * an empty used_by, so it can only release this signup's own reservation.
 */
export async function releaseInviteCode(
  supabaseAdmin: SupabaseClient,
  code: string,
  reservedAt: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('invite_codes')
    .update({ used_at: null })
    .eq('code', normalizeCode(code))
    .eq('used_at', reservedAt)
    .is('used_by', null)

  if (error) console.error('releaseInviteCode failed:', error)
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
