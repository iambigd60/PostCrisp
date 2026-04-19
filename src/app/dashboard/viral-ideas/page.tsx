'use client'

import { useState } from 'react'
import { apiFetch, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { CopyButton } from '@/components/ui/CopyButton'
import { GenerationLoader } from '@/components/ui/GenerationLoader'
import { InlineError } from '@/components/ui/ErrorBoundary'
import { UpgradePrompt } from '@/components/ui/UpgradePrompt'
import { useToast } from '@/components/ui/Toast'
import { useUsage } from '@/hooks/useUsage'
import type { ViralIdea } from '@/app/api/viral-ideas/route'
import { VIRAL_FORMATS, VIRAL_ANGLES } from '@/lib/constants'

const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'X', 'Facebook', 'Threads']
const FORMATS = VIRAL_FORMATS
const TREND_SOURCES = VIRAL_ANGLES
const GENERATION_MESSAGES = [
  'Analyzing viral patterns...',
  'Studying what\'s trending...',
  'Crafting your content ideas...',
  'Adding hooks and outlines...',
  'Almost ready...',
]

const difficultyColor: Record<string, string> = {
  Easy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  Medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  Advanced: 'text-red-400 bg-red-500/10 border-red-500/20',
}

const engagementColor: Record<string, string> = {
  Low: 'text-zinc-400 bg-zinc-500/10',
  Medium: 'text-blue-400 bg-blue-500/10',
  High: 'text-emerald-400 bg-emerald-500/10',
  'Viral Potential': 'text-brand-400 bg-brand-500/10',
}

