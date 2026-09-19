/**
 * Tool metadata — single source of truth for hub pages, dashboard recent-
 * content cards, and anywhere the app needs to display a tool's identity
 * + tagline.
 *
 * `key` matches the value written to `generations.feature` so per-tool
 * recent activity can be filtered without a join.
 */

import { CREDITS_PER_TASK, type CrispTask } from './crisp-engine-config'

export type ToolCategory = 'create' | 'optimize' | 'grow' | 'monetize'

export interface ToolMeta {
  key: string
  /**
   * The engine task this tool runs. `CREDITS_PER_TASK` is keyed by this, so
   * `creditCost` below is always derived from the one price table the API
   * routes charge against — never hard-code a credit number in a page.
   */
  task: CrispTask
  /** Credits charged per run, read from `CREDITS_PER_TASK[task]`. */
  creditCost: number
  /** Typical wall-clock time for one run, shown beside the price ("~10s", "30–60s"). */
  duration: string
  category: ToolCategory
  icon: string
  label: string
  /** 1-line value prop. Shown as the card subtitle. */
  tagline: string
  /** "Best for: ..." — the situation where this tool wins. */
  bestFor: string
  href: string
}

/** Tool definition before the derived price is attached. */
type ToolDef = Omit<ToolMeta, 'creditCost'>

/** Attach `creditCost` from the canonical price table so it can never drift. */
function withCosts(defs: ToolDef[]): ToolMeta[] {
  return defs.map((d) => ({ ...d, creditCost: CREDITS_PER_TASK[d.task] }))
}

// CREATE — content authoring tools. Phase 1 hub.
export const CREATE_TOOLS: ToolMeta[] = withCosts([
  {
    key: 'captions',
    task: 'captions',
    duration: '~10s',
    category: 'create',
    icon: '✍️',
    label: 'Captions',
    tagline: 'Generate ready-to-post captions in your voice.',
    bestFor: 'A single feed post you need to ship today.',
    href: '/dashboard/generate',
  },
  {
    key: 'hashtags',
    task: 'hashtags',
    duration: '~10s',
    category: 'create',
    icon: '🏷️',
    label: 'Hashtags',
    tagline: 'Mix popular + niche hashtags tuned to your platform.',
    bestFor: 'Stretching reach without looking spammy.',
    href: '/dashboard/hashtags',
  },
  {
    key: 'script',
    task: 'script',
    duration: '~15s',
    category: 'create',
    icon: '🎬',
    label: 'Scripts',
    tagline: 'Outline videos + shorts in seconds — hook, beats, CTA.',
    bestFor: 'Planning before you hit record.',
    href: '/dashboard/scripts',
  },
  {
    key: 'repurpose',
    task: 'repurpose',
    duration: '~20s',
    category: 'create',
    icon: '♻️',
    label: 'Repurpose',
    tagline: 'One piece of content → cross-platform variants.',
    bestFor: 'Making your best post work everywhere else too.',
    href: '/dashboard/repurpose',
  },
  {
    key: 'blog_to_social',
    task: 'blog-to-social',
    duration: '~20s',
    category: 'create',
    icon: '📰',
    label: 'Blog → Social',
    tagline: 'Long article → carousel + thread + captions.',
    bestFor: 'Extracting social posts from your newsletter or blog.',
    href: '/dashboard/blog-to-social',
  },
  {
    key: 'polls',
    task: 'polls',
    duration: '~10s',
    category: 'create',
    icon: '📊',
    label: 'Polls',
    tagline: 'Poll questions tuned for engagement.',
    bestFor: 'Stories and posts where comments matter.',
    href: '/dashboard/polls',
  },
  {
    key: 'dm_template',
    task: 'dm-template',
    duration: '~15s',
    category: 'create',
    icon: '✉️',
    label: 'DM Templates',
    tagline: "Outreach DMs that don't sound like outreach DMs.",
    bestFor: 'Collab pitches, customer follow-ups, networking.',
    href: '/dashboard/dm-templates',
  },
  {
    key: 'comment_reply',
    task: 'comment-reply',
    duration: '~10s',
    category: 'create',
    icon: '💬',
    label: 'Comment Replies',
    tagline: 'Three reply variants tuned to engagement.',
    bestFor: "High-value comments where a generic 'thanks!' loses steam.",
    href: '/dashboard/comment-replies',
  },
])

