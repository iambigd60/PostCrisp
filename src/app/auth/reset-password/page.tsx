'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const { addToast } = useToast()

  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasRecoverySession, setHasRecoverySession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Supabase's PKCE recovery flow drops a `?code=xxx` on this URL when the
  // user arrives from the email link. The browser SDK auto-exchanges that
  // code for a recovery session on init (detectSessionInUrl: true by default).
  // We listen for both: (a) an existing session on mount (already exchanged
  // in a prior tick, or returning user) and (b) the PASSWORD_RECOVERY event
  // firing as the exchange completes.
  useEffect(() => {
    let settled = false
    const settle = (hasSession: boolean) => {
      if (settled) return
      settled = true
      setHasRecoverySession(hasSession)
      setCheckingSession(false)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) settle(true)
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) settle(true)
    })

    // Give the async PKCE exchange a few seconds, then give up so the user
    // sees the "invalid link" state rather than a permanent spinner.
    const timeout = setTimeout(() => settle(false), 4000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password.length < 8) {
      addToast('Password must be at least 8 characters.', 'error')
      return
    }
    if (password !== confirmPassword) {
      addToast('Passwords do not match.', 'error')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      addToast(error.message, 'error')
      return
    }

    addToast('Password updated — you are now signed in.', 'success')
    router.push('/dashboard')
    router.refresh()
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-primary px-4">
        <p className="text-zinc-500 text-sm">Verifying recovery link…</p>
      </div>
    )
  }

  if (!hasRecoverySession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-primary px-4">
        <div className="w-full max-w-md p-8 rounded-2xl bg-surface-secondary border border-red-500/20 text-center">
          <div className="w-12 h-12 rounded-xl bg-red-500/15 flex items-center justify-center text-2xl mx-auto mb-4">
            ⏰
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">Recovery link invalid</h1>
          <p className="text-zinc-400 mt-3 text-sm">
            This password reset link has expired or already been used. Request a fresh one below.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block mt-6 py-2 px-5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Request new link
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-primary px-4">
      <div className="w-full max-w-md p-8 rounded-2xl bg-surface-secondary border border-brand-500/20 shadow-glow">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-2xl mx-auto mb-4">
            🔑
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">Set a new password</h1>
          <p className="text-zinc-400 mt-2 text-sm">
            Pick something strong — at least 8 characters.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1" htmlFor="password">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-primary border border-brand-500/20 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              placeholder="Min. 8 characters"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1" htmlFor="confirm_password">
              Confirm new password
            </label>
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-surface-primary border border-brand-500/20 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg transition-all hover:shadow-glow disabled:opacity-50"
          >
            {loading ? 'Updating password…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
