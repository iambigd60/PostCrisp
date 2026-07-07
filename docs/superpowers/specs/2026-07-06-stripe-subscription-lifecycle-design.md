# Stripe Subscription Lifecycle Integrity — Design

**Date:** 2026-07-06
**Status:** ✅ Approved by Dennis 2026-07-07; implemented on `fix/stripe-subscription-lifecycle` — [PR #3](https://github.com/iambigd60/PostCrisp/pull/3)
**Branch:** `fix/stripe-subscription-lifecycle`, based on `main` (Task 1 merged via [PR #2](https://github.com/iambigd60/PostCrisp/pull/2) on 2026-07-06 — the original prerequisite is satisfied).
**Scope:** `src/lib/stripe-webhook.ts` + its Vitest suite (`src/lib/__tests__/stripe-webhook.test.ts`, `fake-supabase.ts`). No dependency changes. No new SQL.

> **Reconciliation note:** this design was drafted against Task 1's original commit (`08eda96`) while, in parallel, another session extended and merged Task 1 (PR #2: throw-on-error gating, ledger release on failure, metadata-vs-price drift detection). The spec below is already updated for the merged code — do not trust older drafts of this reasoning in session history.

## Background

An adversarially-verified review of the Task 1 webhook confirmed three subscription-lifecycle gaps, all deliberately deferred pending product decisions (see PICKUP.md session 19 "Deferred product decisions"). Dennis made those decisions on 2026-07-06 — all four recommendations accepted, plus one robustness enhancement:

| # | Decision | Choice |
|---|----------|--------|
| 1 | Failed renewal (`past_due`) | **Keep paid access during Stripe's retry window**; downgrade only on terminal states |
| 2 | Stale subscription events | **Add subscription-id guard** — ignore events about a subscription not on file |
| 3 | Tier source of truth | **Price-first** on subscription updates, metadata label as fallback (flips PR #2's metadata-first resolution; the drift warning stays, reworded) |
| 4 | `processed_stripe_events` growth | **Auto-prune in code** — webhook deletes rows older than 30 days, best-effort |
| 5 | Event-reordering race | **Verify with Stripe first** — on `customer.subscription.updated`, retrieve the subscription's current state and act on that, not the event payload |

Facts verified during design (do not re-derive):

- Tier drift detection **exists on main** (added by PR #2, after this session's initial read): `resolveSubscriptionTier` reports metadata-vs-price disagreement to Sentry but keeps metadata authoritative. Decision 3 flips that priority.
- The webhook now error-gates every DB read/write: reads/writes throw on failure, and the outer catch **releases the dedupe-ledger row** before returning 500, so Stripe's retry can reprocess. New logic must fit this retry-safety pattern.
- Profile lookups in the subscription branches use `maybeSingle()` + throw-on-read-error.
- The pre-Task-1 webhook already wrote `stripe_subscription_id` on checkout and updates, so existing subscribers have it populated. A null value occurs only for out-of-band provisioning or after a deletion.
- `stripe_subscription_id` is read only by admin display (`src/app/api/admin/users/[id]/route.ts`) — no logic depends on it.
- The billing portal route (`src/app/api/stripe/portal/route.ts`) uses the default Dashboard portal configuration; whether plan switching is enabled is invisible from the codebase. Price-first resolution makes the answer non-critical.
- The payment-failed email wording was already made grace-neutral by PR #2 ("your paid features may be paused until your payment method is updated") — it stays accurate once the grace period ships; no email change required.

## Design

### 1. Dunning grace period (`customer.subscription.updated`)

Paid statuses become `active | trialing | past_due` → profile keeps/receives the resolved paid tier. Every other status (`canceled`, `unpaid`, `incomplete`, `incomplete_expired`, `paused`) → `free`. `customer.subscription.deleted` still downgrades (subject to the guard below). The retry window's length stays controlled by the Stripe Dashboard dunning settings, not code. Update the `// TODO: dunning grace period` comment in the `invoice.payment_failed` branch to describe the now-implemented behavior.

### 2. Stale-event guard (`updated` + `deleted` branches)

- Profile lookup adds `stripe_subscription_id` to the select (keeping the existing `maybeSingle()` + throw-on-error gate).
- If `profile.stripe_subscription_id` is set **and** differs from the event subscription's id → skip all writes, `console.warn` breadcrumb (normal occurrence, not Sentry-worthy). The dedupe-ledger row is deliberately kept: a correctly-ignored event counts as processed.
- If it is null → process normally (covers out-of-band provisioning; deliberate).
- `deleted` needs no fresh retrieve: it is terminal and a subscription id can never be legitimately reused after deletion, so the id guard alone is sufficient there.

### 3. Fresh-state verification (`updated` branch only)

After the guard passes, call `stripe.subscriptions.retrieve(subscription.id)` and compute status + tier from the **retrieved** object, not the event payload. Rationale: Stripe does not guarantee delivery order; a redelivered stale `active` event landing after a processed deletion would otherwise re-provision a paid tier permanently (a dead subscription emits no correcting events). If the retrieve throws, the existing outer catch releases the ledger row and returns 500 so Stripe redelivers — exactly the retry-safe behavior PR #2 established. The retrieve pattern and test fake already exist from the legacy-checkout path.

Write-back on paid status: tier + `stripe_subscription_id = fresh.id`. On non-paid status: `subscription_tier: 'free'`, id still recorded (parity with current behavior; `deleted` is what nulls it).

### 4. Price-first tier resolution

Refactor `resolveSubscriptionTier(subscription)` to take a preference:

- **`price` preference** (used by the `updated` branch): price-ID mapping first; metadata label only if the price is unmapped; Sentry + default `'creator'` if neither resolves (unchanged last resort).
- **`metadata` preference** (used by the legacy-checkout retrieve path): current merged behavior, unchanged.
- **Drift warning (both paths):** PR #2's metadata-vs-price Sentry message stays; reword the price-first variant (price wins now, message should say so).
- `isPaidTier` (exact `'creator' | 'elite'`) is untouched — hard sprint constraint.
- `checkout.session.completed` with fresh session metadata is unaffected.

### 5. Dedupe-ledger auto-prune

In `handleStripeEvent`, when `recordEventOnce` returns `'new'` (not on `'error'` — the table is unhealthy then), issue a best-effort `delete` of `processed_stripe_events` rows with `created_at < now − 30 days`. Wrapped in its own try/catch: failure logs to console and never affects the webhook result — and unlike the write gates, it must NOT throw (pruning is housekeeping, not processing). Runs on every new event — at current volume that is a sub-millisecond query on a table this design keeps permanently small, so no index or scheduler is warranted (documented in code). Distinct from PR #2's ledger *release* (delete by `event_id` in the catch path), which is untouched.

## Test plan (extend existing suite; all 22 existing webhook cases — 74 total — stay green)

1. `past_due` keeps the resolved paid tier.
2. Terminal statuses (`canceled`, `unpaid`, `incomplete_expired`) → `free`.
3. `updated` event for a foreign subscription id → no writes, warn logged.
4. `deleted` event for a foreign subscription id → no downgrade.
5. `updated` with null id on file → applies and stores the id.
6. Price-first: metadata says `elite`, price maps to creator → `creator` + drift Sentry message.
7. Metadata fallback: unmapped price + valid metadata → metadata tier.
8. Reordering race: event payload says `active`, retrieve returns `canceled` → `free`.
9. Retrieve failure → 500 and the ledger row is released (Stripe will redeliver).
10. Prune: >30-day-old row deleted on next new event; fresh rows kept.
11. Prune failure → webhook still returns 200.

`fake-supabase.ts` may need `delete().lt()` + `created_at` on ledger rows (it already supports the `delete().eq()` release path); `updated`-branch tests need the retrieve mock fed per-event (mechanical).

## Out of scope

- Stripe Dashboard portal configuration audit (drift warning + price-first make it non-blocking).
- pg_cron / scheduled cleanup.
- Payment-failed email copy changes (already grace-neutral).
- Sprint Tasks 3 & 4 (service-role credit writes; trigger SQL) — separately gated; see PICKUP.md sprint sequencing.

## Verification gate

`npm run typecheck && npm test` green before any commit claims completion.
