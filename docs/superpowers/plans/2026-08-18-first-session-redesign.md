# First-Session Redesign Implementation Plan (rev. 2 — post-council)

> **Historical implementation plan:** Migration filenames and commands below record the pre-Phase-0 implementation and are non-actionable. Use [the Phase 0 database reconciliation runbook](../../operations/phase-0-database-reconciliation.md) for current filenames and operator steps.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace PostCrisp's 8-step onboarding tour with a three-stage first session that hands a brand-new user 3-5 usable artifacts in under three minutes, survives being abandoned and resumed, and rests on a credit lock a user cannot reset.

**Architecture:** Three stages — **Ask** (one screen), **Pack** (one action producing three artifacts in parallel from the existing AI routes), **Own** (save it, then *optionally* personalise). The flow is replaced; the plumbing is reused. Two things make it durable: an append-only redemption ledger replaces the client-deletable row-count that was standing in for a security boundary, and the Pack stage **rehydrates already-generated artifacts from `generations.output_data` instead of regenerating them**, so a resumed session cannot dead-end on spent freebies.

**Tech Stack:** Next.js 14 (App Router), TypeScript strict, Supabase (Postgres + RLS), vitest (node env), Tailwind. Tests use `createFakeSupabase` in `src/lib/__tests__/fake-supabase.ts`.

**Spec:** `docs/superpowers/analysis/2026-08-18-onboarding-audit.md`, as corrected by the Three AImigos council.

**Depends on:** `docs/superpowers/plans/2026-08-18-onboarding-charge-and-bypass-fixes.md` (branch `fix/onboarding-charge-safety`, 13 commits). **This plan assumes those are merged**: `resolveTutorialCharge` exists, `isInActiveTutorial` no longer gates on `step`, and `chooseDestination` routes new users to `/onboarding`.

## Revision history

**Rev. 1 was reviewed by the Three AImigos full council and rejected unanimously** — Auditor `CHANGES_REQUIRED` across all four rounds, Architect "I concur", Visionary "do not build as written". The Ask/Pack/Own skeleton and the replace-flow/reuse-plumbing synthesis survived; the code did not. Rev. 2 fixes:

| Rev. 1 defect | Fix in rev. 2 |
|---|---|
| `PackStage` sent no `tone`; `/api/generate:69` requires it → captions 400 on every request | Ask stage collects tone; Pack sends it (Tasks 5, 6) |
| Hashtags rendered as strings; the route returns `{tag, score, posts, category}` objects → React crash, `[object Object]` on save | Typed `HashtagItem`, rendered and serialised by `.tag` (Tasks 6, 7) |
| One idea flattened to a title string, discarding `hook`/`outline`/`bestTime`/`hashtags` | The single idea renders in full as a filming brief — same 3 credits (Task 6) |
| Resume re-fired all three calls against spent freebies → three 409s and a disabled button | `GET /api/onboarding/pack` rehydrates from `generations.output_data`; Pack generates only what is missing (Tasks 3, 6) |
| "We never persist generated content here" — false; every route persists to `generations.output_data` | Assertion removed; rehydration built on it |
| Per-feature lock counted `generations` rows, which a user deletes from a UI button | New append-only `tutorial_redemptions` ledger (Task 1) |
| Events table with no producers | Event table ships with its authenticated write route in the same task (Task 2) |
| "Tasks 1-3 independently shippable" — two of them shipped nothing usable | Claim withdrawn; see Sequencing |
| `shouldOfferResume(undefined, null)` true for every long-standing user | Scoped to accounts created after the redesign, or with a first-session record (Task 3) |

## Global Constraints

- TypeScript `strict`; `npm run typecheck` must exit 0 with zero errors.
- All tests pass. The dependency branch ends at **137**; this plan only adds.
- `npm run lint` exits 0 with exactly 4 pre-existing warnings (three `react-hooks/exhaustive-deps` in `src/app/admin/*`, one `no-img-element` in `src/components/ui/FeatureGate.tsx`).
- **Never widen a credit bypass.** After Task 1 the boundary is `tutorial_redemptions` — append-only, service-role write, no client grants. It must stay that way.
- **Do not revoke client `DELETE` on `generations`.** Users legitimately delete their own generations from the UI; that feature stays.
- Never introduce a client-trusted value into a charge or security decision.
- Service-role keys must never appear in client code.
- Do not change credit prices or `TIER_ALLOWANCE`.
- **Skip must never destroy value.** Only a genuine finish sets `completed: true`.
- **No paywall in the first session.** `LockedSection` must not appear in any stage.
- **Read a route before asserting its contract.** Rev. 1 asserted three response shapes without reading them and got all three wrong. Every task that calls an endpoint names the file and line its contract came from; if the code disagrees with this plan, the code wins — fix the caller, report the discrepancy, do not change the route.
- `git diff --check` clean (CRLF warnings on Windows are expected and fine).

## Verified endpoint contracts

Read from source on 2026-08-18. These are the contracts Tasks 6 and 7 depend on.

| Endpoint | Request | Success response |
|---|---|---|
| `POST /api/generate` (`route.ts:69`, `:131`) | `{ topic, platform, tone, contentType?, audience?, count?, avoid?, tutorialMode? }` — **`topic`, `platform` and `tone` are all required**, else 400 | `{ captions: string[], platform, tone, contentType, generatedAt }` |
| `GET /api/hashtags` (`route.ts:27-32`, `:66`, `:111`) | query params `q`, `platform`, `count`, `mix`, `tutorial=1` | `{ hashtags: Array<{ tag: string; score: number; posts: string; category: string }>, query, platform, count, mix }` |
| `POST /api/viral-ideas` (`route.ts:90-98`, `:214`) | `{ niche, platforms?, formats?, trendSource?, audience?, count?, tutorialMode? }` — `count` is clamped to a minimum of 5 | `{ ideas: ViralIdea[], generatedAt }` |
| `POST /api/saved` (`route.ts:44`) | `{ type, content, platform, topic }` | saved row |

`ViralIdea` (`viral-ideas/route.ts:14-25`): `{ title, whyViral, format, platform, difficulty, hook, outline: string[], hashtags: string[], bestTime, engagement }`.

Valid tones (`src/lib/constants.ts:130-138`): `casual`, `professional`, `humorous`, `inspirational`, `educational`, `controversial`, `storytelling`.

Every route persists its artifact: `generations` rows carry `{ user_id, feature, platform, input_data, output_data, tokens_used }`, where `output_data` is `{ captions }`, `{ hashtags }` or the ideas payload.

## Decisions this plan implements

- **Replace the flow, reuse the plumbing.** Retire the step components; keep the endpoints, the bypass gate and the preferences record. The council judged this a genuine synthesis, not a fudge.
- **A dashboard resume card, not a middleware gate.** Two of three council members called a hard gate hostile; the redirect-loop-against-snooze objection is concrete.
- **Channel Analysis leaves the first session.** 5 credits, a 30-60s wait, and output that is three `LockedSection` "$19/mo" blocks. A paywall is not a quick win.
- **The strategic artifact is not lost with it.** Rendering the single viral idea in full — hook, 5-point outline, best time, hashtags — is a filming brief, already paid for by the same 3 credits. This was the council's zero-cost answer to "you removed the only strategic output."
- **Channels are optional context, never a gate.**

## Sequencing

Rev. 1 claimed Tasks 1-3 were independently shippable. Withdrawn — a table with no producers and an endpoint with no consumer are deployable, not valuable. The real sequence:

- **Task 1 is a hard prerequisite.** Until the redemption ledger exists, the free-run count is wrong and the giveaway is unbounded.
- **Task 4 is the one genuinely standalone increment** — it stops skip destroying value in the *existing* wizard, so it can ship while the rest is built.
- **Tasks 5-7 are one vertical slice.** Do not ship Ask without Pack.
- **Task 8 depends on 3 and 7.**

## Cost impact