// OPTIMIZE — channel + asset improvement tools.
export const OPTIMIZE_TOOLS: ToolMeta[] = withCosts([
  {
    key: 'posting_times',
    task: 'posting-times',
    duration: '~15s',
    category: 'optimize',
    icon: '⏰',
    label: 'Best Times',
    tagline: 'Find the hours your audience actually shows up.',
    bestFor: 'Scheduling posts across multiple platforms.',
    href: '/dashboard/best-times',
  },
  {
    key: 'youtube_seo',
    task: 'youtube-seo',
    duration: '~20s',
    category: 'optimize',
    icon: '📺',
    label: 'YouTube SEO',
    tagline: 'Title, description, tags, hashtags — built to rank.',
    bestFor: 'Any new YouTube upload\'s search performance.',
    href: '/dashboard/youtube-seo',
  },
  {
    key: 'bio_optimizer',
    task: 'bio-optimizer',
    duration: '~15s',
    category: 'optimize',
    icon: '🧬',
    label: 'Bio Optimizer',
    tagline: 'Rewrite your profile bio to convert lurkers into followers.',
    bestFor: 'Refreshing bios after a positioning or niche shift.',
    href: '/dashboard/bio-optimizer',
  },
  {
    key: 'platform_tips',
    task: 'platform-tips',
    duration: '~15s',
    category: 'optimize',
    icon: '💡',
    label: 'Platform Tips',
    tagline: 'Algorithm dynamics + best practices specific to each platform.',
    bestFor: 'Getting up to speed when you\'re entering a new platform.',
    href: '/dashboard/platform-tips',
  },
  {
    key: 'channel_analysis',
    task: 'channel-analysis',
    duration: '20–40s',
    category: 'optimize',
    icon: '🪞',
    label: 'Channel Analysis',
    tagline: 'Honest audit of your channel — strengths, gaps, recommendations.',
    bestFor: 'A quarterly self-checkup or pre-pivot diagnostic.',
    href: '/dashboard/channel-analysis',
  },
  {
    key: 'foundation_analysis',
    task: 'foundation-analysis',
    duration: '30–60s',
    category: 'optimize',
    icon: '🧬',
    label: 'Foundation Analysis',
    tagline: 'Evidence-grounded audit + reusable Creator Profile.',
    bestFor: 'The strategic foundation every other tool reads from.',
    href: '/dashboard/foundation-analysis',
  },
  {
    key: 'thumbnail_analyzer',
    task: 'thumbnail-analyzer',
    duration: '15–30s',
    category: 'optimize',
    icon: '🖼️',
    label: 'Thumbnail Analyzer',
    tagline: 'Click-prediction critique with prioritized fixes.',
    bestFor: 'A/B-deciding before you publish a thumbnail.',
    href: '/dashboard/thumbnail-analyzer',
  },
  {
    key: 'cta_optimizer',
    task: 'cta-optimizer',
    duration: '~15s',
    category: 'optimize',
    icon: '🎯',
    label: 'CTA Optimizer',
    tagline: 'Recommended CTA + 4 alternatives, scored for your platform + goal.',
    bestFor: 'Squeezing more conversions out of content you\'ve already drafted.',
    href: '/dashboard/cta-optimizer',
  },
])

