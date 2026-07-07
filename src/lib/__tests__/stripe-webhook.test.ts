import { describe, it, expect, vi, beforeEach, afterEach, afterAll, type MockInstance } from 'vitest'
import type Stripe from 'stripe'
import * as Sentry from '@sentry/nextjs'
import { handleStripeEvent, type StripeWebhookDeps } from '@/lib/stripe-webhook'
import {
  createFakeSupabase,
  type FakeSupabaseTables,
  type FakeWriteErrors,
  type FakeReadErrors,
} from './fake-supabase'

// PRICES resolves env vars at module import — pin them (and clear the legacy
// STRIPE_PRO_* overrides) before any module loads so the price-ID fallback
// tests are deterministic on every machine. Originals are captured here and
// restored in afterAll so the mutation of the shared process.env never leaks
// into other test files running on the same vitest worker.
const PRICE_ENV = vi.hoisted(() => {
  const ids = {
    creator_monthly: 'price_creator_monthly_test',
    creator_yearly: 'price_creator_yearly_test',
    elite_monthly: 'price_elite_monthly_test',
    elite_yearly: 'price_elite_yearly_test',
  }
  const managedKeys = [
    'STRIPE_PRO_MONTHLY_PRICE_ID',
    'STRIPE_PRO_YEARLY_PRICE_ID',
    'STRIPE_CREATOR_MONTHLY_PRICE_ID',
    'STRIPE_CREATOR_YEARLY_PRICE_ID',
    'STRIPE_ELITE_MONTHLY_PRICE_ID',
    'STRIPE_ELITE_YEARLY_PRICE_ID',
  ]
  const original: Record<string, string | undefined> = {}
  for (const key of managedKeys) original[key] = process.env[key]

  delete process.env.STRIPE_PRO_MONTHLY_PRICE_ID
  delete process.env.STRIPE_PRO_YEARLY_PRICE_ID
  process.env.STRIPE_CREATOR_MONTHLY_PRICE_ID = ids.creator_monthly
  process.env.STRIPE_CREATOR_YEARLY_PRICE_ID = ids.creator_yearly
  process.env.STRIPE_ELITE_MONTHLY_PRICE_ID = ids.elite_monthly
  process.env.STRIPE_ELITE_YEARLY_PRICE_ID = ids.elite_yearly
  return { ids, original }
})
const PRICE_IDS = PRICE_ENV.ids