The current tutorial gives away 10 credits per signup (channel-analysis 5, viral-ideas 3, captions 1, hashtags 1). The new pack gives **5** (captions 1, hashtags 1, viral-ideas 3). Dropping Channel Analysis halves the per-signup giveaway and removes the slowest call from the critical path. More importantly, Task 1 makes the cap real: today the "one free run per feature, ever" ceiling is resettable from a UI button, so the true current exposure is unbounded.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260818120000_tutorial_redemptions.sql` (create) | Append-only redemption ledger. The real credit boundary. |
| `src/lib/tutorial-redemptions.ts` (create) | `recordTutorialRedemption` (service-role write). |
| `src/lib/tutorial-bypass.ts` (modify) | `hasUsedTutorialBypass` reads the ledger, not `generations`. |
| `src/app/api/{generate,hashtags,viral-ideas,channel-analysis}/route.ts` (modify) | Record a redemption where each already inserts into `generations`. |
| `supabase/migrations/20260818121000_onboarding_events.sql` (create) | Funnel telemetry table. |
| `src/lib/onboarding-events.ts` (create) | Event-name union + non-throwing logger. |
| `src/app/api/onboarding/event/route.ts` (create) | Authenticated, enum-validated event write. Gives the table producers. |
| `src/lib/first-session-state.ts` (create) | Pure state helpers. No I/O. |
| `src/app/api/onboarding/free-runs/route.ts` (create) | Remaining free runs, from the ledger. |
| `src/app/api/onboarding/pack/route.ts` (create) | Rehydrate already-generated artifacts. The resume fix. |
| `src/app/api/user/preferences/route.ts` (modify) | Accept `snoozed_until`. |
| `src/app/onboarding/page.tsx` (rewrite) | Three-stage container. |
| `src/components/onboarding/AskStage.tsx` (create) | Stage 1, including tone. |
| `src/components/onboarding/PackStage.tsx` (create) | Stage 2, rehydrate-then-generate-the-missing. |
| `src/components/onboarding/OwnStage.tsx` (create) | Stage 3. |
| `src/components/onboarding/TutorialSteps.tsx` (delete) | Retired. |
| `src/components/ResumeFirstSessionCard.tsx` (create) | Dashboard recovery. |
| `src/app/dashboard/page.tsx` (modify) | Resume card; reconcile checklists. |
| `src/components/layout/Sidebar.tsx` (modify) | Relabel "Tutorial" → "Finish setup". |

---

### Task 1: The redemption ledger — make the credit boundary real

`hasUsedTutorialBypass` counts rows in `generations`. `src/app/dashboard/generations/[id]/page.tsx` deletes those rows straight from the browser client behind an ordinary Delete button. So the "one free run per feature, ever" ceiling resets from the UI, with no console. `tutorial_progress.completed` is client-writable through the preferences allowlist too, so the other half of the gate is equally soft.

This task moves the boundary to an append-only ledger the client cannot touch. **It does not revoke client DELETE on `generations`** — that is a real user feature.

**Files:**
- Create: `supabase/migrations/20260818120000_tutorial_redemptions.sql`
- Create: `src/lib/tutorial-redemptions.ts`
- Modify: `src/lib/tutorial-bypass.ts`
- Modify: the four AI routes
- Test: `src/lib/__tests__/tutorial-redemptions.test.ts`

**Interfaces:**
- Produces: `export async function recordTutorialRedemption(userId: string, feature: string, writer?: RedemptionWriter): Promise<void>`. `hasUsedTutorialBypass` keeps its exact signature `(supabase, userId, feature) => Promise<boolean>`; only its data source changes.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260818120000_tutorial_redemptions.sql`:

```sql
-- ============================================================
-- Append-only ledger of consumed onboarding free runs.
--
-- Why: hasUsedTutorialBypass counted rows in `generations` to decide whether a
-- user had already spent a per-feature freebie. Users hold own-row DELETE on
-- that table and the generations detail page exposes a Delete button, so the
-- "one free run per feature, ever" ceiling reset from ordinary UI. Combined
-- with tutorial_progress being client-writable via the preferences allowlist,
-- the giveaway was effectively unbounded.
--
-- This table is the boundary instead: service-role write only, no client
-- grants, RLS enabled with no permissive policy, and UNIQUE(user_id, feature)
-- so a redemption cannot be double-counted or replayed.
--
-- We deliberately do NOT revoke client DELETE on `generations` — deleting your
-- own generations is a real feature and stays.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tutorial_redemptions (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature     TEXT NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tutorial_redemptions_user_feature_key UNIQUE (user_id, feature)
);

CREATE INDEX IF NOT EXISTS tutorial_redemptions_user_idx
  ON public.tutorial_redemptions (user_id);

ALTER TABLE public.tutorial_redemptions ENABLE ROW LEVEL SECURITY;

-- No policy, by design: with RLS on and nothing permissive, client roles can
-- neither read nor write. service_role bypasses RLS.
REVOKE ALL ON public.tutorial_redemptions FROM PUBLIC, anon, authenticated;
GRANT  SELECT, INSERT ON public.tutorial_redemptions TO service_role;
GRANT  USAGE, SELECT ON SEQUENCE public.tutorial_redemptions_id_seq TO service_role;

-- Backfill from history so existing testers do not get their freebies back when
-- the source of truth changes. ON CONFLICT because a user may have several
-- tutorial rows per feature if they previously reset the old counter.
INSERT INTO public.tutorial_redemptions (user_id, feature, redeemed_at)
SELECT DISTINCT ON (user_id, feature) user_id, feature, created_at
  FROM public.generations
 WHERE input_data->>'tutorialMode' = 'true'
 ORDER BY user_id, feature, created_at
ON CONFLICT (user_id, feature) DO NOTHING;
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/__tests__/tutorial-redemptions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { recordTutorialRedemption } from '@/lib/tutorial-redemptions'

function fakeWriter(calls: unknown[], opts: { throwOnInsert?: boolean } = {}) {
  return {
    from(table: string) {
      return {
        upsert(row: unknown, options: unknown) {
          if (opts.throwOnInsert) throw new Error('simulated write failure')
          calls.push({ table, row, options })
          return Promise.resolve({ error: null })
        },
      }
    },
  }
}

describe('recordTutorialRedemption', () => {
  it('writes the redemption to tutorial_redemptions for the user and feature', async () => {
    const calls: unknown[] = []
    await recordTutorialRedemption('user-1', 'captions', fakeWriter(calls) as never)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      table: 'tutorial_redemptions',
      row: { user_id: 'user-1', feature: 'captions' },
    })
  })

  it('is idempotent — a replayed redemption must not error or double-count', async () => {
    // UNIQUE(user_id, feature) means the second write conflicts. The helper
    // must ignore the conflict rather than surface it, because a route may
    // legitimately retry after a partial failure.
    const calls: unknown[] = []
    await recordTutorialRedemption('user-1', 'captions', fakeWriter(calls) as never)
    await recordTutorialRedemption('user-1', 'captions', fakeWriter(calls) as never)
    expect(calls).toHaveLength(2)
    expect((calls[1] as { options: unknown }).options).toMatchObject({ onConflict: 'user_id,feature' })
  })

  it('NEVER throws when the write fails — a ledger error must not fail a generation the user already received', async () => {
    const calls: unknown[] = []
    await expect(
      recordTutorialRedemption('user-1', 'hashtags', fakeWriter(calls, { throwOnInsert: true }) as never),
    ).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/tutorial-redemptions.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/tutorial-redemptions"`.

- [ ] **Step 4: Write the helper**

Create `src/lib/tutorial-redemptions.ts`:

```typescript
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * Records that a user has consumed one of their onboarding free runs.
 *
 * SERVER ONLY — writes with the service-role key, because tutorial_redemptions
 * has RLS enabled with no permissive policy. Never import into a client
 * component.
 *
 * Two rules:
 *  1. Idempotent. UNIQUE(user_id, feature) plus onConflict-ignore, so a retry
 *     after a partial failure cannot double-count or error.
 *  2. Never throws. The user has already received the generation by the time
 *     this runs; failing the response over a ledger write would be worse than
 *     the (bounded, one-per-feature) risk of missing one.
 */

type RedemptionWriter = {
  from(table: string): { upsert(row: unknown, options: unknown): unknown }
}

function serviceWriter(): RedemptionWriter {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  ) as unknown as RedemptionWriter
}

export async function recordTutorialRedemption(
  userId: string,
  feature: string,
  writer?: RedemptionWriter,
): Promise<void> {
  try {
    const client = writer ?? serviceWriter()
    await client
      .from('tutorial_redemptions')
      .upsert({ user_id: userId, feature }, { onConflict: 'user_id,feature', ignoreDuplicates: true })
  } catch (err) {
    console.error('[tutorial-redemptions] failed to record redemption', { userId, feature, err })
  }
}
```

- [ ] **Step 5: Point `hasUsedTutorialBypass` at the ledger**

In `src/lib/tutorial-bypass.ts`, replace the body of `hasUsedTutorialBypass` — the `generations` count query — with a ledger read, and update its doc comment. Keep the signature exactly as it is:

```typescript
  const { count } = await supabase
    .from('tutorial_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('feature', feature)

  return (count ?? 0) > 0
```

Update the doc comment: it currently says detection reads the `generations` table. Replace that paragraph with an explanation that the ledger is append-only and service-role-only *because* `generations` is client-deletable, and that this is what makes the per-feature cap real.

**Note the read still goes through the caller's `supabase` client.** `tutorial_redemptions` has no client grants, so an authenticated client would read `count: null` → `false` → freebie always granted. Verify which client reaches this function: `resolveTutorialCharge` builds a *server* client via `createClient()` from `@/utils/supabase/server`, which uses the anon key with the user's session — **that is not service-role and will not see the table.** You must therefore either (a) give this function its own service-role reader like `recordTutorialRedemption` has, or (b) add a `SELECT` policy scoped to `auth.uid() = user_id`. **Choose (a)** — a read-only client grant is a smaller surface than a policy, and keeps "no client grants" true. Report which you did and why.

- [ ] **Step 6: Record redemptions in the four routes**

In each of `generate`, `hashtags`, `viral-ideas` and `channel-analysis`, find the existing `generations` insert and add a redemption write immediately after it, guarded by the bypass flag. Import `recordTutorialRedemption` from `@/lib/tutorial-redemptions`. The feature keys are the same ones already passed to `resolveTutorialCharge` — `captions`, `hashtags`, `viral_ideas`, `channel_analysis`:

```typescript
    if (tutorialResult.bypassCredits) {
      await recordTutorialRedemption(auth.userId, 'captions')
    }
```

