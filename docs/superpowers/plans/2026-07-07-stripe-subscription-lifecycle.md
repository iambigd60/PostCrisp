# Stripe Subscription Lifecycle Integrity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the five approved subscription-lifecycle decisions (spec: `docs/superpowers/specs/2026-07-06-stripe-subscription-lifecycle-design.md`) in the Stripe webhook handler: dunning grace for `past_due`, a stale-subscription-id guard, fresh-state verification on updates, price-first tier resolution, and dedupe-ledger auto-pruning.

**Architecture:** All logic lives in `src/lib/stripe-webhook.ts` (`handleStripeEvent` + helpers), unit-tested through the injected `{ supabase, stripe }` deps against the in-memory fake in `src/lib/__tests__/fake-supabase.ts`. Each task is one TDD cycle ending in a commit; tasks build on each other in order (guard → retrieve → grace → price-first → prune).

**Tech Stack:** Next.js 15 / TypeScript (strict), Vitest, `stripe` SDK types, Supabase JS client (untyped), Sentry.

## Global Constraints

- Branch: `fix/stripe-subscription-lifecycle` (already checked out; based on `main` at `ad05a4b`).
- No dependency changes (`package.json` untouched).
- `isPaidTier` stays exactly `value === 'creator' || value === 'elite'` — never weaken tier validation.
- After every task: `npm run typecheck && npm test` must both pass (fast inner loop: `npm test -- src/lib/__tests__/stripe-webhook.test.ts`).
- Never run `npm audit fix` (17 known vulns are deferred housekeeping).
- Commit after each task with a `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer.
- Baseline before Task 1: 74 tests green (22 in `stripe-webhook.test.ts`).

---

### Task 1: Stale-subscription guard on `updated` + `deleted`

**Files:**
- Modify: `src/lib/stripe-webhook.ts:257-307` (the two subscription cases)
- Test: `src/lib/__tests__/stripe-webhook.test.ts`

**Interfaces:**
- Consumes: existing `subscriptionUpdatedEvent()` helper, `setupTables(profileOverrides)`, `createDeps(tables)`.
- Produces: both subscription branches select `'id, stripe_subscription_id'` and early-`break` (a) when no profile, (b) when `profile.stripe_subscription_id` is set and ≠ the event subscription's id (with one `console.warn`). Tasks 2–3 edit the `updated` branch downstream of this guard.

- [ ] **Step 1: Write the failing tests** — add a new describe block after the `'handleStripeEvent — subscription tier resolution'` block (after line 278):

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/__tests__/stripe-webhook.test.ts`
Expected: the two new tests FAIL (`subscription_tier` was overwritten to `'free'`); the 22 existing tests still pass.

- [ ] **Step 3: Implement the guard** — replace the whole `customer.subscription.updated` case (lines 257–282) with:

```ts
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const isActive = subscription.status === 'active' || subscription.status === 'trialing'

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
        if (profile.stripe_subscription_id && profile.stripe_subscription_id !== subscription.id) {
          console.warn(
            `Stripe webhook: ignoring ${event.type} for subscription ${subscription.id} — ` +
              `profile ${profile.id} is on subscription ${profile.stripe_subscription_id}`,
          )
          break
        }

        // Idempotent write — throw on failure so Stripe retries (see above).
        const { error: updateError } = await supabase.from('profiles').update({
          subscription_tier: isActive ? resolveSubscriptionTier(subscription) : 'free',
          stripe_subscription_id: subscription.id,
        }).eq('id', profile.id)
        if (updateError) throw updateError
        break
      }
```

and the whole `customer.subscription.deleted` case (originally lines 284–307) with:

```ts
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
```

- [ ] **Step 4: Run the suite**

Run: `npm test -- src/lib/__tests__/stripe-webhook.test.ts` then `npm run typecheck && npm test`
Expected: 24 webhook tests pass, 76 total, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stripe-webhook.ts src/lib/__tests__/stripe-webhook.test.ts
git commit -m "fix(stripe): guard subscription events against stale subscription ids

