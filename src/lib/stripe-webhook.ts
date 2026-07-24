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

// Dunning grace period: past_due means Stripe is still retrying the charge
// on its Dashboard-configured schedule (typically 1–2 weeks), so the
// customer keeps their paid tier while that runs. Everything else —
// canceled, unpaid, incomplete, incomplete_expired, paused — downgrades.
const PAID_STATUSES = new Set<Stripe.Subscription.Status>(['active', 'trialing', 'past_due'])

type TierSource = 'metadata' | 'price'

/**
 * Shared tier resolver for the subscription branches. `prefer` picks the
 * source of truth: the legacy-checkout path stays metadata-first (checkout
 * metadata is written fresh at purchase time), while subscription.updated is
 * price-first — Stripe never rewrites subscription metadata when the price
 * later changes (billing-portal plan switch), so on updates the billed price
 * is the truth and stale metadata is only a fallback. When both resolve and
 * disagree, the drift is reported to Sentry either way. Never throws — a
 * throw would 500 the webhook and make Stripe retry a poison event forever —
 * so the unmappable case reports to Sentry and defaults to 'creator'.
 */
function resolveSubscriptionTier(
  subscription: Stripe.Subscription,
  prefer: TierSource = 'metadata',
): PaidTier {
  const metaTier = subscription.metadata?.tier
  const priceId = subscription.items?.data?.[0]?.price?.id
  const metaResolved = isPaidTier(metaTier) ? metaTier : null
  const priceResolved = tierForPriceId(priceId)

  if (metaResolved && priceResolved && metaResolved !== priceResolved) {
    const winner = prefer === 'price' ? priceResolved : metaResolved
    Sentry.captureMessage(
      `Stripe webhook: tier drift on subscription ${subscription.id} — ` +
        `metadata says '${metaResolved}' but the billed price maps to '${priceResolved}'; ` +
        `using '${winner}' (${prefer}-first)`,
    )
  }

  const resolved =
    prefer === 'price' ? priceResolved ?? metaResolved : metaResolved ?? priceResolved
  if (resolved) return resolved

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

// Retention for the dedupe ledger: Stripe stops retrying within ~3 days, so
// rows older than 30 days can never dedupe anything again.
const LEDGER_RETENTION_DAYS = 30

/**
 * Best-effort prune, piggybacked on each newly recorded event. Housekeeping,
 * never processing: failures log and are otherwise ignored, and nothing here
 * may throw into the caller. Runs on every new event because the delete is a
 * sub-millisecond scan precisely while this keeps the table permanently
 * small — revisit with an index + scheduler only if event volume ever makes
 * it measurable.
 */
async function pruneProcessedEvents(supabase: SupabaseClient): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - LEDGER_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { error } = await supabase
      .from('processed_stripe_events')
      .delete()
      .lt('created_at', cutoff)
    if (error) {
      console.error('Stripe webhook ledger prune failed (non-fatal):', error.message)
    }
  } catch (pruneErr) {
    console.error('Stripe webhook ledger prune failed (non-fatal):', pruneErr)
  }
}