Use each route's own feature key. Do not reconcile the underscore/hyphen vocabularies — that trap is documented in the dependency plan.

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npm test`
Expected: typecheck 0; 140 tests pass (137 + 3).

- [ ] **Step 8: Report the migration as unapplied**

Both migrations in this plan are **written, not applied**. This repository has a documented history of migrations existing in the repo but not in the database. Applying to production is a human step; do not attempt it. Say so explicitly in your report.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260818120000_tutorial_redemptions.sql src/lib/tutorial-redemptions.ts src/lib/__tests__/tutorial-redemptions.test.ts src/lib/tutorial-bypass.ts src/app/api/generate/route.ts src/app/api/hashtags/route.ts src/app/api/viral-ideas/route.ts src/app/api/channel-analysis/route.ts
git commit -m "feat(credits): append-only tutorial redemption ledger replaces the client-resettable lock

hasUsedTutorialBypass counted generations rows, and users delete their own
generations from a UI button — so the per-feature lifetime cap reset without a
console. The ledger is service-role-only with UNIQUE(user_id, feature), and
client DELETE on generations is deliberately left alone."
```

---

### Task 2: Funnel telemetry, with producers

Rev. 1 shipped an events table nothing wrote to. This task ships the table, the logger and the authenticated write route together, so it produces data on day one.

**Files:**
- Create: `supabase/migrations/20260818121000_onboarding_events.sql`
- Create: `src/lib/onboarding-events.ts`
- Create: `src/app/api/onboarding/event/route.ts`
- Test: `src/lib/__tests__/onboarding-events.test.ts`

**Interfaces:**
- Produces: `ONBOARDING_EVENT_NAMES`, `OnboardingEventName`, `logOnboardingEvent(userId, name, detail?, writer?)`, and `POST /api/onboarding/event` accepting `{ name, detail? }`. Tasks 6-8 call the route.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260818121000_onboarding_events.sql`:

```sql
-- ============================================================
-- Onboarding funnel telemetry.
--
-- Why: tutorial_progress.stage records only where a user currently IS. It
-- cannot say where they dropped, how long the first artifact took, or which
-- artifact failed — the questions this redesign has to be measured against.
--
-- Service-role write, no client grants, RLS on with no permissive policy.
-- Rows arrive through POST /api/onboarding/event, which authenticates the
-- caller and validates the name against a fixed enum.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.onboarding_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS onboarding_events_user_created_idx
  ON public.onboarding_events (user_id, created_at);
CREATE INDEX IF NOT EXISTS onboarding_events_name_created_idx
  ON public.onboarding_events (name, created_at);

ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.onboarding_events FROM PUBLIC, anon, authenticated;
GRANT  SELECT, INSERT ON public.onboarding_events TO service_role;
GRANT  USAGE, SELECT ON SEQUENCE public.onboarding_events_id_seq TO service_role;
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/__tests__/onboarding-events.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { logOnboardingEvent, ONBOARDING_EVENT_NAMES, isOnboardingEventName } from '@/lib/onboarding-events'

function fakeWriter(calls: unknown[], opts: { throwOnInsert?: boolean } = {}) {
  return {
    from(table: string) {
      return {
        insert(row: unknown) {
          if (opts.throwOnInsert) throw new Error('simulated write failure')
          calls.push({ table, row })
          return Promise.resolve({ error: null })
        },
      }
    },
  }
}

describe('logOnboardingEvent', () => {
  it('writes user, name and detail to onboarding_events', async () => {
    const calls: unknown[] = []
    await logOnboardingEvent('user-1', 'stage_viewed', { stage: 'ask' }, fakeWriter(calls) as never)
    expect(calls[0]).toMatchObject({
      table: 'onboarding_events',
      row: { user_id: 'user-1', name: 'stage_viewed', detail: { stage: 'ask' } },
    })
  })

  it('defaults detail to an empty object', async () => {
    const calls: unknown[] = []
    await logOnboardingEvent('user-1', 'first_session_completed', undefined, fakeWriter(calls) as never)
    expect(calls[0]).toMatchObject({ row: { detail: {} } })
  })

  it('NEVER throws when the write fails — telemetry must not break the flow', async () => {
    const calls: unknown[] = []
    await expect(
      logOnboardingEvent('user-1', 'pack_requested', {}, fakeWriter(calls, { throwOnInsert: true }) as never),
    ).resolves.toBeUndefined()
  })
})