A customer who cancels and re-subscribes gets a new subscription id, but
Stripe still delivers (and re-delivers) events for the old one — those
were downgrading actively-paying customers to free. Subscription events
now only apply when they match the subscription on file (null on file
still processes, for out-of-band provisioning).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Fresh-state verification on `subscription.updated`

**Files:**
- Modify: `src/lib/stripe-webhook.ts` (the `customer.subscription.updated` case from Task 1)
- Test: `src/lib/__tests__/stripe-webhook.test.ts` (new helper + 5 existing-test adaptations + 2 new tests)

**Interfaces:**
- Consumes: Task 1's guarded `updated` branch; existing `createDeps(tables, retrievedSubscription)` whose `retrieve` mock resolves the second argument.
- Produces: `subscriptionObject(opts: { subId?, status?, metadata?, priceId? })` test helper (returns a plain subscription object; also now feeds `subscriptionUpdatedEvent`); the `updated` branch calls `stripe.subscriptions.retrieve(eventSubscription.id)` and acts only on the retrieved object. Tasks 3–5 write their `updated`-branch tests by passing `subscriptionObject(...)` as `createDeps`'s second argument.

- [ ] **Step 1: Refactor test helpers (suite must stay green)** — replace the `subscriptionUpdatedEvent` function (test file lines 113–132) with:

```ts
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
```

Run: `npm test -- src/lib/__tests__/stripe-webhook.test.ts` — Expected: 24 pass (pure refactor).

- [ ] **Step 2: Write the failing tests** — new describe block after the stale-guard block:

```ts
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- src/lib/__tests__/stripe-webhook.test.ts`
Expected: race test FAILS (tier stays `elite` — handler trusted the payload); the 500 test FAILS (handler returned 200 — it never called retrieve).

- [ ] **Step 4: Implement** — in the `customer.subscription.updated` case, rename the payload binding and verify before writing. Replace the case's first three lines:

```ts
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const isActive = subscription.status === 'active' || subscription.status === 'trialing'
```

with:

```ts
        const eventSubscription = event.data.object as Stripe.Subscription
        const customerId = eventSubscription.customer as string
```

update the guard's two references from `subscription.id` to `eventSubscription.id`, and replace the tier write block (everything after the guard's closing `}` up to `break`) with:

```ts
        // Fresh-state verification: Stripe doesn't guarantee delivery order,
        // and a redelivered stale "active" event landing after a processed
        // cancellation would re-provision a paid tier permanently (a dead
        // subscription emits no correcting events). The event is only a
        // trigger — Stripe's current view of the subscription is the truth.
        // A retrieve failure throws: the outer catch releases the ledger row
        // and returns 500, so Stripe redelivers later.
        const subscription = await stripe.subscriptions.retrieve(eventSubscription.id)

        const isActive = subscription.status === 'active' || subscription.status === 'trialing'
        // Idempotent write — throw on failure so Stripe retries (see above).
        const { error: updateError } = await supabase.from('profiles').update({
          subscription_tier: isActive ? resolveSubscriptionTier(subscription) : 'free',
          stripe_subscription_id: subscription.id,
        }).eq('id', profile.id)
        if (updateError) throw updateError
        break
```

- [ ] **Step 5: Adapt the 5 existing tests that now go through retrieve** (they currently rely on the payload; feed the same subscription to the retrieve stub):

