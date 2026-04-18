'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'

export type SubscriptionTier = 'free' | 'pro' | 'business'

export function useSubscription() {
  const [tier, setTier] = useState<SubscriptionTier>('free')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()

    if (data) setTier(data.subscription_tier as SubscriptionTier)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const upgrade = async (priceId: string) => {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId }),
    })
    const { url, error } = await res.json()
    if (error) throw new Error(error)
    if (url) window.location.href = url
  }

  const manage = async () => {
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const { url, error } = await res.json()
    if (error) throw new Error(error)
    if (url) window.location.href = url
  }

  return { tier, loading, isPro: tier !== 'free', upgrade, manage, refresh }
}
