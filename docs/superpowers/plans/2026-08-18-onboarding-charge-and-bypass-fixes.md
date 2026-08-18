# Onboarding Charge Safety + Bypass Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop PostCrisp charging users credits they did not consent to spend, and make onboarding reachable from every sign-in path.

**Architecture:** Three independent defects share one root cause — decisions that should be server-authoritative are either inferred from client state that may not have arrived yet, or silently defaulted. We fix them by (1) extracting the tutorial charge decision into a pure, tested policy function so "your free run is gone" can never silently become "you have been billed"; (2) removing the client-step dependency from the server-side bypass gate, which eliminates a write-ordering race; and (3) centralising post-authentication routing in one helper so Google OAuth, email confirmation, and the alpha-agreement hop cannot each independently forget about onboarding.

**Tech Stack:** Next.js 14 (App Router), TypeScript strict, Supabase (Auth + Postgres + RLS), vitest (node environment), Tailwind. Tests use the existing `createFakeSupabase` harness in `src/lib/__tests__/fake-supabase.ts`.

**Spec:** `docs/superpowers/analysis/2026-08-18-onboarding-audit.md` (host audit) as revised by the Three AImigos council. **Read the "Council corrections" section below before starting** — several claims in the original audit were proven wrong, and this plan follows the corrected version, not the audit as written.

## Global Constraints

- TypeScript `strict` is on; `npm run typecheck` must exit 0 with zero errors.
- All 105 existing tests must continue to pass. Run `npm test`.
- Never widen a credit bypass. The per-feature lifetime lock (one free run per feature, ever) is the security boundary and must remain server-authoritative.
- Never introduce a client-trusted value into a charge decision.
- Service-role keys must never appear in client code.
- `git diff --check` clean (CRLF warnings on Windows are expected and acceptable).
- Do not change credit prices or `TIER_ALLOWANCE`.
- Copy rule: the onboarding welcome screen promises the tour is "on us". No code path may charge a user during a tutorial step without an explicit confirmed click.

## Council corrections to the source audit

The audit at the spec path contains six findings. Three were factually wrong, and this plan does **not** implement them as written:

- The audit claims signup's redirect is the *only* route to `/onboarding`. **False** — `src/components/layout/Sidebar.tsx:26` defines a "Tutorial" nav link rendered whenever `tutorial_progress.completed !== true` (`Sidebar.tsx:234-244`). Dropouts have a passive return path. Severity is HIGH, not CRITICAL.
- The audit describes ~10 "free credits in the account". **Wrong model** — these are wizard-only `tutorialMode` coupons redeemable solely through the wizard, not a spendable balance. Do not write UI copy calling them account credits.
- The audit cites a "Creator Trial, 10 credits/day for 3 days". **Not shipped** — `docs/credit-matrix.md:52` marks it *proposed*. The live default is `starter: { credits: 10, cycle: 'daily' }` (`src/lib/crisp-engine-config.ts:221`).

