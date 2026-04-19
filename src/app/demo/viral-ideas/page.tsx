'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { CopyButton } from '@/components/ui/CopyButton'

interface ViralIdea {
  title: string
  whyViral: string
  format: string
  platform: string
  difficulty: 'Easy' | 'Medium' | 'Advanced'
  hook: string
  outline: string[]
  hashtags: string[]
  bestTime: string
  engagement: 'Low' | 'Medium' | 'High' | 'Viral Potential'
}

import { VIRAL_FORMATS, VIRAL_ANGLES } from '@/lib/constants'

const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'X', 'Facebook', 'Threads']
const FORMATS = VIRAL_FORMATS
const TREND_SOURCES = VIRAL_ANGLES
const COUNTS = [5, 7, 10, 15]

const MOCK_IDEAS: ViralIdea[] = [
  {
    title: 'The "5-Ingredient Dinner for a Week" Challenge',
    whyViral: 'Budget-friendly cooking content consistently performs — this adds a challenge format which drives saves and shares as viewers bookmark to try it themselves.',
    format: 'Video',
    platform: 'TikTok',
    difficulty: 'Easy',
    hook: "I spent $32 to feed myself for 7 days using only 5 ingredients. Here's what actually worked.",
    outline: [
      'Show the $32 grocery haul on camera — 5 ingredients fanned out',
      'Quick 3-second clips of each dinner with macros on screen',
      'Honest review of taste and satisfaction per meal',
      'Total cost breakdown and leftover-ingredient ideas',
      'Call viewers to drop their 5-ingredient challenge in comments',
    ],
    hashtags: ['#budgetcooking', '#5ingredientmeals', '#cheapeats', '#cookingchallenge', '#mealprep', '#foodtok'],
    bestTime: 'Tuesday 6-8 PM',
    engagement: 'Viral Potential',
  },
  {
    title: 'POV: You Finally Understand Compound Interest',
    whyViral: 'Finance education performs incredibly well when the hook subverts the "boring finance" stereotype. POV framing makes it feel personal rather than lecture-y.',
    format: 'Video',
    platform: 'Instagram',
    difficulty: 'Medium',
    hook: "I put $100 into an index fund 10 years ago. I didn't touch it. Here's what it taught me that no finance class did.",
    outline: [
      'Open with the dollar amount on screen — instant hook',
      'Walk through the growth year by year with visual counter',
      'Explain the "eighth wonder of the world" quote simply',
      'Show what $100/month for 30 years actually becomes',
      'Close with a simple "start with $10 this week" CTA',
    ],
    hashtags: ['#personalfinance', '#investing101', '#compoundinterest', '#moneytips', '#financialliteracy'],
    bestTime: 'Thursday 7-9 PM',
    engagement: 'High',
  },
  {
    title: "Things I Wish I Knew Before Starting My Small Business",
    whyViral: 'Carousel format encourages full-read engagement. Regret-framing triggers curiosity and positions you as authority without bragging.',
    format: 'Carousel',
    platform: 'Instagram',
    difficulty: 'Easy',
    hook: "Month 1 of my business I almost quit three times. Here's what would've saved me the panic attacks.",
    outline: [
      'Slide 1: Hook with bold text over plain background',
      'Slide 2: "Your first pricing will be wrong — charge more than feels comfortable"',
      'Slide 3: "80% of inbound leads are time-wasters — qualify hard"',
      'Slide 4: "Burnout hits around day 90 — build rest into the plan"',
      'Slide 5: "Sales > product until you have customers"',
      'Slide 6: Close with "save this for the next rough day" CTA',
    ],
    hashtags: ['#smallbusinesstips', '#entrepreneur', '#businessadvice', '#femalefounder', '#startuplife'],
    bestTime: 'Wednesday 12-1 PM',
    engagement: 'High',
  },
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

function IdeaCard({ idea, index, defaultOpen = false }: { idea: ViralIdea; index: number; defaultOpen?: boolean }) {
  const [expanded, setExpanded] = useState(defaultOpen)
  const outlineText = idea.outline.map((p, i) => `${i + 1}. ${p}`).join('\n')
  const hashtagText = idea.hashtags.join(' ')

  return (
    <div className="rounded-xl border border-brand-500/10 bg-surface-secondary hover:border-brand-500/20 transition-all">
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
            <Button variant="secondary" size="sm">💾 Save</Button>
          </div>
        </div>
      </div>

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

export default function DemoViralIdeasPage() {
  const [niche, setNiche] = useState('personal finance for millennials')
  const [platforms, setPlatforms] = useState<string[]>(['Instagram', 'TikTok'])
  const [formats, setFormats] = useState<string[]>(['Video', 'Carousel'])
  const [trendSource, setTrendSource] = useState('Current Trends')
  const [audience, setAudience] = useState('')
  const [count, setCount] = useState(10)

  const toggle = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Viral Ideas Generator</h1>
        <p className="text-zinc-500 mt-1">Get a stream of content ideas tailored to your niche and audience.</p>
      </div>

      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Your niche / industry</label>
          <input
            type="text"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40 focus:ring-1 focus:ring-brand-500/20 transition-colors"
          />
        </div>

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

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Target audience <span className="text-zinc-600">(optional)</span></label>
          <input
            type="text"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="e.g., beginner investors aged 25-35..."
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40 focus:ring-1 focus:ring-brand-500/20 transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Number of ideas</label>
            <div className="flex gap-2">
              {COUNTS.map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`w-12 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    count === n
                      ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                      : 'bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">6 generations left today</span>
            <Button size="lg">🚀 Generate Ideas</Button>
          </div>
        </div>
      </div>

      <div className="space-y-4 stagger-children">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-200">{MOCK_IDEAS.length} ideas generated</h2>
        </div>
        {MOCK_IDEAS.map((idea, i) => (
          <IdeaCard key={i} idea={idea} index={i} defaultOpen={i === 0} />
        ))}
      </div>
    </div>
  )
}
