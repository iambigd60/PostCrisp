'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { SkeletonDashboard } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { TIER_ALLOWANCE, tierFromDbValue } from '@/lib/crisp-engine-config'
import { PLATFORM_META, avatarUrlFor, type Channel } from '@/lib/channels'
import { GettingStartedCard, type GettingStartedState } from '@/components/GettingStartedCard'
import { NextToolsCard, type NextToolsState } from '@/components/NextToolsCard'
import { BrandReadinessCard } from '@/components/BrandReadinessCard'
import { computeBrandReadiness, type BrsResult } from '@/lib/brand-readiness'

interface Profile {
  full_name: string | null
  subscription_tier: string
  daily_generations_used: number
  daily_generations_reset_at: string
  credits_balance: number
  credits_reset_at: string
  preferences?: {
    getting_started_dismissed?: boolean
    onboarded_at?: string | null
    next_tools_dismissed?: boolean
    tutorial_progress?: { completed?: boolean } | null
  } | null
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
  channels: Channel[]
  // Maps channel platform → count of generations that went on that platform this week.
  weekGensByPlatform: Record<string, number>
  // Feature keys the user has used at least once (all time). Used to pick unused features for suggestions.
  featuresUsed: Set<string>
  // Getting-started checklist state (persisted via profiles.preferences).
  gettingStarted: GettingStartedState
  gettingStartedDismissed: boolean
  // Phase 2 — 10 next tools checklist. Only shown after the 5-step tutorial
  // is marked completed in tutorial_progress.
  nextTools: NextToolsState
  nextToolsDismissed: boolean
  showNextTools: boolean
  // Brand Readiness Score — deterministic 0-100 scored across 5 dimensions
  // from the same inputs already loaded above. No additional fetches.
  brs: BrsResult
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
  thumbnail_analyzer: { icon: '🖼️', label: 'Thumbnail Analyzer', href: '/dashboard/thumbnail-analyzer' },
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

function CreditMeter({ balance, allowance, resetAt, cycleLabel }: { balance: number; allowance: number; resetAt: string | null; cycleLabel: string }) {
  const r = 32
  const circumference = 2 * Math.PI * r
  const pct = allowance > 0 ? Math.min(1, balance / allowance) : 0
  const offset = circumference * (1 - pct)
  // Invert threshold: low balance = red
  const color = pct <= 0.1 ? '#ef4444' : pct <= 0.3 ? '#f59e0b' : '#10b981'
  const low = pct <= 0.1

  const resetIn = resetAt ? formatResetDistance(new Date(resetAt)) : cycleLabel

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-20 h-20 flex-shrink-0">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(74,158,224,0.12)" strokeWidth="7" />
          <circle
            cx="40" cy="40" r={r} fill="none"
            stroke={color} strokeWidth="7"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-zinc-100 leading-none">{balance}</span>
          <span className="text-2xs text-zinc-600 leading-none">/{allowance}</span>
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-200">
          {balance} credits left
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">
          Resets {resetIn}
        </p>
        {low ? (
          <Link href="/dashboard/billing" className="text-xs text-red-400 hover:text-red-300 font-medium mt-1 inline-block">
            Low balance — top up →
          </Link>
        ) : (
          <Link href="/dashboard/billing" className="text-xs text-brand-400 hover:text-brand-300 font-medium mt-1 inline-block">
            Buy more credits →
          </Link>
        )}
      </div>
    </div>
  )
}

