import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { handleStripeEvent } from '@/lib/stripe-webhook'
import { createClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

// Thin shell: verify the Stripe signature, then delegate the verified event
// to the testable handler in @/lib/stripe-webhook.
export async function POST(request: Request) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const result = await handleStripeEvent(event, { supabase: supabaseAdmin, stripe: getStripe() })
  return NextResponse.json(result.body, { status: result.status })
}