This plan covers the defects the council confirmed plus the ones the audit missed. **The first-session UX redesign is deliberately out of scope** — it is blocked on an unresolved product decision (re-sequence vs replace) and belongs in a separate plan.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/tutorial-charge-policy.ts` (create) | Pure decision function: given "tutorial requested" + "bypass granted", return bypass / refuse / charge. No I/O, no Supabase. |
| `src/lib/__tests__/tutorial-charge-policy.test.ts` (create) | Exhaustive table test of the policy. |
| `src/lib/tutorial-bypass.ts` (modify) | Remove the client-step dependency from `isInActiveTutorial`, closing the write-ordering race. |
| `src/lib/__tests__/tutorial-bypass.test.ts` (modify) | Update the two step-dependent tests; add race-regression tests. |
| `src/lib/post-auth-destination.ts` (create) | Single source of truth for where a freshly authenticated user should land. |
| `src/lib/__tests__/post-auth-destination.test.ts` (create) | Tests for onboarding-needed vs completed vs explicit-next. |
| `src/app/api/{viral-ideas,generate,hashtags,channel-analysis}/route.ts` (modify) | Use the policy; return 409 instead of silently charging. |
| `src/components/onboarding/TutorialSteps.tsx` (modify) | Remove the auto-run that fires a generation with no click. |
| `src/app/auth/callback/route.ts` (modify) | Route through `chooseDestination` instead of defaulting to `/dashboard`. |
| `src/app/accept-terms/page.tsx` (modify) | Stop defaulting `next` to `/dashboard`. |

---

### Task 1: Tutorial charge policy (pure function)

The bug: all four AI routes do `if (tutorialMode) { allowBypass = await shouldGrantTutorialBypass(...) }` then pass `bypassCredits: allowBypass` to `checkAuthAndUsage`. When the user asked for a tutorial run but the free run is already spent, `allowBypass` is `false` and the route **charges them anyway, silently**. Verified at `src/app/api/viral-ideas/route.ts:101-112`, `generate/route.ts:57-64`, `hashtags/route.ts:36-43`, `channel-analysis/route.ts:35-42`.

**Files:**
- Create: `src/lib/tutorial-charge-policy.ts`
- Test: `src/lib/__tests__/tutorial-charge-policy.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `export type TutorialChargeDecision = 'bypass' | 'refuse' | 'charge'`; `export function decideTutorialCharge(input: { tutorialModeRequested: boolean; bypassGranted: boolean }): TutorialChargeDecision`; `export const TUTORIAL_RUN_SPENT_CODE = 'tutorial_run_spent'`. Task 2 imports all three.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/tutorial-charge-policy.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { decideTutorialCharge, TUTORIAL_RUN_SPENT_CODE } from '@/lib/tutorial-charge-policy'