function formatResetDistance(d: Date): string {
  const ms = d.getTime() - Date.now()
  if (ms <= 0) return 'now'
  const hours = Math.floor(ms / 3_600_000)
  if (hours < 1) {
    const mins = Math.max(1, Math.floor(ms / 60_000))
    return `in ${mins}m`
  }
  if (hours < 24) return `in ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `in ${days}d`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const QUICK_ACTIONS = [
  { icon: '✍️', label: 'Generate captions', href: '/dashboard/generate' },
  { icon: '🏷️', label: 'Find hashtags', href: '/dashboard/hashtags' },
  { icon: '⏰', label: 'Best posting times', href: '/dashboard/best-times' },
  { icon: '🚀', label: 'Get viral ideas', href: '/dashboard/viral-ideas' },
]

// Daily briefing generator. Reads the user's internal usage data and returns
// a 1-2 sentence brief that feels personalized. Pure function of the stats
// object — no randomness, so it stays stable across re-renders in the same
// session. Deliberately INTERNAL data only (no scraped social data).
function buildBriefing(stats: DashboardStats, firstName: string): string {
  const { channels, weekGenerations, savedCount, totalGenerations, featuresUsed } = stats

  // First-time or near-empty state
  if (totalGenerations === 0) {
    if (channels.length === 0) {
      return `Welcome in, ${firstName}. Start by adding your channels in Settings — PostCrisp tailors every caption, script, and idea to the platforms you actually post on.`
    }
    const platforms = channels.map((c) => PLATFORM_META[c.platform]?.label ?? c.platform).slice(0, 2).join(' and ')
    return `Welcome in, ${firstName}. Your ${platforms} channel${channels.length === 1 ? '' : 's'} ${channels.length === 1 ? 'is' : 'are'} all set. Generate your first caption — takes about fifteen seconds.`
  }

  // Active user
  const parts: string[] = []
  if (weekGenerations > 0) {
    parts.push(`You've run ${weekGenerations} generation${weekGenerations === 1 ? '' : 's'} this week`)
  } else if (totalGenerations > 0) {
    parts.push(`You haven't generated anything this week yet`)
  }

  if (savedCount > 0) {
    parts.push(`${savedCount} piece${savedCount === 1 ? '' : 's'} saved in your library`)
  }

  // Tease a feature they haven't used yet
  const FEATURE_SUGGESTIONS = [
    { key: 'viral_ideas', blurb: '— try Viral Ideas for a fresh angle' },
    { key: 'channel_analysis', blurb: '— a Channel Analysis might spot gaps in your strategy' },
    { key: 'repurpose', blurb: '— Repurpose turns one post into five' },
    { key: 'posting_times', blurb: '— Best Times can tune your schedule' },
  ]
  const unused = FEATURE_SUGGESTIONS.find((s) => !featuresUsed.has(s.key))

  let sentence = parts.length > 0 ? parts.join(', ') : `Nice to see you back, ${firstName}`
  if (unused) sentence += ` ${unused.blurb}.`
  else sentence += '.'

  return sentence
}

// Proactive suggestions — color-coded by urgency. All signals are internal
// PostCrisp data (no scraped social data) so they work even without any
// platform API integration.
type Suggestion = { id: string; icon: string; label: string; message: string; cta: string; href: string; urgency: 'high' | 'medium' | 'low' }

function buildSuggestions(stats: DashboardStats): Suggestion[] {
  const out: Suggestion[] = []
  const { profile, channels, weekGenerations, weekGensByPlatform, featuresUsed } = stats

  // Low-credit warning
  const tier = tierFromDbValue(profile?.subscription_tier)
  const allowance = TIER_ALLOWANCE[tier].credits
  const balance = profile?.credits_balance ?? 0
  if (allowance > 0 && balance / allowance <= 0.15) {
    out.push({
      id: 'low-credits',
      icon: '⚠️',
      label: 'Credits running low',
      message: `You have ${balance} credit${balance === 1 ? '' : 's'} left of your ${allowance} ${TIER_ALLOWANCE[tier].cycle} allowance.`,
      cta: 'Top up',
      href: '/dashboard/billing',
      urgency: 'high',
    })
  }

  // Missing channels
  if (channels.length === 0) {
    out.push({
      id: 'no-channels',
      icon: '🧭',
      label: 'Connect your channels',
      message: 'List the social accounts you post to. PostCrisp uses these to personalize every tool + organize your library.',
      cta: 'Add channels',
      href: '/dashboard/settings',
      urgency: 'medium',
    })
  } else {
    // Find a channel they haven't generated for this week
    const quietChannel = channels.find((c) => !weekGensByPlatform[c.platform])
    if (quietChannel && weekGenerations > 0) {
      const meta = PLATFORM_META[quietChannel.platform]
      out.push({
        id: 'quiet-channel',
        icon: meta?.icon ?? '🔕',
        label: `Nothing for ${meta?.label ?? quietChannel.platform} this week`,
        message: `${quietChannel.handle} hasn't had any content generated this week. Want to write something?`,
        cta: 'Generate now',
        href: '/dashboard/generate',
        urgency: 'low',
      })
    }
  }

  // Haven't tried Voice Trainer
  if (!featuresUsed.has('voice_profile_analyzed')) {
    // Only recommend Voice Trainer if user has generated SOMETHING — don't overwhelm day-1 users
    if (stats.totalGenerations >= 3) {
      out.push({
        id: 'voice-trainer',
        icon: '🎙️',
        label: 'Train your writing style',
        message: 'Paste 3+ captions you\'ve written, and PostCrisp will match your voice on every future generation.',
        cta: 'Open Voice Trainer',
        href: '/dashboard/voice',
        urgency: 'low',
      })
    }
  }

  return out.slice(0, 3)
}

