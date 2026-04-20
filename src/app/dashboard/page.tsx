'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { SkeletonDashboard } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { FREE_DAILY_LIMIT } from '@/hooks/useUsage'

interface Profile {
  full_name: string | null
  subscription_tier: string
  daily_generations_used: number
  daily_generations_reset_at: string
}

interface Generation {
  id: string
  feature: string
  platform: string | null
  output_data: Record<string, unknown> | null
  created_at: string
}

interface DashboardStats {
  profile: Profile | null
  totalGenerations: number
  savedCount: number
  weekGenerations: number
  recentGenerations: Generation[]
}

const FEATURE_META: Record<string, { icon: string; label: string; href: string }> = {
  // Create
  captions:       { icon: '✍️', label: 'Captions',         href: '/dashboard/generate' },
  hashtags:       { icon: '🏷️', label: 'Hashtags',         href: '/dashboard/hashtags' },
  script:         { icon: '🎬', label: 'Scripts',          href: '/dashboard/scripts' },
  repurpose:      { icon: '♻️', label: 'Repurpose',        href: '/dashboard/repurpose' },
  blog_to_social: { icon: '📰', label: 'Blog → Social',    href: '/dashboard/blog-to-social' },
  polls:          { icon: '📊', label: 'Polls',            href: '/dashboard/polls' },
  dm_template:    { icon: '✉️', label: 'DM Templates',     href: '/dashboard/dm-templates' },
  comment_reply:  { icon: '💬', label: 'Comment Replies',  href: '/dashboard/comment-replies' },
  // Optimize
  posting_times:    { icon: '⏰', label: 'Posting Times',    href: '/dashboard/best-times' },
  youtube_seo:      { icon: '📺', label: 'YouTube SEO',      href: '/dashboard/youtube-seo' },
  bio_optimizer:    { icon: '🧬', label: 'Bio Optimizer',    href: '/dashboard/bio-optimizer' },
  platform_tips:    { icon: '💡', label: 'Platform Tips',    href: '/dashboard/platform-tips' },
  channel_analysis: { icon: '🪞', label: 'Channel Analysis', href: '/dashboard/channel-analysis' },
  // Grow
  viral_ideas:   { icon: '🚀', label: 'Viral Ideas',     href: '/dashboard/viral-ideas' },
  trend_radar:   { icon: '📡', label: 'Trend Radar',     href: '/dashboard/trends' },
  sound_tracker: { icon: '🎵', label: 'Sound Tracker',   href: '/dashboard/sounds' },
  collab_finder: { icon: '🤝', label: 'Collab Finder',   href: '/dashboard/collab-finder' },
  // Monetize
  brand_pitch:          { icon: '📧', label: 'Brand Pitch',         href: '/dashboard/brand-pitch' },
  rate_calculator:      { icon: '💵', label: 'Rate Calculator',     href: '/dashboard/rate-calculator' },
  competitor_analysis:  { icon: '🔍', label: 'Competitor Analysis', href: '/dashboard/competitor-analysis' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function getPreview(gen: Generation): string {
  if (!gen.output_data) return '—'
  const d = gen.output_data as Record<string, unknown>
  const trim = (s: string, n = 80) => s.length > n ? s.slice(0, n) + '…' : s
  try {
    switch (gen.feature) {
      case 'captions': {
        const captions = (d.captions as string[]) ?? []
        return captions[0] ? trim(captions[0]) : '—'
      }
      case 'hashtags': {
        const tags = (d.hashtags as Array<{ tag: string }>) ?? []
        return tags.slice(0, 5).map((h) => h.tag).join(' ') || '—'
      }
      case 'viral_ideas': {
        const ideas = (d.ideas as Array<{ title: string }>) ?? []
        return ideas[0]?.title || '—'
      }
      case 'posting_times': {
        const slots = (d.topSlots as Array<{ day: string; time: string }>) ?? []
        return slots[0] ? `Best: ${slots[0].day} at ${slots[0].time}` : '—'
      }
      case 'script': {
        const hook = d.hook as string | undefined
        return hook ? trim(hook) : '—'
      }
      case 'repurpose': {
        const items = (d.items as Array<{ targetPlatform: string }>) ?? []
        return items.length ? `Repurposed for ${items.map((i) => i.targetPlatform).join(', ')}` : '—'
      }
      case 'blog_to_social': {
        const posts = (d.posts as Array<{ platform: string }>) ?? []
        return posts.length ? `${posts.length} posts extracted for ${Array.from(new Set(posts.map((p) => p.platform))).join(', ')}` : '—'
      }
      case 'polls': {
        const polls = (d.polls as Array<{ question: string }>) ?? []
        return polls[0]?.question ? trim(polls[0].question) : '—'
      }
      case 'dm_template': {
        const body = d.body as string | undefined
        return body ? trim(body) : '—'
      }
      case 'comment_reply': {
        const s = d.short as string | undefined
        return s ? trim(s) : '—'
      }
      case 'youtube_seo': {
        const titles = (d.titles as Array<{ text: string }>) ?? []
        return titles[0]?.text ? trim(titles[0].text) : '—'
      }
      case 'bio_optimizer': {
        const options = (d.options as Array<{ text: string }>) ?? []
        return options[0]?.text ? trim(options[0].text) : '—'
      }
      case 'platform_tips': {
        const tips = (d.tips as Array<{ title: string }>) ?? []
        return tips[0]?.title || `${tips.length} tips`
      }
      case 'channel_analysis': {
        const assessment = d.overallAssessment as string | undefined
        return assessment ? trim(assessment) : '—'
      }
      case 'trend_radar': {
        const trending = (d.trending as Array<{ name: string }>) ?? []
        return trending[0]?.name ? `Top: ${trending[0].name}` : '—'
      }
      case 'sound_tracker': {
        const trending = (d.trending as Array<{ name: string }>) ?? []
        return trending[0]?.name ? `🎵 ${trending[0].name}` : '—'
      }
      case 'collab_finder': {
        const profiles = (d.partnerProfiles as Array<{ description: string }>) ?? []
        return profiles[0]?.description ? trim(profiles[0].description) : '—'
      }
      case 'brand_pitch': {
        const formal = d.formal as { subject?: string } | undefined
        return formal?.subject ? trim(formal.subject) : '—'
      }
      case 'rate_calculator': {
        const rate = d.suggestedRate as { mid?: number } | undefined
        return rate?.mid ? `Suggested: $${rate.mid}` : '—'
      }
      case 'competitor_analysis': {
        const strategy = d.contentStrategy as string | undefined
        return strategy ? trim(strategy) : '—'
      }
    }
  } catch { /* empty */ }
  return '—'
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
          <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(139,92,246,0.1)" strokeWidth="7" />
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
          <Link href="/dashboard/billing" className="text-xs text-brand-400 hover:text-brand-300 font-medium mt-1 inline-block">
            Upgrade →
          </Link>
        )}
      </div>
    </div>
  )
}

