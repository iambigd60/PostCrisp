'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSubscription } from '@/hooks/useSubscription'
import { PLANS, PRICES } from '@/lib/stripe'
import { useToast } from '@/components/ui/Toast'

const FEATURES_COMPARE = [
  { label: 'AI generations / day', free: '10', pro: 'Unlimited' },
  { label: 'Caption generator', free: true, pro: true },
  { label: 'Hashtag finder', free: true, pro: true },
  { label: 'Best posting times', free: true, pro: true },
  { label: 'Viral ideas generator', free: true, pro: true },
  { label: 'Save content library', free: false, pro: true },
  { label: 'Priority support', free: false, pro: true },
]

function Check({ ok }: { ok: boolean | string }) {
  if (typeof ok === 'string') return <span className="text-zinc-300 font-medium">{ok}</span>
  return ok
    ? <span className="text-emerald-400">✓</span>
    : <span className="text-zinc-600">—</span>
}

export default function BillingPage() {
  const { loading, isPro, upgrade, manage } = useSubscription()
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [working, setWorking] = useState(false)
  const searchParams = useSearchParams()
  const { addToast } = useToast()

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      addToast('🎉 Welcome to Pro! Your subscription is active.', 'success')
    }
  }, [searchParams, addToast])

  const handleUpgrade = async () => {
    setWorking(true)
    try {
      const priceId = billing === 'monthly' ? PRICES.pro_monthly : PRICES.pro_yearly
      await upgrade(priceId)
    } catch {
      addToast('Failed to start checkout. Please try again.', 'error')
      setWorking(false)
    }
  }

  const handleManage = async () => {
    setWorking(true)
    try {
      await manage()
    } catch {
      addToast('Failed to open billing portal. Please try again.', 'error')
      setWorking(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded-lg bg-surface-secondary animate-pulse" />
        <div className="h-64 rounded-xl bg-surface-secondary animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Billing & Subscription</h1>
        <p className="text-zinc-500 mt-1">Manage your PostCrisp subscription.</p>
      </div>

      {/* Current plan */}
      <div className="rounded-xl border border-brand-500/20 bg-surface-secondary p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${
            isPro ? 'bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow' : 'bg-surface-elevated'
          }`}>
            {isPro ? '⚡' : '🆓'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-100">{isPro ? 'Pro' : 'Free'} Plan</h2>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                isPro ? 'bg-brand-500/20 text-brand-300' : 'bg-zinc-700/50 text-zinc-400'
              }`}>
                {isPro ? 'Active' : 'Free tier'}
              </span>
            </div>
            <p className="text-sm text-zinc-500 mt-0.5">
              {isPro ? 'Unlimited generations · All features' : '10 generations / day · Core features'}
            </p>
          </div>
        </div>
        {isPro && (
          <button
            onClick={handleManage}
            disabled={working}
            className="flex-shrink-0 px-4 py-2 rounded-lg border border-brand-500/30 text-brand-300 hover:bg-brand-500/10 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {working ? 'Opening...' : 'Manage Subscription'}
          </button>
        )}
      </div>

      {/* Upgrade section — only show for free users */}
      {!isPro && (
        <>
          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm font-medium ${billing === 'monthly' ? 'text-zinc-200' : 'text-zinc-500'}`}>Monthly</span>
            <button
              onClick={() => setBilling(billing === 'monthly' ? 'yearly' : 'monthly')}
              className={`relative w-12 h-6 rounded-full transition-colors ${billing === 'yearly' ? 'bg-brand-600' : 'bg-surface-elevated'}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${billing === 'yearly' ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
            <span className={`text-sm font-medium ${billing === 'yearly' ? 'text-zinc-200' : 'text-zinc-500'}`}>
              Yearly
              <span className="ml-1.5 text-xs text-emerald-400 font-semibold">Save 17%</span>
            </span>
          </div>

          {/* Pricing cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Free card */}
            <div className="rounded-2xl border border-brand-500/10 bg-surface-secondary p-6">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-zinc-100">Free</h3>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-3xl font-extrabold text-zinc-100">$0</span>
                  <span className="text-zinc-500 mb-1">/ month</span>
                </div>
              </div>
              <ul className="space-y-2 mb-6">
                {PLANS.free.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-zinc-400">
                    <span className="text-emerald-400">✓</span> {f}
                  </li>
                ))}
                {PLANS.free.missing.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-zinc-600">
                    <span>—</span> {f}
                  </li>
                ))}
              </ul>
              <div className="w-full py-2.5 rounded-xl bg-surface-elevated text-center text-sm text-zinc-500 font-medium">
                Current plan
              </div>
            </div>

            {/* Pro card */}
            <div className="rounded-2xl border border-brand-500/40 bg-gradient-to-b from-brand-900/20 to-surface-secondary p-6 relative overflow-hidden">
              <div className="absolute top-3 right-3 bg-brand-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                POPULAR
              </div>
              <div className="mb-4">
                <h3 className="text-lg font-bold text-zinc-100">Pro</h3>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-3xl font-extrabold text-zinc-100">
                    ${billing === 'monthly' ? PLANS.pro.monthlyPrice : Math.round(PLANS.pro.yearlyPrice / 12)}
                  </span>
                  <span className="text-zinc-500 mb-1">/ month</span>
                </div>
                {billing === 'yearly' && (
                  <p className="text-xs text-zinc-500 mt-0.5">
                    ${PLANS.pro.yearlyPrice} billed annually
                  </p>
                )}
              </div>
              <ul className="space-y-2 mb-6">
                {PLANS.pro.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                    <span className="text-brand-400">✓</span> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={handleUpgrade}
                disabled={working}
                className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition-all hover:shadow-glow disabled:opacity-50"
              >
                {working ? 'Redirecting...' : `Upgrade to Pro`}
              </button>
            </div>
          </div>

          {/* Feature comparison */}
          <div className="rounded-xl border border-brand-500/10 bg-surface-secondary overflow-hidden">
            <div className="grid grid-cols-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider px-5 py-3 border-b border-brand-500/10 bg-surface-tertiary">
              <span>Feature</span>
              <span className="text-center">Free</span>
              <span className="text-center text-brand-400">Pro</span>
            </div>
            {FEATURES_COMPARE.map((row, i) => (
              <div
                key={row.label}
                className={`grid grid-cols-3 items-center px-5 py-3 text-sm ${i % 2 === 0 ? '' : 'bg-surface-tertiary/30'}`}
              >
                <span className="text-zinc-400">{row.label}</span>
                <span className="text-center"><Check ok={row.free} /></span>
                <span className="text-center"><Check ok={row.pro} /></span>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-zinc-600">
            Cancel anytime · No contracts · 30-day money-back guarantee
          </p>
        </>
      )}

      {/* Pro management section */}
      {isPro && (
        <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-6 space-y-4">
          <h3 className="text-base font-semibold text-zinc-200">Subscription Details</h3>
          <p className="text-sm text-zinc-500">
            Manage your payment method, download invoices, or cancel your subscription through the Stripe billing portal.
          </p>
          <button
            onClick={handleManage}
            disabled={working}
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-xl text-sm transition-all hover:shadow-glow disabled:opacity-50"
          >
            {working ? 'Opening portal...' : 'Open Billing Portal →'}
          </button>
        </div>
      )}
    </div>
  )
}