1. `'defaults to creator and reports to Sentry when tier is unknown and price is unmappable'` — change `const { deps } = createDeps(tables)` to:
```ts
    const { deps } = createDeps(
      tables,
      subscriptionObject({ metadata: { tier: 'team' }, priceId: 'price_unknown' }),
    )
```
2. `'resolves elite from subscription metadata on customer.subscription.updated'` — change `const { deps } = createDeps(tables)` to:
```ts
    const { deps } = createDeps(tables, subscriptionObject({ metadata: { tier: 'elite' } }))
```
3. `'keeps the metadata tier but reports drift when the billed price maps to a different tier'` — change `const { deps } = createDeps(tables)` to:
```ts
    const { deps } = createDeps(
      tables,
      subscriptionObject({ metadata: { tier: 'creator' }, priceId: PRICE_IDS.elite_monthly }),
    )
```
4. `'downgrades to free on a non-active subscription status'` — change `const { deps } = createDeps(tables)` to:
```ts
    const { deps } = createDeps(
      tables,
      subscriptionObject({ status: 'unpaid', metadata: { tier: 'elite' } }),
    )
```
5. `'returns 500 and releases the event when an idempotent tier write fails'` — change `stripe: { subscriptions: { retrieve: vi.fn() } } as unknown as Stripe,` to:
```ts
      stripe: {
        subscriptions: {
          retrieve: vi.fn().mockResolvedValue(subscriptionObject({ metadata: { tier: 'elite' } })),
        },
      } as unknown as Stripe,
```

(The lookup-failure tests need no change — they throw before the retrieve. The stale-guard tests need no change — they `break` before the retrieve.)

- [ ] **Step 6: Run the suite**

Run: `npm test -- src/lib/__tests__/stripe-webhook.test.ts` then `npm run typecheck && npm test`
Expected: 26 webhook tests pass, 78 total, typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/stripe-webhook.ts src/lib/__tests__/stripe-webhook.test.ts
git commit -m "fix(stripe): verify subscription state with Stripe before acting on updates

Stripe doesn't guarantee delivery order: a redelivered stale 'active'
event landing after a processed cancellation would re-provision a paid
tier permanently (dead subscriptions emit no correcting events). The
updated branch now treats the event as a trigger and acts on a fresh
subscriptions.retrieve; a retrieve failure rides the existing
ledger-release + 500 path so Stripe redelivers.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Dunning grace period (`past_due` keeps the paid tier)

**Files:**
- Modify: `src/lib/stripe-webhook.ts` (module scope + `updated` case + `invoice.payment_failed` comment)
- Test: `src/lib/__tests__/stripe-webhook.test.ts`

**Interfaces:**
- Consumes: Task 2's retrieve-based `updated` branch; `subscriptionObject` helper.
- Produces: module-level `const PAID_STATUSES: Set<Stripe.Subscription.Status>`; the `updated` branch uses `PAID_STATUSES.has(subscription.status)` instead of the `isActive` boolean.

- [ ] **Step 1: Write the failing tests** — new describe block after the fresh-state block:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/__tests__/stripe-webhook.test.ts`
Expected: the `past_due` test FAILS (tier downgraded to `'free'`); the three `it.each` terminal-status cases already pass (they pin the boundary so the fix can't overshoot).

- [ ] **Step 3: Implement** — add at module scope, directly above `resolveSubscriptionTier`:

```ts
// Dunning grace period: past_due means Stripe is still retrying the charge
// on its Dashboard-configured schedule (typically 1–2 weeks), so the
// customer keeps their paid tier while that runs. Everything else —
// canceled, unpaid, incomplete, incomplete_expired, paused — downgrades.
const PAID_STATUSES = new Set<Stripe.Subscription.Status>(['active', 'trialing', 'past_due'])
```

In the `updated` case, replace:

```ts
        const isActive = subscription.status === 'active' || subscription.status === 'trialing'
```

with:

```ts
        const isPaid = PAID_STATUSES.has(subscription.status)
```

and `subscription_tier: isActive ? ... : 'free'` with `subscription_tier: isPaid ? ... : 'free'`.

In the `invoice.payment_failed` case, replace the trailing TODO comment:

```ts
        // TODO: dunning grace period — deliberately NOT downgrading the tier
        // on a failed payment. Stripe retries on its own schedule, and
        // customer.subscription.updated handles the eventual past_due /
        // canceled transition. Notify only.
