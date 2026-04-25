'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { apiFetch, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { LockedSection, LockedInline } from '@/components/LockedSection'
import { PLATFORM_META, type Channel } from '@/lib/channels'

// ─── Shared tutorial context — passed step-to-step ───────────────────────

export interface TutorialContext {
  // Step 1: chosen channel + niche from analysis
  selectedChannel: Channel | null
  niche: string
  analysisId: string | null  // generation id from channel analysis

  // Step 2: caption topic the user wrote (chains into hashtags)
  captionTopic: string
  savedCaption: string | null

  // Step 5: did they save anything during the tutorial?
  hasSavedItem: boolean
}

export const initialTutorialContext: TutorialContext = {
  selectedChannel: null,
  niche: '',
  analysisId: null,
  captionTopic: '',
  savedCaption: null,
  hasSavedItem: false,
}

interface StepProps {
  channels: Channel[]
  ctx: TutorialContext
  setCtx: (next: TutorialContext) => void
  onNext: () => void
  onSkip: () => void
}

// ─── STEP 1 — Channel Analysis ───────────────────────────────────────────

/**
 * Fake-progress indicator for the Channel Analysis run. The API doesn't stream
 * progress, so this asymptotes toward 95% over ~45s while cycling through
 * stage messages so the user knows the tab isn't dead. Snaps to 100% when
 * the parent unmounts it on result.
 */
