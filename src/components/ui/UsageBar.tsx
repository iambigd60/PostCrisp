'use client'

import { useUsage, FREE_DAILY_LIMIT } from '@/hooks/useUsage'

export function UsageBar() {
  const { used, isPro, loading } = useUsage()

  if (loading) return null

  if (isPro) {
    return (
      <div className="px-3 py-2 rounded-lg bg-brand-500/10 border border-brand-500/20">
        <p className="text-xs text-brand-400 font-medium">Pro — Unlimited</p>
      </div>
    )
  }

  const pct = Math.min(100, (used / FREE_DAILY_LIMIT) * 100)
  const color = pct >= 90 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
  const textColor = pct >= 90 ? 'text-red-400' : pct >= 60 ? 'text-amber-400' : 'text-zinc-400'

  return (
    <div className="px-3 py-2 space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs text-zinc-500">Daily usage</span>
        <span className={`text-xs font-medium ${textColor}`}>{used} / {FREE_DAILY_LIMIT}</span>
      </div>
      <div className="h-1.5 w-full bg-surface-primary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