describe('isOnboardingEventName', () => {
  it('accepts every name in the union', () => {
    for (const name of ONBOARDING_EVENT_NAMES) {
      expect(isOnboardingEventName(name)).toBe(true)
    }
  })

  it('rejects an arbitrary string — this is the route\'s validation', () => {
    expect(isOnboardingEventName('anything_a_client_invents')).toBe(false)
  })

  it('rejects non-strings', () => {
    expect(isOnboardingEventName(42)).toBe(false)
    expect(isOnboardingEventName(null)).toBe(false)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/onboarding-events.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the logger**

Create `src/lib/onboarding-events.ts`:

```typescript
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * Onboarding funnel telemetry.
 *
 * SERVER ONLY — writes with the service-role key. Client stages reach it
 * through POST /api/onboarding/event, which authenticates the caller and
 * validates the name against the union below. That validation is why an
 * authenticated user cannot fill the table with arbitrary names.
 *
 * Never throws: a telemetry failure must not abort a stage transition or
 * surface an error to someone in the middle of their first session.
 */

export const ONBOARDING_EVENT_NAMES = [
  'first_session_started',
  'stage_viewed',
  'pack_requested',
  'pack_rehydrated',
  'artifact_returned',
  'artifact_failed',
  'artifact_saved',
  'first_session_snoozed',
  'first_session_resumed',
  'first_session_completed',
] as const

export type OnboardingEventName = (typeof ONBOARDING_EVENT_NAMES)[number]

export function isOnboardingEventName(value: unknown): value is OnboardingEventName {
  return typeof value === 'string' && (ONBOARDING_EVENT_NAMES as readonly string[]).includes(value)
}

type EventWriter = {
  from(table: string): { insert(row: unknown): unknown }
}

function serviceWriter(): EventWriter {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  ) as unknown as EventWriter
}

export async function logOnboardingEvent(
  userId: string,
  name: OnboardingEventName,
  detail: Record<string, unknown> = {},
  writer?: EventWriter,
): Promise<void> {
  try {
    const client = writer ?? serviceWriter()
    await client.from('onboarding_events').insert({ user_id: userId, name, detail })
  } catch (err) {
    console.error('[onboarding-events] failed to log event', { name, err })
  }
}
```

- [ ] **Step 5: Add the authenticated write route**

Create `src/app/api/onboarding/event/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { isOnboardingEventName, logOnboardingEvent } from '@/lib/onboarding-events'

/**
 * The client stages' only way into onboarding_events.
 *
 * Three things bound what an authenticated caller can do here: the name must be
 * a member of the fixed union, the user_id comes from the session rather than
 * the body, and detail is size-capped. Worst case is a bounded volume of
 * well-formed rows from a real account — acceptable for a table only admins read.
 */

const MAX_DETAIL_BYTES = 2_000

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { name, detail } = (body ?? {}) as { name?: unknown; detail?: unknown }

  if (!isOnboardingEventName(name)) {
    return NextResponse.json({ error: 'Unknown event name' }, { status: 400 })
  }

  const safeDetail =
    detail && typeof detail === 'object' && !Array.isArray(detail)
      ? (detail as Record<string, unknown>)
      : {}

  if (JSON.stringify(safeDetail).length > MAX_DETAIL_BYTES) {
    return NextResponse.json({ error: 'Detail too large' }, { status: 400 })
  }

  // user.id, never a client-supplied id.
  await logOnboardingEvent(user.id, name, safeDetail)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npm test`
Expected: typecheck 0; 146 tests pass (140 + 6).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260818121000_onboarding_events.sql src/lib/onboarding-events.ts src/lib/__tests__/onboarding-events.test.ts src/app/api/onboarding/event/route.ts
git commit -m "feat(onboarding): funnel telemetry table, logger and authenticated write route

Ships with its producer rather than as an inert table: the route authenticates
the caller, takes user_id from the session, validates the name against a fixed
union and caps detail size."
```

---

### Task 3: State helpers, free-runs, and the rehydration endpoint

Three decisions need one source of truth each: should we offer to resume, how many free runs remain, and what has this user already generated. The third is the fix for rev. 1's dead-end resume.

**Files:**
- Create: `src/lib/first-session-state.ts`
- Test: `src/lib/__tests__/first-session-state.test.ts`
- Create: `src/app/api/onboarding/free-runs/route.ts`
- Create: `src/app/api/onboarding/pack/route.ts`

**Interfaces:**
- Produces: `FirstSessionStage`, `FirstSessionProgress`, `isSnoozed`, `shouldOfferResume`, `snoozeUntil`, `SNOOZE_DAYS`, `FIRST_SESSION_STAGES`; `GET /api/onboarding/free-runs` → `{ remaining, total }`; `GET /api/onboarding/pack` → `{ captions, hashtags, idea }` from prior generations.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/first-session-state.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  isSnoozed,
  shouldOfferResume,
  snoozeUntil,
  SNOOZE_DAYS,
  FIRST_SESSION_STAGES,
} from '@/lib/first-session-state'

const NOW = new Date('2026-08-18T12:00:00.000Z')
const AFTER_LAUNCH = '2026-08-18T09:00:00.000Z'
const BEFORE_LAUNCH = '2026-05-01T09:00:00.000Z'

describe('isSnoozed', () => {
  it('is false with no progress record', () => {
    expect(isSnoozed(undefined, NOW)).toBe(false)
  })

  it('is false when no snooze was set', () => {
    expect(isSnoozed({ stage: 'ask' }, NOW)).toBe(false)
  })

  it('is true while the snooze is in the future', () => {
    expect(isSnoozed({ snoozed_until: '2026-08-25T12:00:00.000Z' }, NOW)).toBe(true)
  })

  it('is false once the snooze has elapsed', () => {
    expect(isSnoozed({ snoozed_until: '2026-08-11T12:00:00.000Z' }, NOW)).toBe(false)
  })

  it('is false for an unparseable value — fail open rather than hide the offer forever', () => {
    expect(isSnoozed({ snoozed_until: 'not-a-date' }, NOW)).toBe(false)
  })
})

describe('shouldOfferResume', () => {
  it('offers to someone who started and abandoned', () => {
    expect(shouldOfferResume({ stage: 'pack', completed: false }, null, BEFORE_LAUNCH, NOW)).toBe(true)
  })

  it('offers to a new account with no record at all', () => {
    expect(shouldOfferResume(undefined, null, AFTER_LAUNCH, NOW)).toBe(true)
  })

  it('does NOT offer to a long-standing account that never had a first session', () => {
    // Rev.1 regression: shouldOfferResume(undefined, null) was true for every
    // pre-existing user, so accounts months old would suddenly be told to
    // "finish" a session that did not exist when they signed up.
    expect(shouldOfferResume(undefined, null, BEFORE_LAUNCH, NOW)).toBe(false)
  })

  it('does NOT offer once completed', () => {
    expect(shouldOfferResume({ stage: 'own', completed: true }, null, AFTER_LAUNCH, NOW)).toBe(false)
  })

  it('does NOT offer to a pre-tutorial tester who already has onboarded_at', () => {
    expect(shouldOfferResume(undefined, '2026-04-19T00:00:00.000Z', AFTER_LAUNCH, NOW)).toBe(false)
  })

  it('does NOT offer while snoozed — skip means later, and later means quiet', () => {
    expect(
      shouldOfferResume({ stage: 'ask', snoozed_until: '2026-08-25T12:00:00.000Z' }, null, AFTER_LAUNCH, NOW),
    ).toBe(false)
  })

  it('offers again once the snooze elapses', () => {
    expect(
      shouldOfferResume({ stage: 'ask', snoozed_until: '2026-08-11T12:00:00.000Z' }, null, AFTER_LAUNCH, NOW),
    ).toBe(true)
  })

  it('completed wins over an un-elapsed snooze', () => {
    expect(
      shouldOfferResume(
        { stage: 'own', completed: true, snoozed_until: '2026-08-25T12:00:00.000Z' },
        null,
        AFTER_LAUNCH,
        NOW,
      ),
    ).toBe(false)
  })
})

describe('snoozeUntil', () => {
  it('returns an ISO timestamp SNOOZE_DAYS ahead', () => {
    expect(snoozeUntil(NOW)).toBe('2026-08-25T12:00:00.000Z')
    expect(SNOOZE_DAYS).toBe(7)
  })

  it('produces a value isSnoozed agrees is active', () => {
    expect(isSnoozed({ snoozed_until: snoozeUntil(NOW) }, NOW)).toBe(true)
  })
})

describe('FIRST_SESSION_STAGES', () => {
  it('is exactly the three stages, in order', () => {
    expect(FIRST_SESSION_STAGES).toEqual(['ask', 'pack', 'own'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/first-session-state.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the helpers**

Create `src/lib/first-session-state.ts`:

```typescript
/**
 * Pure decisions about a user's first session.
 *
 * Three surfaces have to agree on these — the onboarding page, the dashboard
 * resume card and the preferences writer. Divergence between them is exactly
 * how the previous wizard ended up with a resume path nobody could reach.
 *
 * No I/O: every input is passed in, including `now`, so the logic is
 * deterministic and testable.
 */

export type FirstSessionStage = 'ask' | 'pack' | 'own'

export const FIRST_SESSION_STAGES: readonly FirstSessionStage[] = ['ask', 'pack', 'own'] as const

export const SNOOZE_DAYS = 7

/**
 * Accounts created before this did not have a first session to abandon, so we
 * never nag them about finishing one. Set to the redesign's ship date.
 */
export const FIRST_SESSION_LAUNCHED_AT = '2026-08-18T00:00:00.000Z'

/**
 * Persisted under preferences.tutorial_progress — the SAME key the old wizard
 * used, deliberately, because isInActiveTutorial, the sidebar link and the
 * dashboard all read `completed` from it.
 */
export interface FirstSessionProgress {
  stage?: FirstSessionStage
  completed?: boolean
  snoozed_until?: string | null
  niche?: string | null
  platform?: string | null
  tone?: string | null
  pack_saved?: boolean
}

export function isSnoozed(progress: FirstSessionProgress | undefined, now: Date): boolean {
  const raw = progress?.snoozed_until
  if (!raw) return false
  const until = new Date(raw).getTime()
  // Fail open on a corrupt value: hiding the offer forever is worse than
  // showing it a little early.
  if (Number.isNaN(until)) return false
  return until > now.getTime()
}

export function shouldOfferResume(
  progress: FirstSessionProgress | undefined,
  onboardedAt: string | null,
  accountCreatedAt: string,
  now: Date,
): boolean {
  // Finished the new session — nothing to resume.
  if (progress?.completed) return false
  // Finished the OLD wizard before this redesign existed. Leave them alone.
  if (onboardedAt != null) return false
  // Skip means later. Stay quiet until later arrives.
  if (isSnoozed(progress, now)) return false
  // Someone who has a first-session record is mid-session regardless of age.
  if (progress?.stage) return true
  // No record at all: only nag accounts that were offered a first session.
  const created = new Date(accountCreatedAt).getTime()
  const launched = new Date(FIRST_SESSION_LAUNCHED_AT).getTime()
  if (Number.isNaN(created)) return false
  return created >= launched
}

export function snoozeUntil(now: Date): string {
  return new Date(now.getTime() + SNOOZE_DAYS * 24 * 60 * 60 * 1000).toISOString()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/first-session-state.test.ts`
Expected: PASS — 18 tests.

- [ ] **Step 5: Add the free-runs endpoint**

Create `src/app/api/onboarding/free-runs/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { hasUsedTutorialBypass } from '@/lib/tutorial-bypass'

/**
 * How many of the first session's free runs remain.
 *
 * Reads the same server-authoritative source the routes enforce (the redemption
 * ledger, via hasUsedTutorialBypass) rather than counting anything client-side.
 *
 * Copy note for callers: these are session-only coupons, one per feature, not a
 * credit balance. Do not render them as "credits in your account".
 */

const PACK_FEATURES = ['captions', 'hashtags', 'viral_ideas'] as const

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const used = await Promise.all(
    PACK_FEATURES.map((feature) => hasUsedTutorialBypass(supabase, user.id, feature)),
  )

  return NextResponse.json({ remaining: used.filter((u) => !u).length, total: PACK_FEATURES.length })
}
```

- [ ] **Step 6: Add the rehydration endpoint — this is the resume fix**

Create `src/app/api/onboarding/pack/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * Returns whatever the user has ALREADY generated during their first session.
 *
 * Why this exists: resolveTutorialCharge returns 409 for a spent freebie. A
 * resumed session that simply re-fired all three calls would receive three
 * 409s and a dead screen. Every route already persists its artifact to
 * generations.output_data, so resume rehydrates from there and only generates
 * what is genuinely missing.
 *
 * Reads only the caller's own rows — `generations` has an own-row SELECT policy,
 * so the user's session client is the right client here.
 */

type HashtagItem = { tag: string; score: number; posts: string; category: string }

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: rows } = await supabase
    .from('generations')
    .select('feature, output_data, created_at')
    .eq('user_id', user.id)
    .eq('input_data->>tutorialMode', 'true')
    .in('feature', ['captions', 'hashtags', 'viral_ideas'])
    .order('created_at', { ascending: false })

  const latest = new Map<string, Record<string, unknown>>()
  for (const row of rows ?? []) {
    const r = row as { feature: string; output_data: Record<string, unknown> }
    if (!latest.has(r.feature)) latest.set(r.feature, r.output_data ?? {})
  }

  const captionsOut = latest.get('captions')
  const hashtagsOut = latest.get('hashtags')
  const ideasOut = latest.get('viral_ideas')

  const captions = Array.isArray(captionsOut?.captions) ? (captionsOut!.captions as string[]) : []
  const hashtags = Array.isArray(hashtagsOut?.hashtags) ? (hashtagsOut!.hashtags as HashtagItem[]) : []
  const ideasArray = Array.isArray(ideasOut?.ideas) ? (ideasOut!.ideas as unknown[]) : []
  const idea = ideasArray.length ? ideasArray[0] : null

  return NextResponse.json({ captions, hashtags, idea })
}
```

**Before committing, confirm the `input_data->>tutorialMode` filter syntax works against this Supabase client version** — the dependency branch's `hasUsedTutorialBypass` used the same form, so it should, but verify rather than assume. Also confirm `viral_ideas` output_data is stored under an `ideas` key by reading `src/app/api/viral-ideas/route.ts`'s insert; if it differs, match the code and report it.

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npm test`
Expected: typecheck 0; 164 tests pass (146 + 18).

- [ ] **Step 8: Commit**

```bash
git add src/lib/first-session-state.ts src/lib/__tests__/first-session-state.test.ts src/app/api/onboarding/free-runs/route.ts src/app/api/onboarding/pack/route.ts
git commit -m "feat(onboarding): state helpers, free-runs count, and pack rehydration

The rehydration endpoint is the fix for a dead-end resume: re-firing the three
generation calls against spent freebies would return three 409s. Every route
already persists to generations.output_data, so resume reads from there and
generates only what is missing. shouldOfferResume is scoped to accounts created
after launch, so long-standing users are not nagged about a session they were
never offered."
```

---

### Task 4: Skip means later, not never

`finish(skipped = true)` writes `completed: true` (`src/app/onboarding/page.tsx:151`), which `isInActiveTutorial` treats as a permanent stop — so "Skip all" on the welcome screen forfeits every free run and hides the sidebar link back, which keys on the same flag.

**This applies to the existing wizard and is the one genuinely standalone increment in this plan.** It can ship while Tasks 5-8 are built.

**Files:**
- Modify: `src/app/api/user/preferences/route.ts`
- Modify: `src/app/onboarding/page.tsx`

- [ ] **Step 1: Check the allowlist**

Read `src/app/api/user/preferences/route.ts`. `tutorial_progress` is an allowed top-level key and the route stores the object wholesale, so a new inner field needs no change. **Verify by reading the handler rather than assuming** — if it validates the inner shape, add `snoozed_until`. Report which case you found.

- [ ] **Step 2: Split finish from skip**

Add to the imports of `src/app/onboarding/page.tsx`:

```typescript
import { snoozeUntil } from '@/lib/first-session-state'
```

Replace the body of `finish`:

```typescript
  const finish = async (skipped = false) => {
    setFinishing(true)
    try {
      // Skip means LATER, not never. completed:true was a permanent stop for
      // isInActiveTutorial, so skipping destroyed the remaining free runs and
      // hid the sidebar link back, which keys on the same flag.
      const base = {
        analysis_id: tutorialCtx.analysisId,
        caption_topic: tutorialCtx.captionTopic || null,
        niche: tutorialCtx.niche || null,
        selected_channel_id: tutorialCtx.selectedChannel?.id ?? null,
        has_saved_item: !!tutorialCtx.hasSavedItem,
      }

      const progress = skipped
        ? { ...base, step, completed: false, snoozed_until: snoozeUntil(new Date()) }
        : { ...base, step: 'save' as const, completed: true, snoozed_until: null }

      await apiFetch('/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify(
          skipped
            ? { tutorial_progress: progress }
            : { onboarded_at: new Date().toISOString(), tutorial_progress: progress },
        ),
      })
    } catch (err) {
      if (!skipped && err instanceof ApiError) addToast(err.message, 'error')
    } finally {
      router.replace('/dashboard')
    }
  }
```

`onboarded_at` is now written **only on a genuine finish**. Previously the skip path set it too, which made `showNextTools` true for skippers and hid the recovery path from exactly the people who needed it.

- [ ] **Step 3: Relabel the button to match the behaviour**

```tsx
        <button
          onClick={() => finish(true)}
          disabled={finishing}
          title="We'll keep your free runs and remind you on the dashboard."
          className="text-xs sm:text-sm text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
        >
          Finish later
        </button>
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm test && npm run lint`
Expected: typecheck 0; 164 tests pass; lint at exactly the 4 known warnings.

- [ ] **Step 5: Manually verify the value is preserved**

No unit test covers this — it spans client, API and database.

Run `npm run dev`, sign in as a user with no tutorial record, open `/onboarding`, click **Finish later** on the welcome screen, then:

```sql
select preferences->'tutorial_progress', preferences ? 'onboarded_at' from profiles where id = '<user-id>';
```

Expected: `completed` false, `snoozed_until` ~7 days out, `onboarded_at` absent. Then confirm the sidebar still shows the link back, because it keys on `completed !== true`.

If you cannot run a browser or reach the database, say so plainly rather than claiming the check passed.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/user/preferences/route.ts src/app/onboarding/page.tsx
git commit -m "fix(onboarding): skip snoozes instead of destroying the free runs

finish(skipped) wrote completed:true, a permanent stop for isInActiveTutorial —
so 'Skip all' forfeited every free run and hid the sidebar link back, which keys
on the same flag. Skip now records a 7-day snooze; onboarded_at is written only
on a genuine finish."
```

---

### Task 5: Stage 1 — Ask

One screen. The current wizard spends two screens on prose and channel data entry before producing anything.

**Note it collects `tone`.** `/api/generate:69` rejects a request without it, and rev. 1 of this plan omitted it — which would have 400'd the headline artifact on every request.

**Files:**
- Create: `src/components/onboarding/AskStage.tsx`

**Interfaces:**
- Produces:
  ```typescript
  export interface AskResult { niche: string; platform: string; tone: string; handle: string | null }
  export function AskStage(props: { initialNiche?: string; initialPlatform?: string; initialTone?: string; onContinue: (r: AskResult) => void; onLater: () => void }): JSX.Element
  ```

- [ ] **Step 1: Create the component**

Create `src/components/onboarding/AskStage.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { PLATFORMS, TONES } from '@/lib/constants'

/**
 * Stage 1: one screen.
 *
 * The old wizard asked for channels first and hard-blocked on
 * `disabled={channels.length === 0}`. Captions do not need a connected channel,
 * so the handle here is optional context, never a gate.
 *
 * Tone is required because /api/generate rejects a request without it
 * (generate/route.ts:69). It defaults to 'casual' so the user can move on
 * without deciding.
 */

export interface AskResult {
  niche: string
  platform: string
  tone: string
  handle: string | null
}

export function AskStage({
  initialNiche = '',
  initialPlatform = 'instagram',
  initialTone = 'casual',
  onContinue,
  onLater,
}: {
  initialNiche?: string
  initialPlatform?: string
  initialTone?: string
  onContinue: (result: AskResult) => void
  onLater: () => void
}) {
  const [niche, setNiche] = useState(initialNiche)
  const [platform, setPlatform] = useState(initialPlatform)
  const [tone, setTone] = useState(initialTone)
  const [handle, setHandle] = useState('')

  const canContinue = niche.trim().length > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-zinc-100">
          What do you make content about?
        </h1>
        <p className="text-zinc-400 mt-3 text-base leading-relaxed max-w-xl">
          One line is enough. We&apos;ll turn it into captions, hashtags and something to film this
          week — about thirty seconds from now, on us.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="niche" className="block text-sm font-semibold text-zinc-300 mb-1.5">
            Your niche
          </label>
          <input
            id="niche"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="e.g. food creators in Las Vegas, AI tooling for solopreneurs"
            className="w-full rounded-xl border border-brand-500/20 bg-surface-secondary px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-brand-500/50"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="platform" className="block text-sm font-semibold text-zinc-300 mb-1.5">
              Where you post most
            </label>
            <select
              id="platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full rounded-xl border border-brand-500/20 bg-surface-secondary px-4 py-3 text-zinc-100 focus:outline-none focus:border-brand-500/50"
            >
              {PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="tone" className="block text-sm font-semibold text-zinc-300 mb-1.5">
              How it should sound
            </label>
            <select
              id="tone"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full rounded-xl border border-brand-500/20 bg-surface-secondary px-4 py-3 text-zinc-100 focus:outline-none focus:border-brand-500/50"
            >
              {TONES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="handle" className="block text-sm font-semibold text-zinc-300 mb-1.5">
            Your handle <span className="font-normal text-zinc-500">— optional</span>
          </label>
          <input
            id="handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@yourhandle"
            className="w-full rounded-xl border border-brand-500/20 bg-surface-secondary px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-brand-500/50"
          />
          <p className="text-xs text-zinc-500 mt-1.5">
            Skip it — you can connect channels later and everything still works.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button onClick={onLater} className="text-sm text-zinc-500 hover:text-zinc-300">
          Finish later
        </button>
        <Button
          onClick={() =>
            onContinue({ niche: niche.trim(), platform, tone, handle: handle.trim() || null })
          }
          size="lg"
          disabled={!canContinue}
        >
          Make my first pack →
        </Button>
      </div>
    </div>
  )
}
```

**Confirm `PLATFORMS` and `TONES` export shapes** by reading `src/lib/constants.ts` before committing — `TONES` items are `{ id, label, icon }` as of this writing; if `PLATFORMS` differs (e.g. uses `value` rather than `id`), match the code and report it.

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run lint`
Expected: typecheck 0; lint at exactly the 4 known warnings. Every input has a matching `htmlFor`/`id` pair.

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/AskStage.tsx
git commit -m "feat(onboarding): add Ask stage — one screen, tone included, channels optional

Tone is collected because /api/generate rejects a request without it. Replaces
the old wizard's two value-free opening screens and its hard channel gate."
```

---

### Task 6: Stage 2 — the creator pack

The task that decides whether the redesign works. Rehydrate first, then generate only what is missing, then render each artifact as it lands.

**Files:**
- Create: `src/components/onboarding/PackStage.tsx`

**Interfaces:**
- Consumes: `AskResult` (Task 5), `GET /api/onboarding/pack` (Task 3).
- Produces:
  ```typescript
  export interface HashtagItem { tag: string; score: number; posts: string; category: string }
  export interface PackIdea { title: string; hook: string; outline: string[]; hashtags: string[]; bestTime: string; whyViral?: string }
  export interface CreatorPack { captions: string[]; hashtags: HashtagItem[]; idea: PackIdea | null }
  export function PackStage(props: { ask: AskResult; onDone: (pack: CreatorPack) => void; onLater: () => void }): JSX.Element
  ```

- [ ] **Step 1: Create the component**

Create `src/components/onboarding/PackStage.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { AskResult } from './AskStage'

/**
 * Stage 2: the creator pack.
 *
 * Design constraints, each earned by a defect in an earlier revision:
 *
 *  - REHYDRATE BEFORE GENERATING. Free runs are one-per-feature for the life of
 *    the account. A resumed session that re-fired all three calls would get
 *    three 409s and a dead screen. /api/onboarding/pack returns whatever the
 *    routes already persisted to generations.output_data; we generate only the
 *    gaps.
 *  - Three artifacts in PARALLEL, each rendered the moment it lands. The old
 *    flow ran four tools serially with two 30-60s waits.
 *  - Per-artifact failure. One endpoint erroring must not cost the other two.
 *  - The idea renders IN FULL — hook, outline, best time. That is a filming
 *    brief, already paid for by the same 3 credits, and it is what replaces
 *    Channel Analysis as the session's strategic artifact.
 *  - No paywall. Nothing here renders LockedSection.
 *
 * Endpoint contracts verified against source (see the plan's contract table):
 * captions POST needs topic+platform+tone and returns { captions: string[] };
 * hashtags is a GET whose tutorial flag is a QUERY param and which returns
 * OBJECTS; viral-ideas returns { ideas: ViralIdea[] } and clamps count to >= 5.
 */

export interface HashtagItem {
  tag: string
  score: number
  posts: string
  category: string
}

export interface PackIdea {
  title: string
  hook: string
  outline: string[]
  hashtags: string[]
  bestTime: string
  whyViral?: string
}

export interface CreatorPack {
  captions: string[]
  hashtags: HashtagItem[]
  idea: PackIdea | null
}

type ArtifactState = 'idle' | 'loading' | 'done' | 'failed'

export function PackStage({
  ask,
  onDone,
  onLater,
}: {
  ask: AskResult
  onDone: (pack: CreatorPack) => void
  onLater: () => void
}) {
  const [captions, setCaptions] = useState<string[]>([])
  const [hashtags, setHashtags] = useState<HashtagItem[]>([])
  const [idea, setIdea] = useState<PackIdea | null>(null)

  const [captionsState, setCaptionsState] = useState<ArtifactState>('loading')
  const [hashtagsState, setHashtagsState] = useState<ArtifactState>('loading')
  const [ideaState, setIdeaState] = useState<ArtifactState>('loading')

  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    void (async () => {
      // 1. Rehydrate anything already generated, so a resumed session never
      //    re-requests a spent freebie.
      let existing: CreatorPack = { captions: [], hashtags: [], idea: null }
      try {
        const res = await fetch('/api/onboarding/pack')
        if (res.ok) existing = (await res.json()) as CreatorPack
      } catch {
        // Treat a rehydration failure as "nothing yet" and generate.
      }

      if (existing.captions.length) {
        setCaptions(existing.captions)
        setCaptionsState('done')
      }
      if (existing.hashtags.length) {
        setHashtags(existing.hashtags)
        setHashtagsState('done')
      }
      if (existing.idea) {
        setIdea(existing.idea)
        setIdeaState('done')
      }

      void fetch('/api/onboarding/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: existing.captions.length || existing.hashtags.length || existing.idea
            ? 'pack_rehydrated'
            : 'pack_requested',
          detail: { niche: ask.niche, platform: ask.platform },
        }),
      }).catch(() => {})

      // 2. Generate only the gaps, in parallel.
      if (!existing.captions.length) {
        void (async () => {
          try {
            const res = await fetch('/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                topic: ask.niche,
                platform: ask.platform,
                tone: ask.tone,
                count: 3,
                tutorialMode: true,
              }),
            })
            if (!res.ok) throw new Error(String(res.status))
            const data = (await res.json()) as { captions?: string[] }
            const list = Array.isArray(data.captions) ? data.captions : []
            setCaptions(list)
            setCaptionsState(list.length ? 'done' : 'failed')
          } catch {
            setCaptionsState('failed')
          }
        })()
      }

      if (!existing.hashtags.length) {
        void (async () => {
          try {
            const params = new URLSearchParams({
              q: ask.niche,
              platform: ask.platform,
              count: '15',
              tutorial: '1',
            })
            const res = await fetch(`/api/hashtags?${params.toString()}`)
            if (!res.ok) throw new Error(String(res.status))
            const data = (await res.json()) as { hashtags?: HashtagItem[] }
            const list = Array.isArray(data.hashtags) ? data.hashtags : []
            setHashtags(list)
            setHashtagsState(list.length ? 'done' : 'failed')
          } catch {
            setHashtagsState('failed')
          }
        })()
      }

      if (!existing.idea) {
        void (async () => {
          try {
            // The route clamps count to a minimum of 5; we ask for 5 and show
            // the first in full rather than pretending we asked for one.
            const res = await fetch('/api/viral-ideas', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ niche: ask.niche, count: 5, tutorialMode: true }),
            })
            if (!res.ok) throw new Error(String(res.status))
            const data = (await res.json()) as { ideas?: PackIdea[] }
            const first = Array.isArray(data.ideas) && data.ideas.length ? data.ideas[0] : null
            setIdea(first)
            setIdeaState(first ? 'done' : 'failed')
          } catch {
            setIdeaState('failed')
          }
        })()
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const allSettled =
    captionsState !== 'loading' && hashtagsState !== 'loading' && ideaState !== 'loading'
  const anySucceeded =
    captionsState === 'done' || hashtagsState === 'done' || ideaState === 'done'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Your first pack</h1>
        <p className="text-zinc-400 mt-2">
          Built from &ldquo;{ask.niche}&rdquo;. On us — your credits are untouched.
        </p>
      </div>

      <ArtifactCard title="3 captions you can post today" state={captionsState}>
        <ul className="space-y-3">
          {captions.map((c, i) => (
            <li
              key={i}
              className="rounded-lg border border-brand-500/10 bg-surface-secondary p-3 text-sm text-zinc-200"
            >
              {c}
            </li>
          ))}
        </ul>
      </ArtifactCard>

      <ArtifactCard title="Hashtags that match" state={hashtagsState}>
        <div className="flex flex-wrap gap-2">
          {hashtags.map((h) => (
            <span
              key={h.tag}
              title={`${h.category} · ~${h.posts} posts`}
              className="rounded-full bg-brand-500/10 border border-brand-500/20 px-3 py-1 text-xs text-brand-200"
            >
              {h.tag}
            </span>
          ))}
        </div>
      </ArtifactCard>

      <ArtifactCard title="One thing to film this week" state={ideaState}>
        {idea && (
          <div className="space-y-3">
            <div className="text-base font-semibold text-zinc-100">{idea.title}</div>
            <div>
              <div className="text-2xs font-bold uppercase tracking-wider text-brand-300 mb-1">
                Your opening hook
              </div>
              <p className="text-sm text-zinc-200">{idea.hook}</p>
            </div>
            {idea.outline?.length > 0 && (
              <div>
                <div className="text-2xs font-bold uppercase tracking-wider text-brand-300 mb-1">
                  How to structure it
                </div>
                <ol className="list-decimal list-inside space-y-1 text-sm text-zinc-300">
                  {idea.outline.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ol>
              </div>
            )}
            {idea.bestTime && (
              <p className="text-xs text-zinc-500">Best time to post: {idea.bestTime}</p>
            )}
          </div>
        )}
      </ArtifactCard>

      <div className="flex items-center justify-between pt-2">
        <button onClick={onLater} className="text-sm text-zinc-500 hover:text-zinc-300">
          Finish later
        </button>
        <Button onClick={() => onDone({ captions, hashtags, idea })} size="lg" disabled={!allSettled || !anySucceeded}>
          Keep this →
        </Button>
      </div>
    </div>
  )
}