afterAll(() => {
  for (const [key, value] of Object.entries(PRICE_ENV.original)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
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

// Shape shared by subscription.updated event payloads and by
// stripe.subscriptions.retrieve stubs (the handler verifies against the
// retrieved object, so most tests feed the same shape to both).
function subscriptionObject(opts: {
  subId?: string
  status?: string
  metadata?: Record<string, string>
  priceId?: string
} = {}): Record<string, unknown> {
  return {
    id: opts.subId ?? 'sub_1',
    customer: 'cus_1',
    status: opts.status ?? 'active',
    metadata: opts.metadata ?? {},
    items: { data: [{ price: { id: opts.priceId ?? 'price_unknown' } }] },
  }
}

function subscriptionUpdatedEvent(opts: {
  id?: string
  subId?: string
  status?: string
  metadata?: Record<string, string>
  priceId?: string
} = {}): Stripe.Event {
  return {
    id: opts.id ?? 'evt_sub_updated_1',
    type: 'customer.subscription.updated',
    data: {
      object: subscriptionObject(opts),
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
    const { deps } = createDeps(
      tables,
      subscriptionObject({ metadata: { tier: 'team' }, priceId: 'price_unknown' }),
    )

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
    const { deps } = createDeps(tables, subscriptionObject({ metadata: { tier: 'elite' } }))

    await handleStripeEvent(subscriptionUpdatedEvent({ metadata: { tier: 'elite' } }), deps)

    expect(tables.profiles.get('user-1')).toMatchObject({
      subscription_tier: 'elite',
      stripe_subscription_id: 'sub_1',
    })
    expect(vi.mocked(Sentry.captureMessage)).not.toHaveBeenCalled()
  })

  it('writes the price-mapped tier and reports drift when metadata disagrees (price-first)', async () => {
    const tables = setupTables()
    // Metadata says creator, but the actually-billed price is Elite (e.g. a
    // billing-portal plan switch — Stripe never rewrites the metadata). On
    // updates the customer gets what they are billed for.
    const { deps } = createDeps(
      tables,
      subscriptionObject({ metadata: { tier: 'creator' }, priceId: PRICE_IDS.elite_monthly }),
    )

    await handleStripeEvent(
      subscriptionUpdatedEvent({ metadata: { tier: 'creator' }, priceId: PRICE_IDS.elite_monthly }),
      deps,
    )

    expect(tables.profiles.get('user-1')).toMatchObject({ subscription_tier: 'elite' })
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalledTimes(1)
    const message = vi.mocked(Sentry.captureMessage).mock.calls[0][0]
    expect(message).toContain('sub_1')
    expect(message).toContain("'creator'")
    expect(message).toContain("'elite'")
  })

  it('falls back to subscription metadata when the billed price is unmapped', async () => {
    const tables = setupTables()
    const { deps } = createDeps(
      tables,
      subscriptionObject({ metadata: { tier: 'elite' }, priceId: 'price_unknown' }),
    )

    await handleStripeEvent(subscriptionUpdatedEvent({ metadata: { tier: 'elite' } }), deps)

    expect(tables.profiles.get('user-1')).toMatchObject({ subscription_tier: 'elite' })
    expect(vi.mocked(Sentry.captureMessage)).not.toHaveBeenCalled()
  })

  it('keeps metadata-first resolution (with drift alarm) on the legacy checkout path', async () => {
    const tables = setupTables()
    // Legacy session: no session metadata, so the handler retrieves the
    // subscription and resolves metadata-first — checkout metadata is
    // written fresh at purchase time, so it stays authoritative there.
    const { deps } = createDeps(
      tables,
      subscriptionObject({ metadata: { tier: 'creator' }, priceId: PRICE_IDS.elite_monthly }),
    )

    await handleStripeEvent(checkoutCompletedEvent({ metadata: {} }), deps)

    expect(tables.profiles.get('user-1')).toMatchObject({ subscription_tier: 'creator' })
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalledTimes(1)
  })

  it('downgrades to free on a non-active subscription status', async () => {
    const tables = setupTables({ subscription_tier: 'elite' })
    const { deps } = createDeps(
      tables,
      subscriptionObject({ status: 'unpaid', metadata: { tier: 'elite' } }),
    )

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

describe('handleStripeEvent — stale-subscription guard', () => {
  it('ignores a subscription.updated event for a subscription that is not on file', async () => {
    // Customer canceled sub_1 and re-subscribed as sub_2; a late event from
    // the dead sub_1 must not touch the actively-paying profile.
    const tables = setupTables({ subscription_tier: 'elite', stripe_subscription_id: 'sub_2' })
    const { deps } = createDeps(tables)

    const result = await handleStripeEvent(
      subscriptionUpdatedEvent({ status: 'canceled', metadata: { tier: 'elite' } }),
      deps,
    )

    expect(result).toEqual({ status: 200, body: { received: true } })
    expect(tables.profiles.get('user-1')).toMatchObject({
      subscription_tier: 'elite',
      stripe_subscription_id: 'sub_2',
    })
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
  })

  it('ignores a subscription.deleted event for a subscription that is not on file', async () => {
    const tables = setupTables({ subscription_tier: 'elite', stripe_subscription_id: 'sub_2' })
    const { deps } = createDeps(tables)
    const event = {
      id: 'evt_sub_deleted_stale_1',
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_1', customer: 'cus_1' } },
    } as unknown as Stripe.Event

    const result = await handleStripeEvent(event, deps)

    expect(result).toEqual({ status: 200, body: { received: true } })
    expect(tables.profiles.get('user-1')).toMatchObject({
      subscription_tier: 'elite',
      stripe_subscription_id: 'sub_2',
    })
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
  })
})

describe('handleStripeEvent — fresh-state verification on subscription.updated', () => {
  it("acts on Stripe's current state, not the event payload (reordering race)", async () => {
    const tables = setupTables({ subscription_tier: 'elite', stripe_subscription_id: 'sub_1' })
    // A redelivered stale event claims the subscription is active, but
    // Stripe's current view says canceled — the canceled truth must win, or
    // a dead subscription re-provisions a paid tier forever.
    const { deps, retrieve } = createDeps(
      tables,
      subscriptionObject({ status: 'canceled', metadata: { tier: 'elite' } }),
    )

    await handleStripeEvent(
      subscriptionUpdatedEvent({ status: 'active', metadata: { tier: 'elite' } }),
      deps,
    )

    expect(retrieve).toHaveBeenCalledWith('sub_1')
    expect(tables.profiles.get('user-1')).toMatchObject({ subscription_tier: 'free' })
  })

  it('returns 500 and releases the ledger row when the verification retrieve fails', async () => {
    const tables = setupTables({ subscription_tier: 'elite', stripe_subscription_id: 'sub_1' })
    const retrieve = vi.fn().mockRejectedValue(new Error('stripe api down'))
    const deps: StripeWebhookDeps = {
      supabase: createFakeSupabase({ tables }) as any,
      stripe: { subscriptions: { retrieve } } as unknown as Stripe,
    }

    const result = await handleStripeEvent(
      subscriptionUpdatedEvent({ metadata: { tier: 'elite' } }),
      deps,
    )

    // Tier untouched, event still live for Stripe's redelivery.
    expect(result).toEqual({ status: 500, body: { error: 'Webhook handler failed' } })
    expect(tables.profiles.get('user-1')).toMatchObject({ subscription_tier: 'elite' })
    expect(tables.processed_stripe_events!.size).toBe(0)
  })
})

describe('handleStripeEvent — dunning grace period', () => {
  it('keeps the paid tier while the subscription is past_due (Stripe is still retrying)', async () => {
    const tables = setupTables({ subscription_tier: 'elite', stripe_subscription_id: 'sub_1' })
    const { deps } = createDeps(
      tables,
      subscriptionObject({ status: 'past_due', metadata: { tier: 'elite' } }),
    )

    await handleStripeEvent(
      subscriptionUpdatedEvent({ status: 'past_due', metadata: { tier: 'elite' } }),
      deps,
    )

    expect(tables.profiles.get('user-1')).toMatchObject({
      subscription_tier: 'elite',
      stripe_subscription_id: 'sub_1',
    })
  })

  it.each(['canceled', 'incomplete_expired', 'paused'])(
    'downgrades to free when the subscription reaches %s',
    async (status) => {
      const tables = setupTables({ subscription_tier: 'elite', stripe_subscription_id: 'sub_1' })
      const { deps } = createDeps(
        tables,
        subscriptionObject({ status, metadata: { tier: 'elite' } }),
      )

      await handleStripeEvent(subscriptionUpdatedEvent({ status, metadata: { tier: 'elite' } }), deps)

      expect(tables.profiles.get('user-1')).toMatchObject({ subscription_tier: 'free' })
    },
  )
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

describe('handleStripeEvent — retry-safety on processing failures', () => {
  it('releases the ledger row on a mid-event throw so the same event id can be redelivered', async () => {
    const tables = setupTables()
    // Legacy-session path: subscriptions.retrieve fails transiently on the
    // first delivery, then recovers — the poison-event regression scenario.
    const retrieve = vi
      .fn()
      .mockRejectedValueOnce(new Error('stripe transient outage'))
      .mockResolvedValue({
        id: 'sub_1',
        metadata: { tier: 'elite' },
        items: { data: [{ price: { id: PRICE_IDS.elite_monthly } }] },
      })
    const deps: StripeWebhookDeps = {
      supabase: createFakeSupabase({ tables }) as any,
      stripe: { subscriptions: { retrieve } } as unknown as Stripe,
    }
    const event = checkoutCompletedEvent({ id: 'evt_transient_1', metadata: {} })

    const first = await handleStripeEvent(event, deps)
    expect(first).toEqual({ status: 500, body: { error: 'Webhook handler failed' } })
    // Ledger row must be gone — otherwise Stripe's retry no-ops as a
    // duplicate and the paying customer is never provisioned.
    expect(tables.processed_stripe_events!.size).toBe(0)
    expect(tables.profiles.get('user-1')).toMatchObject({ subscription_tier: 'free' })

    // Stripe redelivers the SAME event id — it must now process fully.
    const second = await handleStripeEvent(event, deps)
    expect(second).toEqual({ status: 200, body: { received: true } })
    expect(tables.profiles.get('user-1')).toMatchObject({
      subscription_tier: 'elite',
      stripe_subscription_id: 'sub_1',
    })
    expect(tables.processed_stripe_events!.has('evt_transient_1')).toBe(true)
  })

  it('returns 500 and releases the event when an idempotent tier write fails', async () => {
    const tables = setupTables()
    const writeErrors: FakeWriteErrors = { profiles: { message: 'db connection reset' } }
    const deps: StripeWebhookDeps = {
      supabase: createFakeSupabase({ tables, writeErrors }) as any,
      stripe: {
        subscriptions: {
          retrieve: vi.fn().mockResolvedValue(subscriptionObject({ metadata: { tier: 'elite' } })),
        },
      } as unknown as Stripe,
    }

    const result = await handleStripeEvent(subscriptionUpdatedEvent({ metadata: { tier: 'elite' } }), deps)

    expect(result).toEqual({ status: 500, body: { error: 'Webhook handler failed' } })
    expect(tables.profiles.get('user-1')).toMatchObject({ subscription_tier: 'free' })
    expect(tables.processed_stripe_events!.size).toBe(0)

    // Once the DB recovers, Stripe's retry of the same event id succeeds —
    // the write is idempotent, so re-running it is safe.
    delete writeErrors.profiles
    const retry = await handleStripeEvent(subscriptionUpdatedEvent({ metadata: { tier: 'elite' } }), deps)
    expect(retry).toEqual({ status: 200, body: { received: true } })
    expect(tables.profiles.get('user-1')).toMatchObject({ subscription_tier: 'elite' })
  })

  it('returns 500 and releases the event when the subscription.updated profile lookup fails', async () => {
    const tables = setupTables({ subscription_tier: 'creator' })
    const readErrors: FakeReadErrors = { profiles: { message: 'read timeout' } }
    const deps: StripeWebhookDeps = {
      supabase: createFakeSupabase({ tables, readErrors }) as any,
      stripe: { subscriptions: { retrieve: vi.fn() } } as unknown as Stripe,
    }

    const result = await handleStripeEvent(subscriptionUpdatedEvent({ metadata: { tier: 'elite' } }), deps)

    // A failed read must NOT look like "no profile" — that would 200, keep
    // the ledger row, and make even a dashboard resend a duplicate no-op.
    expect(result).toEqual({ status: 500, body: { error: 'Webhook handler failed' } })
    expect(tables.profiles.get('user-1')).toMatchObject({ subscription_tier: 'creator' })
    expect(tables.processed_stripe_events!.size).toBe(0)
  })

  it('returns 500 and releases the event when the subscription.deleted profile lookup fails', async () => {
    const tables = setupTables({ subscription_tier: 'elite', stripe_subscription_id: 'sub_1' })
    const readErrors: FakeReadErrors = { profiles: { message: 'read timeout' } }
    const deps: StripeWebhookDeps = {
      supabase: createFakeSupabase({ tables, readErrors }) as any,
      stripe: { subscriptions: { retrieve: vi.fn() } } as unknown as Stripe,
    }
    const event = {
      id: 'evt_sub_deleted_err_1',
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_1', customer: 'cus_1' } },
    } as unknown as Stripe.Event

    const result = await handleStripeEvent(event, deps)

    // No later event follows a deletion — a silent skip here would leave a
    // canceled customer on their paid tier permanently.
    expect(result).toEqual({ status: 500, body: { error: 'Webhook handler failed' } })
    expect(tables.profiles.get('user-1')).toMatchObject({
      subscription_tier: 'elite',
      stripe_subscription_id: 'sub_1',
    })
    expect(tables.processed_stripe_events!.size).toBe(0)
  })

  it('returns 500 and releases the event when the credit-pack balance read fails', async () => {
    const tables = setupTables()
    const readErrors: FakeReadErrors = { profiles: { message: 'read timeout' } }
    const deps: StripeWebhookDeps = {
      supabase: createFakeSupabase({ tables, readErrors }) as any,
      stripe: { subscriptions: { retrieve: vi.fn() } } as unknown as Stripe,
    }
    const event = checkoutCompletedEvent({
      id: 'evt_pack_read_1',
      mode: 'payment',
      metadata: { credit_pack_id: 'pack_500', credits: '500' },
    })

    const result = await handleStripeEvent(event, deps)

    // A failed read must NOT fall back to a 0 balance — that would overwrite
    // the customer's real balance with just the pack amount on the update.
    expect(result).toEqual({ status: 500, body: { error: 'Webhook handler failed' } })
    expect(tables.profiles.get('user-1')).toMatchObject({ credits_balance: 10 })
    expect(tables.credit_transactions).toHaveLength(0)
    // Ledger released — nothing was granted, so Stripe's retry is safe.
    expect(tables.processed_stripe_events!.size).toBe(0)
  })

  it('returns 500 and releases the event when the credit-pack balance write fails', async () => {
    const tables = setupTables()
    const writeErrors: FakeWriteErrors = { profiles: { message: 'db down' } }
    const deps: StripeWebhookDeps = {
      supabase: createFakeSupabase({ tables, writeErrors }) as any,
      stripe: { subscriptions: { retrieve: vi.fn() } } as unknown as Stripe,
    }
    const event = checkoutCompletedEvent({
      id: 'evt_pack_fail_1',
      mode: 'payment',
      metadata: { credit_pack_id: 'pack_500', credits: '500' },
    })

    const result = await handleStripeEvent(event, deps)

    // Nothing was granted, so a retry is safe — the event must stay live.
    expect(result).toEqual({ status: 500, body: { error: 'Webhook handler failed' } })
    expect(tables.profiles.get('user-1')).toMatchObject({ credits_balance: 10 })
    expect(tables.credit_transactions).toHaveLength(0)
    expect(tables.processed_stripe_events!.size).toBe(0)
  })

  it('keeps the 200 and reports to Sentry when the credit audit insert fails after the grant', async () => {
    const tables = setupTables()
    const writeErrors: FakeWriteErrors = { credit_transactions: { message: 'insert timeout' } }
    const deps: StripeWebhookDeps = {
      supabase: createFakeSupabase({ tables, writeErrors }) as any,
      stripe: { subscriptions: { retrieve: vi.fn() } } as unknown as Stripe,
    }
    const event = checkoutCompletedEvent({
      id: 'evt_pack_audit_1',
      mode: 'payment',
      metadata: { credit_pack_id: 'pack_500', credits: '500' },
    })

    const result = await handleStripeEvent(event, deps)

    // The balance is already granted — a 500 here would make Stripe retry
    // and double-grant. Loud observability instead of a throw.
    expect(result).toEqual({ status: 200, body: { received: true } })
    expect(tables.profiles.get('user-1')).toMatchObject({ credits_balance: 510 })
    expect(tables.credit_transactions).toHaveLength(0)
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalledTimes(1)
    // Ledger row kept — the event is consumed; a retry must no-op.
    expect(tables.processed_stripe_events!.has('evt_pack_audit_1')).toBe(true)
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
    // Accurate copy: no grace-window promise — past_due can hit on the first
    // failed attempt, so the email says features may pause until it's fixed.
    expect(payload.text).toContain('paused until your payment method is updated')
    expect(payload.text).not.toContain('if it keeps failing')
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

  it('logs but does not fail when the profile lookup for the email errors', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const tables = setupTables()
    const readErrors: FakeReadErrors = { profiles: { message: 'read timeout' } }
    const deps: StripeWebhookDeps = {
      supabase: createFakeSupabase({ tables, readErrors }) as any,
      stripe: { subscriptions: { retrieve: vi.fn() } } as unknown as Stripe,
    }

    const result = await handleStripeEvent(paymentFailedEvent(), deps)

    // Best-effort email: a 500 for a failed lookup would be worse than a
    // missed notification, but the miss must be visible in the logs.
    expect(result).toEqual({ status: 200, body: { received: true } })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
  })

  it('logs a Resend HTTP failure by status code only and never fails the webhook', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://postcrisp.test')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 422 }))

    const tables = setupTables()
    const { deps } = createDeps(tables)

    const result = await handleStripeEvent(paymentFailedEvent(), deps)

    expect(result).toEqual({ status: 200, body: { received: true } })
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    const logged = consoleErrorSpy.mock.calls[0].join(' ')
    expect(logged).toContain('422')
    // Status code only — never the recipient or anything from the response.
    expect(logged).not.toContain('user-1@example.com')
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
