'use client'

import { useState } from 'react'
import { apiFetch, ApiError } from '@/lib/api'

type Step = 'details' | 'code' | 'done'

const inputClasses =
  'w-full px-4 py-3 rounded-xl bg-surface-tertiary border border-brand-500/15 text-zinc-100 ' +
  'placeholder-zinc-500 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/40 transition-colors'
const labelClasses = 'block text-sm font-medium text-zinc-300 mb-1.5'
const primaryBtn =
  'w-full inline-flex items-center justify-center px-8 py-3.5 bg-brand-600 hover:bg-brand-500 ' +
  'disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl ' +
  'transition-all hover:shadow-glow min-h-[48px]'

export default function BetaSignupForm() {
  const [step, setStep] = useState<Step>('details')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [channel, setChannel] = useState('')
  const [company, setCompany] = useState('') // honeypot — always empty for humans
  const [code, setCode] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function requestCode(): Promise<boolean> {
    const res = await apiFetch<{ token: string }>('/api/beta-signup', {
      method: 'POST',
      timeout: 30000,
      body: JSON.stringify({ name, email, channel, company }),
    })
    setToken(res.token)
    return true
  }

  async function handleDetails(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setSubmitting(true)
    try {
      await requestCode()
      setStep('code')
      setNotice(`We sent a 6-digit code to ${email}. Enter it below to confirm your email.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setSubmitting(true)
    try {
      await apiFetch('/api/beta-signup/verify', {
        method: 'POST',
        timeout: 30000,
        body: JSON.stringify({ token, code }),
      })
      setStep('done')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    setError('')
    setNotice('')
    setSubmitting(true)
    try {
      await requestCode()
      setCode('')
      setNotice(`New code sent to ${email}.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend the code. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'done') {
    return (
      <div className="text-center py-4">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl">
          ✓
        </div>
        <h3 className="text-xl font-bold text-white mb-2">You’re on the list!</h3>
        <p className="text-zinc-400">
          Thanks, {name.split(' ')[0] || 'creator'} — your email is verified and your request is in.
          We’ll reach out from <span className="text-zinc-200">beta@postcrisp.com</span> with your invite.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={step === 'details' ? handleDetails : handleVerify} className="space-y-4" noValidate>
      {step === 'details' ? (
        <>
          <div>
            <label htmlFor="beta-name" className={labelClasses}>
              Name
            </label>
            <input
              id="beta-name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Rivera"
              className={inputClasses}
            />
          </div>
          <div>
            <label htmlFor="beta-email" className={labelClasses}>
              Email
            </label>
            <input
              id="beta-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClasses}
            />
          </div>
          <div>
            <label htmlFor="beta-channel" className={labelClasses}>
              Influencer channel link
            </label>
            <input
              id="beta-channel"
              type="url"
              inputMode="url"
              required
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="https://instagram.com/yourhandle"
              className={inputClasses}
            />
          </div>

          {/* Honeypot — hidden from humans, catches bots. */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', height: 0, overflow: 'hidden' }}>
            <label htmlFor="beta-company">Company (leave blank)</label>
            <input
              id="beta-company"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button type="submit" disabled={submitting} className={primaryBtn}>
            {submitting ? 'Sending code…' : 'Send verification code'}
          </button>
          <p className="text-xs text-zinc-500 text-center">
            We’ll email you a code to confirm your address. No password, no spam.
          </p>
        </>
      ) : (
        <>
          {notice && <p className="text-sm text-brand-300">{notice}</p>}
          <div>
            <label htmlFor="beta-code" className={labelClasses}>
              Verification code
            </label>
            <input
              id="beta-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              className={`${inputClasses} tracking-[0.5em] text-center text-lg`}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button type="submit" disabled={submitting || code.length !== 6} className={primaryBtn}>
            {submitting ? 'Verifying…' : 'Verify & join the beta'}
          </button>
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <button
              type="button"
              onClick={() => {
                setStep('details')
                setError('')
                setNotice('')
                setCode('')
              }}
              className="hover:text-zinc-300 transition-colors"
            >
              ← Edit details
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={submitting}
              className="hover:text-zinc-300 transition-colors disabled:opacity-60"
            >
              Resend code
            </button>
          </div>
        </>
      )}
    </form>
  )
}
