/**
 * Client-safe feature-access defaults.
 *
 * This file has NO server imports (no Supabase, no next/headers) so client
 * components like <FeatureGate> can read the same code defaults the server
 * uses. Admin overrides (from the feature_access table) are only applied
 * server-side in `src/lib/feature-access.ts` — the UI uses these defaults
 * for display logic and the API enforces the real gate.
 */

import type { CrispTask, Tier } from './crisp-engine-config'

export const DEFAULT_MIN_TIER: Record<CrispTask, Tier> = {
  // Content creation — all tiers
  captions:        'starter',
  hashtags:        'starter',
  'posting-times': 'starter',
  'viral-ideas':   'starter',
  script:          'starter',
  repurpose:       'starter',
  'blog-to-social':'starter',
  // Engagement — all tiers
  'comment-reply': 'starter',
  'dm-template':   'starter',
  polls:           'starter',
  // Platform optimization — all tiers
  'youtube-seo':   'starter',
  'bio-optimizer': 'starter',
  'platform-tips': 'starter',
  // Growth — all tiers
  'trend-radar':   'starter',
  'sound-tracker': 'starter',
  'collab-finder': 'starter',
  // Monetization — Creator+
  'brand-pitch':         'creator',
  'rate-calculator':     'creator',
  'competitor-analysis': 'creator',
  'media-kit-bio':       'creator',
  // Self-analysis — Creator+
  'channel-analysis':    'creator',
}