/** Renders one artifact's loading / failed / done state. */
function ArtifactCard({
  title,
  state,
  children,
}: {
  title: string
  state: ArtifactState
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-brand-500/15 bg-surface-secondary/50 p-5">
      <h2 className="text-sm font-bold uppercase tracking-wider text-brand-300 mb-3">{title}</h2>
      {state === 'loading' && <p className="text-sm text-zinc-500">Writing…</p>}
      {state === 'failed' && (
        <p className="text-sm text-zinc-500">
          This one didn&apos;t come through. The rest of your pack is fine — you can try this tool
          again any time from the dashboard.
        </p>
      )}
      {state === 'done' && children}
    </section>
  )
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run lint`
Expected: typecheck 0; lint at exactly the 4 known warnings (the single `exhaustive-deps` disable on the mount effect matches the codebase's existing pattern).

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/PackStage.tsx
git commit -m "feat(onboarding): add Pack stage — rehydrate, then generate only the gaps

Reads /api/onboarding/pack first so a resumed session never re-requests a spent
freebie (which would 409 three times into a dead screen), then fires only the
missing artifacts in parallel. Hashtags are objects, not strings. The single
idea renders in full — hook, outline, best time — which is the strategic
artifact that replaces Channel Analysis, at no extra credit cost."
```

---

### Task 7: Stage 3 — Own it, and replace the wizard

**Files:**
- Create: `src/components/onboarding/OwnStage.tsx`
- Rewrite: `src/app/onboarding/page.tsx`
- Delete: `src/components/onboarding/TutorialSteps.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create the Own stage**

Create `src/components/onboarding/OwnStage.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { apiFetch } from '@/lib/api'
import type { CreatorPack } from './PackStage'
import type { AskResult } from './AskStage'

/**
 * Stage 3: the user takes ownership.
 *
 * The old wizard made saving its own ceremonial step. Here the pack saves in one
 * click, and the personalisation offers come AFTER value has landed — offers,
 * never gates.
 *
 * Note hashtags are objects; serialise by `.tag`. Rev.1 joined the objects
 * directly and produced "[object Object]".
 */

export function OwnStage({
  ask,
  pack,
  onFinish,
}: {
  ask: AskResult
  pack: CreatorPack
  onFinish: (saved: boolean) => void
}) {
  const { addToast } = useToast()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const savePack = async () => {
    setSaving(true)
    try {
      const sections: string[] = []
      if (pack.captions.length) sections.push(`Captions:\n${pack.captions.join('\n\n')}`)
      if (pack.hashtags.length) sections.push(`Hashtags:\n${pack.hashtags.map((h) => h.tag).join(' ')}`)
      if (pack.idea) {
        const outline = pack.idea.outline?.length
          ? `\nOutline:\n${pack.idea.outline.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
          : ''
        const when = pack.idea.bestTime ? `\nBest time: ${pack.idea.bestTime}` : ''
        sections.push(`Idea to film:\n${pack.idea.title}\nHook: ${pack.idea.hook}${outline}${when}`)
      }

      await apiFetch('/api/saved', {
        method: 'POST',
        body: JSON.stringify({
          type: 'first-session-pack',
          content: sections.join('\n\n---\n\n'),
          platform: ask.platform,
          topic: ask.niche,
        }),
      })
      setSaved(true)
      addToast('Saved to your library.', 'success')
      void fetch('/api/onboarding/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'artifact_saved', detail: { type: 'first-session-pack' } }),
      }).catch(() => {})
    } catch {
      addToast('Could not save just yet — your pack is still on screen.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Keep it.</h1>
        <p className="text-zinc-400 mt-2 leading-relaxed max-w-xl">
          Save the pack to your library and it&apos;s yours — captions, hashtags and the idea, in
          one place you can come back to.
        </p>
      </div>

      <Button onClick={savePack} loading={saving} disabled={saved} size="lg">
        {saved ? 'Saved ✓' : 'Save to my library'}
      </Button>

      <div className="pt-4 space-y-3">
        <div className="text-2xs font-bold uppercase tracking-wider text-zinc-500">
          Want the next one to sound more like you?
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/dashboard/voice"
            className="rounded-xl border border-brand-500/15 bg-surface-secondary p-4 hover:border-brand-500/40 transition-colors"
          >
            <div className="text-sm font-semibold text-zinc-200">🎙️ Train your voice</div>
            <p className="text-xs text-zinc-500 mt-1">
              Paste 2-3 captions you&apos;ve written. Every generation after that matches your style.
            </p>
          </Link>
          <Link
            href="/dashboard/settings"
            className="rounded-xl border border-brand-500/15 bg-surface-secondary p-4 hover:border-brand-500/40 transition-colors"
          >
            <div className="text-sm font-semibold text-zinc-200">🧭 Add your channels</div>
            <p className="text-xs text-zinc-500 mt-1">
              Tune everything to the platforms you actually post on.
            </p>
          </Link>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={() => onFinish(saved)} size="lg">
          Go to my dashboard →
        </Button>
      </div>
    </div>
  )
}
```

**Before committing, check the live schema for a CHECK constraint on `saved_content.type`.** No migration in the repo defines one, but the table predates the tracked migrations. If a constraint exists and rejects `'first-session-pack'`, use an accepted value and report which.

- [ ] **Step 2: Rewrite the onboarding page**

Replace the entire contents of `src/app/onboarding/page.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { apiFetch } from '@/lib/api'
import { AskStage, type AskResult } from '@/components/onboarding/AskStage'
import { PackStage, type CreatorPack } from '@/components/onboarding/PackStage'
import { OwnStage } from '@/components/onboarding/OwnStage'
import {
  snoozeUntil,
  type FirstSessionProgress,
  type FirstSessionStage,
} from '@/lib/first-session-state'

/**
 * The first session: Ask → Pack → Own.
 *
 * State lives in preferences.tutorial_progress because isInActiveTutorial, the
 * sidebar link and the dashboard all read `completed` from it — only the stage
 * vocabulary and the snooze field are new.
 *
 * Resume: the Ask answers are persisted, so a returning user re-enters at Ask
 * with their niche/platform/tone pre-filled and continues into Pack, which
 * rehydrates already-generated artifacts rather than regenerating them.
 */

const STAGE_LABELS: Record<FirstSessionStage, string> = {
  ask: 'About you',
  pack: 'Your pack',
  own: 'Keep it',
}

export default function OnboardingPage() {
  const router = useRouter()
  const [stage, setStage] = useState<FirstSessionStage>('ask')
  const [ask, setAsk] = useState<AskResult | null>(null)
  const [pack, setPack] = useState<CreatorPack | null>(null)
  const [ready, setReady] = useState(false)
  const [saved, setSaved] = useState<FirstSessionProgress>({})

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .maybeSingle()

      const prefs = (profile?.preferences ?? {}) as {
        tutorial_progress?: FirstSessionProgress
        onboarded_at?: string | null
      }
      const tp = prefs.tutorial_progress

      // Finished — the new session, or the old wizard. Do not replay it.
      // Same predicate as chooseDestination, deliberately.
      if (tp?.completed || prefs.onboarded_at != null) {
        router.replace('/dashboard')
        return
      }

      if (tp) setSaved(tp)
      setReady(true)
    })()
  }, [router])

  const persist = async (progress: FirstSessionProgress, alsoOnboardedAt = false) => {
    try {
      await apiFetch('/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify(
          alsoOnboardedAt
            ? { onboarded_at: new Date().toISOString(), tutorial_progress: progress }
            : { tutorial_progress: progress },
        ),
      })
    } catch {
      // Non-fatal: never block a first session on a preferences write.
    }
  }

  const logEvent = (name: string, detail: Record<string, unknown> = {}) => {
    void fetch('/api/onboarding/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, detail }),
    }).catch(() => {})
  }

  const handleLater = async () => {
    await persist({ ...saved, stage, completed: false, snoozed_until: snoozeUntil(new Date()) })
    logEvent('first_session_snoozed', { stage })
    router.replace('/dashboard')
  }

  const handleAskDone = async (result: AskResult) => {
    setAsk(result)
    setStage('pack')
    await persist({
      ...saved,
      stage: 'pack',
      completed: false,
      niche: result.niche,
      platform: result.platform,
      tone: result.tone,
    })
    logEvent('stage_viewed', { stage: 'pack' })
  }

  const handlePackDone = async (result: CreatorPack) => {
    setPack(result)
    setStage('own')
    await persist({ ...saved, stage: 'own', completed: false })
    logEvent('stage_viewed', { stage: 'own' })
  }

  const handleFinish = async (didSave: boolean) => {
    await persist(
      { ...saved, stage: 'own', completed: true, snoozed_until: null, pack_saved: didSave },
      true,
    )
    logEvent('first_session_completed', { pack_saved: didSave })
    router.replace('/dashboard')
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500">Loading…</div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-brand-500/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-sm shadow-glow">
            ⚡
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
            PostCrisp
          </span>
        </div>
        <nav aria-label="Progress">
          <ol className="flex items-center gap-2">
            {(['ask', 'pack', 'own'] as FirstSessionStage[]).map((s) => (
              <li
                key={s}
                aria-current={s === stage ? 'step' : undefined}
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  s === stage
                    ? 'bg-brand-500/10 text-brand-200 border-brand-500/40'
                    : 'text-zinc-600 border-brand-500/5'
                }`}
              >
                {STAGE_LABELS[s]}
              </li>
            ))}
          </ol>
        </nav>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-3xl">
          {stage === 'ask' && (
            <AskStage
              initialNiche={saved.niche ?? ''}
              initialPlatform={saved.platform ?? 'instagram'}
              initialTone={saved.tone ?? 'casual'}
              onContinue={handleAskDone}
              onLater={handleLater}
            />
          )}
          {stage === 'pack' && ask && (
            <PackStage ask={ask} onDone={handlePackDone} onLater={handleLater} />
          )}
          {stage === 'own' && ask && pack && (
            <OwnStage ask={ask} pack={pack} onFinish={handleFinish} />
          )}
        </div>
      </div>
    </div>
  )
}
```

The progress indicator is a `nav > ol > li` with `aria-current`, and labels are always visible rather than `hidden md:inline` — both were accessibility and mobile findings in the audit.

- [ ] **Step 3: Relabel the sidebar link**

In `src/components/layout/Sidebar.tsx`, `TUTORIAL_ITEM` reads `{ href: "/onboarding", label: "Tutorial", icon: "🎓" }`. It is no longer a tutorial. Change the label to `"Finish setup"` and the icon to `"✨"`. Leave its `!tutorialCompleted` render condition alone.

- [ ] **Step 4: Delete the retired wizard**

```bash
git rm src/components/onboarding/TutorialSteps.tsx
grep -rn "TutorialSteps" src/ || echo "no remaining references"
```

Expected: no remaining references. Remove any dead imports that surface.

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm test && npm run lint`
Expected: typecheck 0; 164 tests pass (no test imports `TutorialSteps`); lint at exactly the 4 known warnings.

