'use client'

import { useState } from 'react'
import { apiFetch, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { CopyButton } from '@/components/ui/CopyButton'
import { useToast } from '@/components/ui/Toast'

interface CTAOption {
  cta: string
  placement: 'opening' | 'middle' | 'closing' | 'caption-end'
  reasoning: string
  expectedLift: 'high' | 'medium' | 'low'
  matchScore: number
}

interface CTAResult {
  recommended: CTAOption
  alternatives: CTAOption[]
  patterns: { name: string; description: string }[]
  warnings?: string[]
}

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok',    label: 'TikTok' },
  { id: 'youtube',   label: 'YouTube' },
  { id: 'x',         label: 'X / Twitter' },
  { id: 'linkedin',  label: 'LinkedIn' },
  { id: 'facebook',  label: 'Facebook' },
  { id: 'threads',   label: 'Threads' },
  { id: 'email',     label: 'Email / Newsletter' },
]

const GOALS = [
  { id: 'clicks',     label: 'Click a link',     hint: 'Drive traffic to your website, product, or content' },
  { id: 'comments',   label: 'Get comments',     hint: 'Spark replies to fuel engagement' },
  { id: 'follows',    label: 'Get followers',    hint: 'Convert one-off viewers into long-term audience' },
  { id: 'shares',     label: 'Get shares',       hint: 'Reposts, retweets, sends-to-friends' },
  { id: 'signups',    label: 'Newsletter / signup', hint: 'Email opt-ins, waitlists, free downloads' },
  { id: 'purchases',  label: 'Purchase',         hint: 'Direct buy intent — products, services, courses' },
  { id: 'dms',        label: 'Start a DM',       hint: 'Open a 1:1 conversation' },
  { id: 'other',      label: 'Other',            hint: 'Describe your specific goal below' },
]

function formatResultAsText(result: CTAResult): string {
  const lines: string[] = []
  lines.push(`# CTA Optimization`)
  lines.push('')
  lines.push(`## Recommended CTA`)
  lines.push(`> ${result.recommended.cta}`)
  lines.push('')
  lines.push(`Placement: ${result.recommended.placement}`)
  lines.push(`Match score: ${result.recommended.matchScore}/10 · Expected lift: ${result.recommended.expectedLift}`)
  lines.push(`Why: ${result.recommended.reasoning}`)
  lines.push('')
  lines.push(`## Alternatives`)
  result.alternatives.forEach((a, i) => {
    lines.push(`${i + 1}. ${a.cta}`)
    lines.push(`   ${a.placement} · ${a.matchScore}/10 · ${a.expectedLift} lift`)
    lines.push(`   ${a.reasoning}`)
    lines.push('')
  })
  lines.push(`## Patterns to keep in your toolkit`)
  result.patterns.forEach((p) => {
    lines.push(`- **${p.name}** — ${p.description}`)
  })
  if (result.warnings && result.warnings.length > 0) {
    lines.push('')
    lines.push(`## Warnings`)
    result.warnings.forEach((w) => lines.push(`- ${w}`))
  }
  return lines.join('\n')
}

const liftBadge = (lift: 'high' | 'medium' | 'low') =>
  lift === 'high'
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    : lift === 'medium'
    ? 'bg-brand-500/15 text-brand-300 border-brand-500/30'
    : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'

const scoreColor = (score: number) =>
  score >= 8 ? 'text-emerald-300'
    : score >= 6 ? 'text-brand-300'
    : score >= 4 ? 'text-amber-300'
    : 'text-red-300'

