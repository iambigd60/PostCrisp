'use client'

import { useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

export interface GettingStartedState {
  channelsAdded: boolean
  firstGeneration: boolean
  savedSomething: boolean
  triedThreeFeatures: boolean
  voiceTrained: boolean
}

interface GettingStartedCardProps {
  state: GettingStartedState
  dismissed: boolean
  onDismiss?: () => void
}

interface Step {
  key: keyof GettingStartedState
  label: string
  description: string
  href: string
  icon: string
}

const STEPS: Step[] = [
  {
    key: 'channelsAdded',
    label: 'Add your channels',
    description: 'Tell PostCrisp which platforms you post on.',
    href: '/dashboard/settings',
    icon: '🧭',
  },
  {
    key: 'firstGeneration',
    label: 'Generate your first content',
    description: 'Captions, Viral Ideas, anything — get your first output.',
    href: '/dashboard/generate',
    icon: '✍️',
  },
  {
    key: 'savedSomething',
    label: 'Save something to your library',
    description: 'Hit Save on a caption, bio, or idea you want to keep.',
    href: '/dashboard/saved',
    icon: '💾',
  },
  {
    key: 'triedThreeFeatures',
    label: 'Try 3 different features',
    description: 'Mix of Create, Optimize, and Grow tools.',
    href: '/dashboard',
    icon: '🛠️',
  },
  {
    key: 'voiceTrained',
    label: 'Train your writing voice',
    description: 'Paste 3+ captions you\'ve written — every generation matches your style after.',
    href: '/dashboard/voice',
    icon: '🎙️',
  },
]

export function GettingStartedCard({ state, dismissed, onDismiss }: GettingStartedCardProps) {
  const [hiding, setHiding] = useState(false)
  const completedCount = STEPS.filter((s) => state[s.key]).length
  const allDone = completedCount === STEPS.length

  // If user already dismissed this, or they've completed everything, don't render.
  if (dismissed || allDone) return null

  const handleDismiss = async () => {
    if (!window.confirm('Hide this checklist? You can still use every feature from the sidebar.')) return
    setHiding(true)
    try {
      await apiFetch('/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify({ getting_started_dismissed: true }),
      })
      onDismiss?.()
    } catch {
      // Non-fatal — optimistically hide in the parent
      onDismiss?.()
    } finally {
      setHiding(false)
    }
  }

  const pct = Math.round((completedCount / STEPS.length) * 100)

  return (
    <div className="rounded-xl border border-brand-500/15 bg-surface-secondary p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-zinc-100">Getting Started</h2>
            <span className="text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300 border border-brand-500/20">
              {completedCount} of {STEPS.length}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Five moves to get the most out of PostCrisp. Takes about ten minutes total.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          disabled={hiding}
          className="text-xs text-zinc-500 hover:text-zinc-300 flex-shrink-0"
          title="Hide this checklist permanently"
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

      {/* Steps */}
      <div className="space-y-1.5">
        {STEPS.map((step) => {
          const done = state[step.key]
          return (
            <Link
              key={step.key}
              href={step.href}
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
                {done ? '✓' : step.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold ${done ? 'text-emerald-300 line-through decoration-emerald-500/30' : 'text-zinc-200'}`}>
                  {step.label}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">{step.description}</div>
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