- [ ] **Step 6: Commit**

```bash
git add -A src/app/onboarding/page.tsx src/components/onboarding/ src/components/layout/Sidebar.tsx
git commit -m "feat(onboarding): replace the 7-step tour with Ask -> Pack -> Own

The old flow spent two screens before producing anything, hard-gated on
channels, and made its first artifact a 30-60s Channel Analysis whose output was
three Unlock-with-Creator blocks. Replay is now gated on the same predicate as
chooseDestination, the progress indicator is a real nav/ol with aria-current,
and the sidebar link no longer calls this a tutorial."
```

---

### Task 8: Bring people back

**Files:**
- Create: `src/components/ResumeFirstSessionCard.tsx`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Create the card**

Create `src/components/ResumeFirstSessionCard.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * Dashboard recovery for an unfinished first session.
 *
 * A CARD, not a middleware redirect: a hard gate would loop against the snooze,
 * add a profile query to every dashboard request, and trap users who chose to
 * defer.
 *
 * The count comes from the server, which reads the redemption ledger. The copy
 * says "free runs", never "credits" — these are session-only coupons, one per
 * feature, not a spendable balance.
 */

export function ResumeFirstSessionCard() {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/onboarding/free-runs')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && typeof data.remaining === 'number') setRemaining(data.remaining)
      } catch {
        // Silent: the card is still useful without the number.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
      <div>
        <div className="text-sm font-bold text-zinc-100">Finish your first pack</div>
        <p className="text-sm text-zinc-400 mt-1">
          {remaining && remaining > 0
            ? `You've still got ${remaining} free run${remaining === 1 ? '' : 's'} waiting — captions, hashtags and something to film, on us.`
            : 'Captions, hashtags and something to film — about a minute.'}
        </p>
      </div>
      <Link
        href="/onboarding"
        className="flex-shrink-0 rounded-lg bg-brand-500 hover:bg-brand-400 px-4 py-2 text-sm font-semibold text-white text-center transition-colors"
      >
        Pick up where I left off →
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Wire it in and reconcile the checklists**