export default function CTAOptimizerPage() {
  const [content, setContent] = useState('')
  const [platform, setPlatform] = useState('instagram')
  const [goal, setGoal] = useState('clicks')
  const [goalDetail, setGoalDetail] = useState('')
  const [audience, setAudience] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<CTAResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const { addToast } = useToast()

  const handleGenerate = async () => {
    if (!content.trim()) {
      addToast('Paste your draft content first.', 'error')
      return
    }
    if (goal === 'other' && !goalDetail.trim()) {
      addToast('Describe your goal in the field below.', 'error')
      return
    }
    setGenerating(true)
    setResult(null)
    setSaved(false)
    try {
      const res = await apiFetch<CTAResult>('/api/cta-optimizer', {
        method: 'POST',
        body: JSON.stringify({
          content: content.trim(),
          platform,
          goal,
          goalDetail: goalDetail.trim() || undefined,
          audience: audience.trim() || undefined,
          linkUrl: linkUrl.trim() || undefined,
        }),
      })
      setResult(res)
      addToast('CTA options generated', 'success')
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Failed to generate', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!result) return
    setSaving(true)
    try {
      await apiFetch('/api/saved', {
        method: 'POST',
        body: JSON.stringify({
          type: 'cta_optimization',
          content: formatResultAsText(result),
          platform,
          topic: `CTAs for ${PLATFORMS.find((p) => p.id === platform)?.label ?? platform}`,
        }),
      })
      setSaved(true)
      addToast('Saved to library', 'success')
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">CTA Optimizer</h1>
        <p className="text-zinc-500 mt-1">
          Drop in a caption, post, or script. Pick a goal. Get a recommended CTA + 4 alternatives, scored against
          {" "}<span className="text-zinc-400">platform conventions</span> and your{" "}<span className="text-zinc-400">stated outcome</span>.
        </p>
      </div>

      {/* Input form */}
      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Source content <span className="text-red-400">*</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            maxLength={8000}
            placeholder="Paste the caption, post, video script, or email you want to add a CTA to..."
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-3 py-2 text-sm focus:outline-none focus:border-brand-500/40 resize-none"
          />
          <div className="text-2xs text-zinc-600 mt-1 text-right">
            {content.length.toLocaleString()} / 8,000 chars
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Platform</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    platform === p.id
                      ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                      : 'bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Goal</label>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-brand-500/40"
            >
              {GOALS.map((g) => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
            <p className="text-2xs text-zinc-600 mt-1">
              {GOALS.find((g) => g.id === goal)?.hint}
            </p>
          </div>
        </div>

        {goal === 'other' && (
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              Describe your goal
            </label>
            <input
              type="text"
              value={goalDetail}
              onChange={(e) => setGoalDetail(e.target.value)}
              placeholder="e.g. get prospects to book a discovery call"
              maxLength={200}
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-3 py-2 text-sm focus:outline-none focus:border-brand-500/40"
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              Audience <span className="text-zinc-600 normal-case">(optional)</span>
            </label>
            <input
              type="text"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. solopreneurs in their first year"
              maxLength={200}
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-3 py-2 text-sm focus:outline-none focus:border-brand-500/40"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              Destination link <span className="text-zinc-600 normal-case">(optional)</span>
            </label>
            <input
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://your-link.com"
              maxLength={500}
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-3 py-2 text-sm focus:outline-none focus:border-brand-500/40"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleGenerate} loading={generating} disabled={!content.trim() || generating} size="lg">
            Generate CTAs · 2 credits
          </Button>
        </div>
      </div>

      {/* Result */}
      {result && !generating && (
        <div className="space-y-5">
          {/* Recommended — hero */}
          <div className="rounded-xl border border-brand-500/30 bg-surface-secondary shadow-glow p-5 sm:p-6 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-2xs font-bold uppercase tracking-wider text-brand-300">★ Recommended</span>
                <span className={`text-2xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${liftBadge(result.recommended.expectedLift)}`}>
                  {result.recommended.expectedLift} lift
                </span>
                <span className={`text-xs font-bold tabular-nums ${scoreColor(result.recommended.matchScore)}`}>
                  {result.recommended.matchScore}/10
                </span>
                <span className="text-2xs text-zinc-500 uppercase tracking-wider">{result.recommended.placement}</span>
              </div>
              <CopyButton text={result.recommended.cta} label="Copy" />
            </div>
            <p className="text-base text-zinc-100 leading-relaxed font-medium">&ldquo;{result.recommended.cta}&rdquo;</p>
            <p className="text-xs text-zinc-500 leading-relaxed">{result.recommended.reasoning}</p>
          </div>

          {/* Alternatives */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-300 mb-3">Alternative angles</h2>
            <div className="space-y-2">
              {result.alternatives.map((alt, i) => (
                <div key={i} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-2xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${liftBadge(alt.expectedLift)}`}>
                        {alt.expectedLift}
                      </span>
                      <span className={`text-xs font-bold tabular-nums ${scoreColor(alt.matchScore)}`}>
                        {alt.matchScore}/10
                      </span>
                      <span className="text-2xs text-zinc-500 uppercase tracking-wider">{alt.placement}</span>
                    </div>
                    <CopyButton text={alt.cta} label="Copy" />
                  </div>
                  <p className="text-sm text-zinc-200 leading-relaxed">&ldquo;{alt.cta}&rdquo;</p>
                  <p className="text-2xs text-zinc-500 leading-relaxed">{alt.reasoning}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Patterns */}
          {result.patterns.length > 0 && (
            <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
              <h2 className="text-sm font-semibold text-zinc-300 mb-3">Patterns to keep in your toolkit</h2>
              <ul className="space-y-2.5">
                {result.patterns.map((p, i) => (
                  <li key={i} className="text-sm text-zinc-300 leading-relaxed">
                    <span className="font-semibold text-zinc-200">{p.name}</span>
                    <span className="text-zinc-500"> — {p.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {result.warnings && result.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
              <h2 className="text-2xs font-bold uppercase tracking-wider text-amber-300 mb-2">⚠ Worth fixing in your content</h2>
              <ul className="space-y-1.5">
                {result.warnings.map((w, i) => (
                  <li key={i} className="text-sm text-zinc-300 leading-relaxed flex gap-2">
                    <span className="text-amber-400 flex-shrink-0">▴</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={saved || saving}
              variant={saved ? 'secondary' : 'primary'}
              size="lg"
            >
              {saved ? '✓ Saved to library' : 'Save to library'}
            </Button>
            <button
              onClick={() => {
                setResult(null)
                setSaved(false)
              }}
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              Generate for different content →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
