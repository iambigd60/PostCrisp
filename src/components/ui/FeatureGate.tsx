'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { tierFromDbValue, TIER_LABELS, type CrispTask, type Tier } from '@/lib/crisp-engine-config'
import { DEFAULT_MIN_TIER } from '@/lib/feature-access-config'

const TIER_RANK: Record<Tier, number> = {
  starter: 0,
  creator: 1,
  team:    1,
  elite:   2,
}

interface FeatureGateProps {
  feature: CrispTask
  featureLabel: string
  featureIcon?: string
  featureTagline?: string
  valueProps?: string[]
  children: React.ReactNode
}

/**
 * Wraps a feature page. If the current user's subscription tier is below the
 * feature's minimum, renders a ghosted preview of the real UI with an upgrade
 * CTA overlay. Otherwise renders children normally.
 *
 * The real API still enforces the gate — this is purely UX.
 */
export function FeatureGate({ feature, featureLabel, featureIcon, featureTagline, valueProps, children }: FeatureGateProps) {
  const [tier, setTier] = useState<Tier | null>(null)
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !mounted) { setLoading(false); return }
      const { data } = await supabase
        .from('profiles')
        .select('subscription_tier, role')
        .eq('id', user.id)
        .maybeSingle()
      if (mounted) {
        setTier(tierFromDbValue(data?.subscription_tier))
        setRole(data?.role === 'admin' ? 'admin' : 'user')
        setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const minTier = DEFAULT_MIN_TIER[feature]

  // Loading: render children (invisible) to keep layout stable; gate flashes in if needed
  if (loading) {
    return <div className="opacity-0 pointer-events-none">{children}</div>
  }

  // Admins bypass everything. Users at or above min_tier see normal content.
  const isUnlocked = role === 'admin' || (tier && TIER_RANK[tier] >= TIER_RANK[minTier])
  if (isUnlocked) {
    return <>{children}</>
  }

  // Locked: ghost children + overlay upgrade CTA
  return (
    <div className="relative">
      {/* Ghosted children */}
      <div
        className="pointer-events-none select-none opacity-30 blur-[1px]"
        aria-hidden
      >
        {children}
      </div>

      {/* CTA overlay — centered, blocks interaction with ghosted UI underneath */}
      <div className="absolute inset-0 flex items-start justify-center pt-20 sm:pt-32 pointer-events-none">
        <div className="pointer-events-auto max-w-lg w-full mx-4 rounded-2xl border border-brand-500/30 bg-gradient-to-br from-surface-elevated to-surface-secondary p-6 sm:p-8 shadow-glow-lg">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-2xl shadow-glow flex-shrink-0">
              {featureIcon ?? '🔒'}
            </div>
            <div className="flex-1">
              <span className="inline-block text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20 mb-2">
                {TIER_LABELS[minTier]}+ feature
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-zinc-100">{featureLabel}</h2>
              {featureTagline && <p className="text-sm text-zinc-400 mt-1">{featureTagline}</p>}
            </div>
          </div>

          {valueProps && valueProps.length > 0 && (
            <ul className="space-y-2 mb-6">
              {valueProps.map((v, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                  <span className="text-emerald-400 flex-shrink-0">✓</span>
                  <span>{v}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <Link
              href="/dashboard/billing"
              className="flex-1 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-center text-sm transition-all hover:shadow-glow"
            >
              Upgrade to {TIER_LABELS[minTier]} →
            </Link>
            <Link
              href="/dashboard"
              className="flex-1 py-3 rounded-xl border border-brand-500/20 text-zinc-300 hover:bg-surface-hover font-medium text-center text-sm transition-colors"
            >
              Maybe later
            </Link>
          </div>

          <p className="text-xs text-zinc-500 text-center mt-4">
            Cancel anytime · 30-day money-back guarantee
          </p>
        </div>
      </div>
    </div>
  )
}
