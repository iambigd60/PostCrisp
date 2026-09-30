'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { createClient } from '@/utils/supabase/client'

type Stage = 'loading' | 'enroll' | 'challenge' | 'ready'
type VerifiedFactor = { id: string; friendly_name?: string }

export function AdminMfa() {
  const [supabase] = useState(createClient)
  const [stage, setStage] = useState<Stage>('loading')
  const [factors, setFactors] = useState<VerifiedFactor[]>([])
  const [factorId, setFactorId] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [assurance, listed] = await Promise.all([
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
          supabase.auth.mfa.listFactors(),
        ])
        if (assurance.error) throw assurance.error
        if (listed.error) throw listed.error
        if (!active) return

        if (assurance.data.currentLevel === 'aal2' && assurance.data.nextLevel === 'aal2') {
          setStage('ready')
          return
        }

        const verified = listed.data.totp.map((factor) => ({
          id: factor.id,
          friendly_name: factor.friendly_name,
        }))
        setFactors(verified)
        if (verified.length > 0) {
          setFactorId(verified[0].id)
          setStage('challenge')
        } else {
          setStage('enroll')
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load MFA settings.')
      }
    }
    void load()
    return () => { active = false }
  }, [supabase])

  async function startEnrollment() {
    setBusy(true)
    setError('')
    try {
      // An interrupted enrollment has no recoverable QR secret. Remove only
      // unverified TOTP factors before starting a fresh enrollment.
      const listed = await supabase.auth.mfa.listFactors()
      if (listed.error) throw listed.error
      for (const factor of listed.data.all) {
        if (factor.factor_type === 'totp' && factor.status === 'unverified') {
          const removed = await supabase.auth.mfa.unenroll({ factorId: factor.id })
          if (removed.error) throw removed.error
        }
      }

      const enrolled = await supabase.auth.mfa.enroll({ factorType: 'totp' })
      if (enrolled.error) throw enrolled.error
      setFactorId(enrolled.data.id)
      setQrCode(enrolled.data.totp.qr_code)
      setSecret(enrolled.data.totp.secret)
      setCode('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start MFA setup.')
    } finally {
      setBusy(false)
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!/^\d{6}$/.test(code) || !factorId) return
    setBusy(true)
    setError('')
    try {
      const challenged = await supabase.auth.mfa.challenge({ factorId })
      if (challenged.error) throw challenged.error
      const verified = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenged.data.id,
        code,
      })
      if (verified.error) throw verified.error
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (assurance.error || assurance.data.currentLevel !== 'aal2' || assurance.data.nextLevel !== 'aal2') {
        throw new Error('Verification succeeded, but this session is not ready yet. Refresh and try again.')
      }
      setSecret('')
      window.location.assign('/admin')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Verification failed. Try a new code.')
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-primary px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-brand-500/20 bg-surface-secondary p-8 shadow-glow">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-2xl">🔐</div>
          <h1 className="text-2xl font-bold text-zinc-100">Admin verification</h1>
          <p className="mt-2 text-sm text-zinc-400">
            {stage === 'challenge'
              ? 'Enter the code from your authenticator app to open admin controls.'
              : 'Admin controls require an authenticator app.'}
          </p>
        </div>

        {error && <p role="alert" className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

        {stage === 'loading' && !error && <p className="text-center text-sm text-zinc-400">Checking your account…</p>}

        {stage === 'enroll' && (
          <div className="space-y-5">
            {!qrCode ? (
              <>
                <p className="text-sm text-zinc-300">Use any authenticator app that supports six-digit codes.</p>
                <button type="button" onClick={startEnrollment} disabled={busy}
                  className="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-medium text-white hover:bg-brand-500 disabled:opacity-50">
                  {busy ? 'Preparing…' : 'Set up authenticator'}
                </button>
              </>
            ) : (
              <>
                <div className="mx-auto w-fit rounded-lg bg-white p-3">
                  <Image src={qrCode} alt="Authenticator setup QR code" width={180} height={180} unoptimized />
                </div>
                <p className="text-sm text-zinc-300">Scan the QR code, then enter the six-digit code below.</p>
                <p className="break-all text-xs text-zinc-400">Can&apos;t scan? Enter this setup key in your app: <span className="font-mono text-zinc-200">{secret}</span></p>
              </>
            )}
          </div>
        )}

        {stage === 'challenge' && factors.length > 1 && (
          <label className="mb-5 block text-sm text-zinc-300">
            Authenticator
            <select value={factorId} onChange={(event) => setFactorId(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-brand-500/20 bg-surface-primary px-4 py-2.5 text-zinc-100">
              {factors.map((factor, index) => <option key={factor.id} value={factor.id}>{factor.friendly_name || `Authenticator ${index + 1}`}</option>)}
            </select>
          </label>
        )}

        {(stage === 'challenge' || (stage === 'enroll' && qrCode)) && (
          <form onSubmit={verify} className="mt-5 space-y-4">
            <label className="block text-sm text-zinc-300" htmlFor="mfa-code">Six-digit code</label>
            <input id="mfa-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric" autoComplete="one-time-code" maxLength={6} required
              className="w-full rounded-lg border border-brand-500/20 bg-surface-primary px-4 py-2.5 text-center font-mono text-xl tracking-widest text-zinc-100 focus:border-brand-500 focus:outline-none" />
            <button type="submit" disabled={busy || code.length !== 6}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-medium text-white hover:bg-brand-500 disabled:opacity-50">
              {busy ? 'Verifying…' : stage === 'enroll' ? 'Enable MFA' : 'Verify and continue'}
            </button>
          </form>
        )}

        {stage === 'ready' && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-green-300">Your admin session is verified.</p>
            <Link href="/admin" className="block rounded-lg bg-brand-600 px-4 py-2.5 font-medium text-white hover:bg-brand-500">Continue to admin</Link>
          </div>
        )}

        <div className="mt-7 border-t border-brand-500/10 pt-5 text-center">
          <Link href="/dashboard" className="text-sm text-brand-400 hover:text-brand-300">Back to dashboard</Link>
          <p className="mt-3 text-xs text-zinc-500">Lost your authenticator? Contact the project owner for account recovery.</p>
        </div>
      </div>
    </div>
  )
}