const QUICK_ACTIONS = [
  { icon: '✍️', label: 'Generate captions', href: '/dashboard/generate' },
  { icon: '🏷️', label: 'Find hashtags', href: '/dashboard/hashtags' },
  { icon: '⏰', label: 'Best posting times', href: '/dashboard/best-times' },
  { icon: '🚀', label: 'Get viral ideas', href: '/dashboard/viral-ideas' },
]

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        const [profileRes, generationsRes, savedRes, recentRes] = await Promise.all([
          supabase.from('profiles')
            .select('full_name, subscription_tier, daily_generations_used, daily_generations_reset_at')
            .eq('id', user.id)
            .maybeSingle(),
          supabase.from('generations')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id),
          supabase.from('saved_content')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id),
          supabase.from('generations')
            .select('id, feature, platform, output_data, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5),
        ])

        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const { count: weekCount } = await supabase.from('generations')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', weekAgo)

        let dailyUsed = profileRes.data?.daily_generations_used ?? 0
        if (profileRes.data) {
          const resetAt = new Date(profileRes.data.daily_generations_reset_at)
          if (resetAt.toDateString() !== new Date().toDateString()) dailyUsed = 0
        }

        setStats({
          profile: profileRes.data ? { ...profileRes.data, daily_generations_used: dailyUsed } : null,
          totalGenerations: generationsRes.count ?? 0,
          savedCount: savedRes.count ?? 0,
          weekGenerations: weekCount ?? 0,
          recentGenerations: (recentRes.data ?? []) as Generation[],
        })
      } catch (err) {
        console.error('[dashboard] unexpected error:', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  if (loading) return <SkeletonDashboard />

  const profile = stats?.profile
  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const isPro = profile?.subscription_tier !== 'free'

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">
            Welcome back, {firstName}! 👋
          </h1>
          <p className="text-zinc-500 mt-1 text-sm">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {!isPro && (
          <Link
            href="/dashboard/billing"
            className="flex-shrink-0 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm font-medium rounded-lg transition-colors"
          >
            ⚡ Upgrade
          </Link>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: '✍️', label: 'This week', value: stats?.weekGenerations ?? 0, sub: 'generations' },
          { icon: '📊', label: 'All time', value: stats?.totalGenerations ?? 0, sub: 'generations' },
          { icon: '💾', label: 'Saved items', value: stats?.savedCount ?? 0, sub: 'pieces of content' },
          { icon: '🔥', label: 'Today', value: profile?.daily_generations_used ?? 0, sub: isPro ? 'unlimited' : `of ${FREE_DAILY_LIMIT}` },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 hover:border-brand-500/20 transition-all">
            <span className="text-xl block mb-2">{stat.icon}</span>
            <div className="text-2xl font-bold text-zinc-100">{stat.value}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick actions */}
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

        {/* Daily usage */}
        <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
          <h2 className="text-base font-semibold text-zinc-200 mb-4">Daily Usage</h2>
          <UsageRing used={profile?.daily_generations_used ?? 0} isPro={isPro} />
        </div>
      </div>

      {/* Recent generations */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-200">Recent Generations</h2>
        </div>

        {stats?.recentGenerations && stats.recentGenerations.length > 0 ? (
          <div className="space-y-2">
            {stats.recentGenerations.map((gen) => {
              const meta = FEATURE_META[gen.feature] ?? { icon: '✨', label: gen.feature, href: '/dashboard' }
              return (
                <Link
                  key={gen.id}
                  href={`/dashboard/generations/${gen.id}`}
                  className="flex items-center gap-3 p-4 rounded-xl border border-brand-500/10 bg-surface-secondary hover:border-brand-500/20 hover:bg-surface-elevated transition-all group"
                >
                  <span className="text-xl flex-shrink-0 group-hover:scale-110 transition-transform">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-brand-400">{meta.label}</span>
                      {gen.platform && (
                        <span className="text-xs text-zinc-600 bg-surface-tertiary px-1.5 py-0.5 rounded-full capitalize">{gen.platform}</span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-400 truncate">{getPreview(gen)}</p>
                  </div>
                  <span className="text-xs text-zinc-600 flex-shrink-0">{timeAgo(gen.created_at)}</span>
                </Link>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon="📝"
            title="No generations yet"
            description="Start generating captions, hashtags, or viral ideas and they'll appear here."
            actionLabel="Generate Your First Caption"
            actionHref="/dashboard/generate"
          />
        )}
      </div>
    </div>
  )
}
