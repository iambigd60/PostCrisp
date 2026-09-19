import Stripe from 'stripe'
import { TIER_ALLOWANCE } from './crisp-engine-config'

const STARTER_CREDITS = TIER_ALLOWANCE.starter.credits
const CREATOR_CREDITS = TIER_ALLOWANCE.creator.credits.toLocaleString('en-US')
const ELITE_CREDITS = TIER_ALLOWANCE.elite.credits.toLocaleString('en-US')

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
      `${STARTER_CREDITS} credits a day — a caption costs 1, a brand pitch 5`,
      'All 4 core tools — captions, hashtags, best times, viral ideas',
      'Save up to 25 pieces of content',
    ],
    missing: ['Monthly credit allowance', 'Premium AI quality', 'Priority support'],
  },
  creator: {
    name: 'Creator',
    tagline: 'For serious creators',
    monthlyPrice: 19,
    yearlyPrice: 190,
    dailyLimit: Infinity,
    engine: 'PostCrisp Engine Pro',
    features: [
      `${CREATOR_CREDITS} credits a month — about 500 captions, or 100 brand pitches`,
      'Every tool shows its cost before you run it',
      'PostCrisp Engine Pro — balanced quality',
      'Premium AI on monetization features (brand pitch, rate calc, competitor analysis)',
      'Unlimited saved library',
      'Priority support',
    ],
    missing: ['Premium AI across all features'],
  },
  elite: {
    name: 'Elite',
    tagline: 'Maximum quality, most credits',
    monthlyPrice: 79,
    yearlyPrice: 790,
    dailyLimit: Infinity,
    engine: 'PostCrisp Engine Elite',
    features: [
      `Everything in Creator, with ${ELITE_CREDITS} credits a month`,
      '🧬 Foundation Analysis — your reusable Creator Profile that powers every other tool',
      'PostCrisp Engine Elite — premium quality across every feature',
      'Highest-tier AI on brand pitches, competitor analysis, and media kits',
      'Early access to new features',
      'Concierge onboarding + white-glove support',
    ],
    missing: [],
  },
} as const
