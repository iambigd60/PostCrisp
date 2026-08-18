'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * Dashboard recovery for an unfinished first session.
 *
 * A CARD, not a middleware redirect: a hard gate would loop against the snooze,
 * add a profile query to every dashboard request, and trap users who chose to
 * defer.
 *
 * The count comes from the server, which reads the redemption ledger. The copy
 * says "free runs", never "credits" — these are session-only coupons, one per
 * feature, not a spendable balance.
 */

export function ResumeFirstSessionCard() {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/onboarding/free-runs')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && typeof data.remaining === 'number') setRemaining(data.remaining)
      } catch {
        // Silent: the card is still useful without the number.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
      <div>
        <div className="text-sm font-bold text-zinc-100">Finish your first pack</div>
        <p className="text-sm text-zinc-400 mt-1">
          {remaining && remaining > 0
            ? `You've still got ${remaining} free run${remaining === 1 ? '' : 's'} waiting — captions, hashtags and something to film, on us.`
            : 'Captions, hashtags and something to film — about a minute.'}
        </p>
      </div>
      <Link
        href="/onboarding"
        className="flex-shrink-0 rounded-lg bg-brand-500 hover:bg-brand-400 px-4 py-2 text-sm font-semibold text-white text-center transition-colors"
      >
        Pick up where I left off →
      </Link>
    </div>
  )
}
