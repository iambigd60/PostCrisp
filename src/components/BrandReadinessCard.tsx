'use client'

import Link from 'next/link'
import type { BrsResult, BrsGrade } from '@/lib/brand-readiness'

interface Props {
  result: BrsResult
}

const GRADE_COLOR: Record<BrsGrade, { text: string; bg: string; border: string }> = {
  A: { text: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  B: { text: 'text-brand-300',   bg: 'bg-brand-500/15',   border: 'border-brand-500/30'   },
  C: { text: 'text-amber-300',   bg: 'bg-amber-500/15',   border: 'border-amber-500/30'   },
  D: { text: 'text-orange-300',  bg: 'bg-orange-500/15',  border: 'border-orange-500/30'  },
  F: { text: 'text-red-300',     bg: 'bg-red-500/15',     border: 'border-red-500/30'     },
}

const GRADE_HEADLINE: Record<BrsGrade, string> = {
  A: 'Brand-ready',
  B: 'On track',
  C: 'Building momentum',
  D: 'Getting started',
  F: 'Just signed up',
}

function dimensionBarColor(status: 'unset' | 'developing' | 'strong'): string {
  if (status === 'strong') return 'from-emerald-500 to-emerald-400'
  if (status === 'developing') return 'from-brand-500 to-brand-400'
  return 'from-zinc-600 to-zinc-500'
}

export function BrandReadinessCard({ result }: Props) {
  const grade = GRADE_COLOR[result.grade]

  return (
    <div className="rounded-xl border border-brand-500/15 bg-surface-secondary p-5 sm:p-6 space-y-5">
      {/* Header — score + grade */}
      <div className="flex items-start gap-5">
        <div className={`flex-shrink-0 w-20 h-20 rounded-2xl flex flex-col items-center justify-center border ${grade.border} ${grade.bg}`}>
          <div className={`text-3xl font-bold leading-none ${grade.text}`}>{result.grade}</div>
          <div className="text-2xs uppercase tracking-wider text-zinc-500 mt-1.5 tabular-nums">
            {result.score}/100
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-zinc-100">Brand Readiness Score</h2>
            <span className={`text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${grade.border} ${grade.bg} ${grade.text}`}>
              {GRADE_HEADLINE[result.grade]}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
            How brand-ready you look right now. Higher score = stronger pitches, faster wins, more reasons brands say yes.
          </p>
        </div>
      </div>

      {/* Dimension bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {result.dimensions.map((dim) => {
          const pct = dim.max > 0 ? Math.round((dim.score / dim.max) * 100) : 0
          return (
            <Link
              key={dim.key}
              href={dim.href}
              className="rounded-lg border border-brand-500/10 bg-surface-tertiary/40 hover:border-brand-500/25 hover:bg-surface-tertiary/70 p-3 transition-all"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-semibold text-zinc-200">{dim.label}</div>
                <span className="text-2xs text-zinc-500 tabular-nums font-semibold">
                  {dim.score}<span className="text-zinc-600">/{dim.max}</span>
                </span>
              </div>
              <div className="h-1.5 bg-surface-primary rounded-full overflow-hidden mb-1.5">
                <div
                  className={`h-full bg-gradient-to-r ${dimensionBarColor(dim.status)} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-2xs text-zinc-500 leading-snug">{dim.reason}</p>
            </Link>
          )
        })}
      </div>

      {/* Top actions to raise the score */}
      {result.actions.length > 0 && (
        <div className="rounded-lg border border-brand-500/15 bg-brand-500/5 p-4">
          <div className="text-2xs font-bold uppercase tracking-wider text-brand-300 mb-2">
            Highest-leverage moves to raise your score
          </div>
          <div className="space-y-1.5">
            {result.actions.map((action, i) => (
              <Link
                key={i}
                href={action.href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-primary/60 hover:bg-surface-primary border border-transparent hover:border-brand-500/30 transition-all group"
              >
                <span
                  className={`text-2xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border flex-shrink-0 ${
                    action.priority === 'high'
                      ? 'bg-red-500/15 text-red-300 border-red-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}
                >
                  +{action.expectedPoints}
                </span>
                <span className="text-sm text-zinc-200 flex-1 truncate">{action.label}</span>
                <span className="text-zinc-500 group-hover:text-brand-400 text-sm flex-shrink-0 transition-colors">
                  →
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