describe('decideTutorialCharge', () => {
  it('bypasses when a tutorial run was requested and granted', () => {
    expect(decideTutorialCharge({ tutorialModeRequested: true, bypassGranted: true })).toBe('bypass')
  })

  it('REFUSES rather than charging when a tutorial run was requested but already spent', () => {
    // This is the whole point of the task: the old code charged here.
    expect(decideTutorialCharge({ tutorialModeRequested: true, bypassGranted: false })).toBe('refuse')
  })

  it('charges normally for an ordinary non-tutorial request', () => {
    expect(decideTutorialCharge({ tutorialModeRequested: false, bypassGranted: false })).toBe('charge')
  })

  it('charges normally when bypassGranted is spuriously true outside tutorial mode', () => {
    // Defensive: a granted flag must never bypass without an explicit request.
    expect(decideTutorialCharge({ tutorialModeRequested: false, bypassGranted: true })).toBe('charge')
  })

  it('exposes a stable error code for clients to branch on', () => {
    expect(TUTORIAL_RUN_SPENT_CODE).toBe('tutorial_run_spent')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/tutorial-charge-policy.test.ts`
Expected: FAIL with `Failed to resolve import "@/lib/tutorial-charge-policy"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/tutorial-charge-policy.ts`:

```typescript
/**
 * Decides how to bill a generation request that may be part of the onboarding
 * tutorial.
 *
 * Why this exists: the four AI routes previously computed `allowBypass` and
 * passed it straight to checkAuthAndUsage as `bypassCredits`. When a user
 * requested a tutorial run whose per-feature freebie was already spent,
 * allowBypass was false and the route charged them with no warning — directly
 * contradicting the wizard's "on us" promise. Worst case, ViralIdeasStep
 * auto-ran on mount, so the charge happened with no click at all.
 *
 * Splitting the decision out makes the three cases explicit and testable
 * without a Supabase client or an HTTP request.
 */

/** Stable code returned to clients so they can offer an explicit paid retry. */
export const TUTORIAL_RUN_SPENT_CODE = 'tutorial_run_spent'

export type TutorialChargeDecision =
  /** Run it; PostCrisp absorbs the cost. */
  | 'bypass'
  /** User asked for a free tutorial run they no longer have. Do NOT charge. */
  | 'refuse'
  /** Ordinary request — charge normal credits and apply tier gates. */
  | 'charge'

export function decideTutorialCharge(input: {
  tutorialModeRequested: boolean
  bypassGranted: boolean
}): TutorialChargeDecision {
  if (!input.tutorialModeRequested) return 'charge'
  return input.bypassGranted ? 'bypass' : 'refuse'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/tutorial-charge-policy.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tutorial-charge-policy.ts src/lib/__tests__/tutorial-charge-policy.test.ts
git commit -m "feat(credits): add tutorial charge policy so a spent free run refuses instead of billing"
```

---

### Task 2: Apply the policy to all four AI routes

**Files:**
- Modify: `src/app/api/viral-ideas/route.ts:100-112`
- Modify: `src/app/api/generate/route.ts:56-64`
- Modify: `src/app/api/hashtags/route.ts:35-43`
- Modify: `src/app/api/channel-analysis/route.ts:34-42`

**Interfaces:**
- Consumes: `decideTutorialCharge`, `TUTORIAL_RUN_SPENT_CODE` from Task 1.
- Produces: a 409 JSON response shape `{ error: string, code: 'tutorial_run_spent' }`.

- [ ] **Step 1: Change `viral-ideas` first (the only auto-running step)**

In `src/app/api/viral-ideas/route.ts`, add to the imports at the top:

```typescript
import { decideTutorialCharge, TUTORIAL_RUN_SPENT_CODE } from '@/lib/tutorial-charge-policy'
```

Replace the block from the `// Tutorial mode:` comment through the `if (!auth.ok) return auth.response` line with:

```typescript
  // Tutorial mode: PostCrisp absorbs credit + tier cost. Server-validated.
  let bypassGranted = false
  if (tutorialMode) {
    const supabase = await (await import('@/utils/supabase/server')).createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) bypassGranted = await shouldGrantTutorialBypass(supabase, user.id, 'viral_ideas')
  }

  const decision = decideTutorialCharge({ tutorialModeRequested: !!tutorialMode, bypassGranted })

  // A spent tutorial run must NEVER fall through to a silent charge. The client
  // shows an explicit "generate anyway for N credits?" prompt and re-requests
  // without tutorialMode if the user agrees.
  if (decision === 'refuse') {
    return NextResponse.json(
      { error: 'Your free tutorial run for Viral Ideas has already been used.', code: TUTORIAL_RUN_SPENT_CODE },
      { status: 409 },
    )
  }

  const auth = await checkAuthAndUsage('viral-ideas', {
    bypassCredits: decision === 'bypass',
    bypassFeatureGate: decision === 'bypass',
  })
  if (!auth.ok) return auth.response
```

- [ ] **Step 2: Verify the change compiles and nothing regressed**

Run: `npm run typecheck && npm test`
Expected: typecheck exits 0; 110 tests pass (105 existing + 5 from Task 1).

- [ ] **Step 3: Apply the identical shape to the remaining three routes**

Each needs the same import, the same `bypassGranted` rename, the same `decision` line, the same `refuse` guard, and the same two `decision === 'bypass'` flags. Only these differ:

| File | Bypass feature key | `checkAuthAndUsage` first arg | Refusal message |
|---|---|---|---|
| `src/app/api/generate/route.ts` | `'captions'` | `'captions'` | `'Your free tutorial run for Captions has already been used.'` |
| `src/app/api/hashtags/route.ts` | `'hashtags'` | `'hashtags'` | `'Your free tutorial run for Hashtags has already been used.'` |
| `src/app/api/channel-analysis/route.ts` | `'channel_analysis'` | `'channel-analysis'` | `'Your free tutorial run for Channel Analysis has already been used.'` |

**Trap to avoid:** the bypass feature key and the `checkAuthAndUsage` argument are *sometimes* different vocabularies — `channel_analysis` (underscore, matches the `generations.feature` column) versus `channel-analysis` (hyphen, matches the route/credit config). Do not "tidy" them into agreement; that would break either the bypass lookup or the credit charge. Equally, do not assume they always differ: for `generate/route.ts` both are `'captions'`, because the `checkAuthAndUsage` argument must be a valid `CrispTask` (`src/lib/crisp-engine-config.ts:52-82`) and there is no `'generate'` member. Take each row of the table literally; the route's own directory name is never the source of either value.

Confirm each file already imports `NextResponse` before adding the 409 return. All four do today, but check rather than assume.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm test`
Expected: typecheck exits 0; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/viral-ideas/route.ts src/app/api/generate/route.ts src/app/api/hashtags/route.ts src/app/api/channel-analysis/route.ts
git commit -m "fix(credits): refuse spent tutorial runs with 409 instead of silently charging

All four AI routes computed allowBypass and passed it straight to
checkAuthAndUsage. When a user requested a tutorial run whose per-feature
freebie was already spent, allowBypass was false and the route billed them
with no warning, contradicting the wizard's 'on us' promise."
```

---

### Task 3: Remove the unprompted generation on the viral step

The bug: `ViralIdeasStep` calls `handleGenerate()` from a mount effect whenever a niche was carried from an earlier step. Combined with the pre-Task-2 behaviour this fired a **paid** generation with no click. Task 2 already made that safe (it now 409s), but an auto-firing generation is still wrong: it spends the user's one free run without them asking, and it re-fires on every remount.

**Files:**
- Modify: `src/components/onboarding/TutorialSteps.tsx:741-748`

**Interfaces:**
- Consumes: nothing new.
- Produces: no signature change. `ViralIdeasStep` keeps its existing props.

- [ ] **Step 1: Delete the auto-run effect**

In `src/components/onboarding/TutorialSteps.tsx`, delete this entire block (currently at lines 741-748):

```typescript
  // Auto-run once on mount if we already have niche context (carried from analyze/captions)
  useEffect(() => {
    if (niche && ideas.length === 0 && !generating && !autoRan) {
      setAutoRan(true)
      handleGenerate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

- [ ] **Step 2: Remove the now-unused `autoRan` state**

Search the file for `autoRan`. Delete its `useState` declaration. Then check whether `useEffect` is still referenced anywhere in the file — other steps may use it. Only remove `useEffect` from the React import if there are zero remaining references, otherwise leave the import alone.

- [ ] **Step 3: Verify no unused-variable or lint errors**

Run: `npm run typecheck && npm run lint`
Expected: typecheck exits 0. Lint exits 0 — the 4 pre-existing warnings (three `react-hooks/exhaustive-deps` in admin pages, one `no-img-element` in `FeatureGate.tsx`) remain and are acceptable. There must be no **new** warning and no error.

- [ ] **Step 4: Confirm the step still works on an explicit click**

Run `npm run dev`, sign in as a user with an incomplete tutorial, go to `/onboarding`, advance to the Viral Ideas step.
Expected: the step renders with its generate button and **no generation starts on its own**. Clicking the button produces ideas as before, and the niche carried from earlier steps still pre-fills the input.

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/TutorialSteps.tsx
git commit -m "fix(onboarding): stop ViralIdeasStep auto-firing a generation on mount

Spent the user's one free viral-ideas run without them asking, and re-fired on
every remount. Generation is now always an explicit click."
```

---

### Task 4: Close the write-ordering race in the bypass gate

The bug: `goToStep` fire-and-forgets the `PUT /api/user/preferences` write (`src/app/onboarding/page.tsx:167-172`) while `isInActiveTutorial` requires `tutorial_progress.step` to be one of `{analyze, captions, hashtags, viral}` (`src/lib/tutorial-bypass.ts:25,56`). A user who advances and generates faster than the write lands is denied the bypass — and before Task 2, was silently charged for it.

The same step-membership check also means a dropout parked on `welcome`, `channels`, or `save` is not considered "in tutorial" at all.

The fix is to drop the step-membership requirement. It adds no real protection: the security boundary is the **per-feature lifetime lock** in `hasUsedTutorialBypass` (one free run per feature, ever) plus the `completed` flag. Removing the step check cannot widen total exposure beyond the same four free runs.

**Files:**
- Modify: `src/lib/tutorial-bypass.ts`
- Modify: `src/lib/__tests__/tutorial-bypass.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `isInActiveTutorial(supabase, userId)` keeps its exact signature `(ServerClient, string) => Promise<boolean>`. Only its semantics change: it now returns true for **any** non-completed tutorial record regardless of `step`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/__tests__/tutorial-bypass.test.ts`, **replace** the two tests named `'grants bypass when user is on a valid tutorial step and not yet completed'` and `'denies bypass for an unknown step value (defensive against client spoofing)'` with these four:

```typescript
  it('grants bypass on any non-completed step — no dependency on the client write landing', async () => {
    // Regression: goToStep fire-and-forgets the preferences PUT, so the step
    // recorded server-side lags the UI. Gating on step value raced that write
    // and silently charged fast users.
    const tables = setupTables({
      tutorial_progress: { step: 'captions', completed: false },
    })
    const supabase = createFakeSupabase({ tables })
    expect(await isInActiveTutorial(supabase as any, 'user-1')).toBe(true)
  })

  it('grants bypass on a pre-generation step (channels), which the old step gate refused', async () => {
    const tables = setupTables({
      tutorial_progress: { step: 'channels', completed: false },
    })
    const supabase = createFakeSupabase({ tables })
    expect(await isInActiveTutorial(supabase as any, 'user-1')).toBe(true)
  })

  it('grants bypass for an unrecognised step value as long as the tutorial is not completed', async () => {
    // Step is now advisory only. Spoofing it buys nothing: the per-feature
    // lifetime lock in hasUsedTutorialBypass still caps free runs at one each.
    const tables = setupTables({
      tutorial_progress: { step: 'arbitrary-fake-step', completed: false },
    })
    const supabase = createFakeSupabase({ tables })
    expect(await isInActiveTutorial(supabase as any, 'user-1')).toBe(true)
  })

  it('still denies bypass once completed, even on a generation step', async () => {
    // The completed flag remains the hard stop.
    const tables = setupTables({
      tutorial_progress: { step: 'viral', completed: true },
    })
    const supabase = createFakeSupabase({ tables })
    expect(await isInActiveTutorial(supabase as any, 'user-1')).toBe(false)
  })
```

Leave the two existing tests (`'grants bypass when the user has no tutorial record yet (first-time onboarding)'` and `'denies bypass once tutorial is marked completed (replay protection)'`) unchanged.

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run src/lib/__tests__/tutorial-bypass.test.ts`
Expected: FAIL — the `'channels'` and `'arbitrary-fake-step'` tests return `false` but expect `true`.

- [ ] **Step 3: Remove the step gate**

In `src/lib/tutorial-bypass.ts`, delete this line near the top:

```typescript
const TUTORIAL_STEPS = new Set(['analyze', 'captions', 'hashtags', 'viral'])
```

Then replace the final comment block and return statement of `isInActiveTutorial` — the comment beginning `// Step must be one of the AI-generation tutorial steps` together with `return !tp.step || TUTORIAL_STEPS.has(tp.step)` — with:

```typescript
  // Any non-completed record counts as an active tutorial. We deliberately do
  // NOT gate on tp.step: goToStep fire-and-forgets its preferences write, so
  // the persisted step lags the UI, and gating on it raced that write — denying
  // the bypass and (before the charge-policy fix) silently billing the user.
  //
  // Step is advisory only. Spoofing it buys nothing — hasUsedTutorialBypass
  // enforces a per-feature lifetime lock, so total free exposure is unchanged
  // at one run per feature.
  return true
```

Also update the function's own doc comment: the clause claiming the recorded step "matches one of the four AI-generation tutorial steps AND the tutorial is not yet marked completed" is now false. Replace it with "or their tutorial record exists and is not yet marked completed".

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/tutorial-bypass.test.ts && npm test`
Expected: the bypass file's 6 tests pass; full suite passes.

- [ ] **Step 5: Confirm the module header is still accurate**

Read the block comment at the top of `src/lib/tutorial-bypass.ts`. It claims the gate validates "the user is genuinely in the active tutorial flow" — still true. It also says "even if a client spoofs tutorial_progress.completed=false to extend the active window, the per-feature lock still fires after the first run" — still true, and now the primary defence. Verify by reading; no edit expected.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tutorial-bypass.ts src/lib/__tests__/tutorial-bypass.test.ts
git commit -m "fix(onboarding): drop step gate from isInActiveTutorial to close write-ordering race

goToStep fire-and-forgets the preferences PUT, so the persisted step lags the
UI. Gating the bypass on step value raced that write and denied free runs to
fast users. The per-feature lifetime lock remains the real boundary, so total
free exposure is unchanged."
```

---

### Task 5: One post-authentication destination for every sign-in path

Three separate paths each independently forget onboarding:

1. **Google OAuth** — `src/app/(auth)/login/page.tsx:25-28` and `src/app/(auth)/signup/page.tsx:55-58` both pass only `redirectTo: ${origin}/auth/callback` with no `next`. Every Google user lands on `/dashboard` and never sees onboarding.
2. **Email confirmation** — `src/app/auth/callback/route.ts:16` defaults `safeNext` to `/dashboard`. Production data shows 12 of 13 users confirmed via an emailed link, and 10 of 13 have no tutorial record at all.
3. **Alpha agreement** — `src/app/accept-terms/page.tsx:71` does `searchParams?.get('next') || '/dashboard'`, so a lost `next` drops the user out of the wizard.

Patching three call sites invites a fourth regression. Add one helper and call it from the callback instead.

**Files:**
- Create: `src/lib/post-auth-destination.ts`
- Test: `src/lib/__tests__/post-auth-destination.test.ts`
- Modify: `src/app/auth/callback/route.ts`
- Modify: `src/app/accept-terms/page.tsx:71`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `export function isSafeRelativePath(next: string | null): boolean`; `export function chooseDestination(input: { explicitNext: string | null; tutorialCompleted: boolean; onboardedAt: string | null }): string`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/post-auth-destination.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { chooseDestination, isSafeRelativePath } from '@/lib/post-auth-destination'

describe('isSafeRelativePath', () => {
  it('accepts a plain relative path', () => {
    expect(isSafeRelativePath('/auth/reset-password')).toBe(true)
  })

  it('rejects null', () => {
    expect(isSafeRelativePath(null)).toBe(false)
  })

  it('rejects a protocol-relative URL (open-redirect vector)', () => {
    expect(isSafeRelativePath('//evil.example.com')).toBe(false)
  })

  it('rejects an absolute URL', () => {
    expect(isSafeRelativePath('https://evil.example.com')).toBe(false)
  })

  it('rejects an embedded scheme', () => {
    expect(isSafeRelativePath('/redirect?to=javascript://evil')).toBe(false)
  })
})

describe('chooseDestination', () => {
  it('honours an explicit safe next above everything else (password recovery must not be hijacked)', () => {
    expect(chooseDestination({
      explicitNext: '/auth/reset-password',
      tutorialCompleted: false,
      onboardedAt: null,
    })).toBe('/auth/reset-password')
  })

  it('ignores an unsafe next and falls through to the onboarding decision', () => {
    expect(chooseDestination({
      explicitNext: '//evil.example.com',
      tutorialCompleted: false,
      onboardedAt: null,
    })).toBe('/onboarding')
  })

  it('sends a brand-new user to onboarding — this is the Google OAuth and email-confirmation fix', () => {
    expect(chooseDestination({
      explicitNext: null,
      tutorialCompleted: false,
      onboardedAt: null,
    })).toBe('/onboarding')
  })

  it('sends a user who completed the tutorial to the dashboard', () => {
    expect(chooseDestination({
      explicitNext: null,
      tutorialCompleted: true,
      onboardedAt: null,
    })).toBe('/dashboard')
  })

  it('sends a pre-tutorial alpha tester with onboarded_at to the dashboard, not back through the wizard', () => {
    expect(chooseDestination({
      explicitNext: null,
      tutorialCompleted: false,
      onboardedAt: '2026-04-19T00:00:00.000Z',
    })).toBe('/dashboard')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/post-auth-destination.test.ts`
Expected: FAIL with `Failed to resolve import "@/lib/post-auth-destination"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/post-auth-destination.ts`:

```typescript
/**
 * Single source of truth for where a freshly authenticated user should land.
 *
 * Why this exists: three sign-in paths each independently defaulted to
 * /dashboard and so skipped onboarding — Google OAuth (no `next` passed at
 * either call site), email confirmation (callback default), and the alpha
 * agreement hop. Production data showed 10 of 13 users never obtained a
 * tutorial record at all. Centralising the decision means a future fourth
 * path cannot quietly regress it.
 */

/**
 * True when `next` is a safe same-origin relative path. Mirrors the guard
 * previously inlined in the auth callback: reject protocol-relative URLs and
 * anything carrying a scheme, either of which would be an open redirect.
 */
export function isSafeRelativePath(next: string | null): boolean {
  if (!next) return false
  if (!next.startsWith('/')) return false
  if (next.startsWith('//')) return false
  if (next.includes('://')) return false
  return true
}

export function chooseDestination(input: {
  /** A `next` query param, if any. Honoured first when safe. */
  explicitNext: string | null
  /** preferences.tutorial_progress.completed === true */
  tutorialCompleted: boolean
  /** preferences.onboarded_at, or null. */
  onboardedAt: string | null
}): string {
  // An explicit safe next wins — password recovery relies on this.
  if (isSafeRelativePath(input.explicitNext)) return input.explicitNext as string

  // Users who finished the wizard, or pre-tutorial testers already marked
  // onboarded, must not be sent back through it.
  if (input.tutorialCompleted || input.onboardedAt) return '/dashboard'

  return '/onboarding'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/post-auth-destination.test.ts`
Expected: PASS — 10 tests.

- [ ] **Step 5: Wire the auth callback to the helper**

Replace the entire contents of `src/app/auth/callback/route.ts` with:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { chooseDestination } from '@/lib/post-auth-destination'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Decide onboarding-vs-dashboard here rather than defaulting to
      // /dashboard. Google OAuth passes no `next` from either call site, and
      // the email-confirmation link doesn't either, so the old default skipped
      // onboarding for every user arriving by those routes.
      let tutorialCompleted = false
      let onboardedAt: string | null = null

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('preferences')
          .eq('id', user.id)
          .maybeSingle()
        const prefs = (profile?.preferences ?? {}) as {
          tutorial_progress?: { completed?: boolean }
          onboarded_at?: string | null
        }
        tutorialCompleted = prefs.tutorial_progress?.completed === true
        onboardedAt = prefs.onboarded_at ?? null
      }

      const destination = chooseDestination({ explicitNext: next, tutorialCompleted, onboardedAt })
      return NextResponse.redirect(`${origin}${destination}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`)
}
```

- [ ] **Step 6: Stop accept-terms defaulting out of onboarding**

In `src/app/accept-terms/page.tsx`, line 71 currently reads:

```typescript
      const next = searchParams?.get('next') || '/dashboard'
```

Replace it with:

```typescript
      // Default to /onboarding, not /dashboard: this page is reached from the
      // onboarding layout's requireAlphaAcceptance gate, so a lost `next`
      // previously dropped brand-new users straight past the wizard.
      // /onboarding itself redirects already-completed users onward, so this
      // stays safe for a returning user who somehow lands here.
      const next = searchParams?.get('next') || '/onboarding'
```

- [ ] **Step 7: Verify the full suite and types**

Run: `npm run typecheck && npm test`
Expected: typecheck exits 0. Test count: **122** — 105 original, +5 (Task 1), +2 net (Task 4 swaps 2 tests for 4, taking `tutorial-bypass.test.ts` from 4 to 6), +10 (Task 5).

- [ ] **Step 8: Manually verify the three redirect paths tests cannot cover**

Run `npm run dev`, then:

1. **New email signup** — sign up with a fresh address. Expected: you land on `/onboarding` (via `/accept-terms` first if you have not accepted). Confirm you are **not** dropped on `/dashboard`.
2. **Password recovery is not hijacked** — trigger a password reset and click the emailed link. Expected: `/auth/reset-password`, *not* `/onboarding`.

   ⚠️ **Correction (2026-08-18, found in Task 5 review):** this check will pass, but *not* for the reason originally written here. This plan claimed the reset link carries `next=/auth/reset-password` through `/auth/callback`. It does not. Both recovery senders — `src/app/(auth)/forgot-password/actions.ts:19` and `src/app/api/admin/users/[id]/reset-password/route.ts:46` — point the email **directly** at `/auth/reset-password`, bypassing the callback entirely; the admin route documents why ("Routing through /auth/callback doesn't work for recovery because of query-string mangling — our `?next=` and Supabase's `?code=` don't combine cleanly"). So a passing check here is evidence that **recovery bypasses the callback**, not evidence that `chooseDestination` honours `explicitNext`. That branch is correct and worth keeping as defence-in-depth, but it has no live producer today. Record the result accordingly.
3. **Returning completed user** — log in as a user whose `tutorial_progress.completed` is true. Expected: `/dashboard`, with no bounce through the wizard.

- [ ] **Step 9: Commit**

```bash
git add src/lib/post-auth-destination.ts src/lib/__tests__/post-auth-destination.test.ts src/app/auth/callback/route.ts src/app/accept-terms/page.tsx
git commit -m "fix(auth): route new users to onboarding from every sign-in path

Google OAuth passed no next from either call site, the email-confirmation link
relied on the callback default, and accept-terms defaulted to /dashboard — so
all three skipped onboarding. Production data showed 10 of 13 users never
obtained a tutorial record. Centralised in chooseDestination so a fourth path
cannot regress it. An explicit safe next still wins, keeping password recovery
intact."
```

---

## Out of scope, tracked

From the audit and council review, deliberately **not** in this plan:

- **First-session redesign (the 3-5 quick wins).** ✅ **Decision made 2026-08-18: REPLACE**, siding with the Auditor and Visionary over the Architect. Ship a 3-stage flow — ask niche/platform → generate one coherent creator pack → let the user save/copy it — with channels and voice as optional follow-ons rather than gates. Rationale: a reordered 7-step tour is still a tour, and captions never required a connected channel. Needs its own plan; the Architect's dissent (the existing persistence/resume/bypass/upsell plumbing is solid and recent, so replacement risks discarding working code) should be honoured by reusing those components inside the new flow rather than rewriting them.
- **Onboarding return path** — middleware gate vs persistent dashboard resume card. Three-way disagreement; it couples to skip-as-snooze state and would redirect-loop if shipped naively. Belongs with the redesign.
- **The first output is paywalled.** `TutorialSteps.tsx:369,375,382` put three `LockedSection` "Unlock with Creator — $19/mo" blocks in the Channel Analysis step, which is the user's first artifact. A product decision, not a bug.
- **Google-on-login may mint accounts outside the invite gate.** `src/app/auth/callback/route.ts` never checks `signup_mode` or invite validity, and the Google button on `/login` is not hidden in invite mode. This is an access-control concern rather than onboarding UX, and warrants its own security review.
- **No re-engagement loop.** No email or notification code exists for dropouts.
- **Copy drift.** The welcome screen promises "5 most useful tools in your first 5 minutes"; the real flow is 8 steps with two 30-60s AI waits.
- **Three competing checklists.** Wizard (7) + GettingStartedCard (5) + NextToolsCard (10) = 22 items on a first session.
- **Accessibility and mobile in the wizard.** `StepIndicator` is nested divs with no `nav`/`ol` semantics or `aria-current`; step labels are `hidden md:inline`, so phone users see bare numbers.
- **Verify the production email-confirmation setting directly.** Our evidence is timing inference from `auth.users`, not a read of the Auth config. Still owed: Supabase dashboard → Authentication → Sign In / Providers.

## Self-Review

**Spec coverage.** Confirmed defects map to tasks: silent charge on a spent tutorial run → Tasks 1-2 (all four routes). Unprompted auto-run → Task 3. Write-ordering race, plus the welcome/channels/save gap → Task 4. Google OAuth, email confirmation and accept-terms bypasses → Task 5. The audit's F4 and F6 and the return-path question are explicitly deferred above with reasons rather than silently dropped.

**Placeholder scan.** No TBDs. Every code step carries literal code. Task 2 Step 3 uses a difference table rather than repeating a near-identical block four times — it gives each route's exact feature key, route string and message, and names the one trap (route string vs generations key differ), so nothing is left to guess.

**Type consistency.** `decideTutorialCharge` / `TutorialChargeDecision` / `TUTORIAL_RUN_SPENT_CODE` defined in Task 1 are used under the same names in Task 2. `chooseDestination` / `isSafeRelativePath` defined in Task 5 Step 3 match their Step 1 test imports and their Step 5 usage. `isInActiveTutorial` keeps its exact signature in Task 4; only semantics change, which its Interfaces block states.

**One risk flagged for the executor.** Task 5 Step 5 adds a `profiles` read to the auth callback. It runs once per sign-in rather than per dashboard request, so the cost is negligible. If `preferences` is null because the `handle_new_user` trigger has not yet created the row, `chooseDestination` receives `false`/`null` and correctly routes to `/onboarding` — the desired outcome, so no extra guard is needed.
