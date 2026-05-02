'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { tierFromDbValue, type Tier } from '@/lib/crisp-engine-config'

export function useSubscription() {
  const [tier, setTier] = useState<Tier>('starter')
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

    if (data) setTier(tierFromDbValue(data.subscription_tier))
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const upgrade = async (target: 'creator' | 'elite', cycle: 'monthly' | 'yearly') => {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: target, cycle }),
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

  const isPaid = tier !== 'starter'

  return {
    tier,
    loading,
    isPaid,
    isCreator: tier === 'creator',
    isElite: tier === 'elite',
    // Back-compat alias — some components still check `isPro`. "Pro" now means "any paid tier."
    isPro: isPaid,
    upgrade,
    manage,
    refresh,
  }
}