function AnalysisProgress({ platform, handle }: { platform: string; handle: string }) {
  const [progress, setProgress] = useState(2)
  const [stageIdx, setStageIdx] = useState(0)
  const platformLabel = PLATFORM_META[platform as keyof typeof PLATFORM_META]?.label ?? platform

  const stages = [
    'Reading your channel context…',
    `Reviewing 2026 ${platformLabel} dynamics…`,
    'Identifying strengths and gaps…',
    'Drafting platform-specific recommendations…',
    'Finalizing your audit report…',
  ]

  useEffect(() => {
    // Asymptote toward 95% — slow down as we approach
    const tick = setInterval(() => {
      setProgress((p) => {
        if (p >= 95) return p
        const remaining = 95 - p
        return Math.min(95, p + Math.max(0.4, remaining * 0.045))
      })
    }, 500)

    // Advance stage roughly every 9 seconds
    const stageTick = setInterval(() => {
      setStageIdx((i) => Math.min(i + 1, stages.length - 1))
    }, 9000)

    return () => {
      clearInterval(tick)
      clearInterval(stageTick)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-zinc-100">Analyzing your channel.</h2>
        <p className="text-zinc-400 mt-2 text-sm leading-relaxed">
          Running a real audit of <strong className="text-zinc-200">{handle}</strong> on{' '}
          <strong className="text-zinc-200">{platformLabel}</strong>. This usually takes 30–60 seconds.
        </p>
      </div>
      <div className="rounded-xl border border-brand-500/20 bg-surface-secondary p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-brand-500/30 border-t-brand-500 animate-spin flex-shrink-0" />
          <div className="text-sm text-zinc-200 font-medium flex-1">{stages[stageIdx]}</div>
          <div className="text-xs text-zinc-500 tabular-nums font-semibold">{Math.round(progress)}%</div>
        </div>
        <div className="h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed">
          We&apos;re reviewing your niche, posting cadence, and the 2026 {platformLabel} algorithm — not a stock template.
          Hang tight.
        </p>
      </div>
    </div>
  )
}

interface LockedAnalysisResult {
  overallAssessment: string
  strengths: string[]
  gaps: string[]
  contentMix: { observation: string; recommendation: string | null }
  postingConsistency: { observation: string; recommendation: string | null }
  audienceEngagement: { observation: string; recommendation: string | null }
  missedOpportunities: string[]
  quickWins: unknown[]
  longTermMoves: unknown[]
  _locked: {
    strengths_hidden: number
    gaps_hidden: number
    missedOpportunities_hidden: number
    quickWins_hidden: number
    longTermMoves_hidden: number
    recommendations_hidden: number
  }
  analysis_id: string | null
}

export function ChannelAnalysisStep({ channels, ctx, setCtx, onNext, onSkip }: StepProps) {
  const [selectedChannelId, setSelectedChannelId] = useState<string>(channels[0]?.id ?? '')
  const [niche, setNiche] = useState('')
  const [followerCount, setFollowerCount] = useState('')
  const [challenge, setChallenge] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<LockedAnalysisResult | null>(null)
  const { addToast } = useToast()

  const selected = channels.find((c) => c.id === selectedChannelId) ?? channels[0] ?? null

  const handleRun = async () => {
    if (!selected) {
      addToast('Add a channel first.', 'error')
      return
    }
    if (!niche.trim()) {
      addToast('Tell us your niche so the analysis is specific.', 'error')
      return
    }
    setRunning(true)
    try {
      const res = await apiFetch<LockedAnalysisResult>('/api/channel-analysis', {
        method: 'POST',
        body: JSON.stringify({
          platform: selected.platform,
          niche: niche.trim(),
          followerCount: followerCount.trim() || undefined,
          currentChallenges: challenge.trim() || undefined,
          analyzeHandle: selected.handle,
          tutorialMode: true,
        }),
        timeout: 90000,
      })
      setResult(res)
      setCtx({
        ...ctx,
        selectedChannel: selected,
        niche: niche.trim(),
        analysisId: res.analysis_id,
      })
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Analysis failed', 'error')
    } finally {
      setRunning(false)
    }
  }

  // ── Running — show progress card so the user sees something is happening ──
  if (running && !result && selected) {
    return <AnalysisProgress platform={selected.platform} handle={selected.handle} />
  }

  // ── No channel state ──
  if (channels.length === 0) {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-sm text-amber-200">
          You need to add at least one channel before we can run an analysis. Go back to the previous step
          and add a channel.
        </div>
        <button onClick={onSkip} className="text-sm text-zinc-500 hover:text-zinc-300">
          Skip this step →
        </button>
      </div>
    )
  }

  // ── Pre-run form ──
  if (!result) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100">Let&apos;s analyze one of your channels.</h2>
          <p className="text-zinc-400 mt-2 text-sm leading-relaxed">
            We&apos;ll run a real audit — strengths, gaps, recommendations — based on your niche and the platform&apos;s
            current dynamics. <strong className="text-brand-300">This one&apos;s on us</strong> — your starter credits
            stay intact.
          </p>
        </div>

        <div className="rounded-xl border border-brand-500/20 bg-surface-secondary p-5 space-y-4">
          {/* Channel picker */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Channel</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {channels.map((c) => {
                const meta = PLATFORM_META[c.platform]
                const isActive = c.id === selectedChannelId
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedChannelId(c.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-all ${
                      isActive
                        ? 'border-brand-500/50 bg-brand-500/10'
                        : 'border-brand-500/10 bg-surface-tertiary/40 hover:border-brand-500/25'
                    }`}
                  >
                    <span className="text-lg">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-zinc-200 truncate">{c.handle}</div>
                      <div className="text-2xs text-zinc-500 uppercase tracking-wider">{meta.label}</div>
                    </div>
                    {isActive && <span className="text-brand-400 text-sm">✓</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Niche */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Your niche <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. food creators in Las Vegas, AI tooling for solopreneurs"
              maxLength={200}
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500/40"
              autoFocus
            />
          </div>

          {/* Follower count + Challenge — optional */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Follower count <span className="text-zinc-600 normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={followerCount}
                onChange={(e) => setFollowerCount(e.target.value)}
                placeholder="~2.5K"
                maxLength={40}
                className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500/40"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                One challenge <span className="text-zinc-600 normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={challenge}
                onChange={(e) => setChallenge(e.target.value)}
                placeholder="reach plateau"
                maxLength={120}
                className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500/40"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <button onClick={onSkip} className="text-sm text-zinc-500 hover:text-zinc-300">
            Skip this step →
          </button>
          <Button onClick={handleRun} loading={running} size="lg" disabled={!selected || !niche.trim()}>
            {running ? 'Analyzing your channel…' : 'Run analysis'}
          </Button>
        </div>
      </div>
    )
  }

  // ── Result with locked sections ──
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-zinc-100">Here&apos;s what we found.</h2>
        <p className="text-zinc-500 text-sm mt-2">
          We&apos;ve unlocked a preview. Quick wins, long-term moves, and the rest of your gaps are part of the full
          report — included with Creator.
        </p>
      </div>

      {/* Overall assessment */}
      <div className="rounded-xl border border-brand-500/20 bg-surface-secondary p-5">
        <div className="text-2xs font-bold uppercase tracking-wider text-brand-300 mb-2">Overall assessment</div>
        <p className="text-sm text-zinc-200 leading-relaxed">{result.overallAssessment}</p>
      </div>

      {/* Strengths + Gaps in two cols */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-emerald-500/20 bg-surface-secondary p-5 space-y-2">
          <div className="text-2xs font-bold uppercase tracking-wider text-emerald-300 mb-1">Strengths</div>
          <ul className="space-y-2">
            {result.strengths.map((s, i) => (
              <li key={i} className="text-sm text-zinc-300 leading-relaxed flex gap-2">
                <span className="text-emerald-400 flex-shrink-0">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
          <LockedInline count={result._locked.strengths_hidden} itemLabel="strength" />
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-surface-secondary p-5 space-y-2">
          <div className="text-2xs font-bold uppercase tracking-wider text-amber-300 mb-1">Gaps to close</div>
          <ul className="space-y-2">
            {result.gaps.map((g, i) => (
              <li key={i} className="text-sm text-zinc-300 leading-relaxed flex gap-2">
                <span className="text-amber-400 flex-shrink-0">▴</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
          <LockedInline count={result._locked.gaps_hidden} itemLabel="gap" />
        </div>
      </div>

      {/* Observations (free) + Recommendations (locked) */}
      <div className="space-y-3">
        {([
          ['Content mix', result.contentMix.observation],
          ['Posting consistency', result.postingConsistency.observation],
          ['Audience engagement', result.audienceEngagement.observation],
        ] as const).map(([title, obs]) => (
          <div key={title} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4">
            <div className="text-2xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5">{title}</div>
            <p className="text-sm text-zinc-300 leading-relaxed mb-2">{obs}</p>
            <LockedInline count={1} itemLabel="recommendation" />
          </div>
        ))}
      </div>

      {/* Big locked sections */}
      <LockedSection
        title="Quick wins"
        count={result._locked.quickWins_hidden}
        itemLabel="quick win"
        preview="3 actions to take this week — specific to your platform and follower tier, with expected impact ratings."
      />
      <LockedSection
        title="Long-term strategic moves"
        count={result._locked.longTermMoves_hidden}
        itemLabel="strategic move"
        preview="3 multi-month plays to build a moat in your niche, with timeframes and milestones."
      />
      {result._locked.missedOpportunities_hidden > 0 && (
        <LockedSection
          title="Missed opportunities"
          count={result._locked.missedOpportunities_hidden}
          itemLabel="opportunity"
          preview="Specific platform features and formats you're probably underusing for your niche."
        />
      )}

      <div className="flex justify-between items-center pt-4">
        <Link href="/dashboard/billing" className="text-xs text-brand-400 hover:text-brand-300">
          Or unlock everything → /dashboard/billing
        </Link>
        <Button onClick={onNext} size="lg">
          Continue → write your first caption
        </Button>
      </div>
    </div>
  )
}

// ─── STEP 2 — Captions ───────────────────────────────────────────────────

export function CaptionsStep({ ctx, setCtx, onNext, onSkip }: StepProps) {
  const [topic, setTopic] = useState(() => ctx.niche || '')
  const [tone, setTone] = useState('casual')
  const [generating, setGenerating] = useState(false)
  const [captions, setCaptions] = useState<string[]>([])
  const [savedIdx, setSavedIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const { addToast } = useToast()

  const platform = ctx.selectedChannel?.platform ?? 'instagram'

  const handleGenerate = async () => {
    if (!topic.trim()) {
      addToast('Type a topic first.', 'error')
      return
    }
    setGenerating(true)
    try {
      const res = await apiFetch<{ captions: string[] }>('/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          topic: topic.trim(),
          platform,
          tone,
          contentType: 'post',
          count: 3,
        }),
        timeout: 60000,
      })
      setCaptions(res.captions ?? [])
      setSavedIdx(null)
      setCtx({ ...ctx, captionTopic: topic.trim() })
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Generation failed', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async (idx: number) => {
    setSaving(true)
    try {
      await apiFetch('/api/saved', {
        method: 'POST',
        body: JSON.stringify({
          type: 'caption',
          content: captions[idx],
          platform,
          topic,
        }),
      })
      setSavedIdx(idx)
      setCtx({ ...ctx, savedCaption: captions[idx], hasSavedItem: true })
      addToast('Saved to your library', 'success')
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-zinc-100">Write your first caption.</h2>
        <p className="text-zinc-400 mt-2 text-sm leading-relaxed">
          Drop in a topic and we&apos;ll generate 3 caption options tuned for{' '}
          <strong className="text-zinc-200">{PLATFORM_META[platform as keyof typeof PLATFORM_META]?.label ?? platform}</strong>.
          {ctx.niche && <> We&apos;ve pre-filled your niche.</>} Save one you like — it lands in your library
          for later.
        </p>
      </div>

      <div className="rounded-xl border border-brand-500/20 bg-surface-secondary p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Topic</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What's the post about?"
            maxLength={200}
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500/40"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(['casual', 'professional', 'witty'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTone(t)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${
                tone === t
                  ? 'bg-brand-500/15 border border-brand-500/40 text-brand-200'
                  : 'bg-surface-tertiary border border-brand-500/10 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <Button onClick={handleGenerate} loading={generating} disabled={!topic.trim()}>
          {generating ? 'Generating 3 captions…' : 'Generate captions'}
        </Button>
      </div>

      {captions.length > 0 && (
        <div className="space-y-2">
          <div className="text-2xs font-bold uppercase tracking-wider text-zinc-500">Your captions</div>
          {captions.map((c, i) => (
            <div key={i} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 flex items-start gap-3">
              <p className="flex-1 text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{c}</p>
              <Button
                size="sm"
                variant={savedIdx === i ? 'secondary' : 'primary'}
                onClick={() => handleSave(i)}
                loading={saving && savedIdx !== i}
                disabled={savedIdx !== null}
              >
                {savedIdx === i ? '✓ Saved' : 'Save'}
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center pt-2">
        <button onClick={onSkip} className="text-sm text-zinc-500 hover:text-zinc-300">
          Skip this step →
        </button>
        <Button onClick={onNext} size="lg" variant={captions.length > 0 ? 'primary' : 'secondary'}>
          {captions.length > 0 ? 'Continue → find hashtags' : 'Skip ahead →'}
        </Button>
      </div>
    </div>
  )
}

// ─── STEP 3 — Hashtags ────────────────────────────────────────────────────

type HashtagCategory = 'HIGH_REACH' | 'MEDIUM_REACH' | 'LOW_COMPETITION'
interface HashtagsResult {
  hashtags: { tag: string; category: HashtagCategory; score?: number; posts?: string }[]
}

export function HashtagsStep({ ctx, onNext, onSkip }: StepProps) {
  const [topic, setTopic] = useState(() => ctx.captionTopic || ctx.niche || '')
  const [generating, setGenerating] = useState(false)
  const [tags, setTags] = useState<HashtagsResult['hashtags']>([])
  const { addToast } = useToast()

  const platform = ctx.selectedChannel?.platform ?? 'instagram'

  const handleGenerate = async () => {
    if (!topic.trim()) {
      addToast('Add a topic first.', 'error')
      return
    }
    setGenerating(true)
    try {
      const params = new URLSearchParams({
        q: topic.trim(),
        platform,
        count: '15',
        mix: '0.5',
      })
      const res = await apiFetch<HashtagsResult>(`/api/hashtags?${params.toString()}`, {
        timeout: 60000,
      })
      setTags(res.hashtags ?? [])
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Generation failed', 'error')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-zinc-100">Now find hashtags that match.</h2>
        <p className="text-zinc-400 mt-2 text-sm leading-relaxed">
          {ctx.captionTopic
            ? <>We pulled your topic from the last step — <strong className="text-zinc-200">{ctx.captionTopic}</strong>. Edit it or hit generate.</>
            : <>Type a topic and we&apos;ll mix popular + niche tags for reach.</>}
        </p>
      </div>

      <div className="rounded-xl border border-brand-500/20 bg-surface-secondary p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Topic</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What's the post about?"
            maxLength={200}
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500/40"
          />
        </div>
        <Button onClick={handleGenerate} loading={generating} disabled={!topic.trim()}>
          {generating ? 'Finding hashtags…' : 'Generate hashtags'}
        </Button>
      </div>

      {tags.length > 0 && (
        <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
          <div className="text-2xs font-bold uppercase tracking-wider text-zinc-500 mb-3">{tags.length} hashtags</div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t, i) => (
              <span
                key={i}
                className={`text-xs px-2.5 py-1 rounded-lg border ${
                  t.category === 'HIGH_REACH'
                    ? 'bg-brand-500/10 text-brand-300 border-brand-500/20'
                    : t.category === 'LOW_COMPETITION'
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                }`}
              >
                {t.tag.startsWith('#') ? t.tag : `#${t.tag}`}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center pt-2">
        <button onClick={onSkip} className="text-sm text-zinc-500 hover:text-zinc-300">
          Skip this step →
        </button>
        <Button onClick={onNext} size="lg" variant={tags.length > 0 ? 'primary' : 'secondary'}>
          {tags.length > 0 ? 'Continue → viral ideas' : 'Skip ahead →'}
        </Button>
      </div>
    </div>
  )
}

// ─── STEP 4 — Viral Ideas ─────────────────────────────────────────────────

interface ViralIdea {
  title: string
  whyViral: string
  format: string
  hook: string
}

export function ViralIdeasStep({ ctx, onNext, onSkip }: StepProps) {
  const [niche, setNiche] = useState<string>(() => ctx.niche || ctx.captionTopic || '')
  const [generating, setGenerating] = useState(false)
  const [ideas, setIdeas] = useState<ViralIdea[]>([])
  const [autoRan, setAutoRan] = useState(false)
  const { addToast } = useToast()

  const platform = ctx.selectedChannel?.platform ?? 'instagram'

  const handleGenerate = async () => {
    const trimmed = niche.trim()
    if (!trimmed) {
      addToast('Add a niche or topic first.', 'error')
      return
    }
    setGenerating(true)
    try {
      const res = await apiFetch<{ ideas: ViralIdea[] }>('/api/viral-ideas', {
        method: 'POST',
        body: JSON.stringify({
          niche: trimmed,
          platforms: [PLATFORM_META[platform as keyof typeof PLATFORM_META]?.label ?? 'Instagram'],
          formats: ['Video', 'Carousel'],
          count: 5,
        }),
        timeout: 90000,
      })
      setIdeas(res.ideas ?? [])
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Generation failed', 'error')
    } finally {
      setGenerating(false)
    }
  }

  // Auto-run once on mount if we already have niche context (carried from analyze/captions)
  useEffect(() => {
    if (niche && ideas.length === 0 && !generating && !autoRan) {
      setAutoRan(true)
      handleGenerate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const carried = !!(ctx.niche || ctx.captionTopic)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-zinc-100">5 viral ideas for your niche.</h2>
        <p className="text-zinc-400 mt-2 text-sm leading-relaxed">
          {carried
            ? <>Tailored to <strong className="text-zinc-200">{niche}</strong>. Each comes with a hook + why it works.</>
            : <>Tell us a niche and we&apos;ll generate 5 specific ideas.</>}
        </p>
      </div>

      {/* Niche input — visible when nothing carried over OR no ideas yet so user can edit */}
      {!carried && ideas.length === 0 && !generating && (
        <div className="rounded-xl border border-brand-500/20 bg-surface-secondary p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Your niche
            </label>
            <input
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. food creators in Las Vegas, AI tooling for solopreneurs"
              maxLength={200}
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500/40"
              autoFocus
            />
          </div>
          <Button onClick={handleGenerate} loading={generating} disabled={!niche.trim()}>
            Generate 5 ideas
          </Button>
        </div>
      )}

      {generating && (
        <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-8 text-center text-zinc-500">
          <div className="animate-pulse">Generating 5 viral ideas tailored to your niche…</div>
        </div>
      )}

      {!generating && ideas.length > 0 && (
        <div className="space-y-3">
          {ideas.map((idea, i) => (
            <div key={i} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
              <div className="flex items-start gap-3">
                <span className="text-2xs font-bold uppercase tracking-wider text-brand-300 bg-brand-500/15 border border-brand-500/20 px-2 py-0.5 rounded-full mt-1">
                  {idea.format}
                </span>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-zinc-100">{idea.title}</h3>
                  <p className="text-xs text-zinc-500 mt-1">{idea.whyViral}</p>
                  {idea.hook && (
                    <div className="mt-2 text-xs text-zinc-300 italic border-l-2 border-brand-500/30 pl-3">
                      &ldquo;{idea.hook}&rdquo;
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center pt-2">
        <button onClick={onSkip} className="text-sm text-zinc-500 hover:text-zinc-300">
          Skip this step →
        </button>
        <Button onClick={onNext} size="lg">
          Continue → final step
        </Button>
      </div>
    </div>
  )
}

// ─── STEP 5 — Save / Wrap-up ─────────────────────────────────────────────

export function SaveStep({ ctx, onNext, onSkip }: StepProps) {
  return (
    <div className="space-y-5 text-center">
      <div className="inline-block w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow flex items-center justify-center text-3xl mx-auto">
        🎉
      </div>
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-100">You&apos;re set up.</h2>
        <p className="text-zinc-400 mt-3 text-base leading-relaxed max-w-md mx-auto">
          {ctx.hasSavedItem
            ? <>You already have <strong className="text-zinc-200">{ctx.savedCaption ? '1 caption' : 'a piece of content'}</strong> saved in your library — find it in <strong className="text-zinc-200">Library</strong> from the sidebar any time.</>
            : <>Your dashboard is ready. The captions, hashtags, and ideas you generated are in your <strong className="text-zinc-200">Recent content</strong> on the dashboard. Save anything you want to keep.</>}
        </p>
      </div>

      <div className="rounded-xl border border-brand-500/20 bg-surface-secondary p-5 max-w-md mx-auto text-left space-y-3">
        <div className="text-2xs font-bold uppercase tracking-wider text-brand-300">What&apos;s next on your dashboard</div>
        <ul className="space-y-2 text-sm text-zinc-300">
          <li className="flex gap-2"><span className="text-brand-400 flex-shrink-0">✓</span><span><strong>Channels added.</strong> Your dashboard is personalized.</span></li>
          {ctx.analysisId && (
            <li className="flex gap-2"><span className="text-brand-400 flex-shrink-0">✓</span><span><strong>Channel analysis saved.</strong> Find it in Recent content.</span></li>
          )}
          {ctx.captionTopic && (
            <li className="flex gap-2"><span className="text-brand-400 flex-shrink-0">✓</span><span><strong>First captions generated.</strong></span></li>
          )}
          <li className="flex gap-2"><span className="text-zinc-600 flex-shrink-0">○</span><span>10 starter credits intact — go explore the rest.</span></li>
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 justify-center items-center pt-2">
        <button onClick={onSkip} className="text-sm text-zinc-500 hover:text-zinc-300">
          Just skip to dashboard →
        </button>
        <Button onClick={onNext} size="lg">
          Take me to my dashboard →
        </Button>
      </div>
    </div>
  )
}
