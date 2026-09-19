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

export type Tier = 'starter' | 'creator' | 'elite'

// Tiers that have their own engine configuration. Mirrors Tier exactly now
// that Team is gone, but kept as a separate alias for call-site clarity.
export type ConfigurableTier = 'starter' | 'creator' | 'elite'
export const CONFIGURABLE_TIERS: ConfigurableTier[] = ['starter', 'creator', 'elite']

export const TIER_LABELS: Record<Tier, string> = {
  starter: 'Starter',
  creator: 'Creator',
  elite:   'Elite',
}

// Pretty-label for the engine badge shown to users on generation results
export const TIER_BADGE_LABEL: Record<Tier, string> = {
  starter: 'PostCrisp Engine',
  creator: 'PostCrisp Engine Pro',
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
    case 'team':     return 'creator'  // dropped tier — defensive fallback for any in-flight rows
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
  // Self-analysis
  | 'channel-analysis'
  | 'foundation-analysis'   // NEW — Elite-only foundational audit + saved profile
  // Vision (multimodal)
  | 'thumbnail-analyzer'
  // Conversion / call-to-action
  | 'cta-optimizer'

export type PowerProfile = 'FAST' | 'STANDARD' | 'PREMIUM'

export interface ProfileConfig {
  provider: ProviderId
  model: string
}

// ─── Updating engines ───────────────────────────────────────────────────────
// Three places, all in this repo, must agree when a model changes:
//   1. MODEL_CATALOG (below)  — what the admin screen offers in its dropdowns
//   2. MODEL_PRICING in ai-costs.ts — what the cost ledger charges per token
//   3. this table               — the code default per power profile
// A test (engine-catalog.test.ts) fails if a catalogued model has no price.
// Production may also carry per-cell overrides in `ai_config_overrides`; those
// win over this table until reset from /admin/ai-config, so a change here is
// not live until the overrides are reset or re-applied.
export const DEFAULT_PROFILE_CONFIG: Record<PowerProfile, ProfileConfig> = {
  // GPT-5 mini: $0.25 / $2 per 1M — cheap, short-output tasks.
  FAST:     { provider: 'openai',    model: 'gpt-5-mini' },
  // Sonnet 5: $2 / $10 per 1M — the balanced default (cheaper than Sonnet 4.6).
  STANDARD: { provider: 'anthropic', model: 'claude-sonnet-5' },
  // Opus 5: $5 / $25 per 1M — same price as Opus 4.7, current generation.
  PREMIUM:  { provider: 'anthropic', model: 'claude-opus-5' },
}

// ─── Per-tier task routing ──────────────────────────────────────────────────
// Each task has a default PowerProfile per tier. Starter pays cheapest, Creator
// standard quality, Elite premium — with premium Opus-class on monetization
// features even at Creator where the quality affects the user's real-world
// outcome (pitch emails, rate cards, etc).
//
// Admin can override any cell at runtime via `/admin/ai-config`.

// Elite runs PREMIUM only where quality changes a real-world outcome (pitches,
// pricing, analyses, vision critique, strategy). Everyday high-volume tasks
// run STANDARD on Elite too: on a 2,000-credit allowance, a 1-credit caption
// on Opus is the most expensive thing a user can do to our margin.
export const TASK_TIER_PROFILE: Record<CrispTask, Record<ConfigurableTier, PowerProfile>> = {
  // Content creation
  captions:        { starter: 'FAST', creator: 'STANDARD', elite: 'STANDARD' },
  hashtags:        { starter: 'FAST', creator: 'STANDARD', elite: 'STANDARD' },
  'posting-times': { starter: 'FAST', creator: 'STANDARD', elite: 'STANDARD' },
  'viral-ideas':   { starter: 'FAST', creator: 'STANDARD', elite: 'PREMIUM' },
  script:          { starter: 'FAST', creator: 'STANDARD', elite: 'STANDARD' },
  repurpose:       { starter: 'FAST', creator: 'STANDARD', elite: 'STANDARD' },
  'blog-to-social':{ starter: 'FAST', creator: 'STANDARD', elite: 'STANDARD' },
  // Engagement
  'comment-reply': { starter: 'FAST', creator: 'STANDARD', elite: 'STANDARD' },
  'dm-template':   { starter: 'FAST', creator: 'STANDARD', elite: 'STANDARD' },
  polls:           { starter: 'FAST', creator: 'FAST',     elite: 'STANDARD' },
  // Platform optimization
  'youtube-seo':   { starter: 'FAST', creator: 'STANDARD', elite: 'STANDARD' },
  'bio-optimizer': { starter: 'FAST', creator: 'STANDARD', elite: 'STANDARD' },
  'platform-tips': { starter: 'FAST', creator: 'STANDARD', elite: 'STANDARD' },
  // Growth / discovery
  'trend-radar':   { starter: 'FAST', creator: 'STANDARD', elite: 'STANDARD' },
  'sound-tracker': { starter: 'FAST', creator: 'STANDARD', elite: 'STANDARD' },
  'collab-finder': { starter: 'FAST', creator: 'STANDARD', elite: 'PREMIUM' },
  // Monetization — Creator already gets PREMIUM here because these are where
  // real-world outcome (brand deals, pricing) depends on AI quality.
  'brand-pitch':          { starter: 'STANDARD', creator: 'PREMIUM', elite: 'PREMIUM' },
  'rate-calculator':      { starter: 'STANDARD', creator: 'PREMIUM', elite: 'PREMIUM' },
  'competitor-analysis':  { starter: 'STANDARD', creator: 'PREMIUM', elite: 'PREMIUM' },
  // Channel analysis — users benefit most from premium quality here since
  // it's a strategic self-assessment. Premium even at Creator tier.
  'channel-analysis':     { starter: 'STANDARD', creator: 'PREMIUM', elite: 'PREMIUM' },
  'foundation-analysis':  { starter: 'PREMIUM', creator: 'PREMIUM', elite: 'PREMIUM' },
  // Thumbnail analyzer — Claude vision required regardless of tier (OpenAI
  // path also supports vision but we anchor on Anthropic for image quality).
  // STANDARD = Sonnet for everyone; Elite gets Opus for nuanced critique.
  'thumbnail-analyzer':   { starter: 'STANDARD', creator: 'STANDARD', elite: 'PREMIUM' },
  // CTA Optimizer — conversion-focused output. Quality matters because the
  // CTA is what the audience actually sees and acts on. Premium at Elite,
  // standard everywhere else.
  'cta-optimizer':        { starter: 'FAST', creator: 'STANDARD', elite: 'PREMIUM' },
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
  'channel-analysis':    'Channel Analysis',
  'foundation-analysis': 'Foundation Analysis',
  'thumbnail-analyzer':  'Thumbnail Analyzer',
  'cta-optimizer':       'CTA Optimizer',
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
  // VISION tier (multimodal — image input + analysis output) — 4 credits
  'thumbnail-analyzer':   4,
  // CTA Optimizer — multi-CTA output with reasoning per option, 2 credits.
  'cta-optimizer':        2,
  // PREMIUM tier (Opus-class + strategic outputs) — 5 credits
  'brand-pitch':          5,
  'rate-calculator':      5,
  'competitor-analysis':  5,
  'channel-analysis':     5,
  'foundation-analysis':  8,
}

// Monthly (or daily for Starter) credit allowance per tier.
// When the user's credits_reset_at passes, balance resets to this number.
export const TIER_ALLOWANCE: Record<Tier, { credits: number; cycle: 'daily' | 'monthly' }> = {
  starter: { credits: 10,   cycle: 'daily' },
  creator: { credits: 500,  cycle: 'monthly' },
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
    { id: 'claude-opus-5',             label: 'Claude Opus 5',             notes: 'Premium default · $5 / $25 per 1M' },
    { id: 'claude-sonnet-5',           label: 'Claude Sonnet 5',           notes: 'Balanced default · $2 / $10 per 1M' },
    { id: 'claude-opus-4-8',           label: 'Claude Opus 4.8',           notes: 'Previous premium · $5 / $25 per 1M' },
    { id: 'claude-opus-4-7',           label: 'Claude Opus 4.7',           notes: 'Previous premium · $5 / $25 per 1M' },
    { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6',         notes: 'Previous balanced · $3 / $15 per 1M' },
    { id: 'claude-haiku-4-5',          label: 'Claude Haiku 4.5',          notes: 'Cheapest Anthropic · $1 / $5 per 1M' },
  ],
  openai: [
    { id: 'gpt-5',                     label: 'GPT-5',                     notes: '$1.25 / $10 per 1M' },
    { id: 'gpt-5-mini',                label: 'GPT-5 mini',                notes: 'Fast default · $0.25 / $2 per 1M' },
    { id: 'gpt-5-nano',                label: 'GPT-5 nano',                notes: 'Cheapest · $0.05 / $0.40 per 1M' },
    { id: 'gpt-4o',                    label: 'GPT-4o',                    notes: 'Previous · $2.50 / $10 per 1M' },
    { id: 'gpt-4o-mini',               label: 'GPT-4o mini',               notes: 'Previous fast · $0.15 / $0.60 per 1M' },
  ],
  azure: [
    { id: 'gpt-4o',                    label: 'Azure GPT-4o',              notes: 'Azure adapter not yet wired — falls back to Anthropic' },
  ],
}