```

with:

```ts
        // Notify only — no tier change here. The dunning grace period lives
        // in customer.subscription.updated: past_due keeps the paid tier
        // while Stripe retries, and the terminal statuses (canceled, unpaid,
        // incomplete_expired, …) or customer.subscription.deleted downgrade.
```

- [ ] **Step 4: Run the suite**

Run: `npm test -- src/lib/__tests__/stripe-webhook.test.ts` then `npm run typecheck && npm test`
Expected: 30 webhook tests pass (26 + 1 past_due + 3 it.each), 82 total, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stripe-webhook.ts src/lib/__tests__/stripe-webhook.test.ts
git commit -m "feat(stripe): dunning grace — past_due keeps the paid tier

A subscription goes past_due within moments of the FIRST failed renewal
charge, before Stripe's smart-retry window even starts — instantly
downgrading paying customers whose card merely expired, and
contradicting the payment-failed email. past_due now retains the paid
tier; the downgrade happens on the terminal statuses or deletion.
Decision by Dennis 2026-07-06 (see the lifecycle spec).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Price-first tier resolution on subscription updates

**Files:**
- Modify: `src/lib/stripe-webhook.ts:43-75` (`resolveSubscriptionTier`) + the `updated` case's call site
- Test: `src/lib/__tests__/stripe-webhook.test.ts` (rewrite 1 existing test, add 2)

**Interfaces:**
- Consumes: Tasks 2–3's `updated` branch.
- Produces: `resolveSubscriptionTier(subscription: Stripe.Subscription, prefer: 'metadata' | 'price' = 'metadata'): PaidTier`. The legacy-checkout call site stays `resolveSubscriptionTier(subscription)`; the `updated` branch calls `resolveSubscriptionTier(subscription, 'price')`.

- [ ] **Step 1: Rewrite the drift test and add two tests.** Replace the existing test `'keeps the metadata tier but reports drift when the billed price maps to a different tier'` entirely with:

```ts
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
```

- [ ] **Step 2: Run tests to verify the state**

Run: `npm test -- src/lib/__tests__/stripe-webhook.test.ts`
Expected: the price-first test FAILS (`subscription_tier: 'creator'` — metadata still wins); the metadata-fallback test passes already; the legacy-checkout test passes already (pins current behavior).

- [ ] **Step 3: Implement** — replace `resolveSubscriptionTier` (lines 43–75, including its doc comment) with:

```ts
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
```

In the `updated` case, change the call site to:

```ts
          subscription_tier: isPaid ? resolveSubscriptionTier(subscription, 'price') : 'free',
