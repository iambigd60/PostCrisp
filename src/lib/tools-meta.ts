/**
 * Tool metadata — single source of truth for hub pages, dashboard recent-
 * content cards, and anywhere the app needs to display a tool's identity
 * + tagline.
 *
 * `key` matches the value written to `generations.feature` so per-tool
 * recent activity can be filtered without a join.
 */

export type ToolCategory = 'create' | 'optimize' | 'grow' | 'monetize'

export interface ToolMeta {
  key: string
  category: ToolCategory
  icon: string
  label: string
  /** 1-line value prop. Shown as the card subtitle. */
  tagline: string
  /** "Best for: ..." — the situation where this tool wins. */
  bestFor: string
  href: string
}

// CREATE — content authoring tools. Phase 1 hub.
export const CREATE_TOOLS: ToolMeta[] = [
  {
    key: 'captions',
    category: 'create',
    icon: '✍️',
    label: 'Captions',
    tagline: 'Generate ready-to-post captions in your voice.',
    bestFor: 'A single feed post you need to ship today.',
    href: '/dashboard/generate',
  },
  {
    key: 'hashtags',
    category: 'create',
    icon: '🏷️',
    label: 'Hashtags',
    tagline: 'Mix popular + niche hashtags tuned to your platform.',
    bestFor: 'Stretching reach without looking spammy.',
    href: '/dashboard/hashtags',
  },
  {
    key: 'script',
    category: 'create',
    icon: '🎬',
    label: 'Scripts',
    tagline: 'Outline videos + shorts in seconds — hook, beats, CTA.',
    bestFor: 'Planning before you hit record.',
    href: '/dashboard/scripts',
  },
  {
    key: 'repurpose',
    category: 'create',
    icon: '♻️',
    label: 'Repurpose',
    tagline: 'One piece of content → cross-platform variants.',
    bestFor: 'Making your best post work everywhere else too.',
    href: '/dashboard/repurpose',
  },
  {
    key: 'blog_to_social',
    category: 'create',
    icon: '📰',
    label: 'Blog → Social',
    tagline: 'Long article → carousel + thread + captions.',
    bestFor: 'Extracting social posts from your newsletter or blog.',
    href: '/dashboard/blog-to-social',
  },
  {
    key: 'polls',
    category: 'create',
    icon: '📊',
    label: 'Polls',
    tagline: 'Poll questions tuned for engagement.',
    bestFor: 'Stories and posts where comments matter.',
    href: '/dashboard/polls',
  },
  {
    key: 'dm_template',
    category: 'create',
    icon: '✉️',
    label: 'DM Templates',
    tagline: "Outreach DMs that don't sound like outreach DMs.",
    bestFor: 'Collab pitches, customer follow-ups, networking.',
    href: '/dashboard/dm-templates',
  },
  {
    key: 'comment_reply',
    category: 'create',
    icon: '💬',
    label: 'Comment Replies',
    tagline: 'Three reply variants tuned to engagement.',
    bestFor: "High-value comments where a generic 'thanks!' loses steam.",
    href: '/dashboard/comment-replies',
  },
]

// OPTIMIZE — channel + asset improvement tools.
export const OPTIMIZE_TOOLS: ToolMeta[] = [
  {
    key: 'posting_times',
    category: 'optimize',
    icon: '⏰',
    label: 'Best Times',
    tagline: 'Find the hours your audience actually shows up.',
    bestFor: 'Scheduling posts across multiple platforms.',
    href: '/dashboard/best-times',
  },
  {
    key: 'youtube_seo',
    category: 'optimize',
    icon: '📺',
    label: 'YouTube SEO',
    tagline: 'Title, description, tags, hashtags — built to rank.',
    bestFor: 'Any new YouTube upload\'s search performance.',
    href: '/dashboard/youtube-seo',
  },
  {
    key: 'bio_optimizer',
    category: 'optimize',
    icon: '🧬',
    label: 'Bio Optimizer',
    tagline: 'Rewrite your profile bio to convert lurkers into followers.',
    bestFor: 'Refreshing bios after a positioning or niche shift.',
    href: '/dashboard/bio-optimizer',
  },
  {
    key: 'platform_tips',
    category: 'optimize',
    icon: '💡',
    label: 'Platform Tips',
    tagline: 'Algorithm dynamics + best practices specific to each platform.',
    bestFor: 'Getting up to speed when you\'re entering a new platform.',
    href: '/dashboard/platform-tips',
  },
  {
    key: 'channel_analysis',
    category: 'optimize',
    icon: '🪞',
    label: 'Channel Analysis',
    tagline: 'Honest audit of your channel — strengths, gaps, recommendations.',
    bestFor: 'A quarterly self-checkup or pre-pivot diagnostic.',
    href: '/dashboard/channel-analysis',
  },
  {
    key: 'thumbnail_analyzer',
    category: 'optimize',
    icon: '🖼️',
    label: 'Thumbnail Analyzer',
    tagline: 'Click-prediction critique with prioritized fixes.',
    bestFor: 'A/B-deciding before you publish a thumbnail.',
    href: '/dashboard/thumbnail-analyzer',
  },
]

// GROW — discovery + reach tools.
export const GROW_TOOLS: ToolMeta[] = [
  {
    key: 'viral_ideas',
    category: 'grow',
    icon: '🚀',
    label: 'Viral Ideas',
    tagline: 'Specific content ideas tailored to your niche.',
    bestFor: 'Stuck-on-what-to-post days.',
    href: '/dashboard/viral-ideas',
  },
  {
    key: 'trend_radar',
    category: 'grow',
    icon: '📡',
    label: 'Trend Radar',
    tagline: "What's peaking and what's rising in your niche.",
    bestFor: 'Catching trends before they crest.',
    href: '/dashboard/trends',
  },
  {
    key: 'sound_tracker',
    category: 'grow',
    icon: '🎵',
    label: 'Sound Tracker',
    tagline: 'Trending sounds for TikTok and Reels.',
    bestFor: 'Short-form creators who need sound coverage.',
    href: '/dashboard/sounds',
  },
  {
    key: 'collab_finder',
    category: 'grow',
    icon: '🤝',
    label: 'Collab Finder',
    tagline: 'Match with creators who fit your niche + tier.',
    bestFor: 'Building reach through partnerships.',
    href: '/dashboard/collab-finder',
  },
]

// MONETIZE — partnership + pricing tools (Creator+ tier-gated).
export const MONETIZE_TOOLS: ToolMeta[] = [
  {
    key: 'brand_pitch',
    category: 'monetize',
    icon: '📧',
    label: 'Brand Pitch',
    tagline: 'Outreach pitches tuned to a brand — formal + casual + follow-up.',
    bestFor: 'Cold-pitching brand partnerships.',
    href: '/dashboard/brand-pitch',
  },
  {
    key: 'rate_calculator',
    category: 'monetize',
    icon: '💵',
    label: 'Rate Calculator',
    tagline: 'Defensible rate cards for sponsored posts.',
    bestFor: "Setting prices when a brand asks 'how much?'.",
    href: '/dashboard/rate-calculator',
  },
  {
    key: 'competitor_analysis',
    category: 'monetize',
    icon: '🔍',
    label: 'Competitor Analysis',
    tagline: 'Strategic read on a competing creator — strengths, gaps, differentiation.',
    bestFor: 'Positioning against creators in your tier.',
    href: '/dashboard/competitor-analysis',
  },
]

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
