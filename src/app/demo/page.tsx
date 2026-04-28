'use client'

import Link from 'next/link'
import { computeBrandReadiness } from '@/lib/brand-readiness'
import { BrandReadinessCard } from '@/components/BrandReadinessCard'

const FREE_DAILY_LIMIT = 10

const MOCK = {
  firstName: 'Alex',
  subscription_tier: 'free',
  daily_generations_used: 4,
  totalGenerations: 127,
  savedCount: 23,
  weekGenerations: 18,
  channels: [
    { platform: 'instagram', handle: '@alex.creates', label: 'Main feed' },
    { platform: 'tiktok',    handle: '@alexcreates',  label: 'Shorts' },
    { platform: 'youtube',   handle: 'AlexCreates',   label: 'Long-form' },
  ] as const,
  recentGenerations: [
    {
      id: '1',
      feature: 'cta_optimizer',
      platform: 'instagram',
      preview: 'Recommended CTA: "Save this for your next golden-hour shoot 📌" — score 9/10 for follow-driven posts.',
      created_at_minutes_ago: 8,
    },
    {
      id: '2',
      feature: 'thumbnail_analyzer',
      platform: 'youtube',
      preview: 'Click prediction 7/10 — strong color contrast, but text overlaps face. Move "GUIDE" to top-right.',
      created_at_minutes_ago: 32,
    },
    {
      id: '3',
      feature: 'captions',
      platform: 'instagram',
      preview: "Sunset chasers only 🌅 Nothing hits like golden hour over the Pacific. Tag someone you'd watch this with.",
      created_at_minutes_ago: 48,
    },
    {
      id: '4',
      feature: 'channel_analysis',
      platform: 'tiktok',
      preview: 'Channel report — strengths: niche clarity, posting cadence. Gaps: hook variety, CTA discipline.',
      created_at_minutes_ago: 145,
    },
    {
      id: '5',
      feature: 'brand_pitch',
      platform: 'email',
      preview: '"Hi Sara — I noticed Caraway just rebranded. Here\'s how my food creator audience overlaps with your home cook ICP…"',
      created_at_minutes_ago: 240,
    },
    {
      id: '6',
      feature: 'viral_ideas',
      platform: 'tiktok',
      preview: '"I tried the 5-ingredient dinner challenge for a week" — POV reveal format, 60-sec arc.',
      created_at_minutes_ago: 360,
    },
    {
      id: '7',
      feature: 'hashtags',
      platform: 'tiktok',
      preview: '#fitnessjourney #homeworkout #nogymneeded #fitlife #transformationtuesday',
      created_at_minutes_ago: 720,
    },
  ],
}

const FEATURE_META: Record<string, { icon: string; label: string; href: string }> = {
  // Interactive demo pages
  captions:           { icon: '✍️', label: 'Captions',           href: '/demo/captions' },
  hashtags:           { icon: '🏷️', label: 'Hashtags',           href: '/demo/hashtags' },
  posting_times:      { icon: '⏰', label: 'Best Times',         href: '/demo/best-times' },
  viral_ideas:        { icon: '🚀', label: 'Viral Ideas',        href: '/demo/viral-ideas' },
  // Sign-up gated (locked) — clicking lands on /signup
  cta_optimizer:      { icon: '🎯', label: 'CTA Optimizer',      href: '/signup?from=demo&tool=cta-optimizer' },
  thumbnail_analyzer: { icon: '🖼️', label: 'Thumbnail Analyzer', href: '/signup?from=demo&tool=thumbnail-analyzer' },
  channel_analysis:   { icon: '🪞', label: 'Channel Analysis',   href: '/signup?from=demo&tool=channel-analysis' },
  brand_pitch:        { icon: '📧', label: 'Brand Pitch',        href: '/signup?from=demo&tool=brand-pitch' },
}

