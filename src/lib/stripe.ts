import Stripe from 'stripe'

let _stripe: Stripe | undefined

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-03-25.dahlia',
    })
  }
  return _stripe
}

// Stripe price IDs — env-driven so they can be swapped between dev/staging/prod
// without code changes. Legacy `STRIPE_PRO_*` vars map to Creator tier.
export const PRICES = {
  creator_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || process.env.STRIPE_CREATOR_MONTHLY_PRICE_ID!,
  creator_yearly:  process.env.STRIPE_PRO_YEARLY_PRICE_ID  || process.env.STRIPE_CREATOR_YEARLY_PRICE_ID!,
  elite_monthly:   process.env.STRIPE_ELITE_MONTHLY_PRICE_ID!,
  elite_yearly:    process.env.STRIPE_ELITE_YEARLY_PRICE_ID!,
} as const

export const PLANS = {
  starter: {
    name: 'Starter',
    tagline: 'Try the full toolkit',
    price: 0,
    dailyLimit: 10,
    engine: 'PostCrisp Engine',
    features: [
      '10 AI generations per day',
      'All 4 core tools — captions, hashtags, best times, viral ideas',
      'Save up to 25 pieces of content',
    ],
    missing: ['Unlimited generations', 'Premium AI quality', 'Priority support'],
  },
  creator: {
    name: 'Creator',
    tagline: 'For serious creators',
    monthlyPrice: 19,
    yearlyPrice: 190,
    dailyLimit: Infinity,
    engine: 'PostCrisp Engine Pro',
    features: [
      'Unlimited AI generations',
      'PostCrisp Engine Pro — balanced quality',
      'Premium AI on monetization features (brand pitch, rate calc, competitor analysis)',
      'Unlimited saved library',
      'Priority support',
    ],
    missing: ['Premium AI across all features'],
  },
  elite: {
    name: 'Elite',
    tagline: 'Maximum quality, no limits',
    monthlyPrice: 79,
    yearlyPrice: 790,
    dailyLimit: Infinity,
    engine: 'PostCrisp Engine Elite',
    features: [
      '🧬 Foundation Analysis — your reusable Creator Profile that powers every other tool',
      'Everything in Creator',
      'PostCrisp Engine Elite — premium quality across every feature',
      'Highest-tier AI on brand pitches, competitor analysis, and media kits',
      'Early access to new features',
      'Concierge onboarding + white-glove support',
    ],
    missing: [],
  },
} as const
