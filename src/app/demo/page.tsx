'use client'

import Link from 'next/link'

const FREE_DAILY_LIMIT = 10

const MOCK = {
  firstName: 'Alex',
  subscription_tier: 'free',
  daily_generations_used: 4,
  totalGenerations: 127,
  savedCount: 23,
  weekGenerations: 18,
  recentGenerations: [
    {
      id: '1',
      feature: 'captions',
      platform: 'instagram',
      preview: "Sunset chasers only 🌅 Nothing hits like golden hour over the Pacific. Tag someone you'd watch this with.",
      created_at_minutes_ago: 12,
    },
    {
      id: '2',
      feature: 'hashtags',
      platform: 'tiktok',
      preview: '#fitnessjourney #homeworkout #nogymneeded #fitlife #transformationtuesday',
      created_at_minutes_ago: 45,
    },
    {
      id: '3',
      feature: 'viral_ideas',
      platform: 'tiktok',
      preview: '"I tried the 5-ingredient dinner challenge for a week" — POV reveal format',
      created_at_minutes_ago: 180,
    },
    {
      id: '4',
      feature: 'posting_times',
      platform: 'instagram',
      preview: 'Best: Tuesday at 10:00 AM',
      created_at_minutes_ago: 360,
    },
    {
      id: '5',
      feature: 'captions',
      platform: 'x',
      preview: 'Shipping beats perfection. Day 47 of building in public — today we hit 1,000 users.',
      created_at_minutes_ago: 1440,
    },
  ],
}

const FEATURE_META: Record<string, { icon: string; label: string; href: string }> = {
  captions: { icon: '✍️', label: 'Captions', href: '/demo/captions' },
  hashtags: { icon: '🏷️', label: 'Hashtags', href: '/demo/hashtags' },
  posting_times: { icon: '⏰', label: 'Posting Times', href: '/demo/best-times' },
  viral_ideas: { icon: '🚀', label: 'Viral Ideas', href: '/demo/viral-ideas' },
}

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
        {!isPro && (
          <span className="text-xs text-brand-400 font-medium mt-1 inline-block">
            Upgrade →
          </span>
        )}
      </div>
    </div>
  )
}

const QUICK_ACTIONS = [
  { icon: '✍️', label: 'Generate captions', href: '/demo/captions' },
  { icon: '🏷️', label: 'Find hashtags', href: '/demo/hashtags' },
  { icon: '⏰', label: 'Best posting times', href: '/demo/best-times' },
  { icon: '🚀', label: 'Get viral ideas', href: '/demo/viral-ideas' },
]

export default function DemoDashboardPage() {
  const isPro = MOCK.subscription_tier !== 'free'

  return (
    <div className="space-y-6 stagger-children">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">
            Welcome back, {MOCK.firstName}! 👋
          </h1>
          <p className="text-zinc-500 mt-1 text-sm">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {!isPro && (
          <div className="flex-shrink-0 px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-medium rounded-lg">
            ⚡ Upgrade
          </div>
        )}
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-base font-semibold text-zinc-200">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-secondary border border-brand-500/10 hover:border-brand-500/25 hover:bg-surface-elevated transition-all group min-h-[52px]"
              >
                <span className="text-xl group-hover:scale-110 transition-transform">{action.icon}</span>
                <span className="text-sm font-medium text-zinc-300">{action.label}</span>
                <span className="ml-auto text-zinc-600 group-hover:text-zinc-400 transition-colors text-sm">→</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
          <h2 className="text-base font-semibold text-zinc-200 mb-4">Daily Usage</h2>
          <UsageRing used={MOCK.daily_generations_used} isPro={isPro} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-200">Recent Generations</h2>
        </div>

        <div className="space-y-2">
          {MOCK.recentGenerations.map((gen) => {
            const meta = FEATURE_META[gen.feature] ?? { icon: '✨', label: gen.feature, href: '/demo' }
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
    </div>
  )
}