// Animated typewriter for the daily briefing. Renders progressively to feel
// 'alive' on page load, then stays static. No loop — runs once per mount.
function TypedBriefing({ text }: { text: string }) {
  const [shown, setShown] = useState('')
  const [done, setDone] = useState(false)
  const idx = useRef(0)

  useEffect(() => {
    idx.current = 0
    setShown('')
    setDone(false)
    // Short initial delay so the animation doesn't clash with layout shift.
    const delay = setTimeout(() => {
      const interval = setInterval(() => {
        if (idx.current < text.length) {
          idx.current++
          setShown(text.slice(0, idx.current))
        } else {
          setDone(true)
          clearInterval(interval)
        }
      }, 18)
      return () => clearInterval(interval)
    }, 200)
    return () => clearTimeout(delay)
  }, [text])

  return (
    <>
      {shown}
      {!done && <span className="inline-block w-[2px] h-4 bg-brand-400 ml-0.5 align-middle animate-pulse" />}
    </>
  )
}

// Channel avatar with platform-emoji fallback. Tries unavatar.io first;
// if the image fails to load (CSP block, network error, platform not
// supported, or the user's handle is wrong), the emoji icon shows instead.
// Either way the dashboard stays intact.
function ChannelAvatar({ platform, handle }: { platform: Channel['platform']; handle: string }) {
  const [errored, setErrored] = useState(false)
  const meta = PLATFORM_META[platform]
  const url = avatarUrlFor(platform, handle)

  if (errored || !url) {
    return (
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${meta.chip.split(' ').slice(0, 2).join(' ')}`}>
        {meta.icon}
      </div>
    )
  }

  return (
    <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-brand-500/20 bg-surface-tertiary flex-shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={handle}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setErrored(true)}
        className="w-full h-full object-cover"
      />
      {/* Tiny platform emoji overlay so the user can still tell which channel
          this is at a glance, even when the avatar loads — helps when two
          channels have similar profile pictures. */}
      <span
        aria-hidden
        className="absolute bottom-0 right-0 text-[10px] leading-none bg-surface-primary/90 rounded-tl-md px-0.5 py-0.5"
      >
        {meta.icon}
      </span>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

        const [profileRes, generationsRes, savedRes, recentRes, channelsRes, weekGensRes, featuresRes, voiceRes] = await Promise.all([
          supabase.from('profiles')
            .select('full_name, subscription_tier, daily_generations_used, daily_generations_reset_at, credits_balance, credits_reset_at, preferences')
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
          supabase.from('channels')
            .select('id, user_id, platform, handle, label, url, sort_order, created_at, updated_at')
            .eq('user_id', user.id)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true }),
          // Per-platform generation counts for this week — used for the 'you haven't
          // posted on X yet this week' proactive suggestion + channel card stats.
          supabase.from('generations')
            .select('platform')
            .eq('user_id', user.id)
            .gte('created_at', weekAgo),
          // Distinct feature set all-time — used to pick unused features to suggest.
          supabase.from('generations')
            .select('feature')
            .eq('user_id', user.id),
          // Voice profile traits + samples — populated traits means analyzed,
          // samples count drives Brand Readiness Score.
          supabase.from('voice_profiles')
            .select('traits, samples')
            .eq('user_id', user.id)
            .maybeSingle(),
        ])

        let dailyUsed = profileRes.data?.daily_generations_used ?? 0
        if (profileRes.data) {
          const resetAt = new Date(profileRes.data.daily_generations_reset_at)
          if (resetAt.toDateString() !== new Date().toDateString()) dailyUsed = 0
        }

        const weekGensByPlatform: Record<string, number> = {}
        for (const row of (weekGensRes.data ?? []) as { platform: string | null }[]) {
          if (!row.platform) continue
          weekGensByPlatform[row.platform] = (weekGensByPlatform[row.platform] ?? 0) + 1
        }

        const featuresUsed = new Set<string>()
        for (const row of (featuresRes.data ?? []) as { feature: string }[]) {
          if (row.feature) featuresUsed.add(row.feature)
        }

        const channels = (channelsRes.data ?? []) as Channel[]
        const totalGenerations = generationsRes.count ?? 0
        const savedCount = savedRes.count ?? 0
        const voiceTrained = !!voiceRes.data?.traits
        const prefs = (profileRes.data?.preferences ?? {}) as Profile['preferences']

        const gettingStarted: GettingStartedState = {
          channelsAdded: channels.length > 0,
          firstGeneration: totalGenerations > 0,
          savedSomething: savedCount > 0,
          triedThreeFeatures: featuresUsed.size >= 3,
          voiceTrained,
        }

        // Phase 2 — 10 next-tool checklist. Auto-checks each tool when the
        // matching feature key appears in generations.feature for this user.
        const nextTools: NextToolsState = {
          script:           featuresUsed.has('script'),
          repurpose:        featuresUsed.has('repurpose'),
          channel_analysis: featuresUsed.has('channel_analysis'),
          trend_radar:      featuresUsed.has('trend_radar'),
          platform_tips:    featuresUsed.has('platform_tips'),
          bio_optimizer:    featuresUsed.has('bio_optimizer'),
          sound_tracker:    featuresUsed.has('sound_tracker'),
          blog_to_social:   featuresUsed.has('blog_to_social'),
          comment_reply:    featuresUsed.has('comment_reply'),
          brand_pitch:      featuresUsed.has('brand_pitch'),
        }
        // Only surface Phase 2 once the 5-step tutorial is marked completed.
        // Pre-tutorial users still see GettingStartedCard for the basics.
        const tutorialDone = !!prefs?.tutorial_progress?.completed
        const onboardedAt = prefs?.onboarded_at
        // Backfill: pre-tutorial alpha testers who already finished onboarding
        // (onboarded_at set, no tutorial_progress yet) shouldn't be skipped.
        const showNextTools = tutorialDone || !!onboardedAt

        // Brand Readiness Score — pure-function compute from the inputs we
        // already loaded. Re-runs on every dashboard load so it always
        // reflects current state.
        const voiceRow = voiceRes.data as { traits: unknown; samples: unknown[] | null } | null
        const brs = computeBrandReadiness({
          channelCount: channels.length,
          voiceProfileExists: !!voiceRow,
          voiceSamples: Array.isArray(voiceRow?.samples) ? voiceRow.samples.length : 0,
          voiceAnalyzed: voiceTrained,
          uniqueFeaturesUsed: featuresUsed.size,
          savedCount,
          weekGenerations: (weekGensRes.data ?? []).length,
        })

        setStats({
          profile: profileRes.data ? { ...profileRes.data, daily_generations_used: dailyUsed } : null,
          totalGenerations,
          savedCount,
          weekGenerations: (weekGensRes.data ?? []).length,
          recentGenerations: (recentRes.data ?? []) as Generation[],
          channels,
          weekGensByPlatform,
          featuresUsed,
          gettingStarted,
          gettingStartedDismissed: Boolean(prefs?.getting_started_dismissed),
          nextTools,
          nextToolsDismissed: Boolean(prefs?.next_tools_dismissed),
          showNextTools,
          brs,
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
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const briefing = stats ? buildBriefing(stats, firstName) : ''
  const suggestions = stats ? buildSuggestions(stats) : []

  return (
    <div className="space-y-6">
      {/* Header — greeting + date + upgrade CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">
            {greeting}, {firstName}
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

      {/* Channels row — moved to the top so the user immediately sees what
          they have. Only renders when channels exist; new users land on
          GettingStartedCard's "Add your channels" prompt instead. */}
      {stats && stats.channels.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300">Your channels</h2>
            <Link href="/dashboard/settings" className="text-xs text-brand-400 hover:text-brand-300">Manage →</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            {stats.channels.map((c) => {
              const meta = PLATFORM_META[c.platform]
              const weekCount = stats.weekGensByPlatform[c.platform] ?? 0
              return (
                <div
                  key={c.id}
                  className="flex-shrink-0 min-w-[220px] rounded-xl border border-brand-500/10 bg-surface-secondary hover:border-brand-500/25 transition-all p-4 group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <ChannelAvatar platform={c.platform} handle={c.handle} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">{meta.label}</div>
                      <div className="text-sm text-zinc-200 truncate">{c.handle}</div>
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500">
                    <span className="font-bold text-zinc-200">{weekCount}</span> generation{weekCount === 1 ? '' : 's'} this week
                  </div>
                  {c.label && <div className="text-2xs text-zinc-600 mt-1 truncate">{c.label}</div>}
                </div>
              )
            })}
            <Link
              href="/dashboard/settings"
              className="flex-shrink-0 min-w-[120px] rounded-xl border border-dashed border-brand-500/20 hover:border-brand-500/40 hover:bg-surface-secondary/60 transition-all p-4 flex flex-col items-center justify-center text-zinc-500 hover:text-zinc-300"
            >
              <span className="text-xl mb-1">＋</span>
              <span className="text-xs font-medium">Add channel</span>
            </Link>
          </div>
        </div>
      )}

      {/* Daily briefing — typed text, references the user's channels + usage */}
      <div className="rounded-xl border border-brand-500/20 bg-surface-secondary shadow-glow p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center text-xl flex-shrink-0">
          ✦
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-2xs font-bold uppercase tracking-wider text-brand-300 mb-1.5">Your daily briefing</div>
          <p className="text-sm sm:text-base text-zinc-200 leading-relaxed min-h-[1.5rem]">
            <TypedBriefing text={briefing} />
          </p>
        </div>
      </div>

      {/* Getting Started checklist — hides once fully complete or user dismisses */}
      {stats && (
        <GettingStartedCard
          state={stats.gettingStarted}
          dismissed={stats.gettingStartedDismissed}
          onDismiss={() => setStats((prev) => prev ? { ...prev, gettingStartedDismissed: true } : prev)}
        />
      )}

      {/* Phase 2 — 10 next tools to try. Only surfaces post-tutorial. */}
      {stats?.showNextTools && (
        <NextToolsCard
          state={stats.nextTools}
          dismissed={stats.nextToolsDismissed}
          onDismiss={() => setStats((prev) => prev ? { ...prev, nextToolsDismissed: true } : prev)}
        />
      )}

      {/* Brand Readiness Score — always visible, deterministic, free. */}
      {stats && <BrandReadinessCard result={stats.brs} />}

      {/* Metrics + Credits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-2 gap-3">
          {[
            { icon: '✍️', label: 'This week',   value: stats?.weekGenerations ?? 0,            sub: 'generations' },
            { icon: '📊', label: 'All time',    value: stats?.totalGenerations ?? 0,           sub: 'generations' },
            { icon: '💾', label: 'Saved items', value: stats?.savedCount ?? 0,                 sub: 'in your library' },
            { icon: '🔥', label: 'Today',       value: profile?.daily_generations_used ?? 0,   sub: 'generations' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 hover:border-brand-500/20 transition-all">
              <span className="text-xl block mb-2">{stat.icon}</span>
              <div className="text-2xl font-bold text-zinc-100">{stat.value}</div>
              <div className="text-xs text-zinc-500 mt-0.5">{stat.label}</div>
              <div className="text-2xs text-zinc-600">{stat.sub}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
          <h2 className="text-base font-semibold text-zinc-200 mb-4">Credits</h2>
          <CreditMeter
            balance={profile?.credits_balance ?? 0}
            allowance={TIER_ALLOWANCE[tierFromDbValue(profile?.subscription_tier)].credits}
            resetAt={profile?.credits_reset_at ?? null}
            cycleLabel={TIER_ALLOWANCE[tierFromDbValue(profile?.subscription_tier)].cycle === 'daily' ? 'daily' : 'monthly'}
          />
        </div>
      </div>

      {/* Two-column: Recent Generations + Proactive Suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent generations (left, 2 cols) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-200">Recent content</h2>
          </div>

          {stats?.recentGenerations && stats.recentGenerations.length > 0 ? (
            <div className="space-y-2">
              {stats.recentGenerations.map((gen) => {
                const meta = FEATURE_META[gen.feature] ?? { icon: '✨', label: gen.feature, href: '/dashboard' }
                const platformMeta = gen.platform ? PLATFORM_META[gen.platform as keyof typeof PLATFORM_META] : null
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
                        {platformMeta && (
                          <span className={`text-2xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${platformMeta.chip}`}>
                            {platformMeta.icon} {platformMeta.label}
                          </span>
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

        {/* Proactive suggestions + quick actions (right column) */}
        <div className="space-y-3">
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-zinc-200">PostCrisp suggests</h2>
              {suggestions.map((s) => {
                const borderColor =
                  s.urgency === 'high'   ? 'border-l-red-400' :
                  s.urgency === 'medium' ? 'border-l-amber-400' :
                                           'border-l-brand-400'
                const labelColor =
                  s.urgency === 'high'   ? 'text-red-300' :
                  s.urgency === 'medium' ? 'text-amber-300' :
                                           'text-brand-300'
                return (
                  <Link
                    key={s.id}
                    href={s.href}
                    className={`block rounded-xl border border-brand-500/10 border-l-4 ${borderColor} bg-surface-secondary hover:bg-surface-elevated p-4 transition-all group`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-lg flex-shrink-0">{s.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-2xs font-bold uppercase tracking-wider ${labelColor} mb-1`}>{s.label}</div>
                        <p className="text-sm text-zinc-300 leading-snug">{s.message}</p>
                        <span className="inline-block text-xs text-brand-400 group-hover:text-brand-300 font-medium mt-2">
                          {s.cta} →
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-zinc-200">Quick actions</h2>
            <div className="grid grid-cols-1 gap-2">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-secondary border border-brand-500/10 hover:border-brand-500/25 hover:bg-surface-elevated transition-all group min-h-[48px]"
                >
                  <span className="text-lg group-hover:scale-110 transition-transform">{action.icon}</span>
                  <span className="text-sm font-medium text-zinc-300">{action.label}</span>
                  <span className="ml-auto text-zinc-600 group-hover:text-brand-400 transition-colors text-sm">→</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer affordance — only renders if user has dismissed at least one
          of the onboarding cards. One-click reset to bring them back. */}
      {stats && (stats.gettingStartedDismissed || stats.nextToolsDismissed) && (
        <div className="flex justify-center pt-4 pb-2 border-t border-brand-500/5">
          <button
            onClick={async () => {
              try {
                await fetch('/api/user/preferences', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    getting_started_dismissed: false,
                    next_tools_dismissed: false,
                  }),
                })
                setStats((prev) => prev ? {
                  ...prev,
                  gettingStartedDismissed: false,
                  nextToolsDismissed: false,
                } : prev)
              } catch {
                // Non-fatal — toggling visibility shouldn't error-out the dashboard.
              }
            }}
            className="text-xs text-zinc-500 hover:text-brand-300 transition-colors"
          >
            ↩  Show hidden checklists
          </button>
        </div>
      )}
    </div>
  )
}
