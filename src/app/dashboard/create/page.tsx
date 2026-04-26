'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { CREATE_TOOLS, toolByKey } from '@/lib/tools-meta'
import { SkeletonGrid } from '@/components/ui/Skeleton'

interface RecentRow {
  id: string
  feature: string
  platform: string | null
  created_at: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  return `${weeks}w ago`
}

export default function CreateHubPage() {
  const [recent, setRecent] = useState<RecentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [usedToolKeys, setUsedToolKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const createKeys = CREATE_TOOLS.map((t) => t.key)
      const { data: rows } = await supabase
        .from('generations')
        .select('id, feature, platform, created_at')
        .eq('user_id', user.id)
        .in('feature', createKeys)
        .order('created_at', { ascending: false })
        .limit(8)

      const recentRows = (rows ?? []) as RecentRow[]
      setRecent(recentRows)
      setUsedToolKeys(new Set(recentRows.map((r) => r.feature)))
      setLoading(false)
    })()
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Create</h1>
          <span className="text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300 border border-brand-500/20">
            {CREATE_TOOLS.length} tools
          </span>
        </div>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Tools for authoring social content. Pick one based on what you need to ship —
          captions for a single post, scripts for a video, repurpose to stretch one piece across platforms.
        </p>
      </div>

      {/* Tool grid */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-300 mb-3">All Create tools</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CREATE_TOOLS.map((tool) => {
            const used = usedToolKeys.has(tool.key)
            return (
              <Link
                key={tool.key}
                href={tool.href}
                className="group rounded-xl border border-brand-500/10 bg-surface-secondary hover:border-brand-500/30 hover:bg-surface-elevated transition-all p-5 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-2xl flex-shrink-0">{tool.icon}</span>
                    <h3 className="text-base font-bold text-zinc-100 truncate">{tool.label}</h3>
                  </div>
                  {used && (
                    <span className="text-2xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex-shrink-0">
                      used
                    </span>
                  )}
                </div>
                <p className="text-sm text-zinc-300 leading-snug">{tool.tagline}</p>
                <div className="text-2xs text-zinc-500 leading-relaxed">
                  <span className="font-semibold text-zinc-400">Best for:</span> {tool.bestFor}
                </div>
                <div className="mt-auto pt-2 flex items-center justify-end text-xs text-zinc-500 group-hover:text-brand-300 transition-colors">
                  Open <span className="ml-1.5">→</span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Recent activity in this category */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-300">Your recent Create activity</h2>
          {recent.length > 0 && (
            <span className="text-2xs text-zinc-500">{recent.length} item{recent.length === 1 ? '' : 's'}</span>
          )}
        </div>

        {loading && <SkeletonGrid count={3} />}

        {!loading && recent.length === 0 && (
          <div className="rounded-xl border border-dashed border-brand-500/15 bg-surface-secondary/40 p-8 text-center">
            <p className="text-sm text-zinc-400">
              Nothing here yet. Pick a tool above and ship your first piece — it&apos;ll show up in this list.
            </p>
          </div>
        )}

        {!loading && recent.length > 0 && (
          <div className="space-y-2">
            {recent.map((row) => {
              const tool = toolByKey(row.feature)
              if (!tool) return null
              return (
                <Link
                  key={row.id}
                  href={`/dashboard/generations/${row.id}`}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-secondary border border-brand-500/10 hover:border-brand-500/25 hover:bg-surface-elevated transition-all group"
                >
                  <span className="text-lg flex-shrink-0">{tool.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-zinc-200 truncate">{tool.label}</div>
                    <div className="text-2xs text-zinc-500">
                      {row.platform ? `${row.platform} · ` : ''}{timeAgo(row.created_at)}
                    </div>
                  </div>
                  <span className="text-zinc-500 group-hover:text-brand-400 text-sm flex-shrink-0 transition-colors">
                    →
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
