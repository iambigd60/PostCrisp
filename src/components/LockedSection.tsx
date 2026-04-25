import Link from 'next/link'

interface LockedSectionProps {
  /** Heading shown above the locked content. */
  title: string
  /** Number of items hidden behind the lock (e.g. "3 quick wins locked"). */
  count?: number
  /** Singular/plural label for the items, e.g. "quick win" / "quick wins". */
  itemLabel?: string
  /** Optional one-line preview text shown blurred behind the lock. */
  preview?: string
  /** Where the upgrade CTA points. Defaults to billing. */
  href?: string
  /** Custom CTA text. Defaults to "Unlock with Creator". */
  ctaText?: string
}

/**
 * Lock-out card used by the onboarding tutorial's Channel Analysis step.
 * Renders a grayed-out preview + an inline upgrade CTA. Non-blocking — the
 * user can keep scrolling/clicking next on the tutorial without engaging.
 */
export function LockedSection({
  title,
  count,
  itemLabel = 'item',
  preview,
  href = '/dashboard/billing',
  ctaText = 'Unlock with Creator',
}: LockedSectionProps) {
  const labelPlural = count === 1 ? itemLabel : `${itemLabel}s`
  const summary = count != null ? `${count} ${labelPlural} locked` : 'Locked'

  return (
    <div className="relative rounded-xl border border-brand-500/20 bg-surface-tertiary/30 overflow-hidden">
      {/* Blurred preview */}
      <div className="p-4 select-none pointer-events-none blur-sm opacity-60">
        <div className="text-sm font-bold text-zinc-300 mb-2">{title}</div>
        <p className="text-sm text-zinc-400 leading-relaxed">
          {preview ?? 'Detailed actionable steps tailored to your channel — full breakdown, prioritized timing, and expected impact.'}
        </p>
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-surface-secondary/90 backdrop-blur-sm border border-brand-500/30 rounded-lg px-5 py-4 text-center shadow-glow max-w-xs">
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <span className="text-lg">🔒</span>
            <span className="text-sm font-bold text-brand-200 uppercase tracking-wider">{title}</span>
          </div>
          <p className="text-xs text-zinc-400 mb-3">{summary}</p>
          <Link
            href={href}
            className="inline-block text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 px-4 py-2 rounded-lg transition-colors"
          >
            {ctaText} — $19/mo
          </Link>
        </div>
      </div>
    </div>
  )
}

/**
 * Minimal inline lock — for places where a single small section is hidden
 * (e.g. inside a list of strengths/gaps, "+ 3 more locked"). Not a card.
 */
export function LockedInline({
  count,
  itemLabel = 'item',
  href = '/dashboard/billing',
}: {
  count: number
  itemLabel?: string
  href?: string
}) {
  if (count <= 0) return null
  const labelPlural = count === 1 ? itemLabel : `${itemLabel}s`
  return (
    <Link
      href={href}
      className="flex items-center gap-2 text-xs text-brand-300 hover:text-brand-200 px-3 py-2 rounded-lg border border-dashed border-brand-500/30 hover:border-brand-500/50 hover:bg-brand-500/5 transition-all"
    >
      <span>🔒</span>
      <span>+ {count} more {labelPlural} — unlock with Creator</span>
      <span className="ml-auto">→</span>
    </Link>
  )
}
