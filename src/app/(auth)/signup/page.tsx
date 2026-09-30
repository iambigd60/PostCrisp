'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { signup } from './actions'
import { useToast } from '@/components/ui/Toast'

type SignupMode = 'open' | 'invite' | 'closed'

export default function SignupPage() {
  const [loading, setLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [mode, setMode] = useState<SignupMode | null>(null)
  const { addToast } = useToast()

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
              ? 'PostCrisp is invite-only during beta. Enter your code below.'
              : 'Get started with PostCrisp today.'}
          </p>
        </div>

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