const PLATFORM_EMOJI: Record<string, string> = {
  instagram: '📷',
  tiktok:    '🎵',
  youtube:   '📺',
  x:         '🐦',
  linkedin:  '💼',
  threads:   '🧵',
  facebook:  '👍',
}

const CATEGORIES = [
  {
    label: 'Create',
    icon: '✨',
    color: 'from-brand-500 to-brand-700',
    desc: 'Captions · Hashtags · Scripts · Repurpose · Blog→Social · Polls · DMs · Comment Replies',
    count: 8,
    href: '/demo/captions',
    interactive: true,
  },
  {
    label: 'Optimize',
    icon: '⚙️',
    color: 'from-blue-500 to-cyan-500',
    desc: 'Best Times · YouTube SEO · Bio · Platform Tips · Channel Analysis · Thumbnail · CTA',
    count: 7,
    href: '/demo/best-times',
    interactive: true,
  },
  {
    label: 'Grow',
    icon: '🚀',
    color: 'from-emerald-500 to-teal-500',
    desc: 'Viral Ideas · Trend Radar · Sound Tracker · Collab Finder',
    count: 4,
    href: '/demo/viral-ideas',
    interactive: true,
  },
  {
    label: 'Monetize',
    icon: '💰',
    color: 'from-amber-500 to-orange-500',
    desc: 'Brand Pitch · Rate Calculator · Competitor Analysis',
    count: 3,
    href: '/signup?from=demo&category=monetize',
    interactive: false,
  },
]

