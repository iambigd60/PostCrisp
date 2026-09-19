/**
 * Beta-signup form — server helpers.
 *
 * Flow (no database, no migration): a visitor submits {name, email, channel}.
 * We email them a 6-digit code and hand the browser an opaque, HMAC-signed
 * token that carries the submission plus a MAC of the code. When they enter the
 * code we re-derive the MAC and, on a match, email the verified submission to
 * beta@postcrisp.com. The code MAC is keyed by a server secret, so a holder of
 * the token cannot brute-force the code offline; online guessing is bounded by
 * the 15-minute expiry and the edge (Vercel WAF) per-IP limit.
 */

import crypto from 'node:crypto'

export const CODE_TTL_MS = 15 * 60 * 1000
const TOKEN_VERSION = 'v1'

export interface BetaSignupInput {
  name: string
  email: string
  channel: string
}

interface BetaTokenPayload extends BetaSignupInput {
  exp: number // epoch ms
  mac: string // HMAC(key, version|email|code|exp)
  v: string
}

// ─── Validation ────────────────────────────────────────────────────────────

// Deliberately permissive: one @, at least one dot in the domain, no spaces.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export type ValidationResult =
  | { ok: true; value: BetaSignupInput }
  | { ok: false; error: string }

/**
 * True when `value` is a usable http(s) channel link with a dotted hostname.
 * A bare `www.` prefix is treated as https. Rejects incomplete values such as
 * "https://" or "www." that would pass a prefix-only check.
 */
function isValidChannelUrl(value: string): boolean {
  let candidate = value.trim()
  if (/^www\./i.test(candidate)) candidate = `https://${candidate}`
  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    return false
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
  // Require a dotted hostname with non-empty labels (e.g. instagram.com).
  return /^[^.\s]+(\.[^.\s]+)+$/.test(parsed.hostname)
}

/**
 * Validate and normalize a raw beta-signup submission. Returns the trimmed
 * value (email lower-cased) on success, or a user-facing error string.
 */
export function validateSignup(raw: Partial<BetaSignupInput>): ValidationResult {
  const name = (raw.name ?? '').trim()
  const email = normalizeEmail(raw.email ?? '')
  const channel = (raw.channel ?? '').trim()

  if (!name || name.length > 100) {
    return { ok: false, error: 'Please enter your name (under 100 characters).' }
  }
  if (!email || email.length > 200 || !EMAIL_RE.test(email)) {
    return { ok: false, error: 'Please enter a valid email address.' }
  }
  if (!channel || channel.length > 300 || !isValidChannelUrl(channel)) {
    return {
      ok: false,
      error: 'Please enter a valid link to your channel or profile (e.g. https://instagram.com/you).',
    }
  }
  return { ok: true, value: { name, email, channel } }
}

// ─── Token crypto ────────────────────────────────────────────────────────────

/**
 * Resolve the HMAC key for signing beta tokens. Prefers an explicit
 * BETA_SIGNUP_SECRET; otherwise derives a domain-separated subkey from
 * SUPABASE_SERVICE_ROLE_KEY (present in prod) so the feature works with no new
 * env var. The service key material is never used directly — HMAC is one-way,
 * so the derived key can't reveal it. Returns null when neither is configured
 * (callers fail closed).
 */
export function betaSigningKey(): Buffer | null {
  const explicit = process.env.BETA_SIGNUP_SECRET
  if (explicit && explicit.length >= 16) {
    return crypto.createHash('sha256').update(explicit).digest()
  }
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (svc) {
    return crypto.createHmac('sha256', svc).update('beta-signup-token-v1').digest()
  }
  return null
}

function hmac(key: Buffer, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest()
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

/** Uniformly-random 6-digit code, zero-padded. */
export function generateCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
}

function codeMac(key: Buffer, email: string, code: string, exp: number): string {
  return hmac(key, `${TOKEN_VERSION}|${email}|${code}|${exp}`).toString('hex')
}

