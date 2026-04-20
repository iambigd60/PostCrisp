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

// ─── Subscription tiers ─────────────────────────────────────────────────────
// DB values in profiles.subscription_tier map to these engine tiers.
// 'team' runs the same AI quality as 'creator' — Team tier adds seats, not better AI.

export type Tier = 'starter' | 'creator' | 'team' | 'elite'

// Tiers that have their own engine configuration. Team tier is deliberately
// NOT configurable — it mirrors Creator's AI quality (Team value is seats).
export type ConfigurableTier = 'starter' | 'creator' | 'elite'
export const CONFIGURABLE_TIERS: ConfigurableTier[] = ['starter', 'creator', 'elite']

export const TIER_LABELS: Record<Tier, string> = {
  starter: 'Starter',
  creator: 'Creator',
  team:    'Team',
  elite:   'Elite',
}

// Resolve Team tier to its effective config tier (Creator).
export function effectiveTier(tier: Tier): ConfigurableTier {
  return tier === 'team' ? 'creator' : tier
}

// Pretty-label for the engine badge shown to users on generation results
export const TIER_BADGE_LABEL: Record<Tier, string> = {
  starter: 'PostCrisp Engine',
  creator: 'PostCrisp Engine Pro',
  team:    'PostCrisp Engine Pro',
  elite:   'PostCrisp Engine Elite',
}

// Map legacy DB values → engine Tier. Keeps old profiles working while the
// subscription_tier enum is in transition.
export function tierFromDbValue(dbValue: string | null | undefined): Tier {
  switch (dbValue) {
    case 'free':     return 'starter'
    case 'starter':  return 'starter'
    case 'pro':      return 'creator'  // legacy — pre-rename
    case 'creator':  return 'creator'
    case 'team':     return 'team'
    case 'business': return 'elite'    // legacy — pre-rename
    case 'elite':    return 'elite'
    default:         return 'starter'
  }
}

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
  // Self-analysis
  | 'channel-analysis'

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

// ─── Per-tier task routing ──────────────────────────────────────────────────
// Each task has a default PowerProfile per tier. Starter pays cheapest, Creator
// standard quality, Elite premium — with premium Opus-class on monetization
// features even at Creator where the quality affects the user's real-world
// outcome (pitch emails, rate cards, etc).
//
// Admin can override any cell at runtime via `/admin/ai-config`.

export const TASK_TIER_PROFILE: Record<CrispTask, Record<ConfigurableTier, PowerProfile>> = {
  // Content creation
  captions:        { starter: 'FAST', creator: 'STANDARD', elite: 'PREMIUM' },
  hashtags:        { starter: 'FAST', creator: 'STANDARD', elite: 'PREMIUM' },
  'posting-times': { starter: 'FAST', creator: 'STANDARD', elite: 'PREMIUM' },
  'viral-ideas':   { starter: 'FAST', creator: 'STANDARD', elite: 'PREMIUM' },
  script:          { starter: 'FAST', creator: 'STANDARD', elite: 'PREMIUM' },
  repurpose:       { starter: 'FAST', creator: 'STANDARD', elite: 'PREMIUM' },
  'blog-to-social':{ starter: 'FAST', creator: 'STANDARD', elite: 'PREMIUM' },
  // Engagement
  'comment-reply': { starter: 'FAST', creator: 'STANDARD', elite: 'STANDARD' },
  'dm-template':   { starter: 'FAST', creator: 'STANDARD', elite: 'PREMIUM' },
  polls:           { starter: 'FAST', creator: 'FAST',     elite: 'STANDARD' },
  // Platform optimization
  'youtube-seo':   { starter: 'FAST', creator: 'STANDARD', elite: 'PREMIUM' },
  'bio-optimizer': { starter: 'FAST', creator: 'STANDARD', elite: 'PREMIUM' },
  'platform-tips': { starter: 'FAST', creator: 'STANDARD', elite: 'STANDARD' },
  // Growth / discovery
  'trend-radar':   { starter: 'FAST', creator: 'STANDARD', elite: 'PREMIUM' },
  'sound-tracker': { starter: 'FAST', creator: 'STANDARD', elite: 'STANDARD' },
  'collab-finder': { starter: 'FAST', creator: 'STANDARD', elite: 'PREMIUM' },
  // Monetization — Creator already gets PREMIUM here because these are where
  // real-world outcome (brand deals, pricing) depends on AI quality.
  'brand-pitch':          { starter: 'STANDARD', creator: 'PREMIUM', elite: 'PREMIUM' },
  'rate-calculator':      { starter: 'STANDARD', creator: 'PREMIUM', elite: 'PREMIUM' },
  'competitor-analysis':  { starter: 'STANDARD', creator: 'PREMIUM', elite: 'PREMIUM' },
  'media-kit-bio':        { starter: 'STANDARD', creator: 'PREMIUM', elite: 'PREMIUM' },
  // Channel analysis — users benefit most from premium quality here since
  // it's a strategic self-assessment. Premium even at Creator tier.
  'channel-analysis':     { starter: 'STANDARD', creator: 'PREMIUM', elite: 'PREMIUM' },
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
  'channel-analysis':    'Channel Analysis',
}

