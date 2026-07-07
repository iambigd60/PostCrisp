import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import type Stripe from 'stripe'
import * as Sentry from '@sentry/nextjs'
import { handleStripeEvent, type StripeWebhookDeps } from '@/lib/stripe-webhook'
import { createFakeSupabase, type FakeSupabaseTables } from './fake-supabase'

// PRICES resolves env vars at module import — pin them (and clear the legacy
// STRIPE_PRO_* overrides) before any module loads so the price-ID fallback
// tests are deterministic on every machine.
const PRICE_IDS = vi.hoisted(() => {
  const ids = {
    creator_monthly: 'price_creator_monthly_test',
    creator_yearly: 'price_creator_yearly_test',
    elite_monthly: 'price_elite_monthly_test',
    elite_yearly: 'price_elite_yearly_test',
  }
  delete process.env.STRIPE_PRO_MONTHLY_PRICE_ID
  delete process.env.STRIPE_PRO_YEARLY_PRICE_ID
  process.env.STRIPE_CREATOR_MONTHLY_PRICE_ID = ids.creator_monthly
  process.env.STRIPE_CREATOR_YEARLY_PRICE_ID = ids.creator_yearly
  process.env.STRIPE_ELITE_MONTHLY_PRICE_ID = ids.elite_monthly
  process.env.STRIPE_ELITE_YEARLY_PRICE_ID = ids.elite_yearly
  return ids
})

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}))

function setupTables(profileOverrides: Record<string, unknown> = {}): FakeSupabaseTables {
  return {
    profiles: new Map([
      [
        'user-1',
        {
          id: 'user-1',
          email: 'user-1@example.com',
          subscription_tier: 'free',
          stripe_customer_id: 'cus_1',
          stripe_subscription_id: null,
          credits_balance: 10,
          ...profileOverrides,
        },
      ],
    ]),
    credit_transactions: [],
    generations: [],
    generation_ai_calls: [],
    creator_profiles: new Map(),
    processed_stripe_events: new Map(),
  }
}

// Fake Stripe SDK — only subscriptions.retrieve is used by the handler (the
// legacy-session fallback in checkout.session.completed).
function createDeps(tables: FakeSupabaseTables, retrievedSubscription: Record<string, unknown> = {}) {
  const retrieve = vi.fn().mockResolvedValue(retrievedSubscription)
  const deps: StripeWebhookDeps = {
    supabase: createFakeSupabase({ tables }) as any,
    stripe: { subscriptions: { retrieve } } as unknown as Stripe,
  }
  return { deps, retrieve }
}

function checkoutCompletedEvent(opts: {
  id?: string
  mode?: 'subscription' | 'payment'
  metadata?: Record<string, string>
} = {}): Stripe.Event {
  const mode = opts.mode ?? 'subscription'
  return {
    id: opts.id ?? 'evt_checkout_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        client_reference_id: 'user-1',
        customer: 'cus_1',
        subscription: mode === 'subscription' ? 'sub_1' : null,
        mode,
        metadata: opts.metadata ?? {},
      },
    },
  } as unknown as Stripe.Event
}

function subscriptionUpdatedEvent(opts: {
  id?: string
  status?: string
  metadata?: Record<string, string>
  priceId?: string
} = {}): Stripe.Event {
  return {
    id: opts.id ?? 'evt_sub_updated_1',
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_1',
        customer: 'cus_1',
        status: opts.status ?? 'active',
        metadata: opts.metadata ?? {},
        items: { data: [{ price: { id: opts.priceId ?? 'price_unknown' } }] },
      },
    },
  } as unknown as Stripe.Event
}

let consoleErrorSpy: MockInstance
let consoleWarnSpy: MockInstance