function IdeaCard({ idea, index }: { idea: ViralIdea; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const { addToast } = useToast()

  const outlineText = idea.outline.map((p, i) => `${i + 1}. ${p}`).join('\n')
  const hashtagText = idea.hashtags.join(' ')

  const handleSave = async () => {
    const fullContent = [
      `# ${idea.title}`,
      ``,
      `📊 ${idea.format} · ${idea.platform} · ${idea.difficulty} · ${idea.engagement}`,
      ``,
      `💡 WHY IT COULD GO VIRAL`,
      idea.whyViral,
      ``,
      `🎯 HOOK`,
      `"${idea.hook}"`,
      ``,
      `📝 CONTENT OUTLINE`,
      outlineText,
      ``,
      `🏷️ SUGGESTED HASHTAGS`,
      hashtagText,
      ``,
      `⏰ BEST TIME TO POST`,
      idea.bestTime,
    ].join('\n')

    try {
      await apiFetch('/api/saved', {
        method: 'POST',
        body: JSON.stringify({
          type: 'viral_idea',
          content: fullContent,
          platform: idea.platform.toLowerCase(),
          topic: idea.title,
        }),
      })
      addToast('Idea saved!', 'success')
    } catch {
      addToast('Failed to save idea', 'error')
    }
  }

  return (
    <div className="rounded-xl border border-brand-500/10 bg-surface-secondary hover:border-brand-500/20 transition-all">
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${difficultyColor[idea.difficulty] ?? 'text-zinc-400 bg-zinc-500/10'}`}>
              {idea.difficulty}
            </span>
            <span className="text-xs text-zinc-500 bg-surface-tertiary px-2 py-0.5 rounded-full">{idea.format}</span>
            <span className="text-xs text-zinc-500 bg-surface-tertiary px-2 py-0.5 rounded-full">{idea.platform}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${engagementColor[idea.engagement] ?? 'text-zinc-400'}`}>
              {idea.engagement}
            </span>
          </div>
          <span className="text-zinc-600 text-sm flex-shrink-0">#{index + 1}</span>
        </div>

        <h3 className="text-base font-semibold text-zinc-100 mb-2 leading-snug">{idea.title}</h3>
        <p className="text-sm text-zinc-400 leading-relaxed mb-3">{idea.whyViral}</p>

        <div className="rounded-lg bg-surface-tertiary border border-brand-500/10 px-4 py-3 mb-4">
          <p className="text-xs text-zinc-500 mb-1">Hook</p>
          <p className="text-sm text-zinc-300 italic">&ldquo;{idea.hook}&rdquo;</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors"
          >
            {expanded ? '▲ Less' : '▼ More details'}
          </button>
          <div className="ml-auto flex gap-2">
            <CopyButton text={outlineText} label="Copy Outline" />
            <Button variant="secondary" size="sm" onClick={handleSave}>💾 Save</Button>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-brand-500/10 p-5 space-y-4 animate-fade-in">
          <div>
            <p className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">Content Outline</p>
            <ol className="space-y-1.5">
              {idea.outline.map((point, i) => (
                <li key={i} className="flex gap-2 text-sm text-zinc-300">
                  <span className="text-brand-500 font-bold flex-shrink-0">{i + 1}.</span>
                  {point}
                </li>
              ))}
            </ol>
          </div>

          <div>
            <p className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">Suggested Hashtags</p>
            <div className="flex flex-wrap gap-1.5">
              {idea.hashtags.map((tag) => (
                <span key={tag} className="text-xs text-brand-300 bg-brand-500/10 px-2 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>
            <CopyButton text={hashtagText} label="Copy hashtags" className="mt-2" />
          </div>

          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-xs text-zinc-500 mb-0.5">Best time to post</p>
              <p className="text-zinc-300">⏰ {idea.bestTime}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ViralIdeasPage() {
  const [niche, setNiche] = useState('')
  const [platforms, setPlatforms] = useState<string[]>(['Instagram', 'TikTok'])
  const [formats, setFormats] = useState<string[]>(['Short / Reel / TikTok'])
  const [trendSource, setTrendSource] = useState('Current Trends')
  const [audience, setAudience] = useState('')
  const [count, setCount] = useState(10)
  const [ideas, setIdeas] = useState<ViralIdea[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limitReached, setLimitReached] = useState(false)
  const { addToast } = useToast()
  const { canGenerate, remaining, isPro } = useUsage()

  const toggle = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]

  const handleGenerate = async () => {
    if (!niche.trim()) { addToast('Please enter your niche', 'warning'); return }
    if (!canGenerate) { setLimitReached(true); return }

    setLoading(true)
    setError(null)
    setLimitReached(false)

    try {
      const data = await apiFetch<{ ideas: ViralIdea[] }>('/api/viral-ideas', {
        method: 'POST',
        body: JSON.stringify({ niche, platforms, formats, trendSource, audience, count }),
        timeout: 60000,
      })
      setIdeas(data.ideas)
      addToast(`${data.ideas.length} ideas generated!`, 'success')
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setLimitReached(true)
      } else {
        const msg = err instanceof ApiError ? err.message : 'Failed to generate ideas'
        setError(msg)
        addToast(msg, 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Viral Ideas Generator</h1>
        <p className="text-zinc-500 mt-1">Get a stream of content ideas tailored to your niche and audience.</p>
      </div>

      {/* Input form */}
      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
        {/* Niche */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Your niche / industry</label>
          <input
            type="text"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="e.g., personal finance, fitness coaching, cooking..."
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40 focus:ring-1 focus:ring-brand-500/20 transition-colors"
          />
        </div>

        {/* Platforms */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Platform focus</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => setPlatforms(toggle(platforms, p))}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all min-h-[36px] ${
                  platforms.includes(p)
                    ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                    : 'bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Formats */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Content formats</label>
          <div className="flex flex-wrap gap-2">
            {FORMATS.map((f) => (
              <button
                key={f}
                onClick={() => setFormats(toggle(formats, f))}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all min-h-[36px] ${
                  formats.includes(f)
                    ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                    : 'bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Trend source */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Content angle</label>
          <div className="flex flex-wrap gap-2">
            {TREND_SOURCES.map((t) => (
              <button
                key={t}
                onClick={() => setTrendSource(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all min-h-[36px] ${
                  trendSource === t
                    ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                    : 'bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Audience */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Target audience <span className="text-zinc-600">(optional)</span></label>
          <input
            type="text"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="e.g., beginner investors aged 25-35, home cooks who want quick meals..."
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40 focus:ring-1 focus:ring-brand-500/20 transition-colors"
          />
        </div>

        {/* Count slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="count" className="block text-sm font-medium text-zinc-300">
              Number of ideas
            </label>
            <span className="text-sm font-mono text-brand-300">{count}</span>
          </div>
          <input
            id="count"
            type="range"
            min={5}
            max={15}
            step={1}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-full accent-brand-500"
          />
          <div className="flex justify-between text-2xs text-zinc-600 mt-1">
            <span>5</span><span>10</span><span>15</span>
          </div>
        </div>

        {/* Generate */}
        <div className="flex flex-wrap items-center justify-end gap-4">

          <div className="flex items-center gap-3">
            {!isPro && (
              <span className="text-xs text-zinc-500">{remaining} generations left today</span>
            )}
            <Button onClick={handleGenerate} loading={loading} size="lg">
              {loading ? 'Generating...' : '🚀 Generate Ideas'}
            </Button>
          </div>
        </div>
      </div>

      {/* Limit reached */}
      {limitReached && <UpgradePrompt />}

      {/* Loading */}
      {loading && (
        <div className="rounded-xl border border-brand-500/10 bg-surface-secondary">
          <GenerationLoader messages={GENERATION_MESSAGES} />
        </div>
      )}

      {/* Error */}
      {error && !loading && <InlineError message={error} onRetry={handleGenerate} />}

      {/* Results */}
      {ideas.length > 0 && !loading && (
        <div className="space-y-4 stagger-children">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-200">{ideas.length} ideas generated</h2>
          </div>
          {ideas.map((idea, i) => (
            <IdeaCard key={i} idea={idea} index={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && ideas.length === 0 && !limitReached && (
        <div className="text-center py-16 text-zinc-500">
          <span className="text-4xl block mb-4">🚀</span>
          <p>Enter your niche and hit Generate to get viral content ideas</p>
        </div>
      )}
    </div>
  )
}
