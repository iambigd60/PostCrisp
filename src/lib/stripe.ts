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

export const PRICES = {
  pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
  pro_yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID!,
} as const

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    dailyLimit: 10,
    features: [
      '10 AI generations per day',
      'Caption generator',
      'Hashtag finder',
      'Best posting times',
      'Viral ideas generator',
    ],
    missing: ['Unlimited generations', 'Save content library', 'Priority support'],
  },
  pro: {
    name: 'Pro',
    monthlyPrice: 19,
    yearlyPrice: 190,
    dailyLimit: Infinity,
    features: [
      'Unlimited AI generations',
      'Caption generator',
      'Hashtag finder',
      'Best posting times',
      'Viral ideas generator',
      'Save content library',
      'Priority support',
    ],
    missing: [],
  },
} as const