beforeEach(() => {
  vi.clearAllMocks()
  // Silence expected handler logging so test output stays pristine; the
  // fail-open test asserts on the spy instead of reading stderr.
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
  consoleWarnSpy.mockRestore()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('handleStripeEvent — subscription tier resolution', () => {
  it('provisions creator when checkout session metadata.tier is creator', async () => {
    const tables = setupTables()
    const { deps, retrieve } = createDeps(tables)

    const result = await handleStripeEvent(checkoutCompletedEvent({ metadata: { tier: 'creator' } }), deps)

    expect(result).toEqual({ status: 200, body: { received: true } })
    expect(tables.profiles.get('user-1')).toMatchObject({
      subscription_tier: 'creator',
      stripe_customer_id: 'cus_1',
      stripe_subscription_id: 'sub_1',
    })
    // Session metadata was enough — no extra Stripe API round-trip.
    expect(retrieve).not.toHaveBeenCalled()
  })

  it('provisions elite when checkout session metadata.tier is elite', async () => {
    const tables = setupTables()
    const { deps, retrieve } = createDeps(tables)

    const result = await handleStripeEvent(checkoutCompletedEvent({ metadata: { tier: 'elite' } }), deps)

    expect(result).toEqual({ status: 200, body: { received: true } })
    expect(tables.profiles.get('user-1')).toMatchObject({
      subscription_tier: 'elite',
      stripe_customer_id: 'cus_1',
      stripe_subscription_id: 'sub_1',
    })
    expect(retrieve).not.toHaveBeenCalled()
  })

  it('falls back to the subscription price ID when session metadata is missing', async () => {
    const tables = setupTables()
    // Legacy session (created before the metadata deploy): no session tier,
    // and the retrieved subscription has no usable metadata either — only
    // its price ID identifies the Elite plan.
    const { deps, retrieve } = createDeps(tables, {
      id: 'sub_1',
      metadata: {},
      items: { data: [{ price: { id: PRICE_IDS.elite_monthly } }] },
    })

    const result = await handleStripeEvent(checkoutCompletedEvent({ metadata: {} }), deps)

    expect(result).toEqual({ status: 200, body: { received: true } })
    expect(retrieve).toHaveBeenCalledWith('sub_1')
    expect(tables.profiles.get('user-1')).toMatchObject({ subscription_tier: 'elite' })
  })

  it('defaults to creator and reports to Sentry when tier is unknown and price is unmappable', async () => {
    const tables = setupTables()
    const { deps } = createDeps(tables)

    const result = await handleStripeEvent(
      subscriptionUpdatedEvent({ metadata: { tier: 'team' }, priceId: 'price_unknown' }),
      deps,
    )

    expect(result).toEqual({ status: 200, body: { received: true } })
    expect(tables.profiles.get('user-1')).toMatchObject({ subscription_tier: 'creator' })
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalledTimes(1)
  })

  it('resolves elite from subscription metadata on customer.subscription.updated', async () => {
    const tables = setupTables()
    const { deps } = createDeps(tables)

    await handleStripeEvent(subscriptionUpdatedEvent({ metadata: { tier: 'elite' } }), deps)

    expect(tables.profiles.get('user-1')).toMatchObject({
      subscription_tier: 'elite',
      stripe_subscription_id: 'sub_1',
    })
    expect(vi.mocked(Sentry.captureMessage)).not.toHaveBeenCalled()
  })

  it('downgrades to free on a non-active subscription status', async () => {
    const tables = setupTables({ subscription_tier: 'elite' })
    const { deps } = createDeps(tables)

    await handleStripeEvent(
      subscriptionUpdatedEvent({ status: 'unpaid', metadata: { tier: 'elite' } }),
      deps,
    )

    expect(tables.profiles.get('user-1')).toMatchObject({ subscription_tier: 'free' })
  })

  it('downgrades to free and clears the subscription id on customer.subscription.deleted', async () => {
    const tables = setupTables({ subscription_tier: 'elite', stripe_subscription_id: 'sub_1' })
    const { deps } = createDeps(tables)

    const event = {
      id: 'evt_sub_deleted_1',
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_1', customer: 'cus_1' } },
    } as unknown as Stripe.Event

    await handleStripeEvent(event, deps)

    expect(tables.profiles.get('user-1')).toMatchObject({
      subscription_tier: 'free',
      stripe_subscription_id: null,
    })
  })
})

describe('handleStripeEvent — idempotency', () => {
  it('processes a replayed credit-pack event only once', async () => {
    const tables = setupTables()
    const { deps } = createDeps(tables)
    const event = checkoutCompletedEvent({
      id: 'evt_pack_1',
      mode: 'payment',
      metadata: { credit_pack_id: 'pack_500', credits: '500' },
    })

    const first = await handleStripeEvent(event, deps)
    expect(first).toEqual({ status: 200, body: { received: true } })
    expect(tables.profiles.get('user-1')).toMatchObject({ credits_balance: 510 })
    expect(tables.credit_transactions).toHaveLength(1)

    // Stripe retry — same event id delivered again.
    const second = await handleStripeEvent(event, deps)
    expect(second).toEqual({ status: 200, body: { received: true, duplicate: true } })
    expect(tables.profiles.get('user-1')).toMatchObject({ credits_balance: 510 })
    expect(tables.credit_transactions).toHaveLength(1)
  })

  it('fails open and still processes the event when the dedupe write errors', async () => {
    // Omitting processed_stripe_events simulates the migration not having
    // been run yet — the fake returns a "relation does not exist" error.
    const tables = setupTables()
    delete tables.processed_stripe_events
    const { deps } = createDeps(tables)

    const result = await handleStripeEvent(checkoutCompletedEvent({ metadata: { tier: 'elite' } }), deps)

    expect(result).toEqual({ status: 200, body: { received: true } })
    expect(tables.profiles.get('user-1')).toMatchObject({ subscription_tier: 'elite' })
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalledTimes(1)
  })
})

describe('handleStripeEvent — invoice.payment_failed', () => {
  const paymentFailedEvent = () =>
    ({
      id: 'evt_invoice_failed_1',
      type: 'invoice.payment_failed',
      data: { object: { customer: 'cus_1' } },
    }) as unknown as Stripe.Event

  it('emails the customer via Resend and does NOT downgrade the tier', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://postcrisp.test')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const tables = setupTables({ subscription_tier: 'elite' })
    const { deps } = createDeps(tables)

    const result = await handleStripeEvent(paymentFailedEvent(), deps)

    expect(result).toEqual({ status: 200, body: { received: true } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    const payload = JSON.parse((init as { body: string }).body)
    expect(payload.from).toBe('PostCrisp <noreply@postcrisp.com>')
    expect(payload.to).toEqual(['user-1@example.com'])
    expect(payload.text).toContain('https://postcrisp.test/dashboard/billing')
    // Notify only — the tier must survive a payment failure untouched.
    expect(tables.profiles.get('user-1')).toMatchObject({ subscription_tier: 'elite' })
  })

  it('skips the email silently when RESEND_API_KEY is not configured', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const tables = setupTables()
    const { deps } = createDeps(tables)

    const result = await handleStripeEvent(paymentFailedEvent(), deps)

    expect(result).toEqual({ status: 200, body: { received: true } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('never fails the webhook response when the email send throws', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://postcrisp.test')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('resend down')))

    const tables = setupTables()
    const { deps } = createDeps(tables)

    const result = await handleStripeEvent(paymentFailedEvent(), deps)

    expect(result).toEqual({ status: 200, body: { received: true } })
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
  })
})
