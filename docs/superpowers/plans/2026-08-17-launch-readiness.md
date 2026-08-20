# PostCrisp — Public Paid Launch Readiness Plan

> **Historical plan:** Migration filenames below reflect the repository as of 2026-08-17 and are non-actionable. Use [the Phase 0 database reconciliation runbook](../../operations/phase-0-database-reconciliation.md) for the current migration lineage.

**Date:** 2026-08-17
**Review inputs:** Greybeard codebase audit (Claude) + independent Codex review (local Codex CLI, read-only sandbox)
**Missing input:** Grok / Visionary. The Three AImigos full-council run failed — see [Appendix B](#appendix-b--three-aimigos-failure-record). No alternatives-generation pass was performed.
**Verdict:** 🔴 **No-go for public paid launch today** — not because the code is unfixed, but because *what is actually deployed cannot be proven from the repo.*

---

## 1. Plain-English summary

The engineering is in better shape than the working copy suggests. The dangerous discovery from this review is **not a bug — it is a provenance gap.**

There are three different versions of PostCrisp in play and nobody has proven they match:

1. **The local working tree** — 11 commits behind, still contains the credit-theft hole and the pack-wiping reset bug.
2. **`origin/main`** — already fixes those, via 5 migrations and a security-hardening sprint.
3. **Production** — unknown. Migrations sitting in a repo are *not* applied to a database, and Vercel deploys a specific commit SHA that nobody has checked.

This exact failure has already bitten this project once: in session 19 a protective trigger everyone assumed was live in production **was not there**, leaving every user able to self-promote to admin. That was caught by inspecting the live database directly, not by reading the repo.

So the single highest-priority action is **not writing code — it is verifying production.** Until the live Supabase grants, triggers, and functions are inspected and the deployed Vercel SHA is confirmed, every other assurance in this document is unproven.

**Cost note:** the fixes below reduce a genuinely uncapped AI-spend exposure. None of the recommended work adds meaningful monthly cost; the WAF and budget-ceiling items in Wave 3 *reduce* worst-case spend.

---

## 2. What changed during this review

My initial audit was performed against the checked-out tree and was accurate *for that tree* — but the tree is stale. Codex caught this; it is the most valuable finding of the review.

| # | Finding (as first ranked) | Status on `origin/main` | Verified by |
|---|---|---|---|
| C1 | Any user can write their own `credits_balance` (RLS has no column restriction) | **Fixed** — `20260723120000_prelaunch_security_hardening.sql` revokes table UPDATE, grants only cosmetic columns, restricts `consume_user_credits` EXECUTE to `service_role` | Migration inspected directly |
| C2 | Allowance reset destroys purchased packs advertised as "never expire" | **Fixed** — `20260724150000_purchased_credits_bucket.sql` adds a non-expiring `purchased_credits` bucket (commit `085b190`) | Migration inspected directly |
| H3 | LLM called before credits debited (no reservation) | **Fixed** — reserve-before-generate across AI routes (commit `3963dec`, refined by `597dc88`) | Commit log |
| H4 | Rate limiting fails open without Upstash env | **Mechanism replaced** — Upstash removed in favour of Vercel WAF (commit `7c15c09`). Control now lives *outside* the repo and is unproven | Commit log |
| H5 | Production not reproducible; only 1 migration | **Partially fixed** — 5 migrations now, including the protective trigger. Still not a bootstrappable history; monolithic `supabase-schema.sql` is still the practical baseline; still no verified DB backup | `git ls-tree origin/main` |

**Also corrected:** the stack is **Next.js 15.5.15**, not 14 (`PICKUP.md` is stale). And the dashboard does **not** import `ChannelsSection` — it has its own inline channel row (Codex correction to my read).

### Material issues neither the repo docs nor my audit had caught

These came from Codex and are **not** fixed on `origin/main`:

- **Credit refresh is still not atomic.** `ensureCreditsCurrent` is a read-then-unconditional-update keyed only by user id. Two requests at a cycle boundary can interleave so one debit is overwritten by the other's reset. A pack grant landing between the read and the update can be lost.
- **Month-skip date bug.** `nextResetDate` advances the month *before* setting the day to 1. A reset falling on Jan 29–31 produces **March 1**, skipping February entirely — the user silently gets one allowance for two months. *(Independently confirmed by reasoning through the date math.)*
- **SELECT errors are swallowed and treated as a zero balance.**
- **Webhook idempotency ordering is crash-unsafe.** The event id is inserted *before* fulfillment, so a crash in between marks the event permanently processed and the customer never gets their credits. Conversely a ledger error deliberately fails open, allowing duplicate pack grants on retry.
- **No refund / dispute / chargeback handling at all.** Only checkout-completed, subscription updated/deleted, and payment-failed are handled.
- **"Unlimited" is false advertising.** Paid plans are marketed as Unlimited while actually capped at 500 / 2,000 credits per month (`billing/page.tsx`, `UpgradePrompt.tsx`, `UsageBar.tsx`).
- **Errors are logged, not alerted.** Most catch blocks call `console.error` only. Because the errors are caught and converted to responses, Sentry's `onRequestError` never sees them.
- **No public Terms, Privacy, refund, or cancellation pages.** The project's own alpha-tester agreement flags this as required before paid users. Data export also omits channels, voice profiles, creator profiles, feedback, and credit transactions.

### Where the two reviews disagreed

| Topic | Greybeard (Claude) | Codex | Resolution |
|---|---|---|---|
| Severity of the pack-wiping bug (C2) | **Critical** — money *and* trust; Starter resets **daily**, so a $40 pack can vanish in 24h | **High**, not Critical | Kept as the top *product* risk. Codex ranked on remote-tip state where it is already fixed; Greybeard ranked the live-tree risk. Both hold once you separate "code" from "deployed". |
| Fail-open rate limiting (H4) | **High** | **Medium standalone**, High only combined with C1/H3 | Codex is right on the standalone rating — but it becomes a launch gate again because the replacement (WAF) is unverified. |
| 916-line dashboard component | Medium debt | Not a blocker; real issue is 9 client-side queries, 2 unbounded, errors silently rendered as empty | **Codex is more precise.** Adopted his framing. |

**No Grok input.** The alternatives pass — competing credit architectures, missed abuse/refund/cost paths, cheapest-safe-sequence — was not run.

---

## 3. The plan

Each wave is independently shippable. **Wave 0 gates everything else.**

### Wave 0 — Production parity and containment (do this first, before any code)

Nothing here is a code change. This is proving what is real.

- [ ] **Keep paid checkout disabled** until Wave 0 passes.
- [ ] **Sync the working tree**: `git pull` — you are 11 commits behind and any edit made now risks reverting security fixes.
- [ ] **Identify the deployed Vercel commit SHA** and confirm it contains `085b190` (purchased credits) and `48fcf33` (hardening).
- [ ] **Inspect the live Supabase database directly** — do not infer from the repo:
  - `profiles` UPDATE policy and **column-level grants** for `authenticated`
  - the `protect_privileged_profile_columns` trigger definition, and whether it now covers `credits_balance`
  - `consume_user_credits` function body and ACL; confirm the vulnerable 4-argument overload is **absent**
  - confirm all 5 migrations are actually applied
- [ ] **Prove reserve-before-generate is live** on every AI route, not just captions.
- [ ] **Verify the two Vercel WAF rules actually fire** in production logs (this replaced Upstash).
- [ ] **Attempt the exploit against production as a normal test user**: try to PATCH your own `credits_balance` via the REST API with an anon-key JWT. It must fail. This is the single most valuable 10 minutes in this plan.

**Exit criteria:** every box above verified against live systems, with evidence recorded in `PICKUP.md`.

### Wave 1 — Atomic credit core

- [ ] Move refresh / reserve / settle / refund into **one service-role-only transactional RPC** that locks the profile row, refreshes allowance, reserves, updates both buckets, and writes the ledger atomically.
- [ ] Fix the **month-skip bug** in `nextResetDate` (set day to 1 *before* advancing the month). Add tests for Jan 29/30/31.
- [ ] **Stop swallowing SELECT errors** — fail closed, never treat an error as a zero balance.
- [ ] Handle **tier changes**: subscription events must update allowance and reset state, not just the tier label.
- [ ] **Reconcile purchased balances** from `credit_transactions` — the migration's backfill admits it under-counts existing pack holders. The ledger already exists and has the right shape; use it.
- [ ] **Fix the copy**: replace "Unlimited" with the real allowance and per-action cost everywhere.

### Wave 2 — Durable Stripe lifecycle

- [ ] Replace insert-first idempotency with **explicit processing states** (`processing` / `processed`), a lease, attempt count, `processed_at`, `last_error`.
- [ ] Make **pack fulfillment + idempotency one transaction**.
- [ ] Add a **reconciliation job** for stuck/undelivered events.
- [ ] Implement **refund, dispute, and chargeback** handling — including clawing back credits.
- [ ] Block **duplicate subscriptions** server-side; don't rely on a Stripe Dashboard setting.
- [ ] Exercise paid, failed, canceled, refunded, duplicated, and replayed events in **Stripe test mode** (this is the Task 2 checklist already pending in `PICKUP.md`).

### Wave 3 — Cost and abuse ceilings

- [ ] **Hard budget caps + alerts** on the Anthropic and OpenAI accounts. This is the true backstop against a surprise bill.
- [ ] **Kill switch** to disable AI generation without a deploy.
- [ ] **CAPTCHA on signup** (still open in `ROADMAP.md`).
- [ ] **Consistent input length limits** on all AI routes — only three currently import the shared validator.
- [ ] **Extend cost telemetry** (`generation_ai_calls`) to every AI route; currently wired to three features.

### Wave 4 — Recovery, visibility, and customer protection

- [ ] **Real alerting**: capture exceptions explicitly with event id, user id, task, reservation id, Stripe object id. Alert on webhook 5xx, stuck events, refund failure, failed credit reset, debit/refund imbalance, unusual provider spend.
- [ ] **Bootstrappable schema baseline** + forward migrations + drift check in CI.
- [ ] **Confirm Supabase backup/PITR retention and run a restore drill** into a separate project. `scripts/backup.sh` backs up **git, not the database** — this is currently unverified.
- [ ] **Publish Terms, Privacy, cancellation, and refund policies**, consistent with actual credit behaviour. Get legal review.
- [ ] **Complete data export** — add channels, voice profiles, creator profiles, feedback, credit transactions.

### Wave 5 — Paid canary

- [ ] Enable checkout for **one controlled account**. Run a real low-value subscription **and** a pack purchase.
- [ ] Verify webhook → credit reconciliation end to end.
- [ ] Simulate concurrency, failure, and refund paths.
- [ ] **Wait one full billing cycle and reset boundary**, confirm packs survive, then expand.

---

## 4. UI track — Living Dashboard v1-lite

**Both reviews agree: v1-lite is effectively already shipped.** `src/app/dashboard/page.tsx` implements the typed daily briefing (`buildBriefing` / `TypedBriefing`), credits as hero metric (`CreditMeter`), usage-pattern suggestions (`buildSuggestions`), recent generations, Brand Readiness, and an inline channel row. `ROADMAP.md` listing it as future work is **stale — update it.**

Scope the UI work as **refinement, not a new build.** Runs safely in parallel with Waves 1–2 (no billing files touched).

**Ship now:**
- [ ] Contextual actions on recent-content cards: *Boost this post*, *Create a follow-up*, *Analyze thumbnail*
- [ ] Micro-polish from the mockup: `AnimatedNumber`, `PulsingDot`
- [ ] **Add a real error state** — individual query failures currently render silently as zero/empty, so a broken dashboard looks like an empty one
- [ ] **Bound the two unbounded historical queries**

**Defer (needs social APIs — already v1.5 per the 2026-04-20 decision record):** real follower/engagement/cadence metrics, channel health, published-post performance, trend detection, scheduling.

**Defer (post-launch):** split the 916-line component into view components + pure builders; move initial load server-side or behind a single dashboard-summary RPC. Per Codex — and I agree — file length is not the real cost; **9 client-side queries after hydration** is. Do not delay billing hardening for this refactor.

**Not in scope:** the mockup's `#080c14` mint/midnight palette — that is the separate deferred colour track.

---

## 5. Recommended next steps

1. **Do Wave 0 today.** Especially the live exploit attempt against production — it is 10 minutes and it either clears or condemns the whole launch.
2. **`git pull` before touching anything.**
3. **Delete or relocate the nested `PostCrisp/` directory** — a 1.1 GB duplicate git clone inside the working tree, guaranteed to cause an edit-the-wrong-copy incident.
4. **Decide on Grok.** The alternatives pass never ran; if you want competing credit architectures before committing to Wave 1's RPC design, fix the AImigos config first.
5. **Refresh `PICKUP.md` / `ROADMAP.md`** — they claim Next.js 14 and list a shipped dashboard as pending. Stale trackers caused this review to start from a false baseline.

---

## Appendix A — What could not be verified

Read-only source review cannot confirm: production database state, Vercel WAF rules, Stripe Dashboard settings, AI provider budget caps, deployed commit SHA, Supabase backup retention. **All are Wave 0 gates.**

## Appendix B — Three AImigos failure record

Two full-council runs were attempted against a `full-council` profile (Architect: `anthropic/claude-fable-5`, Auditor: `openai/gpt-5.6-sol`, Visionary: `xai/grok-4.6`).

| Run | Result |
|---|---|
| `9adb33fc` | `malformed-response`, 1/3 invocations — partly an artifact of a 10-minute client-side timeout |
| `b4b7dc20` | `provider-failure`, **0/3** invocations, no verdict |
| `d46e3ec2` (trivial "Say OK." probe) | Architect ✅ **completed**; Auditor ❌ failed; Visionary ❌ failed |

**Diagnosis:** the trivial probe rules out context size and prompt length. Anthropic works; **both non-Anthropic legs fail at the provider-call stage.** `three-aimigos doctor` reports all three "Healthy" because it validates credential/config presence, not an actual completion — this gives false confidence and is worth reporting upstream. `models refresh` returned 45 models but **verified 0**, leaving config pinned to `gpt-5.6-sol` / `grok-4.6` with a stale `"availability": "verified"` flag — the most likely root cause is that those two model IDs no longer resolve.

`--role visionary` fails instantly (exit 2) because the CLI rejects `--role` under a `full-council` profile, so a single-leg re-run requires switching profile via `three-aimigos configure` (interactive).

**Codex's opinion in this document was therefore obtained out-of-band** via the local Codex CLI (`codex exec -s read-only`, v0.147.0), independent of the AImigos runtime.
