'use client'

import Link from 'next/link'
import { FREE_DAILY_LIMIT } from '@/hooks/useUsage'

interface UpgradePromptProps {
  compact?: boolean
}

export function UpgradePrompt({ compact = false }: UpgradePromptProps) {
  if (compact) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-amber-300">Daily limit reached</p>
          <p className="text-xs text-zinc-500 mt-0.5">You&apos;ve used all {FREE_DAILY_LIMIT} free generations today.</p>
        </div>
        <Link
          href="/dashboard/billing"
          className="flex-shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold rounded-lg transition-colors"
        >
          Upgrade
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-brand-500/20 bg-surface-secondary p-6 sm:p-8 text-center space-y-6">
      <div>
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-2xl mx-auto mb-4">
          ⚡
        </div>
        <h3 className="text-xl font-bold text-zinc-100">You&apos;ve hit today&apos;s limit</h3>
        <p className="text-zinc-400 mt-2 text-sm">
          Free plan includes {FREE_DAILY_LIMIT} AI generations per day. Upgrade to Pro for unlimited access.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm text-left">
        {[
          ['Generations / day', '10', 'Unlimited'],
          ['Save content', '✗', '✓'],
          ['All features', '✓', '✓'],
          ['Priority support', '✗', '✓'],
        ].map(([feature, free, pro]) => (
          <div key={feature} className="contents">
            <div className="col-span-2 grid grid-cols-3 items-center gap-2 py-2 border-b border-brand-500/10">
              <span className="text-zinc-500">{feature}</span>
              <span className="text-center text-zinc-500">{free}</span>
              <span className="text-center text-brand-400 font-medium">{pro}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/dashboard/billing"
          className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl transition-all hover:shadow-glow text-center"
        >
          Upgrade to Pro — $19/mo
        </Link>
        <p className="text-xs text-zinc-600 self-center">Resets at midnight</p>
      </div>
    </div>
  )
}