In `src/app/dashboard/page.tsx`, add the imports:

```typescript
import { ResumeFirstSessionCard } from '@/components/ResumeFirstSessionCard'
import { shouldOfferResume, type FirstSessionProgress } from '@/lib/first-session-state'
```

`shouldOfferResume` needs the account's creation date. The dashboard already calls `supabase.auth.getUser()`; use `user.created_at`. Near the existing `tutorialDone` computation add:

```typescript
        const firstSessionProgress = prefs?.tutorial_progress as FirstSessionProgress | undefined
        const offerResume = shouldOfferResume(
          firstSessionProgress,
          prefs?.onboarded_at ?? null,
          user.created_at,
          new Date(),
        )
```

Add `offerResume: boolean` to the `DashboardStats` interface and include it in the `setStats` object. Then in the render, place the card above `GettingStartedCard` and make them mutually exclusive:

```tsx
      {/* An unfinished first session takes precedence over the generic
          checklist — showing both is how a new user faced 22 checklist items. */}
      {stats?.offerResume && <ResumeFirstSessionCard />}

      {stats && !stats.offerResume && (
        <GettingStartedCard
          state={stats.gettingStarted}
          dismissed={stats.gettingStartedDismissed}
          onDismiss={() => setStats((prev) => prev ? { ...prev, gettingStartedDismissed: true } : prev)}
        />
      )}
```

