/**
 * Crisp Engine — client-safe configuration.
 *
 * Types, task list, labels, and model catalog live here so both server code
 * (the engine itself) and client code (admin UI) can import without dragging
 * in server-only deps like `next/headers`.
 *
 * Runtime code (provider calls, DB overrides) lives in `crisp-engine.ts` —
 * do NOT import that file from a client component.
 */

import type { ProviderId } from './providers/types'

export type CrispTask =
  // Content creation
  | 'captions'
  | 'hashtags'
  | 'posting-times'
  | 'viral-ideas'
  | 'script'
  | 'repurpose'
  | 'blog-to-social'
  // Engagement
  | 'comment-reply'
  | 'dm-template'
  | 'polls'
  // Platform optimization
  | 'youtube-seo'
  | 'bio-optimizer'
  | 'platform-tips'
  // Growth / discovery
  | 'trend-radar'
  | 'sound-tracker'
  | 'collab-finder'
  // Monetization — premium quality
  | 'brand-pitch'
  | 'rate-calculator'
  | 'competitor-analysis'
  | 'media-kit-bio'

export type PowerProfile = 'FAST' | 'STANDARD' | 'PREMIUM'

export interface ProfileConfig {
  provider: ProviderId
  model: string
}

export const DEFAULT_PROFILE_CONFIG: Record<PowerProfile, ProfileConfig> = {
  FAST:     { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  STANDARD: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  PREMIUM:  { provider: 'anthropic', model: 'claude-opus-4-7' },
}

export const TASK_PROFILE: Record<CrispTask, PowerProfile> = {
  captions:        'STANDARD',
  hashtags:        'STANDARD',
  'posting-times': 'STANDARD',
  'viral-ideas':   'STANDARD',
  script:          'STANDARD',
  repurpose:       'STANDARD',
  'blog-to-social':'STANDARD',
  'comment-reply': 'STANDARD',
  'dm-template':   'STANDARD',
  polls:           'FAST',
  'youtube-seo':   'STANDARD',
  'bio-optimizer': 'STANDARD',
  'platform-tips': 'STANDARD',
  'trend-radar':   'STANDARD',
  'sound-tracker': 'STANDARD',
  'collab-finder': 'STANDARD',
  'brand-pitch':          'PREMIUM',
  'rate-calculator':      'PREMIUM',
  'competitor-analysis':  'PREMIUM',
  'media-kit-bio':        'PREMIUM',
}

export const TASK_LABELS: Record<CrispTask, string> = {
  captions:              'Caption Generator',
  hashtags:              'Hashtag Finder',
  'posting-times':       'Best Posting Times',
  'viral-ideas':         'Viral Ideas',
  script:                'Script Generator',
  repurpose:             'Content Repurposer',
  'blog-to-social':      'Blog-to-Social',
  'comment-reply':       'Comment Replies',
  'dm-template':         'DM Templates',
  polls:                 'Polls / Questions',
  'youtube-seo':         'YouTube SEO',
  'bio-optimizer':       'Bio Optimizer',
  'platform-tips':       'Platform Tips',
  'trend-radar':         'Trend Radar',
  'sound-tracker':       'Sound Tracker',
  'collab-finder':       'Collaboration Finder',
  'brand-pitch':         'Brand Pitch',
  'rate-calculator':     'Rate Calculator',
  'competitor-analysis': 'Competitor Analysis',
  'media-kit-bio':       'Media Kit Bio Optimizer',
}

export const ALL_TASKS: CrispTask[] = Object.keys(TASK_PROFILE) as CrispTask[]

export const MODEL_CATALOG: Record<ProviderId, { id: string; label: string; notes?: string }[]> = {
  anthropic: [
    { id: 'claude-opus-4-7',           label: 'Claude Opus 4.7',           notes: 'Premium quality' },
    { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6',         notes: 'Balanced default' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',          notes: 'Cheapest / fastest' },
  ],
  openai: [
    { id: 'gpt-4o',                    label: 'GPT-4o',                    notes: 'Balanced, ~$2.50/$10 per 1M' },
    { id: 'gpt-4o-mini',               label: 'GPT-4o mini',               notes: 'Cheap, ~$0.15/$0.60 per 1M' },
    { id: 'o1',                        label: 'o1 (reasoning)',            notes: 'Premium reasoning, slow' },
    { id: 'o1-mini',                   label: 'o1-mini (reasoning)',       notes: 'Cheaper reasoning' },
  ],
  azure: [
    { id: 'gpt-4o',                    label: 'Azure GPT-4o',              notes: 'Azure adapter not yet wired — falls back to Anthropic' },
  ],
}
