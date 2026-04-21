'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { signup } from './actions'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/utils/supabase/client'

type SignupMode = 'open' | 'invite' | 'closed'

export default function SignupPage() {
  const [loading, setLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [mode, setMode] = useState<SignupMode | null>(null)
  const { addToast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetch('/api/access-control/public')
      .then((r) => r.json())
      .then((d) => setMode(d.signup_mode as SignupMode))
      .catch(() => setMode('open'))  // fail open — admin shouldn't be locked out by config fetch error
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setPasswordError('')
    const formData = new FormData(e.currentTarget)
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirm_password') as string

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }

    setLoading(true)
    const result = await signup(formData)
    if (result?.error) {
      addToast(result.error, 'error')
      setLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    // Google OAuth bypasses our signup flow, so we gate it here too
    if (mode === 'closed') {
      addToast('Signups are currently closed.', 'error')
      return
    }
    if (mode === 'invite') {
      addToast('An invite code is required to sign up. Please use the email form.', 'error')
      return
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) addToast(error.message, 'error')
  }

  // Closed state — no form, just a message
  if (mode === 'closed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-primary px-4">
        <div className="w-full max-w-md p-8 rounded-2xl bg-surface-secondary border border-brand-500/20 shadow-glow text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-500 to-zinc-700 flex items-center justify-center text-2xl mx-auto mb-4">
            🚧
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">Signups are closed</h1>
          <p className="text-zinc-400 mt-3">
            PostCrisp isn&apos;t accepting new signups right now. Check back soon.
          </p>
          <Link href="/login" className="inline-block mt-6 text-sm text-brand-400 hover:text-brand-300 font-medium">
            Already have an account? Sign in →
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
            ⚡
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">Create an account</h1>
          <p className="text-zinc-400 mt-2">
            {mode === 'invite'
              ? 'PostCrisp is invite-only during alpha. Enter your code below.'
              : 'Get started with PostCrisp today.'}
          </p>
        </div>

        {mode !== 'invite' && (
          <>
            <button
              onClick={handleGoogleSignup}
              type="button"
              className="w-full py-2.5 px-4 bg-white hover:bg-zinc-100 text-zinc-900 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 mb-6"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Sign up with Google
            </button>

            <div className="flex items-center gap-4 mb-6">
              <div className="h-px flex-1 bg-brand-500/20" />
              <span className="text-sm text-zinc-500">or</span>
              <div className="h-px flex-1 bg-brand-500/20" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'invite' && (
            <div>
              <label className="block text-sm font-medium text-brand-300 mb-1" htmlFor="invite_code">
                Invite code
              </label>
              <input
                id="invite_code"
                name="invite_code"
                type="text"
                required
                className="w-full bg-surface-primary border border-brand-500/30 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors font-mono"
                placeholder="Enter your invite code"
                autoFocus
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1" htmlFor="full_name">
              Full Name
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              required
              className="w-full bg-surface-primary border border-brand-500/20 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              placeholder="Jane Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full bg-surface-primary border border-brand-500/20 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="w-full bg-surface-primary border border-brand-500/20 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              placeholder="Min. 8 characters"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1" htmlFor="confirm_password">
              Confirm Password
            </label>
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              required
              className="w-full bg-surface-primary border border-brand-500/20 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              placeholder="••••••••"
            />
            {passwordError && (
              <p className="mt-1 text-sm text-red-400">{passwordError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || mode === null}
            className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg transition-all hover:shadow-glow disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
