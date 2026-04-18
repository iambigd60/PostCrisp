'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'

export const FREE_DAILY_LIMIT = 10

export function useUsage() {
  const [used, setUsed] = useState(0)
  const [tier, setTier] = useState<'free' | 'pro' | 'business'>('free')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('profiles')
      .select('daily_generations_used, daily_generations_reset_at, subscription_tier')
      .eq('id', user.id)
      .single()

    if (data) {
      const resetAt = new Date(data.daily_generations_reset_at)
      const isNewDay = resetAt.toDateString() !== new Date().toDateString()
      setUsed(isNewDay ? 0 : data.daily_generations_used)
      setTier(data.subscription_tier as 'free' | 'pro' | 'business')
    }
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const isPro = tier !== 'free'
  const limit = isPro ? Infinity : FREE_DAILY_LIMIT
  const remaining = isPro ? Infinity : Math.max(0, FREE_DAILY_LIMIT - used)
  const canGenerate = isPro || used < FREE_DAILY_LIMIT

  return { used, limit, remaining, canGenerate, loading, tier, isPro, refresh }
}