export function makeToken(
  key: Buffer,
  input: BetaSignupInput,
  code: string,
  now: number = Date.now(),
): string {
  const exp = now + CODE_TTL_MS
  const payload: BetaTokenPayload = {
    ...input,
    exp,
    v: TOKEN_VERSION,
    mac: codeMac(key, input.email, code, exp),
  }
  const body = b64url(JSON.stringify(payload))
  const sig = b64url(hmac(key, body))
  return `${body}.${sig}`
}

export type VerifyResult =
  | { ok: true; value: BetaSignupInput }
  | { ok: false; error: string; code: 'malformed' | 'tampered' | 'expired' | 'bad_code' }

export function verifyToken(
  key: Buffer,
  token: string,
  code: string,
  now: number = Date.now(),
): VerifyResult {
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, error: 'Your session expired. Please start again.', code: 'malformed' }
  }
  const [body, sig] = parts

  // Integrity first: the whole payload (including the code MAC) is signed.
  if (!timingSafeEqualStr(sig, b64url(hmac(key, body)))) {
    return { ok: false, error: 'Your session expired. Please start again.', code: 'tampered' }
  }

  let payload: BetaTokenPayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as BetaTokenPayload
  } catch {
    return { ok: false, error: 'Your session expired. Please start again.', code: 'malformed' }
  }
  if (payload.v !== TOKEN_VERSION || typeof payload.exp !== 'number' || typeof payload.mac !== 'string') {
    return { ok: false, error: 'Your session expired. Please start again.', code: 'malformed' }
  }
  if (now > payload.exp) {
    return { ok: false, error: 'That code expired. Please request a new one.', code: 'expired' }
  }

  const submitted = (code ?? '').trim()
  const expectedMac = codeMac(key, payload.email, submitted, payload.exp)
  if (!timingSafeEqualStr(expectedMac, payload.mac)) {
    return { ok: false, error: 'That code is incorrect. Please check and try again.', code: 'bad_code' }
  }

  return { ok: true, value: { name: payload.name, email: payload.email, channel: payload.channel } }
}

// ─── Email (Resend) ──────────────────────────────────────────────────────────

export interface EmailResult {
  ok: boolean
  skipped?: boolean
  error?: string
}

/**
 * POST an email via the Resend API. Guards on RESEND_API_KEY (skips when unset),
 * aborts after 10s so a hung connection can't pin the serverless invocation, and
 * forwards an optional Idempotency-Key so safe retries don't double-send.
 */
async function sendResend(
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, skipped: true, error: 'email_not_configured' }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers,
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, error: `resend_${res.status}: ${detail.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'resend_threw' }
  }
}

/** Email the 6-digit verification code to the prospective tester. */
export function sendVerificationCodeEmail(to: string, code: string): Promise<EmailResult> {
  return sendResend({
    from: 'PostCrisp Beta <noreply@postcrisp.com>',
    to: [to],
    subject: `Your PostCrisp beta code: ${code}`,
    text:
      `Welcome to the PostCrisp beta!\n\n` +
      `Your verification code is: ${code}\n\n` +
      `Enter it on the signup form to confirm your email. It expires in 15 minutes.\n\n` +
      `If you didn't request this, you can safely ignore this email.\n\n` +
      `— PostCrisp`,
  })
}

/**
 * Email the verified signup to the beta inbox. Pass a stable `idempotencyKey`
 * (e.g. derived from the token) so a duplicate verify doesn't send twice — the
 * payload must be identical across retries, so it carries no per-call timestamp.
 */
export function sendBetaNotificationEmail(
  input: BetaSignupInput,
  idempotencyKey?: string,
): Promise<EmailResult> {
  const to = process.env.BETA_NOTIFICATION_EMAIL ?? 'beta@postcrisp.com'
  return sendResend(
    {
      from: 'PostCrisp Beta Signups <noreply@postcrisp.com>',
      to: [to],
      reply_to: input.email,
      subject: `New beta signup: ${input.name}`,
      text:
        `A new (email-verified) beta tester signed up:\n\n` +
        `Name:    ${input.name}\n` +
        `Email:   ${input.email}\n` +
        `Channel: ${input.channel}\n\n` +
        `Reply directly to this email to reach them.`,
    },
    idempotencyKey,
  )
}
