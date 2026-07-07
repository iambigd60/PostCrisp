/**
 * Stripe webhook event handling — the business logic behind
 * /api/stripe/webhook, extracted so it can be unit-tested with injected
 * dependencies. The route stays a thin shell: it verifies the Stripe
 * signature, then delegates the verified event here and turns the returned
 * WebhookResult into an HTTP response.
 */

import * as Sentry from '@sentry/nextjs'
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PRICES } from './stripe'

export interface StripeWebhookDeps {
  /** Service-role client (bypasses RLS) — webhooks carry no user session. */
  supabase: SupabaseClient
  /** Stripe SDK client — used to retrieve subscriptions for legacy sessions. */
  stripe: Stripe
}

/** Outcome the route serializes into an HTTP response. */
export interface WebhookResult {
  status: number
  body: Record<string, unknown>
}

type PaidTier = 'creator' | 'elite'

function isPaidTier(value: unknown): value is PaidTier {
  return value === 'creator' || value === 'elite'
}

// Price-ID → tier fallback for subscriptions whose metadata is missing or
// invalid. Compares against the resolved PRICES values, so both the legacy
// STRIPE_PRO_* and the STRIPE_CREATOR_* env names work automatically.
function tierForPriceId(priceId: string | undefined): PaidTier | null {
  if (!priceId) return null
  if (priceId === PRICES.creator_monthly || priceId === PRICES.creator_yearly) return 'creator'
  if (priceId === PRICES.elite_monthly || priceId === PRICES.elite_yearly) return 'elite'
  return null
}

/**
 * Shared tier resolver for all subscription branches: metadata.tier when
 * valid, else the first line item's price ID. Never throws — a throw would
 * 500 the webhook and make Stripe retry a poison event forever — so the
 * unmappable case reports to Sentry and defaults to 'creator'.
 */
function resolveSubscriptionTier(subscription: Stripe.Subscription): PaidTier {
  const metaTier = subscription.metadata?.tier
  if (isPaidTier(metaTier)) return metaTier

  const priceId = subscription.items?.data?.[0]?.price?.id
  const mapped = tierForPriceId(priceId)
  if (mapped) return mapped

  Sentry.captureMessage(
    `Stripe webhook: could not resolve tier for subscription ${subscription.id} ` +
      `(metadata.tier=${JSON.stringify(metaTier ?? null)}, price=${priceId ?? 'none'}); defaulting to creator`,
  )
  return 'creator'
}

/**
 * Idempotency guard — Stripe retries deliveries, and a retried credit-pack
 * event would otherwise grant credits twice. Insert-first (upsert with
 * ignoreDuplicates) so concurrent retries race atomically on the primary key
 * instead of through a check-then-insert window. With ignoreDuplicates, a
 * duplicate insert affects 0 rows and returns an empty data array.
 *
 * If the dedupe write itself errors (table missing because the migration
 * hasn't been run yet, or a transient DB failure) we fail OPEN and process
 * the event anyway: a rare duplicate grant is recoverable, while hard-failing
 * here would take down the entire webhook pipeline. Deployment order
 * (migration before code) is human-run and must not be a single point of
 * failure.
 */
async function recordEventOnce(
  supabase: SupabaseClient,
  event: Stripe.Event,
): Promise<'new' | 'duplicate' | 'error'> {
  const { data, error } = await supabase
    .from('processed_stripe_events')
    .upsert(
      { event_id: event.id, type: event.type },
      { onConflict: 'event_id', ignoreDuplicates: true },
    )
    .select()

  if (error) {
    console.error('Stripe webhook dedupe insert failed (failing open):', error.message)
    Sentry.captureMessage(`Stripe webhook dedupe insert failed (failing open): ${error.message}`)
    return 'error'
  }

  return (data?.length ?? 0) > 0 ? 'new' : 'duplicate'
}

// ─── Payment-failed notification via Resend — same raw-REST pattern as the
// feedback route: guard on RESEND_API_KEY (skip silently if missing), never
// let an email error fail the webhook response.
async function sendPaymentFailedEmail(email: string): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return

    // The billing page hosts the customer-portal button (the portal route is
    // an authenticated POST an email can't link to directly).
    const billingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`
    const text =
      `Hi,\n\n` +
      `We couldn't process your latest PostCrisp payment. We'll retry automatically, ` +
      `but if it keeps failing your subscription benefits may pause.\n\n` +
      `To keep everything running, update your payment method here:\n` +
      `${billingUrl}\n\n` +
      `Questions? Just reply to this email.\n\n` +
      `— The PostCrisp team`

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PostCrisp <noreply@postcrisp.com>',
        to: [email],
        subject: 'Action needed: your PostCrisp payment failed',
        text,
      }),
    })
  } catch (notifyErr) {
    console.error('payment-failed notification failed (non-fatal):', notifyErr)
  }
}

/**
 * Handle a signature-verified Stripe event. Returns the { status, body } the
 * route should respond with.
 */
export async function handleStripeEvent(
  event: Stripe.Event,
  deps: StripeWebhookDeps,
): Promise<WebhookResult> {
  const { supabase, stripe } = deps

  const dedupe = await recordEventOnce(supabase, event)
  if (dedupe === 'duplicate') {
    return { status: 200, body: { received: true, duplicate: true } }
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
            const { data: profile } = await supabase
              .from('profiles')
              .select('credits_balance')
              .eq('id', userId)
              .maybeSingle()
            const currentBalance = profile?.credits_balance ?? 0
            const newBalance = currentBalance + credits

            await supabase.from('profiles').update({
              credits_balance: newBalance,
              stripe_customer_id: customerId,
            }).eq('id', userId)

            await supabase.from('credit_transactions').insert({
              user_id: userId,
              type: 'purchase',
              amount: credits,
              balance_after: newBalance,
              reason: `Credit pack: ${meta.credit_pack_id} (${credits} credits)`,
              actor_id: userId,
            })
          }
        } else if (mode === 'subscription') {
          const subscriptionId = session.subscription as string
          // The checkout route puts { tier, cycle } on the session's own
          // metadata. Sessions created before that deploy won't carry it —
          // retrieve the subscription and resolve from its metadata/price ID.
          let tier: PaidTier
          if (isPaidTier(meta.tier)) {
            tier = meta.tier
          } else {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId)
            tier = resolveSubscriptionTier(subscription)
          }

          await supabase.from('profiles').update({
            subscription_tier: tier,
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

        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (profile) {
          await supabase.from('profiles').update({
            subscription_tier: isActive ? resolveSubscriptionTier(subscription) : 'free',
            stripe_subscription_id: subscription.id,
          }).eq('id', profile.id)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (profile) {
          await supabase.from('profiles').update({
            subscription_tier: 'free',
            stripe_subscription_id: null,
          }).eq('id', profile.id)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        console.warn('Payment failed for customer:', customerId)

        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        if (profile?.email) {
          await sendPaymentFailedEmail(profile.email as string)
        }
        // TODO: dunning grace period — deliberately NOT downgrading the tier
        // on a failed payment. Stripe retries on its own schedule, and
        // customer.subscription.updated handles the eventual past_due /
        // canceled transition. Notify only.
        break
      }

      default:
        break
    }
  } catch (error) {
    console.error(`Error handling webhook event ${event.type}:`, error)
    return { status: 500, body: { error: 'Webhook handler failed' } }
  }

  return { status: 200, body: { received: true } }
}
