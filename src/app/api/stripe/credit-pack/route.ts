import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createClient } from '@/utils/supabase/server'
import { CREDIT_PACKS } from '@/lib/crisp-engine-config'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { packId } = await request.json()
  const pack = CREDIT_PACKS.find((p) => p.id === packId)
  if (!pack) {
    return NextResponse.json({ error: 'Unknown credit pack' }, { status: 400 })
  }

  const priceId = process.env[pack.envVarKey]
  if (!priceId) {
    return NextResponse.json(
      { error: `Credit pack "${pack.id}" is not yet configured in Stripe. Missing env var ${pack.envVarKey}.` },
      { status: 500 }
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
      mode: 'payment',  // one-time payment, not subscription
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?credits_added=${pack.credits}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
      metadata: {
        supabase_user_id: user.id,
        credit_pack_id: pack.id,
        credits: pack.credits.toString(),
      },
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Credit pack checkout error:', error)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