// ─── Payment-failed notification via Resend — same raw-REST pattern as the
// feedback route: guard on RESEND_API_KEY (skip silently if missing), never
// let an email error fail the webhook response.
async function sendPaymentFailedEmail(email: string): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return

    // The billing page hosts the customer-portal button (the portal route is
    // an authenticated POST an email can't link to directly). Fall back to
    // the canonical production URL — a broken "undefined/..." link in a
    // customer email is worse than a hardcoded fallback.
    const billingUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://postcrisp.com'}/dashboard/billing`
    // Accurate, not alarming: a subscription can go past_due on the first
    // failed renewal attempt, so don't promise a grace window we don't have.
    const text =
      `Hi,\n\n` +
      `We couldn't process your latest PostCrisp payment. We'll retry automatically, ` +
      `but your paid features may be paused until your payment method is updated.\n\n` +
      `To keep everything running, update your payment method here:\n` +
      `${billingUrl}\n\n` +
      `Questions? Just reply to this email.\n\n` +
      `— The PostCrisp team`

    const res = await fetch('https://api.resend.com/emails', {
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
    if (!res.ok) {
      // Status code only — never the response body, API key, or recipients.
      console.error(`payment-failed notification: Resend responded ${res.status} (non-fatal)`)
    }
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
  if (dedupe === 'new') {
    // Piggybacked retention pass — see pruneProcessedEvents. Skipped on
    // 'error' (the table is unhealthy) and on duplicates (already pruned
    // when the event was first recorded).
    await pruneProcessedEvents(supabase)
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

        // Only provision once payment has actually settled. Card-only checkout
        // completes as 'paid', but if any delayed/async payment method is ever
        // enabled the event can fire before funds settle ('unpaid') — never
        // grant credits/tier before then. 'no_payment_required' covers
        // legitimate zero-cost / trial sessions.
        if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
          console.warn(
            `Stripe webhook: checkout.session.completed ${event.id} has payment_status=${session.payment_status}; skipping provisioning until paid`,
          )
          break
        }

        if (mode === 'payment' && meta.credit_pack_id) {
          // One-time credit pack purchase — grant credits
          const credits = parseInt(meta.credits ?? '0', 10)
          if (credits > 0) {
            // Fetch current balance. A failed read must throw: treating it
            // as "no row" would fall back to 0 and overwrite the customer's
            // real balance with just the pack amount. Nothing is written yet,
            // so the retry is safe. A genuinely missing row / null balance
            // still legitimately falls back to 0 below.
            const { data: profile, error: balanceReadError } = await supabase
              .from('profiles')
              .select('credits_balance')
              .eq('id', userId)
              .maybeSingle()
            if (balanceReadError) throw balanceReadError
            const currentBalance = profile?.credits_balance ?? 0
            const newBalance = currentBalance + credits

            // Nothing granted yet — a failed balance write must throw so the
            // ledger row is released and Stripe's retry can grant safely.
            const { error: balanceError } = await supabase.from('profiles').update({
              credits_balance: newBalance,
              stripe_customer_id: customerId,
            }).eq('id', userId)
            if (balanceError) throw balanceError

            const { error: txError } = await supabase.from('credit_transactions').insert({
              user_id: userId,
              type: 'purchase',
              amount: credits,
              balance_after: newBalance,
              reason: `Credit pack: ${meta.credit_pack_id} (${credits} credits)`,
              actor_id: userId,
            })
            if (txError) {
              // Asymmetry is deliberate: the balance is already granted, so
              // throwing here would make Stripe retry and re-run the balance
              // update — a double grant, the exact bug the idempotency guard
              // exists to prevent. Keep the 200; make the lost audit row loud.
              console.error(
                `Stripe webhook: credit_transactions insert failed after balance grant for event ${event.id}:`,
                txError.message,
              )
              Sentry.captureMessage(
                `Stripe webhook: credits granted but audit row lost for event ${event.id}: ${txError.message}`,
              )
            }
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

          // Idempotent write — throw on failure so the outer catch releases
          // the ledger row and Stripe's retry can re-run it safely.
          const { error: tierError } = await supabase.from('profiles').update({
            subscription_tier: tier,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          }).eq('id', userId)
          if (tierError) throw tierError
        }
        break
      }

      case 'customer.subscription.updated': {
        const eventSubscription = event.data.object as Stripe.Subscription
        const customerId = eventSubscription.customer as string

        // maybeSingle so a genuinely unknown customer skips cleanly, while a
        // failed READ throws — otherwise it looks identical to "no profile",
        // the branch no-ops with a 200, and the ledger row makes even a
        // dashboard resend a duplicate no-op.
        const { data: profile, error: lookupError } = await supabase
          .from('profiles')
          .select('id, stripe_subscription_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()
        if (lookupError) throw lookupError
        if (!profile) break

        // Stale/foreign-subscription guard: Stripe does not guarantee event
        // ordering, so a late event from a customer's OLD subscription (they
        // canceled, then re-subscribed under a new id) must not touch the
        // profile. Null on file processes normally — covers profiles
        // provisioned out-of-band. The ledger row is kept: a correctly
        // ignored event counts as processed.
        if (profile.stripe_subscription_id && profile.stripe_subscription_id !== eventSubscription.id) {
          console.warn(
            `Stripe webhook: ignoring ${event.type} for subscription ${eventSubscription.id} — ` +
              `profile ${profile.id} is on subscription ${profile.stripe_subscription_id}`,
          )
          break
        }

        // Fresh-state verification: Stripe doesn't guarantee delivery order,
        // and a redelivered stale "active" event landing after a processed
        // cancellation would re-provision a paid tier permanently (a dead
        // subscription emits no correcting events). The event is only a
        // trigger — Stripe's current view of the subscription is the truth.
        // A retrieve failure throws: the outer catch releases the ledger row
        // and returns 500, so Stripe redelivers later.
        const subscription = await stripe.subscriptions.retrieve(eventSubscription.id)

        const isPaid = PAID_STATUSES.has(subscription.status)
        // Idempotent write — throw on failure so Stripe retries (see above).
        const { error: updateError } = await supabase.from('profiles').update({
          subscription_tier: isPaid ? resolveSubscriptionTier(subscription, 'price') : 'free',
          stripe_subscription_id: subscription.id,
        }).eq('id', profile.id)
        if (updateError) throw updateError
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Same read gate as subscription.updated — extra critical here: there
        // is no later event, so a silently skipped downgrade would leave a
        // canceled customer on their paid tier permanently.
        const { data: profile, error: lookupError } = await supabase
          .from('profiles')
          .select('id, stripe_subscription_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()
        if (lookupError) throw lookupError
        if (!profile) break

        // Stale/foreign-subscription guard — see subscription.updated. A
        // deletion needs no fresh verification: it is terminal, and Stripe
        // never reuses a subscription id, so the id match alone is safe.
        if (profile.stripe_subscription_id && profile.stripe_subscription_id !== subscription.id) {
          console.warn(
            `Stripe webhook: ignoring ${event.type} for subscription ${subscription.id} — ` +
              `profile ${profile.id} is on subscription ${profile.stripe_subscription_id}`,
          )
          break
        }

        // Idempotent write — throw on failure so Stripe retries (see above).
        const { error: deleteError } = await supabase.from('profiles').update({
          subscription_tier: 'free',
          stripe_subscription_id: null,
        }).eq('id', profile.id)
        if (deleteError) throw deleteError
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        console.warn('Payment failed for customer:', customerId)

        const { data: profile, error: lookupError } = await supabase
          .from('profiles')
          .select('email')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()
        if (lookupError) {
          // Best-effort email — a 500 for a failed lookup would be worse than
          // a missed notification, but the miss must be visible.
          console.error('Stripe webhook: profile lookup for payment-failed email errored:', lookupError.message)
        }

        if (profile?.email) {
          await sendPaymentFailedEmail(profile.email as string)
        }
        // Notify only — no tier change here. The dunning grace period lives
        // in customer.subscription.updated: past_due keeps the paid tier
        // while Stripe retries, and the terminal statuses (canceled, unpaid,
        // incomplete_expired, …) or customer.subscription.deleted downgrade.
        break
      }

      default:
        break
    }
  } catch (error) {
    console.error(`Error handling webhook event ${event.type}:`, error)
    // Insert-first dedupe stays (atomic under concurrent retries), but a
    // ledger row for an event we FAILED to process would make Stripe's retry
    // no-op as a duplicate — the event would be permanently lost. Best-effort
    // delete restores retry-ability; its own try/catch guarantees a cleanup
    // failure can never mask the 500 below.
    try {
      const { error: cleanupError } = await supabase
        .from('processed_stripe_events')
        .delete()
        .eq('event_id', event.id)
      if (cleanupError) {
        console.error('Stripe webhook ledger cleanup failed:', cleanupError.message)
      }
    } catch (cleanupErr) {
      console.error('Stripe webhook ledger cleanup failed:', cleanupErr)
    }
    return { status: 500, body: { error: 'Webhook handler failed' } }
  }

  return { status: 200, body: { received: true } }
}
