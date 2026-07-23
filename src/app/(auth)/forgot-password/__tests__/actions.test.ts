import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// HIGH-2: the recovery link origin must come from the fixed, env-configured
// canonical URL — never from an attacker-controllable request Host header.
// These tests assert the redirectTo is built from NEXT_PUBLIC_APP_URL and that
// a missing config fails safe (generic error, no email sent).

const resetPasswordForEmail = vi.fn()

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { resetPasswordForEmail },
  })),
}))

const ORIGINAL_ENV = { ...process.env }

function formWithEmail(email: string): FormData {
  const fd = new FormData()
  fd.set('email', email)
  return fd
}

beforeEach(() => {
  resetPasswordForEmail.mockReset()
  resetPasswordForEmail.mockResolvedValue({ error: null })
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.resetModules()
})

describe('sendPasswordReset (HIGH-2)', () => {
  it('builds redirectTo from NEXT_PUBLIC_APP_URL, stripping trailing slashes', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com///'
    const { sendPasswordReset } = await import('../actions')

    const result = await sendPasswordReset(formWithEmail('user@example.com'))

    expect(result).toEqual({ success: true })
    expect(resetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'https://app.example.com/auth/reset-password',
    })
  })

  it('fails safe when NEXT_PUBLIC_APP_URL is not configured', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    const { sendPasswordReset } = await import('../actions')

    const result = await sendPasswordReset(formWithEmail('user@example.com'))

    expect(result).toHaveProperty('error')
    expect(resetPasswordForEmail).not.toHaveBeenCalled()
  })
})