```

(The legacy-checkout call site keeps the `'metadata'` default — no change.)

- [ ] **Step 4: Run the suite**

Run: `npm test -- src/lib/__tests__/stripe-webhook.test.ts` then `npm run typecheck && npm test`
Expected: 32 webhook tests pass, 84 total, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stripe-webhook.ts src/lib/__tests__/stripe-webhook.test.ts
git commit -m "fix(stripe): resolve tier price-first on subscription updates

Stripe never rewrites subscription metadata when the billed price
changes, so a billing-portal plan switch left the metadata tier stale —
an Elite->Creator switch kept provisioning Elite while charging \$19,
durably. Updates now provision what is actually billed, with metadata
as fallback; the drift Sentry alarm stays. The legacy checkout path
remains metadata-first. Decision by Dennis 2026-07-06.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Dedupe-ledger auto-prune (30-day retention)

**Files:**
- Modify: `src/lib/stripe-webhook.ts` (new helper + call in `handleStripeEvent`)
- Modify: `src/lib/__tests__/fake-supabase.ts` (add `lt()` filter + `deleteErrors` injection)
- Test: `src/lib/__tests__/stripe-webhook.test.ts`

**Interfaces:**
- Consumes: `recordEventOnce`'s `'new' | 'duplicate' | 'error'` result.
- Produces: `pruneProcessedEvents(supabase: SupabaseClient): Promise<void>` (never throws); fake-supabase gains `.lt(col, val)` (string `<` comparison, rows missing the column never match) and a `deleteErrors?: FakeWriteErrors` option consulted only for `delete()` chains.

- [ ] **Step 1: Extend the fake.** In `fake-supabase.ts`:

(a) destructure the new option — change `const { tables, rpcs = {}, writeErrors, readErrors } = opts` and the `opts` type to:

```ts
export function createFakeSupabase(opts: {
  tables: FakeSupabaseTables
  rpcs?: FakeRpcResults
  writeErrors?: FakeWriteErrors
  readErrors?: FakeReadErrors
  // Consulted only for delete() chains — lets a test fail the prune/cleanup
  // delete while the upsert on the same table still succeeds.
  deleteErrors?: FakeWriteErrors
}) {
  const { tables, rpcs = {}, writeErrors, readErrors, deleteErrors } = opts
```

(b) add an `lt` filter — below the `filters` declaration add `const ltFilters: Filter[] = []`, extend `matches` to:

```ts
    const matches = (row: Record<string, unknown>) =>
      filters.every((f) => row[f.col] === f.val) &&
      ltFilters.every((f) => {
        const value = row[f.col]
        // Rows without the column never match — mirrors SQL NULL semantics.
        return typeof value === 'string' && typeof f.val === 'string' && value < f.val
      })
```

and add the builder method after `eq`:

```ts
      lt(col: string, val: unknown) {
        ltFilters.push({ col, val })
        return builder
      },
```

(c) consult `deleteErrors` first — in `then()`, replace:

```ts
        const injected =
          isInsert || isUpsert || isDelete || updatePayload ? writeErrors?.[table] : undefined
```

with:

```ts
        const injected =
          (isDelete ? deleteErrors?.[table] : undefined) ??
          (isInsert || isUpsert || isDelete || updatePayload ? writeErrors?.[table] : undefined)
```

Run: `npm test` — Expected: all pass (pure extension).

- [ ] **Step 2: Write the failing tests** — new describe block at the end of the webhook test file:

```ts
describe('handleStripeEvent — dedupe ledger retention', () => {
  it('prunes ledger rows older than 30 days while recording a new event', async () => {
    const tables = setupTables({ stripe_subscription_id: 'sub_1' })
    const dayMs = 24 * 60 * 60 * 1000
    tables.processed_stripe_events!.set('evt_old', {
      event_id: 'evt_old',
      type: 'noise',
      created_at: new Date(Date.now() - 31 * dayMs).toISOString(),
    })
    tables.processed_stripe_events!.set('evt_recent', {
      event_id: 'evt_recent',
      type: 'noise',
      created_at: new Date(Date.now() - 29 * dayMs).toISOString(),
    })
    const { deps } = createDeps(tables, subscriptionObject({ metadata: { tier: 'elite' } }))

    const result = await handleStripeEvent(
      subscriptionUpdatedEvent({ metadata: { tier: 'elite' } }),
      deps,
    )

    expect(result).toEqual({ status: 200, body: { received: true } })
    expect(tables.processed_stripe_events!.has('evt_old')).toBe(false)
    expect(tables.processed_stripe_events!.has('evt_recent')).toBe(true)
    expect(tables.processed_stripe_events!.has('evt_sub_updated_1')).toBe(true)
  })

  it('never fails the webhook when the prune delete errors', async () => {
    const tables = setupTables({ stripe_subscription_id: 'sub_1' })
    const deleteErrors: FakeWriteErrors = { processed_stripe_events: { message: 'delete timeout' } }
    const retrieve = vi
      .fn()
      .mockResolvedValue(subscriptionObject({ metadata: { tier: 'elite' } }))
    const deps: StripeWebhookDeps = {
      supabase: createFakeSupabase({ tables, deleteErrors }) as any,
      stripe: { subscriptions: { retrieve } } as unknown as Stripe,
    }

    const result = await handleStripeEvent(
      subscriptionUpdatedEvent({ metadata: { tier: 'elite' } }),
      deps,
    )

    // Pruning is housekeeping, not processing — the event itself succeeds.
    expect(result).toEqual({ status: 200, body: { received: true } })
    expect(tables.profiles.get('user-1')).toMatchObject({ subscription_tier: 'elite' })
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- src/lib/__tests__/stripe-webhook.test.ts`
Expected: prune test FAILS (`evt_old` still present); prune-failure test FAILS on `consoleErrorSpy` count 0 (no prune call exists yet).

- [ ] **Step 4: Implement.** In `stripe-webhook.ts`, add below `recordEventOnce`:

```ts
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
```

In `handleStripeEvent`, directly after the `duplicate` early-return, add:

```ts
  if (dedupe === 'new') {
    // Piggybacked retention pass — see pruneProcessedEvents. Skipped on
    // 'error' (the table is unhealthy) and on duplicates (already pruned
    // when the event was first recorded).
    await pruneProcessedEvents(supabase)
  }
```

- [ ] **Step 5: Run the suite**

Run: `npm test -- src/lib/__tests__/stripe-webhook.test.ts` then `npm run typecheck && npm test`
Expected: 34 webhook tests pass, 86 total, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/stripe-webhook.ts src/lib/__tests__/stripe-webhook.test.ts src/lib/__tests__/fake-supabase.ts
git commit -m "feat(stripe): auto-prune processed_stripe_events after 30 days

The dedupe ledger grew unbounded; Stripe retries max out within ~3
days, so 30-day-old rows can never dedupe anything again. Each newly
recorded event piggybacks a best-effort delete of expired rows — no
cron, no manual step, and a prune failure can never fail the webhook.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Full verification, docs, PR

**Files:**
- Modify: `docs/superpowers/specs/2026-07-06-stripe-subscription-lifecycle-design.md` (status line)
- Modify: `PICKUP.md` (session 20 block: design→implemented)

**Interfaces:**
- Consumes: all prior tasks committed; suite green.

- [ ] **Step 1: Full verification**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; 86/86 tests pass (34 in `stripe-webhook.test.ts`). If anything fails, fix before proceeding — do not commit red.

- [ ] **Step 2: Update the spec status.** In the spec, replace:

```markdown
**Status:** 🟡 Product decisions locked with Dennis; **final design sign-off pending** (session paused overnight — resume here)
```

with:

```markdown
**Status:** ✅ Approved by Dennis 2026-07-07; implemented on `fix/stripe-subscription-lifecycle` (see the PR for the diff)
```

- [ ] **Step 3: Update PICKUP.md session 20 block** — change the heading and paused/resume lines to reflect: design approved 2026-07-07, all five decisions implemented with TDD, N tests green, PR opened (link), awaiting Dennis's merge. Keep the "Sprint gates unchanged" line.

- [ ] **Step 4: Commit docs and push**

```bash
git add docs/superpowers/specs/2026-07-06-stripe-subscription-lifecycle-design.md PICKUP.md
git commit -m "docs(billing): mark lifecycle spec implemented (session 20)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push origin fix/stripe-subscription-lifecycle
```

- [ ] **Step 5: Open the PR** (base `main`), body written for a non-developer reviewer: what each of the five changes does in plain language, what to verify (CI green), and a note that merging is safe independent of the Task 2 checklist.

```bash
gh pr create --base main --head fix/stripe-subscription-lifecycle --title "fix(stripe): subscription lifecycle integrity — grace period, stale-event guard, price-first tiers, ledger pruning"
```

(Compose the body inline with `--body`; end it with the standard Claude Code attribution line.)
