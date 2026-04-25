'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSubscription } from '@/hooks/useSubscription'
import { PLANS, PRICES } from '@/lib/stripe'
import { useToast } from '@/components/ui/Toast'
import { TIER_LABELS, CREDIT_PACKS, type Tier, type CreditPack } from '@/lib/crisp-engine-config'

type PaidTier = 'creator' | 'team' | 'elite'

const FEATURES_COMPARE: { label: string; starter: boolean | string; creator: boolean | string; team: boolean | string; elite: boolean | string }[] = [
  { label: 'AI generations / day',         starter: '10',           creator: 'Unlimited',    team: 'Unlimited',      elite: 'Unlimited' },
  { label: 'PostCrisp Engine tier',            starter: 'Starter',      creator: 'Pro',          team: 'Pro',            elite: 'Elite' },
  { label: 'Caption generator',            starter: true,           creator: true,           team: true,             elite: true },
  { label: 'Hashtag finder',               starter: true,           creator: true,           team: true,             elite: true },
  { label: 'Best posting times',           starter: true,           creator: true,           team: true,             elite: true },
  { label: 'Viral ideas generator',        starter: true,           creator: true,           team: true,             elite: true },
  { label: 'Premium AI on monetization',   starter: false,          creator: true,           team: true,             elite: true },
  { label: 'Premium AI on all features',   starter: false,          creator: false,          team: false,            elite: true },
  { label: 'Saved content library',        starter: '25 items',     creator: 'Unlimited',    team: 'Unlimited',      elite: 'Unlimited' },
  { label: 'Team seats',                   starter: '1',            creator: '1',            team: 'Up to 5',        elite: '1' },
  { label: 'Priority support',             starter: false,          creator: true,           team: true,             elite: 'Concierge' },
]

function Check({ ok }: { ok: boolean | string }) {
  if (typeof ok === 'string') return <span className="text-zinc-200 font-medium text-xs">{ok}</span>
  return ok
    ? <span className="text-emerald-400">✓</span>
    : <span className="text-zinc-600">—</span>
}

const tierTheme: Record<Tier, { ring: string; glow: string; accent: string; icon: string }> = {
  starter: { ring: 'border-brand-500/10', glow: '', accent: 'text-zinc-300', icon: '🆓' },
  creator: { ring: 'border-brand-500/40', glow: 'shadow-glow', accent: 'text-brand-300', icon: '⚡' },
  team:    { ring: 'border-sky-500/40',   glow: '',            accent: 'text-sky-300',   icon: '👥' },
  elite:   { ring: 'border-amber-500/40', glow: 'shadow-glow', accent: 'text-amber-300', icon: '👑' },
}

