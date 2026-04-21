'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

type Status = 'new' | 'in_progress' | 'resolved'
type Category = 'bug' | 'feature' | 'general'

interface FeedbackEntry {
  id: string
  message: string
  category: Category | null
  status: Status
  created_at: string
  user: { email: string; full_name: string | null } | null
}

interface ListResponse {
  feedback: FeedbackEntry[]
  total: number
}

const STATUS_COLOR: Record<Status, string> = {
  new:         'bg-sky-500/15 text-sky-300 border-sky-500/20',
  in_progress: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  resolved:    'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
}

const CATEGORY_ICON: Record<Category, string> = {
  bug: '🐛',
  feature: '💡',
  general: '💬',
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export function FeedbackOverviewWidget() {
  const [latest, setLatest] = useState<FeedbackEntry[] | null>(null)
  const [newCount, setNewCount] = useState(0)

  useEffect(() => {
    // One fetch for the latest 5 entries regardless of status…
    apiFetch<ListResponse>('/api/admin/feedback?page=1').then((res) => {
      setLatest(res.feedback.slice(0, 5))
    }).catch(() => setLatest([]))

    // …and a second fetch just to get the count of status=new (more reliable
    // than filtering client-side since pagination might hide older new items).
    apiFetch<ListResponse>('/api/admin/feedback?status=new&page=1').then((res) => {
      setNewCount(res.total)
    }).catch(() => setNewCount(0))
  }, [])

  const loading = latest === null

  return (
    <Link
      href="/admin/feedback"
      className="block p-5 rounded-xl border border-brand-500/20 bg-surface-secondary hover:border-brand-500/40 hover:bg-surface-elevated transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            💬 Feedback
            {newCount > 0 && (
              <span className="text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/20">
                {newCount} new
              </span>
            )}
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            {newCount === 0 && !loading
              ? 'All caught up — nothing new.'
              : `Latest submissions from testers.`}
          </p>
        </div>
        <span className="text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity text-sm">
          View all →
        </span>
      </div>

      {loading && <div className="h-20 rounded-lg bg-surface-tertiary/50 animate-pulse" />}

      {!loading && latest && latest.length === 0 && (
        <div className="rounded-lg bg-surface-tertiary/30 p-6 text-center text-xs text-zinc-500">
          No feedback yet. When testers submit, it&apos;ll show up here.
        </div>
      )}

      {!loading && latest && latest.length > 0 && (
        <div className="space-y-2">
          {latest.map((f) => (
            <div key={f.id} className="flex items-start gap-3 p-3 rounded-lg bg-surface-tertiary/40 hover:bg-surface-tertiary/70 transition-colors">
              <span className={`text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex-shrink-0 mt-0.5 ${STATUS_COLOR[f.status]}`}>
                {f.status === 'in_progress' ? 'WIP' : f.status}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {f.category && <span className="text-xs">{CATEGORY_ICON[f.category]}</span>}
                  <span className="text-xs text-zinc-500 truncate">
                    {f.user?.email ?? '(anonymous)'}
                  </span>
                  <span className="text-xs text-zinc-600 flex-shrink-0">· {relativeTime(f.created_at)}</span>
                </div>
                <p className="text-sm text-zinc-200 line-clamp-2">{f.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Link>
  )
}
