import { NextResponse } from 'next/server'
import { getStripe, PRICES } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'

// Server-authoritative tier → priceId map. We never trust a client-supplied
// priceId — a logged-in user could otherwise pass a $0 test price (or a
// lower-tier price) and get a higher-tier subscription. Client sends a
// semantic { tier, cycle } pair; we resolve the actual Stripe price here.
const TIER_PRICE_MAP: Record<string, Record<string, string | undefined>> = {
  creator: { monthly: PRICES.creator_monthly, yearly: PRICES.creator_yearly },
  elite:   { monthly: PRICES.elite_monthly,   yearly: PRICES.elite_yearly   },
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { tier, cycle } = body as { tier?: string; cycle?: string }

  if (tier !== 'creator' && tier !== 'elite') {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  }
  if (cycle !== 'monthly' && cycle !== 'yearly') {
    return NextResponse.json({ error: 'Invalid billing cycle' }, { status: 400 })
  }

  const priceId = TIER_PRICE_MAP[tier][cycle]
  if (!priceId) {
    return NextResponse.json(
      { error: `${tier} ${cycle} is not yet configured in Stripe.` },
      { status: 400 },
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, email')
    .eq('id', user.id)
    .single()

  try {
    const customerParams = profile?.stripe_customer_id
      ? { customer: profile.stripe_customer_id }
      : { customer_email: profile?.email ?? user.email }

    const session = await getStripe().checkout.sessions.create({
      ...customerParams,
      client_reference_id: user.id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
      // Session-level metadata so the checkout.session.completed webhook can
      // read the tier without an extra Stripe API round-trip —
      // subscription_data.metadata lands on the Subscription object only,
      // never on the Checkout Session itself.
      metadata: { tier, cycle },
      subscription_data: {
        metadata: { supabase_user_id: user.id, tier, cycle },
      },
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