Leave the `NextToolsCard` block alone — it is already gated on `showNextTools`, which requires a completed tutorial or `onboarded_at`, so it cannot co-occur with the resume card.

**If `user.created_at` is not already in scope at that point, read it from the `getUser()` result rather than adding a query.** Report what you did.

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm test && npm run lint`
Expected: typecheck 0; 164 tests pass; lint at exactly the 4 known warnings.

- [ ] **Step 4: Manually verify the four dashboard states**

No unit test covers this composition.

1. **New account, unfinished, not snoozed** — resume card shows; GettingStartedCard hidden; NextToolsCard hidden.
2. **Snoozed** (set `snoozed_until` a few days out) — resume card hidden; GettingStartedCard shows.
3. **Completed** — resume card hidden; GettingStartedCard shows; NextToolsCard shows.
4. **Long-standing account with no first-session record** — resume card hidden. This is the rev. 1 regression; verify it explicitly.

If you cannot run a browser or reach the database, say so plainly.

- [ ] **Step 5: Commit**

```bash
git add src/components/ResumeFirstSessionCard.tsx src/app/dashboard/page.tsx
git commit -m "feat(onboarding): dashboard resume card, and stop stacking three checklists

An unfinished first session surfaces with its remaining free-run count instead
of relying on passive discovery of a sidebar link 10 of 13 users never clicked.
A card rather than a middleware gate: no redirect loop against the snooze and no
profile query per dashboard request. Scoped to accounts created after launch, so
long-standing users are not nagged about a session they were never offered."
```

---

## Out of scope, tracked

- **`onboarded_at` is client-writable** (`src/app/api/user/preferences/route.ts:18`), so a user can self-declare onboarded and skip the session. The Architect rates this low severity once the redemption ledger exists — self-declared onboarding is UX self-harm with no credit exposure — while the Auditor wanted it a precondition. Recorded dissent; not blocking. A server-side completion route would be the fix, and Tasks 4 and 7 touch the code paths that write it, so folding one in later is cheap.
- **`tutorial_progress` is client-writable wholesale**, including `completed`. Harmless for credits after Task 1 (the ledger is the boundary), but it means the flow-state itself is not trustworthy for analytics.
- **Google-on-login may mint accounts outside the invite gate** — access-control work from the audit.
- **Re-engagement for people who never return.** No email or notification code exists; the resume card only helps users who come back on their own.
- **Channel Analysis as a day-2 conversion moment.** Removed from the first session here; where it reappears is a product decision.
- **Verify the production email-confirmation setting.** Still owed from the audit.
- **The dependency branch's open item:** its feature-key drift guard is tautological and its "hazard demonstration" test pins the bug rather than catching it. Replacing it with a source-level assertion over the four route files is ~15 lines.

## Self-Review

**Spec coverage.** Quick wins map to artifacts: publish-ready captions, a matching hashtag set, and one idea rendered as a full filming brief (Task 6); an owned saved asset (Task 7); optional voice and channel personalisation after value lands (Task 7). Audit F1 (return path) is Task 8; F3 (skip burning value) is Task 4; F4 (no output until step 3) is Tasks 5-7; F6 (competing checklists) is Task 8; F5 (invisible free runs) is Task 3's endpoint plus Task 8's card. F2 was fixed on the dependency branch.

**Placeholder scan.** No TBDs. Five steps deliberately instruct verify-then-adjust rather than fixed code — the preferences inner-shape check (Task 4), the `PLATFORMS`/`TONES` export shapes (Task 5), the `viral_ideas` output key and JSON-filter syntax (Task 3), the `saved_content.type` constraint (Task 7), and `user.created_at` scope (Task 8). Each names exactly what to check and what to do with either outcome. **This is deliberate: rev. 1 asserted three endpoint contracts without reading them and got all three wrong, which is why the Global Constraints now require reading a route before asserting its contract.**

**Type consistency.** `AskResult` (Task 5) is consumed by Tasks 6 and 7 under that name, and now carries `tone`. `HashtagItem`, `PackIdea` and `CreatorPack` are defined in Task 6 and consumed by Task 7. `FirstSessionProgress`, `FirstSessionStage`, `shouldOfferResume`, `snoozeUntil` are defined in Task 3 and used with identical signatures in Tasks 4, 7 and 8 — note `shouldOfferResume` now takes four arguments, with `accountCreatedAt` third. `recordTutorialRedemption` (Task 1) is called only from server routes. `logOnboardingEvent` (Task 2) is server-only; client stages reach it through `POST /api/onboarding/event`.

**Known limitation, stated rather than hidden.** Task 1 Step 5 requires a judgement call the plan cannot make for the implementer: `hasUsedTutorialBypass` currently receives the caller's session client, which cannot see a table with no client grants. The plan directs adding a service-role reader and says why that is preferred over a SELECT policy — but if the implementer finds a reason that is wrong, they should report rather than force it. Getting this wrong fails **open** (every freebie granted forever), so it deserves explicit attention in Task 1's review.
