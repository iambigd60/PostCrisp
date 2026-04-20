import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

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

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.client_reference_id
        const customerId = session.customer as string
        const mode = session.mode
        const meta = session.metadata ?? {}

        if (!userId) break

        if (mode === 'payment' && meta.credit_pack_id) {
          // One-time credit pack purchase — grant credits
          const credits = parseInt(meta.credits ?? '0', 10)
          if (credits > 0) {
            // Fetch current balance
            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('credits_balance')
              .eq('id', userId)
              .maybeSingle()
            const currentBalance = profile?.credits_balance ?? 0
            const newBalance = currentBalance + credits

            await supabaseAdmin.from('profiles').update({
              credits_balance: newBalance,
              stripe_customer_id: customerId,
            }).eq('id', userId)

            await supabaseAdmin.from('credit_transactions').insert({
              user_id: userId,
              type: 'purchase',
              amount: credits,
              balance_after: newBalance,
              reason: `Credit pack: ${meta.credit_pack_id} (${credits} credits)`,
              actor_id: userId,
            })
          }
        } else if (mode === 'subscription') {
          // Subscription checkout — set tier (legacy still maps to 'pro' → creator)
          const subscriptionId = session.subscription as string
          await supabaseAdmin.from('profiles').update({
            subscription_tier: 'creator',
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          }).eq('id', userId)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const isActive = subscription.status === 'active' || subscription.status === 'trialing'

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (profile) {
          await supabaseAdmin.from('profiles').update({
            subscription_tier: isActive ? 'creator' : 'free',
            stripe_subscription_id: subscription.id,
          }).eq('id', profile.id)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (profile) {
          await supabaseAdmin.from('profiles').update({
            subscription_tier: 'free',
            stripe_subscription_id: null,
          }).eq('id', profile.id)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        console.warn('Payment failed for customer:', invoice.customer)
        // TODO: send notification email via Supabase Edge Function or Resend
        break
      }

      default:
        break
    }
  } catch (error) {
    console.error(`Error handling webhook event ${event.type}:`, error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