// GROW — discovery + reach tools.
export const GROW_TOOLS: ToolMeta[] = withCosts([
  {
    key: 'viral_ideas',
    task: 'viral-ideas',
    duration: '~20s',
    category: 'grow',
    icon: '🚀',
    label: 'Viral Ideas',
    tagline: 'Specific content ideas tailored to your niche.',
    bestFor: 'Stuck-on-what-to-post days.',
    href: '/dashboard/viral-ideas',
  },
  {
    key: 'trend_radar',
    task: 'trend-radar',
    duration: '~20s',
    category: 'grow',
    icon: '📡',
    label: 'Trend Radar',
    tagline: "What's peaking and what's rising in your niche.",
    bestFor: 'Catching trends before they crest.',
    href: '/dashboard/trends',
  },
  {
    key: 'sound_tracker',
    task: 'sound-tracker',
    duration: '~20s',
    category: 'grow',
    icon: '🎵',
    label: 'Sound Tracker',
    tagline: 'Trending sounds for TikTok and Reels.',
    bestFor: 'Short-form creators who need sound coverage.',
    href: '/dashboard/sounds',
  },
  {
    key: 'collab_finder',
    task: 'collab-finder',
    duration: '~20s',
    category: 'grow',
    icon: '🤝',
    label: 'Collab Finder',
    tagline: 'Match with creators who fit your niche + tier.',
    bestFor: 'Building reach through partnerships.',
    href: '/dashboard/collab-finder',
  },
])

// MONETIZE — partnership + pricing tools (Creator+ tier-gated).
export const MONETIZE_TOOLS: ToolMeta[] = withCosts([
  {
    key: 'brand_pitch',
    task: 'brand-pitch',
    duration: '20–40s',
    category: 'monetize',
    icon: '📧',
    label: 'Brand Pitch',
    tagline: 'Outreach pitches tuned to a brand — formal + casual + follow-up.',
    bestFor: 'Cold-pitching brand partnerships.',
    href: '/dashboard/brand-pitch',
  },
  {
    key: 'rate_calculator',
    task: 'rate-calculator',
    duration: '20–40s',
    category: 'monetize',
    icon: '💵',
    label: 'Rate Calculator',
    tagline: 'Defensible rate cards for sponsored posts.',
    bestFor: "Setting prices when a brand asks 'how much?'.",
    href: '/dashboard/rate-calculator',
  },
  {
    key: 'competitor_analysis',
    task: 'competitor-analysis',
    duration: '20–40s',
    category: 'monetize',
    icon: '🔍',
    label: 'Competitor Analysis',
    tagline: 'Strategic read on a competing creator — strengths, gaps, differentiation.',
    bestFor: 'Positioning against creators in your tier.',
    href: '/dashboard/competitor-analysis',
  },
])

// Aggregate map for quick lookup by feature key. Hub pages read by
// category; dashboard widgets read by key.
export const ALL_TOOLS: ToolMeta[] = [
  ...CREATE_TOOLS,
  ...OPTIMIZE_TOOLS,
  ...GROW_TOOLS,
  ...MONETIZE_TOOLS,
]

export function toolsForCategory(category: ToolCategory): ToolMeta[] {
  return ALL_TOOLS.filter((t) => t.category === category)
}

export function toolByKey(key: string): ToolMeta | undefined {
  return ALL_TOOLS.find((t) => t.key === key)
}

/** Credit cost for a tool by feature key; falls back to 1 for unknown keys. */
export function creditCostForTool(key: string): number {
  return toolByKey(key)?.creditCost ?? 1
}

/** Look a tool up by the engine task it runs. */
export function toolByTask(task: CrispTask): ToolMeta | undefined {
  return ALL_TOOLS.find((t) => t.task === task)
}

/** Credit cost for an engine task, for pages that know the task rather than the tool key. */
export function creditCostForTask(task: CrispTask): number {
  return CREDITS_PER_TASK[task]
}

/** Tools priced at this many credits or more ask the user to confirm before spending. */
export const SPEND_CONFIRM_THRESHOLD = 5
