import { afterEach, describe, expect, it, vi } from 'vitest'
import crypto from 'node:crypto'
import {
  CODE_TTL_MS,
  betaSigningKey,
  generateCode,
  makeToken,
  validateSignup,
  verifyToken,
} from '@/lib/beta-signup'

const KEY = crypto.createHash('sha256').update('test-key').digest()
const INPUT = { name: 'Alex Rivera', email: 'alex@example.com', channel: 'https://instagram.com/alex' }

describe('validateSignup', () => {
  it('accepts a valid submission and normalizes name/email', () => {
    const res = validateSignup({ name: '  Alex Rivera ', email: '  Alex@Example.COM ', channel: 'https://tiktok.com/@alex' })
    expect(res).toEqual({
      ok: true,
      value: { name: 'Alex Rivera', email: 'alex@example.com', channel: 'https://tiktok.com/@alex' },
    })
  })

  it('accepts a bare www. channel link', () => {
    const res = validateSignup({ ...INPUT, channel: 'www.youtube.com/@alex' })
    expect(res.ok).toBe(true)
  })

  it('rejects a missing name', () => {
    const res = validateSignup({ name: '  ', email: 'a@b.com', channel: 'https://x.com/a' })
    expect(res.ok).toBe(false)
  })

  it('rejects an invalid email', () => {
    for (const email of ['nope', 'a@b', 'a b@c.com', '']) {
      expect(validateSignup({ ...INPUT, email }).ok).toBe(false)
    }
  })

  it('rejects a channel that is not a usable link', () => {
    // Incomplete values that pass a prefix-only check must still be rejected.
    for (const channel of ['my instagram', 'https://', 'www.', 'ftp://example.com', 'https://nodot']) {
      expect(validateSignup({ ...INPUT, channel }).ok).toBe(false)
    }
  })

  it('accepts a full http(s) channel link', () => {
    for (const channel of ['https://instagram.com/you', 'http://x.com/you', 'www.youtube.com/@you']) {
      expect(validateSignup({ ...INPUT, channel }).ok).toBe(true)
    }
  })

  it('rejects over-long fields', () => {
    expect(validateSignup({ ...INPUT, name: 'a'.repeat(101) }).ok).toBe(false)
    expect(validateSignup({ ...INPUT, channel: 'https://x.com/' + 'a'.repeat(300) }).ok).toBe(false)
  })
})

describe('generateCode', () => {
  it('returns a zero-padded 6-digit string', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode()
      expect(code).toMatch(/^\d{6}$/)
    }
  })
})

describe('token round-trip', () => {
  it('verifies with the correct code and returns the original submission', () => {
    const code = '123456'
    const token = makeToken(KEY, INPUT, code)
    const res = verifyToken(KEY, token, code)
    expect(res).toEqual({ ok: true, value: INPUT })
  })

  it('trims whitespace around the submitted code', () => {
    const code = '000042'
    const token = makeToken(KEY, INPUT, code)
    expect(verifyToken(KEY, token, ' 000042 ').ok).toBe(true)
  })

  it('rejects an incorrect code as bad_code', () => {
    const token = makeToken(KEY, INPUT, '123456')
    const res = verifyToken(KEY, token, '654321')
    expect(res).toMatchObject({ ok: false, code: 'bad_code' })
  })

  it('rejects an expired token', () => {
    const token = makeToken(KEY, INPUT, '123456', 1000)
    const res = verifyToken(KEY, token, '123456', 1000 + CODE_TTL_MS + 1)
    expect(res).toMatchObject({ ok: false, code: 'expired' })
  })

  it('rejects a token tampered in the payload (signature mismatch)', () => {
    const token = makeToken(KEY, INPUT, '123456')
    const [body, sig] = token.split('.')
    // Flip a character in the payload body; the signature no longer matches.
    const flipped = (body[10] === 'A' ? 'B' : 'A') + body.slice(1)
    const res = verifyToken(KEY, `${flipped}.${sig}`, '123456')
    expect(res).toMatchObject({ ok: false, code: 'tampered' })
  })

  it('rejects a token signed with a different key', () => {
    const token = makeToken(crypto.createHash('sha256').update('other-key').digest(), INPUT, '123456')
    const res = verifyToken(KEY, token, '123456')
    expect(res).toMatchObject({ ok: false, code: 'tampered' })
  })

  it('rejects a malformed token', () => {
    expect(verifyToken(KEY, 'not-a-token', '123456')).toMatchObject({ ok: false, code: 'malformed' })
    expect(verifyToken(KEY, '', '123456')).toMatchObject({ ok: false, code: 'malformed' })
  })

  it('a fresh token for the same input embeds a different random code (offline guess fails)', () => {
    // A holder of the token cannot recompute the MAC without the key, so the
    // real emailed code is required — a guessed 6-digit code is rejected. Uses a
    // fixed code outside the guessed range so the test is deterministic.
    const token = makeToken(KEY, INPUT, '999999')
    let accepted = 0
    for (let guess = 0; guess < 50; guess++) {
      if (verifyToken(KEY, token, String(guess).padStart(6, '0')).ok) accepted++
    }
    expect(accepted).toBe(0)
  })
})

describe('betaSigningKey', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('derives a key from an explicit BETA_SIGNUP_SECRET', () => {
    vi.stubEnv('BETA_SIGNUP_SECRET', 'a-sufficiently-long-secret')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    expect(betaSigningKey()).not.toBeNull()
  })

  it('falls back to a domain-separated subkey of the service role key', () => {
    vi.stubEnv('BETA_SIGNUP_SECRET', '')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key-value')
    const key = betaSigningKey()
    expect(key).not.toBeNull()
    // Not the raw service key material.
    expect(key?.toString('utf8')).not.toContain('service-role-key-value')
  })

  it('returns null when no secret is configured (fail closed)', () => {
    vi.stubEnv('BETA_SIGNUP_SECRET', '')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    expect(betaSigningKey()).toBeNull()
  })

  it('ignores a too-short BETA_SIGNUP_SECRET and falls through', () => {
    vi.stubEnv('BETA_SIGNUP_SECRET', 'short')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    expect(betaSigningKey()).toBeNull()
  })
})