function timeAgo(mins: number): string {
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function UsageRing({ used, isPro }: { used: number; isPro: boolean }) {
  const r = 32
  const circumference = 2 * Math.PI * r
  const pct = isPro ? 0 : Math.min(1, used / FREE_DAILY_LIMIT)
  const offset = circumference * (1 - pct)
  const color = pct >= 0.9 ? '#ef4444' : pct >= 0.6 ? '#f59e0b' : '#8b5cf6'

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-20 h-20 flex-shrink-0">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(74,158,224,0.12)" strokeWidth="7" />
          {!isPro && (
            <circle
              cx="40" cy="40" r={r} fill="none"
              stroke={color} strokeWidth="7"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isPro ? (
            <span className="text-lg text-brand-400 font-bold">∞</span>
          ) : (
            <>
              <span className="text-lg font-bold text-zinc-100 leading-none">{used}</span>
              <span className="text-2xs text-zinc-600 leading-none">/{FREE_DAILY_LIMIT}</span>
            </>
          )}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-200">
          {isPro ? 'Unlimited plan' : `${Math.max(0, FREE_DAILY_LIMIT - used)} left today`}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">
          {isPro ? 'All features unlocked' : 'Starter · resets at midnight'}
        </p>
        <Link href="/signup" className="text-xs text-brand-400 font-medium mt-1 inline-block hover:text-brand-300">
          Sign up — it&apos;s free →
        </Link>
      </div>
    </div>
  )
}

export default function DemoDashboardPage() {
  const isPro = MOCK.subscription_tier !== 'free'

  // Compute a sample BRS score from the mock state above. Same function the
  // real dashboard uses — just with mock inputs for the demo.
  const brs = computeBrandReadiness({
    channelCount: MOCK.channels.length,
    voiceProfileExists: true,
    voiceSamples: 4,
    voiceAnalyzed: true,
    uniqueFeaturesUsed: 6,
    savedCount: MOCK.savedCount,
    weekGenerations: MOCK.weekGenerations,
  })

  return (
    <div className="space-y-6 stagger-children">
      {/* Header greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">
            Welcome back, {MOCK.firstName}! 👋
          </h1>
          <p className="text-zinc-500 mt-1 text-sm">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link
          href="/signup"
          className="flex-shrink-0 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-lg transition-all hover:shadow-glow"
        >
          🚀 Sign up — free
        </Link>
      </div>

      {/* Channels row */}
      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-200">Your channels</h2>
          <span className="text-xs text-zinc-600">{MOCK.channels.length} connected (demo)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {MOCK.channels.map((c) => (
            <div key={c.handle} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-tertiary border border-brand-500/5">
              <span className="text-lg">{PLATFORM_EMOJI[c.platform] ?? '🌐'}</span>
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-medium text-zinc-200">{c.handle}</span>
                <span className="text-2xs text-zinc-500">{c.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: '✍️', label: 'This week', value: MOCK.weekGenerations, sub: 'generations' },
          { icon: '📊', label: 'All time', value: MOCK.totalGenerations, sub: 'generations' },
          { icon: '💾', label: 'Saved items', value: MOCK.savedCount, sub: 'pieces of content' },
          { icon: '🔥', label: 'Today', value: MOCK.daily_generations_used, sub: isPro ? 'unlimited' : `of ${FREE_DAILY_LIMIT}` },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 hover:border-brand-500/20 transition-all">
            <span className="text-xl block mb-2">{stat.icon}</span>
            <div className="text-2xl font-bold text-zinc-100">{stat.value}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Brand Readiness Score (live from mock) + Daily usage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <BrandReadinessCard result={brs} />
        </div>
        <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
          <h2 className="text-base font-semibold text-zinc-200 mb-4">Daily Usage</h2>
          <UsageRing used={MOCK.daily_generations_used} isPro={isPro} />
        </div>
      </div>

      {/* Category browse — mirrors the per-category hub structure */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-200">Browse all 22 tools</h2>
          <span className="text-xs text-zinc-500">4 interactive demos · rest unlock on signup</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CATEGORIES.map((c) => (
            <Link
              key={c.label}
              href={c.href}
              className="group relative rounded-xl bg-surface-secondary border border-brand-500/10 p-5 hover:border-brand-500/25 transition-all hover:shadow-glow flex items-start gap-4"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-110 transition-transform`}>
                {c.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-semibold text-zinc-100">{c.label}</h3>
                  <span className="text-2xs text-brand-400 font-medium bg-brand-500/10 px-1.5 py-0.5 rounded-full">{c.count} tools</span>
                  {!c.interactive && (
                    <span className="text-2xs text-amber-400 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded-full">🔒 sign up</span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{c.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent generations — diverse feature mix to showcase breadth */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-200">Recent generations</h2>
        <div className="space-y-2">
          {MOCK.recentGenerations.map((gen) => {
            const meta = FEATURE_META[gen.feature] ?? { icon: '✨', label: gen.feature, href: '/signup' }
            return (
              <Link
                key={gen.id}
                href={meta.href}
                className="flex items-center gap-3 p-4 rounded-xl border border-brand-500/10 bg-surface-secondary hover:border-brand-500/20 hover:bg-surface-elevated transition-all group"
              >
                <span className="text-xl flex-shrink-0 group-hover:scale-110 transition-transform">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-brand-400">{meta.label}</span>
                    <span className="text-xs text-zinc-600 bg-surface-tertiary px-1.5 py-0.5 rounded-full capitalize">{gen.platform}</span>
                  </div>
                  <p className="text-sm text-zinc-400 truncate">{gen.preview}</p>
                </div>
                <span className="text-xs text-zinc-600 flex-shrink-0">{timeAgo(gen.created_at_minutes_ago)}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Final CTA at bottom of demo */}
      <div className="rounded-2xl border border-brand-500/20 bg-gradient-to-br from-brand-900/30 to-surface-secondary p-6 sm:p-8 text-center">
        <h3 className="text-xl sm:text-2xl font-bold text-zinc-100 mb-2">Ready to use the real thing?</h3>
        <p className="text-zinc-400 text-sm mb-5">
          All 22 tools, your voice trained on your captions, generations saved to your library — free to start.
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl transition-all hover:shadow-glow-lg"
        >
          🚀 Start free — 10 credits to try every tool
        </Link>
      </div>
    </div>
  )
}
