'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { tierFromDbValue, TIER_BADGE_LABEL, type Tier } from '@/lib/crisp-engine-config'

/**
 * Small badge that labels content as powered by Crisp Engine / Pro / Elite
 * based on the current user's subscription tier. Render it above or near
 * AI-generated results so users see the tier as a product benefit.
 *
 * Fetches the user's tier once on mount and caches in a module-level var
 * so we don't hit Supabase on every feature page load.
 */

let cachedTier: Tier | null = null

export function EngineBadge({ className = '' }: { className?: string }) {
  const [tier, setTier] = useState<Tier | null>(cachedTier)

  useEffect(() => {
    if (cachedTier) return
    let mounted = true
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !mounted) return
      const { data } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .maybeSingle()
      const resolved = tierFromDbValue(data?.subscription_tier)
      cachedTier = resolved
      if (mounted) setTier(resolved)
    })()
    return () => { mounted = false }
  }, [])

  if (!tier) return null

  const label = TIER_BADGE_LABEL[tier]
  const themed =
    tier === 'elite'   ? 'bg-amber-500/10 border-amber-500/25 text-amber-300' :
    tier === 'creator' ? 'bg-brand-500/10 border-brand-500/25 text-brand-300' :
    tier === 'team'    ? 'bg-brand-500/10 border-brand-500/25 text-brand-300' :
                          'bg-zinc-500/10 border-zinc-500/20 text-zinc-400'

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-2xs font-medium ${themed} ${className}`}
      title={`This generation was produced by ${label}`}
    >
      <span className="text-sm">🧠</span>
      <span>{label}</span>
    </span>
  )
}
