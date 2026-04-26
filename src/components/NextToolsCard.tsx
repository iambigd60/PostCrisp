'use client'

import { useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

/**
 * Phase 2 of the onboarding arc. Once the user completes the 5-step tutorial,
 * this card appears on /dashboard and walks them through the next 10 highest-
 * impact tools. Auto-checks each item once a generation is recorded for that
 * feature in the generations table — no manual marking needed.
 *
 * Hides permanently when:
 *   - all 10 tools have been used at least once, OR
 *   - user dismisses the card (preferences.next_tools_dismissed = true)
 */

export interface NextToolsState {
  script: boolean
  repurpose: boolean
  channel_analysis: boolean
  trend_radar: boolean
  platform_tips: boolean
  bio_optimizer: boolean
  sound_tracker: boolean
  blog_to_social: boolean
  comment_reply: boolean
  brand_pitch: boolean
}

interface NextToolsCardProps {
  state: NextToolsState
  dismissed: boolean
  onDismiss?: () => void
}

interface Tool {
  key: keyof NextToolsState
  label: string
  description: string
  href: string
  icon: string
}

// Ranked by impact per ROADMAP. Order matters — top items get visual priority.
const TOOLS: Tool[] = [
  {
    key: 'script',
    label: 'Scripts',
    description: 'Outline a video or short — hook, beats, CTA, in seconds.',
    href: '/dashboard/scripts',
    icon: '🎬',
  },
  {
    key: 'repurpose',
    label: 'Repurpose',
    description: 'Turn one piece into 5 — feed in your post, get cross-platform variants.',
    href: '/dashboard/repurpose',
    icon: '♻️',
  },
  {
    key: 'channel_analysis',
    label: 'Channel Analysis',
    description: 'Honest audit of one of your channels — strengths, gaps, recommendations.',
    href: '/dashboard/channel-analysis',
    icon: '🪞',
  },
  {
    key: 'trend_radar',
    label: 'Trend Radar',
    description: 'What\'s spiking in your niche right now, and how to ride it.',
    href: '/dashboard/trends',
    icon: '📡',
  },
  {
    key: 'platform_tips',
    label: 'Platform Tips',
    description: 'Algorithm dynamics + best practices specific to each platform.',
    href: '/dashboard/platform-tips',
    icon: '💡',
  },
  {
    key: 'bio_optimizer',
    label: 'Bio Optimizer',
    description: 'Rewrite your profile bio to convert visitors into followers.',
    href: '/dashboard/bio-optimizer',
    icon: '🧬',
  },
  {
    key: 'sound_tracker',
    label: 'Sound Tracker',
    description: 'Trending sounds for TikTok and Reels — picked for your niche.',
    href: '/dashboard/sounds',
    icon: '🎵',
  },
  {
    key: 'blog_to_social',
    label: 'Blog → Social',
    description: 'Drop in a long-form article, get a thread + carousel + 3 captions.',
    href: '/dashboard/blog-to-social',
    icon: '📰',
  },
  {
    key: 'comment_reply',
    label: 'Comment Replies',
    description: 'Three reply variants tuned to engagement, not just acknowledgment.',
    href: '/dashboard/comment-replies',
    icon: '💬',
  },
  {
    key: 'brand_pitch',
    label: 'Brand Pitch',
    description: 'Outreach pitch tailored to a brand — formal + casual versions + follow-up.',
    href: '/dashboard/brand-pitch',
    icon: '📧',
  },
]

export function NextToolsCard({ state, dismissed, onDismiss }: NextToolsCardProps) {
  const [hiding, setHiding] = useState(false)
  const completedCount = TOOLS.filter((t) => state[t.key]).length
  const allDone = completedCount === TOOLS.length

  if (dismissed || allDone) return null

  const handleDismiss = async () => {
    if (!window.confirm('Hide this list? Every tool stays available from the sidebar.')) return
    setHiding(true)
    try {
      await apiFetch('/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify({ next_tools_dismissed: true }),
      })
      onDismiss?.()
    } catch {
      onDismiss?.()
    } finally {
      setHiding(false)
    }
  }

  const pct = Math.round((completedCount / TOOLS.length) * 100)

  return (
    <div className="rounded-xl border border-brand-500/15 bg-surface-secondary p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-zinc-100">
              <span className="mr-1.5">🔓</span>
              {completedCount === 0 ? 'Ten more tools to explore' : 'Keep exploring'}
            </h2>
            <span className="text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300 border border-brand-500/20">
              {completedCount} of {TOOLS.length}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            You&apos;ve cleared the basics. These are the highest-impact tools left to try — your pace.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          disabled={hiding}
          className="text-xs text-zinc-500 hover:text-zinc-300 flex-shrink-0"
          title="Hide this list permanently"
        >
          Hide
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Tools grid — 2 columns on sm+ to keep the card from getting too tall */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {TOOLS.map((tool) => {
          const done = state[tool.key]
          return (
            <Link
              key={tool.key}
              href={tool.href}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-all group ${
                done
                  ? 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10'
                  : 'border-brand-500/10 bg-surface-tertiary/40 hover:border-brand-500/25 hover:bg-surface-tertiary/70'
              }`}
            >
              <div
                className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 transition-colors ${
                  done
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-surface-primary text-zinc-500 border border-brand-500/20'
                }`}
              >
                {done ? '✓' : tool.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold ${done ? 'text-emerald-300 line-through decoration-emerald-500/30' : 'text-zinc-200'}`}>
                  {tool.label}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5 leading-snug">{tool.description}</div>
              </div>
              {!done && (
                <span className="text-zinc-500 group-hover:text-brand-400 text-sm flex-shrink-0 mt-1 transition-colors">
                  →
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
