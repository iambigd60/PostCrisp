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

// Aggregate map for quick lookup by feature key. Hub pages read by
// category; dashboard widgets read by key.
export const ALL_TOOLS: ToolMeta[] = [
  ...CREATE_TOOLS,
  // OPTIMIZE / GROW / MONETIZE coming as those hubs land.
]

export function toolsForCategory(category: ToolCategory): ToolMeta[] {
  return ALL_TOOLS.filter((t) => t.category === category)
}

export function toolByKey(key: string): ToolMeta | undefined {
  return ALL_TOOLS.find((t) => t.key === key)
}