export default function BillingPage() {
  const { tier, loading, isPaid, upgrade, manage } = useSubscription()
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [working, setWorking] = useState<PaidTier | null>(null)
  const searchParams = useSearchParams()
  const { addToast } = useToast()

  const [buyingPack, setBuyingPack] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      addToast('🎉 Welcome to PostCrisp! Your subscription is active.', 'success')
    }
    const creditsAdded = searchParams.get('credits_added')
    if (creditsAdded) {
      addToast(`🎉 ${creditsAdded} credits added to your account!`, 'success')
    }
  }, [searchParams, addToast])

  const handleBuyPack = async (pack: CreditPack) => {
    setBuyingPack(pack.id)
    try {
      const res = await fetch('/api/stripe/credit-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: pack.id }),
      })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      if (url) window.location.href = url
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to start checkout', 'error')
      setBuyingPack(null)
    }
  }

  // Client-side check is for UX only — surface the "not configured" toast
  // before round-tripping. The server is authoritative on which tier maps
  // to which Stripe price ID.
  const isConfigured = (target: PaidTier): boolean => {
    if (target === 'creator') return !!(billing === 'monthly' ? PRICES.creator_monthly : PRICES.creator_yearly)
    if (target === 'team')    return !!(billing === 'monthly' ? PRICES.team_monthly    : PRICES.team_yearly)
    if (target === 'elite')   return !!(billing === 'monthly' ? PRICES.elite_monthly   : PRICES.elite_yearly)
    return false
  }

  const handleUpgrade = async (target: PaidTier) => {
    if (!isConfigured(target)) {
      addToast(`${TIER_LABELS[target]} is not yet configured in Stripe.`, 'warning')
      return
    }
    setWorking(target)
    try {
      await upgrade(target, billing)
    } catch {
      addToast('Failed to start checkout. Please try again.', 'error')
      setWorking(null)
    }
  }

  const handleManage = async () => {
    setWorking('creator')
    try {
      await manage()
    } catch {
      addToast('Failed to open billing portal. Please try again.', 'error')
      setWorking(null)
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

  const currentPlan = PLANS[tier]
  const theme = tierTheme[tier]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Billing &amp; Subscription</h1>
        <p className="text-zinc-500 mt-1">Manage your PostCrisp plan.</p>
      </div>

      {/* Current plan */}
      <div className={`rounded-xl border bg-surface-secondary p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${theme.ring}`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-gradient-to-br ${
            tier === 'starter' ? 'from-zinc-700 to-zinc-800' :
            tier === 'creator' ? 'from-brand-500 to-brand-700' :
            tier === 'team'    ? 'from-sky-500 to-sky-700' :
                                 'from-amber-500 to-amber-700'
          } ${theme.glow}`}>
            {theme.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-100">{currentPlan.name} Plan</h2>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isPaid ? `bg-opacity-20 ${theme.accent}` : 'bg-zinc-700/50 text-zinc-400'}`} style={isPaid ? { backgroundColor: 'rgba(74,158,224,0.18)' } : undefined}>
                {isPaid ? 'Active' : 'Free tier'}
              </span>
            </div>
            <p className="text-sm text-zinc-500 mt-0.5">
              {currentPlan.tagline} · {currentPlan.engine}
            </p>
          </div>
        </div>
        {isPaid && (
          <button
            onClick={handleManage}
            disabled={!!working}
            className={`flex-shrink-0 px-4 py-2 rounded-lg border hover:bg-opacity-10 text-sm font-medium transition-colors disabled:opacity-50 ${theme.ring} ${theme.accent}`}
          >
            {working ? 'Opening...' : 'Manage Subscription'}
          </button>
        )}
      </div>

      {/* Upgrade section — only for non-Elite users (can always upgrade) */}
      {tier !== 'elite' && (
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

          {/* Pricing cards — 4 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Starter */}
            <PricingCard
              planKey="starter"
              billing={billing}
              isCurrent={tier === 'starter'}
              cta={tier === 'starter' ? 'Current plan' : undefined}
              disabled
            />

            {/* Creator — POPULAR */}
            <PricingCard
              planKey="creator"
              billing={billing}
              isCurrent={tier === 'creator'}
              popular
              cta={tier === 'creator' ? 'Current plan' : 'Upgrade to Creator'}
              onClick={tier === 'creator' ? undefined : () => handleUpgrade('creator')}
              working={working === 'creator'}
            />

            {/* Team */}
            <PricingCard
              planKey="team"
              billing={billing}
              isCurrent={tier === 'team'}
              cta={tier === 'team' ? 'Current plan' : 'Upgrade to Team'}
              onClick={tier === 'team' ? undefined : () => handleUpgrade('team')}
              working={working === 'team'}
            />

            {/* Elite */}
            <PricingCard
              planKey="elite"
              billing={billing}
              isCurrent={false}
              premium
              cta="Upgrade to Elite"
              onClick={() => handleUpgrade('elite')}
              working={working === 'elite'}
            />
          </div>

          {/* Feature comparison */}
          <div className="rounded-xl border border-brand-500/10 bg-surface-secondary overflow-hidden overflow-x-auto">
            <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr_1fr] text-xs font-semibold text-zinc-500 uppercase tracking-wider px-5 py-3 border-b border-brand-500/10 bg-surface-tertiary min-w-[720px]">
              <span>Feature</span>
              <span className="text-center">Starter</span>
              <span className="text-center text-brand-400">Creator</span>
              <span className="text-center text-sky-400">Team</span>
              <span className="text-center text-amber-400">Elite</span>
            </div>
            {FEATURES_COMPARE.map((row, i) => (
              <div
                key={row.label}
                className={`grid grid-cols-[1.6fr_1fr_1fr_1fr_1fr] items-center px-5 py-3 text-sm min-w-[720px] ${i % 2 === 0 ? '' : 'bg-surface-tertiary/30'}`}
              >
                <span className="text-zinc-400">{row.label}</span>
                <span className="text-center"><Check ok={row.starter} /></span>
                <span className="text-center"><Check ok={row.creator} /></span>
                <span className="text-center"><Check ok={row.team} /></span>
                <span className="text-center"><Check ok={row.elite} /></span>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-zinc-600">
            Cancel anytime · No contracts · 30-day money-back guarantee
          </p>
        </>
      )}

      {/* Credit packs — always visible, top up any tier */}
      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">Top up credits</h2>
            <p className="text-xs text-zinc-500 mt-0.5">One-time credit packs. Never expire.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CREDIT_PACKS.map((pack) => {
            const dollarsPerCredit = (pack.priceDollars / pack.credits).toFixed(3)
            const isBest = pack.id === 'large'
            return (
              <div
                key={pack.id}
                className={`rounded-xl border p-5 ${isBest ? 'border-brand-500/40 bg-gradient-to-b from-brand-900/10 to-surface-secondary' : 'border-brand-500/10 bg-surface-secondary'} relative`}
              >
                {isBest && (
                  <span className="absolute top-3 right-3 bg-brand-600 text-white text-2xs font-bold px-2 py-0.5 rounded-full">BEST VALUE</span>
                )}
                <div className="text-3xl font-extrabold text-zinc-100">{pack.credits}</div>
                <div className="text-xs text-zinc-500 mt-0.5">credits</div>
                <div className="text-xl font-bold text-brand-300 mt-3">${pack.priceDollars}</div>
                <div className="text-2xs text-zinc-600">${dollarsPerCredit} / credit</div>
                <button
                  onClick={() => handleBuyPack(pack)}
                  disabled={buyingPack !== null}
                  className={`w-full mt-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 ${isBest ? 'bg-brand-600 hover:bg-brand-500 text-white' : 'bg-surface-elevated hover:bg-surface-hover text-zinc-200 border border-brand-500/20'}`}
                >
                  {buyingPack === pack.id ? 'Redirecting...' : 'Buy now'}
                </button>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-zinc-600">
          💡 Credit packs stack on top of your monthly allowance and never expire. Great for heavy project months.
        </p>
      </div>

      {/* Elite management section (you're at the top — nothing to upgrade to) */}
      {tier === 'elite' && (
        <div className="rounded-xl border border-amber-500/20 bg-surface-secondary p-6 space-y-4">
          <h3 className="text-base font-semibold text-amber-200">👑 You&apos;re on Elite — highest tier</h3>
          <p className="text-sm text-zinc-500">
            You have access to every feature at PostCrisp Engine Elite quality. Manage payment method, download invoices, or cancel through the Stripe billing portal.
          </p>
          <button
            onClick={handleManage}
            disabled={!!working}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-xl text-sm transition-all disabled:opacity-50"
          >
            {working ? 'Opening portal...' : 'Open Billing Portal →'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Pricing card component ─────────────────────────────────────────────────

interface PricingCardProps {
  planKey: Tier
  billing: 'monthly' | 'yearly'
  isCurrent?: boolean
  popular?: boolean
  premium?: boolean
  disabled?: boolean
  cta?: string
  onClick?: () => void
  working?: boolean
}

function PricingCard({ planKey, billing, isCurrent, popular, premium, disabled, cta, onClick, working }: PricingCardProps) {
  const plan = PLANS[planKey]
  const isPaid = 'monthlyPrice' in plan
  const monthlyPrice = isPaid ? (billing === 'monthly' ? plan.monthlyPrice : Math.round(plan.yearlyPrice / 12)) : 0
  const yearlyPrice = isPaid ? plan.yearlyPrice : 0

  const cardClasses = premium
    ? 'border-amber-500/40 bg-gradient-to-b from-amber-900/20 to-surface-secondary'
    : popular
    ? 'border-brand-500/40 bg-gradient-to-b from-brand-900/20 to-surface-secondary'
    : 'border-brand-500/10 bg-surface-secondary'

  const ctaClasses = premium
    ? 'bg-amber-600 hover:bg-amber-500 text-white hover:shadow-glow'
    : popular
    ? 'bg-brand-600 hover:bg-brand-500 text-white hover:shadow-glow'
    : 'bg-surface-elevated hover:bg-surface-hover text-zinc-200 border border-brand-500/20'

  return (
    <div className={`rounded-2xl border p-6 relative overflow-hidden flex flex-col ${cardClasses}`}>
      {popular && (
        <div className="absolute top-3 right-3 bg-brand-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          POPULAR
        </div>
      )}
      {premium && (
        <div className="absolute top-3 right-3 bg-amber-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          PREMIUM
        </div>
      )}
      <div className="mb-4">
        <h3 className="text-lg font-bold text-zinc-100">{plan.name}</h3>
        <p className="text-xs text-zinc-500 mt-0.5">{plan.tagline}</p>
        <div className="mt-3 flex items-end gap-1">
          <span className="text-3xl font-extrabold text-zinc-100">${monthlyPrice}</span>
          <span className="text-zinc-500 mb-1">/ mo</span>
        </div>
        {isPaid && billing === 'yearly' && (
          <p className="text-xs text-zinc-500 mt-0.5">${yearlyPrice} billed annually</p>
        )}
      </div>
      <ul className="space-y-2 mb-6 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
            <span className={premium ? 'text-amber-400' : popular ? 'text-brand-400' : 'text-emerald-400'}>✓</span>
            <span className="flex-1">{f}</span>
          </li>
        ))}
      </ul>
      {cta && (
        <button
          onClick={onClick}
          disabled={disabled || isCurrent || !onClick || working}
          className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed ${isCurrent ? 'bg-surface-elevated text-zinc-400' : ctaClasses}`}
        >
          {working ? 'Redirecting...' : cta}
        </button>
      )}
    </div>
  )
}