export const ALL_TASKS: CrispTask[] = Object.keys(TASK_TIER_PROFILE) as CrispTask[]

// ─── Credit system ──────────────────────────────────────────────────────────
// Each generation debits a fixed number of credits from the user's balance.
// Credits are the user-facing unit (simple mental model) — internally we still
// track real token usage. Credit costs are tuned to approximate token cost
// differences across tasks so our margin holds even on premium features.

export const CREDITS_PER_TASK: Record<CrispTask, number> = {
  // FAST tier (cheap, short outputs) — 1 credit
  captions:        1,
  hashtags:        1,
  'comment-reply': 1,
  polls:           1,
  // STANDARD tier (normal outputs) — 2 credits
  'posting-times': 2,
  script:          2,
  'dm-template':   2,
  'platform-tips': 2,
  'bio-optimizer': 2,
  // HEAVY tier (large or multi-part outputs) — 3 credits
  'viral-ideas':   3,
  repurpose:       3,
  'blog-to-social':3,
  'youtube-seo':   3,
  'collab-finder': 3,
  'trend-radar':   3,
  'sound-tracker': 3,
  // PREMIUM tier (Opus-class + strategic outputs) — 5 credits
  'brand-pitch':          5,
  'rate-calculator':      5,
  'competitor-analysis':  5,
  'media-kit-bio':        5,
  'channel-analysis':     5,
}

// Monthly (or daily for Starter) credit allowance per tier.
// When the user's credits_reset_at passes, balance resets to this number.
export const TIER_ALLOWANCE: Record<Tier, { credits: number; cycle: 'daily' | 'monthly' }> = {
  starter: { credits: 10,   cycle: 'daily' },
  creator: { credits: 500,  cycle: 'monthly' },
  team:    { credits: 500,  cycle: 'monthly' }, // individual until team pooling ships
  elite:   { credits: 2000, cycle: 'monthly' },
}

// Credit packs users can buy as one-time Stripe purchases. Price IDs live in env.
export interface CreditPack {
  id: 'small' | 'medium' | 'large'
  credits: number
  priceDollars: number
  envVarKey: string  // env var holding the Stripe price ID
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: 'small',  credits: 100,  priceDollars: 5,  envVarKey: 'STRIPE_CREDIT_PACK_SMALL_PRICE_ID' },
  { id: 'medium', credits: 500,  priceDollars: 15, envVarKey: 'STRIPE_CREDIT_PACK_MEDIUM_PRICE_ID' },
  { id: 'large',  credits: 1500, priceDollars: 40, envVarKey: 'STRIPE_CREDIT_PACK_LARGE_PRICE_ID' },
]

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
