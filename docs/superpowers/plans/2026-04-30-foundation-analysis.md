# Foundation Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a new Elite-tier feature called Foundation Analysis that produces an evidence-grounded creator audit and saves a structured Creator Profile that downstream tools (Captions, Viral Ideas, Bio Optimizer) read on every generation. Drop the Team tier from pricing in the same body of work.

**Architecture:** New API route + Next.js page following the Channel Analysis pattern (Opus + refine, parseLooseJson, persistence to `generations`). New `creator_profiles` table with one row per user, upserted on each run. Phase 2 wires three existing tools to inject a "Creator Context" prompt block when a profile exists.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres + auth), Anthropic Opus / OpenAI gpt-4o-mini via the existing `crispGenerate` engine, Tailwind, vitest for unit tests.

**Spec:** `docs/superpowers/specs/2026-04-30-foundation-analysis-design.md`

**File Structure:**

| File | Purpose | Phase |
|---|---|---|
| `src/lib/supabase-schema.sql` | Append `creator_profiles` table, `profiles.use_foundation_in_generations`, `profiles.foundation_cta_dismissed_at`, drop `'team'` from CHECK | 1 |
| `src/lib/crisp-engine-config.ts` | Add `foundation-analysis` task; remove `'team'` from `Tier` union and helpers | 1 |
| `src/lib/feature-access-config.ts` | Add `DEFAULT_MIN_TIER['foundation-analysis'] = 'elite'` | 1 |
| `src/lib/tools-meta.ts` | Register Foundation Analysis under OPTIMIZE_TOOLS | 1 |
| `src/lib/creator-profile.ts` (new) | `getCreatorProfile`, `upsertCreatorProfile` helpers | 1 |
| `src/lib/__tests__/creator-profile.test.ts` (new) | Unit tests for the helper | 1 |
| `src/lib/voice-profile.ts` | Strip `'team'` from tier union | 1 |
| `src/hooks/useSubscription.ts` | Strip `'team'` | 1 |
| `src/components/ui/EngineBadge.tsx` | Remove `team` colour variant | 1 |
| `src/components/ui/FeatureGate.tsx` | Add optional `previewSnapshotUrl?: string` prop | 1 |
| `src/lib/stripe.ts` | Remove `team_monthly` / `team_yearly` price entries | 1 |
| `src/app/api/stripe/checkout/route.ts` | Strip `'team'` from valid tiers | 1 |
| `src/app/api/admin/feature-access/route.ts` | Strip from `VALID_TIERS` | 1 |
| `src/app/api/admin/users/[id]/route.ts` | Strip from `VALID_TIERS` | 1 |
| `src/app/admin/users/page.tsx` and `[id]/page.tsx` | Remove `<option value="team">` | 1 |
| `src/app/admin/feature-access/page.tsx` | Remove from `TIER_OPTIONS` | 1 |
| `src/app/dashboard/billing/page.tsx` | Remove Team `PricingCard`; rebalance grid; strip Team from styling | 1 |
| `src/app/page.tsx` | Remove Team `PricingCard`; rebalance grid; rewrite FAQ | 1 |
| `README.md` | Sweep Team mentions | 1 |
| `src/app/api/foundation-analysis/route.ts` (new) | POST handler | 1 |
| `src/app/api/foundation-analysis/__tests__/prompt.test.ts` (new) | Prompt construction tests | 1 |
| `src/app/dashboard/foundation-analysis/page.tsx` (new) | Form + result UI | 1 |
| `src/app/dashboard/page.tsx` | Render Elite-only Foundation CTA card when profile is null | 1 |
| `src/app/api/user/dismiss-foundation-cta/route.ts` (new) | POST endpoint to set `foundation_cta_dismissed_at` | 1 |
| `public/foundation-analysis-preview.png` (new) | Static preview screenshot for paywall | 1 |
| `src/app/dashboard/settings/page.tsx` | Add Profile section: view + edit + opt-out toggle | 2 |
| `src/app/api/user/creator-profile/route.ts` (new) | PATCH endpoint for manual profile edits and toggle | 2 |
| `src/app/api/generate/route.ts` (Captions) | Inject Creator Context block when profile + toggle present | 2 |
| `src/app/api/viral-ideas/route.ts` | Same | 2 |
| `src/app/api/bio-optimizer/route.ts` | Same | 2 |
| `src/lib/creator-context-block.ts` (new) | Pure function that formats a profile into the prompt block | 2 |
| `src/lib/__tests__/creator-context-block.test.ts` (new) | Tests for the formatter | 2 |

---

## Task 1: DB schema additions + Team tier CHECK update

**Files:**
- Modify: `src/lib/supabase-schema.sql`

The schema file is re-runnable (`CREATE TABLE IF NOT EXISTS`). Append new objects at the bottom. The user applies it manually via the Supabase SQL editor.

- [ ] **Step 1: Append `creator_profiles` table to the schema**

Add to the end of `src/lib/supabase-schema.sql`:

```sql
-- creator_profiles — single row per user; upserted by Foundation Analysis runs.
-- Read by downstream tools (Captions, Viral Ideas, Bio Optimizer in Phase 2)
-- as a "Creator Context" prompt block.
CREATE TABLE IF NOT EXISTS public.creator_profiles (
  user_id               UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  content_pillars       JSONB NOT NULL,                    -- string[]
  voice_signature       JSONB NOT NULL,                    -- { adjectives: string[], examplePhrasing: string }
  audience_persona      JSONB NOT NULL,                    -- { description: string, sophistication: 'beginner'|'intermediate'|'advanced' }
  growth_stage          TEXT NOT NULL CHECK (growth_stage IN ('pre-traction', 'early-traction', 'scaling', 'established')),
  monetization_position JSONB NOT NULL,                    -- { stage: string, primaryStreams: string[] }
  format_strengths      JSONB NOT NULL,                    -- string[]
  differentiators       JSONB NOT NULL,                    -- string[]
  top_blockers          JSONB NOT NULL,                    -- string[]
  source_analysis_id    UUID REFERENCES public.generations(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creator_profiles_updated_at_idx ON public.creator_profiles(updated_at DESC);
```

- [ ] **Step 2: Append two columns to `profiles` for the toggle and CTA dismiss**

Add to the end of `src/lib/supabase-schema.sql`:

```sql
-- Foundation Analysis integration on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS use_foundation_in_generations BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS foundation_cta_dismissed_at TIMESTAMPTZ;
```

- [ ] **Step 3: Drop `'team'` from the `subscription_tier` CHECK constraint**

The CHECK constraint at line 14–15 of `src/lib/supabase-schema.sql` currently allows `'team'`. Replace the existing `CREATE TABLE IF NOT EXISTS public.profiles (...)` block: change

```sql
subscription_tier          TEXT NOT NULL DEFAULT 'free'
                             CHECK (subscription_tier IN ('free', 'creator', 'team', 'elite')),
```

to

```sql
subscription_tier          TEXT NOT NULL DEFAULT 'free'
                             CHECK (subscription_tier IN ('free', 'creator', 'elite')),
```

Then append a separate ALTER statement at the bottom of the file so existing deployments get the constraint updated:

```sql
-- Drop Team tier from subscription_tier CHECK (no Team subscribers exist).
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;
ALTER TABLE public.profiles
  ADD  CONSTRAINT profiles_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'creator', 'elite'));
```

- [ ] **Step 4: Apply the schema in Supabase**

Run the entire `src/lib/supabase-schema.sql` in the Supabase SQL editor. Confirm:
- `\d creator_profiles` shows the new table
- `\d profiles` shows the new columns and updated CHECK

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase-schema.sql
git commit -m "feat(db): add creator_profiles table and drop team tier from CHECK"
```

---

## Task 2: Drop Team tier from types and core configs

**Files:**
- Modify: `src/lib/crisp-engine-config.ts`
- Modify: `src/lib/voice-profile.ts:108`
- Modify: `src/hooks/useSubscription.ts:28`, `:53`
- Modify: `src/components/ui/EngineBadge.tsx:46`

- [ ] **Step 1: Remove `'team'` from `Tier` union and helpers in `crisp-engine-config.ts`**

In `src/lib/crisp-engine-config.ts`:

Replace line 18:
```ts
export type Tier = 'starter' | 'creator' | 'team' | 'elite'
```
with:
```ts
export type Tier = 'starter' | 'creator' | 'elite'
```

Remove the `team` line from `TIER_LABELS` (around line 28) and `TIER_BADGE_LABEL` (around line 41). Both objects keep only starter/creator/elite.

Remove the `effectiveTier` function entirely (lines 33–35) — no more aliasing needed. Find call sites with:

```bash
grep -rn "effectiveTier" src/
```
Replace each call with the raw tier value.

In `tierFromDbValue` (around line 47–58), remove the `case 'team': return 'team'` line. The function should otherwise keep all other cases untouched.

In `TIER_ALLOWANCE` (around line 224–229), delete the `team:` entry entirely so the object has only starter / creator / elite.

- [ ] **Step 2: Remove `'team'` from `voice-profile.ts`**

In `src/lib/voice-profile.ts:108`, change:
```ts
tier: 'starter' | 'creator' | 'team' | 'elite'
```
to:
```ts
tier: 'starter' | 'creator' | 'elite'
```

- [ ] **Step 3: Remove `'team'` from `useSubscription.ts`**

In `src/hooks/useSubscription.ts`:

Line 28 — change
```ts
const upgrade = async (target: 'creator' | 'team' | 'elite', cycle: 'monthly' | 'yearly') => {
```
to
```ts
const upgrade = async (target: 'creator' | 'elite', cycle: 'monthly' | 'yearly') => {
```

Line 53 — delete the `isTeam: tier === 'team',` line entirely.

- [ ] **Step 4: Remove team color variant from `EngineBadge.tsx`**

In `src/components/ui/EngineBadge.tsx:46`, delete the line:
```ts
tier === 'team'    ? 'bg-brand-500/10 border-brand-500/25 text-brand-300' :
```

- [ ] **Step 5: Type-check**

Run:
```bash
npm run typecheck 2>&1 | tail -40
```
or if the package script doesn't exist:
```bash
npx tsc --noEmit
```
Expected: clean run. Any references to `Tier` that still mention `'team'` will surface here. Fix any leftovers.

- [ ] **Step 6: Run unit tests**

```bash
npm test
```
Expected: all existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/crisp-engine-config.ts src/lib/voice-profile.ts src/hooks/useSubscription.ts src/components/ui/EngineBadge.tsx
git commit -m "refactor: drop team tier from core types and configs"
```

---

## Task 3: Drop Team tier from billing, Stripe, and admin paths

**Files:**
- Modify: `src/app/dashboard/billing/page.tsx:10`, `:81`, `:135`, `:205-211`
- Modify: `src/lib/stripe.ts`
- Modify: `src/app/api/stripe/checkout/route.ts:26`
- Modify: `src/app/api/admin/feature-access/route.ts:6`
- Modify: `src/app/api/admin/users/[id]/route.ts:6`
- Modify: `src/app/admin/users/page.tsx:113`
- Modify: `src/app/admin/users/[id]/page.tsx:261`
- Modify: `src/app/admin/feature-access/page.tsx:16`

- [ ] **Step 1: Strip Team from `dashboard/billing/page.tsx`**

In `src/app/dashboard/billing/page.tsx`:

Line 10 — change
```ts
type PaidTier = 'creator' | 'team' | 'elite'
```
to
```ts
type PaidTier = 'creator' | 'elite'
```

Line 81 — delete the `team` arm:
```ts
if (target === 'team')    return !!(billing === 'monthly' ? PRICES.team_monthly    : PRICES.team_yearly)
```

Line 135 — delete the `team` gradient line:
```ts
tier === 'team'    ? 'from-sky-500 to-sky-700' :
```

Lines 205–211 — delete the entire `<PricingCard planKey="team" ... />` block.

- [ ] **Step 2: Remove team prices from `stripe.ts`**

Open `src/lib/stripe.ts` and delete the `team_monthly` and `team_yearly` entries from the `PRICES` object. Match-and-delete; the surrounding object literal stays.

- [ ] **Step 3: Strip team from API VALID_TIERS**

In `src/app/api/stripe/checkout/route.ts:26`, change:
```ts
if (tier !== 'creator' && tier !== 'team' && tier !== 'elite') {
```
to
```ts
if (tier !== 'creator' && tier !== 'elite') {
```

In `src/app/api/admin/feature-access/route.ts:6`, change:
```ts
const VALID_TIERS: Tier[] = ['starter', 'creator', 'team', 'elite']
```
to
```ts
const VALID_TIERS: Tier[] = ['starter', 'creator', 'elite']
```

In `src/app/api/admin/users/[id]/route.ts:6`, change:
```ts
const VALID_TIERS = new Set(['free', 'creator', 'team', 'elite'])
```
to
```ts
const VALID_TIERS = new Set(['free', 'creator', 'elite'])
```

- [ ] **Step 4: Strip team from admin UI**

In `src/app/admin/users/page.tsx:113`, delete the line:
```tsx
<option value="team">Team</option>
```

In `src/app/admin/users/[id]/page.tsx:261`, delete the line:
```tsx
<option value="team">Team</option>
```

In `src/app/admin/feature-access/page.tsx:16`, change:
```ts
const TIER_OPTIONS: Tier[] = ["starter", "creator", "team", "elite"];
```
to
```ts
const TIER_OPTIONS: Tier[] = ["starter", "creator", "elite"];
```

- [ ] **Step 5: Type-check + smoke**

Run:
```bash
npx tsc --noEmit
npm run dev
```
In the dev server, open `/dashboard/billing` and `/admin/users` and confirm:
- Billing page shows only Starter / Creator / Elite cards (3, not 4)
- Admin user editor tier dropdown has 3 options

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/billing/page.tsx src/lib/stripe.ts \
        src/app/api/stripe src/app/api/admin \
        src/app/admin
git commit -m "refactor: drop team tier from billing, stripe, and admin paths"
```

---

## Task 4: Drop Team tier from marketing site and README

**Files:**
- Modify: `src/app/page.tsx:108`, `:111-112`, `:343-352`, `:320` (grid breakpoint)
- Modify: `README.md`

- [ ] **Step 1: Update FAQ entries on the landing page**

In `src/app/page.tsx`:

Line 108 — change the FAQ answer (current text mentions credit cycles for "Creator / Team / Elite"):

Find:
```
Your allowance refreshes daily (Starter) or monthly (Creator / Team / Elite).
```
Replace with:
```
Your allowance refreshes daily (Starter) or monthly (Creator / Elite).
```

Lines 111–112 — change the FAQ question and answer. Find:
```ts
q: "What's the difference between Creator, Team, and Elite?",
a: "Creator ($19/mo) gives you 500 credits/month with PostCrisp Engine Pro quality AI. Team ($49/mo) is Creator with 5 seats for agencies. Elite ($79/mo) uses PostCrisp Engine Elite — our highest-tier AI — across every feature, plus 2,000 credits/month. Try Creator first; upgrade to Elite when you feel a quality ceiling.",
```
Replace with:
```ts
q: "What's the difference between Creator and Elite?",
a: "Creator ($19/mo) gives you 500 credits/month with PostCrisp Engine Pro quality AI. Elite ($79/mo) uses PostCrisp Engine Elite — our highest-tier AI — across every feature, plus 2,000 credits/month and Foundation Analysis: a reusable Creator Profile that powers every other tool with your voice, pillars, and audience. Try Creator first; upgrade to Elite when you feel a quality ceiling or want the foundation profile.",
```

- [ ] **Step 2: Remove Team pricing card and rebalance the grid**

In `src/app/page.tsx`:

At line 321 — change the grid class so the remaining 3 cards balance cleanly. Find:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
```
Replace with:
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
```

Lines 343–352 — delete the entire `{/* Team */} <PricingCard name="Team" ... />` block.

- [ ] **Step 3: Add Foundation Analysis to the Elite card features**

Find the line that builds the Elite features list and add Foundation Analysis as the lead bullet. Locate:

```bash
grep -n "PLANS.elite.features" src/app/page.tsx
```

The features list is defined in `src/lib/plans.ts` (or similar). Open the file referenced by the import in `src/app/page.tsx` (search for `PLANS` import at the top of `page.tsx`). Add to the start of the Elite features array:

```ts
"🧬 Foundation Analysis — your reusable Creator Profile that powers every other tool",
```

If the PLANS object also has a `team` entry, remove it.

- [ ] **Step 4: Sweep README.md**

```bash
grep -n "team\|Team" README.md
```
For each match, decide: if it's about the Team tier, drop it; if it's unrelated (e.g., "the team built X"), leave it.

- [ ] **Step 5: Smoke**

Run:
```bash
npm run dev
```
Open `/` and confirm:
- Pricing section shows 3 cards (Starter / Creator / Elite), no Team
- FAQ has 3-tier wording
- Elite card lists Foundation Analysis as its first or second feature bullet

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/lib/plans.ts README.md
git commit -m "refactor(marketing): drop team tier from landing, FAQ, and pricing"
```

---

## Task 5: Register Foundation Analysis in engine, feature-access, and tools-meta

**Files:**
- Modify: `src/lib/crisp-engine-config.ts`
- Modify: `src/lib/feature-access-config.ts`
- Modify: `src/lib/tools-meta.ts`

- [ ] **Step 1: Add `foundation-analysis` to the `CrispTask` union and routing tables**

In `src/lib/crisp-engine-config.ts`:

In the `CrispTask` union (around line 60–91), add a new line at the bottom of the "Self-analysis" group:
```ts
  // Self-analysis
  | 'channel-analysis'
  | 'foundation-analysis'   // NEW — Elite-only foundational audit + saved profile
```

In `TASK_TIER_PROFILE` (line 116+), add a new entry adjacent to channel-analysis:
```ts
  'foundation-analysis':  { starter: 'PREMIUM', creator: 'PREMIUM', elite: 'PREMIUM' },
```

In `TASK_LABELS` (line 156+), add:
```ts
  'foundation-analysis': 'Foundation Analysis',
```

In `CREDITS_PER_TASK` (line 190+), add at the end of the PREMIUM block:
```ts
  'foundation-analysis':  8,
```

- [ ] **Step 2: Set the default min tier to Elite**

In `src/lib/feature-access-config.ts`, in the `DEFAULT_MIN_TIER` object, add at the end of the Self-analysis block (around line 40):
```ts
  // Foundation Analysis — Elite-only by default
  'foundation-analysis': 'elite',
```

- [ ] **Step 3: Register Foundation Analysis in `tools-meta.ts`**

In `src/lib/tools-meta.ts`, append a new tool to the `OPTIMIZE_TOOLS` array (after the existing `channel_analysis` entry around line 138–146):
```ts
  {
    key: 'foundation_analysis',
    category: 'optimize',
    icon: '🧬',
    label: 'Foundation Analysis',
    tagline: 'Evidence-grounded audit + reusable Creator Profile.',
    bestFor: 'The strategic foundation every other tool reads from.',
    href: '/dashboard/foundation-analysis',
  },
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: clean run.

- [ ] **Step 5: Run tests**

```bash
npm test
```
Expected: all existing tests pass. The credits test references hard-coded values like `creditCostFor('channel-analysis')` — those keep working.

- [ ] **Step 6: Commit**

```bash
git add src/lib/crisp-engine-config.ts src/lib/feature-access-config.ts src/lib/tools-meta.ts
git commit -m "feat(engine): register foundation-analysis task (elite, 8 credits, premium tier)"
```

---

## Task 6: `creator-profile.ts` helper with TDD

**Files:**
- Create: `src/lib/creator-profile.ts`
- Create: `src/lib/__tests__/creator-profile.test.ts`

- [ ] **Step 1: Add `creator_profiles` to the `FakeSupabaseTables` shape**

In `src/lib/__tests__/fake-supabase.ts`, extend the `FakeSupabaseTables` interface (around line 12):

```ts
export interface FakeSupabaseTables {
  profiles: Map<string, Record<string, unknown>>
  credit_transactions: Record<string, unknown>[]
  generations: Record<string, unknown>[]
  creator_profiles: Map<string, Record<string, unknown>>   // NEW
}
```

Verify the existing `fromBuilder` helper handles `Map`-typed tables correctly (it already handles `profiles` which is a Map). If `fromBuilder` short-circuits on certain table names, extend it; otherwise the new entry should work as-is.

- [ ] **Step 2: Write failing test for `getCreatorProfile` returning null when no row**

Create `src/lib/__tests__/creator-profile.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getCreatorProfile, upsertCreatorProfile } from '@/lib/creator-profile'
import { createFakeSupabase, type FakeSupabaseTables } from './fake-supabase'

function emptyTables(): FakeSupabaseTables {
  return {
    profiles: new Map(),
    credit_transactions: [],
    generations: [],
    creator_profiles: new Map(),
  }
}

describe('getCreatorProfile', () => {
  it('returns null when the user has no profile row', async () => {
    const tables = emptyTables()
    const supabase = createFakeSupabase({ tables })
    const profile = await getCreatorProfile(supabase as any, 'user-1')
    expect(profile).toBeNull()
  })
})
```

- [ ] **Step 3: Run failing test**

```bash
npx vitest run src/lib/__tests__/creator-profile.test.ts
```
Expected: FAIL — module `@/lib/creator-profile` not found.

- [ ] **Step 4: Create the helper with the minimal shape to make the test pass**

Create `src/lib/creator-profile.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export interface CreatorProfile {
  user_id: string
  content_pillars: string[]
  voice_signature: { adjectives: string[]; examplePhrasing: string }
  audience_persona: { description: string; sophistication: 'beginner' | 'intermediate' | 'advanced' }
  growth_stage: 'pre-traction' | 'early-traction' | 'scaling' | 'established'
  monetization_position: { stage: string; primaryStreams: string[] }
  format_strengths: string[]
  differentiators: string[]
  top_blockers: string[]
  source_analysis_id: string | null
  created_at: string
  updated_at: string
}

export async function getCreatorProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<CreatorProfile | null> {
  const { data, error } = await supabase
    .from('creator_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.error('[creator-profile] getCreatorProfile failed:', error)
    return null
  }
  return (data as CreatorProfile) ?? null
}

export interface CreatorProfileInput {
  content_pillars: string[]
  voice_signature: { adjectives: string[]; examplePhrasing: string }
  audience_persona: { description: string; sophistication: 'beginner' | 'intermediate' | 'advanced' }
  growth_stage: 'pre-traction' | 'early-traction' | 'scaling' | 'established'
  monetization_position: { stage: string; primaryStreams: string[] }
  format_strengths: string[]
  differentiators: string[]
  top_blockers: string[]
}

export async function upsertCreatorProfile(
  supabase: SupabaseClient,
  userId: string,
  profile: CreatorProfileInput,
  sourceAnalysisId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from('creator_profiles').upsert({
    user_id: userId,
    ...profile,
    source_analysis_id: sourceAnalysisId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) {
    console.error('[creator-profile] upsertCreatorProfile failed:', error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
```

- [ ] **Step 5: Run the test — should pass now**

```bash
npx vitest run src/lib/__tests__/creator-profile.test.ts
```
Expected: PASS.

- [ ] **Step 6: Add a test for `getCreatorProfile` returning a saved row**

Append to `src/lib/__tests__/creator-profile.test.ts`:

```ts
describe('getCreatorProfile (existing row)', () => {
  it('returns the row when one exists for the user', async () => {
    const tables = emptyTables()
    tables.creator_profiles.set('user-1', {
      user_id: 'user-1',
      content_pillars: ['AI tools', 'founder workflow'],
      voice_signature: { adjectives: ['plainspoken'], examplePhrasing: 'ship it ugly' },
      audience_persona: { description: 'indie hackers', sophistication: 'intermediate' },
      growth_stage: 'early-traction',
      monetization_position: { stage: 'digital-products', primaryStreams: ['course'] },
      format_strengths: ['carousels'],
      differentiators: ['builds in public'],
      top_blockers: ['hook fatigue'],
      source_analysis_id: 'gen-abc',
      created_at: '2026-04-30T00:00:00Z',
      updated_at: '2026-04-30T00:00:00Z',
    })
    const supabase = createFakeSupabase({ tables })
    const profile = await getCreatorProfile(supabase as any, 'user-1')
    expect(profile).not.toBeNull()
    expect(profile?.content_pillars).toEqual(['AI tools', 'founder workflow'])
    expect(profile?.growth_stage).toBe('early-traction')
  })
})
```

- [ ] **Step 7: Run tests — both should pass**

```bash
npx vitest run src/lib/__tests__/creator-profile.test.ts
```
Expected: 2 tests pass.

- [ ] **Step 8: Add a test for `upsertCreatorProfile`**

Append:

```ts
describe('upsertCreatorProfile', () => {
  it('writes the profile row with source_analysis_id and updated_at', async () => {
    const tables = emptyTables()
    const supabase = createFakeSupabase({ tables })
    const result = await upsertCreatorProfile(supabase as any, 'user-1', {
      content_pillars: ['p1', 'p2'],
      voice_signature: { adjectives: ['dry'], examplePhrasing: 'just ship' },
      audience_persona: { description: 'devs', sophistication: 'advanced' },
      growth_stage: 'scaling',
      monetization_position: { stage: 'services', primaryStreams: ['consulting'] },
      format_strengths: ['threads'],
      differentiators: ['anti-hype'],
      top_blockers: ['burnout'],
    }, 'gen-xyz')
    expect(result).toEqual({ ok: true })
    const row = tables.creator_profiles.get('user-1') as Record<string, unknown>
    expect(row).toBeDefined()
    expect(row.source_analysis_id).toBe('gen-xyz')
    expect(row.growth_stage).toBe('scaling')
    expect(typeof row.updated_at).toBe('string')
  })
})
```

- [ ] **Step 9: Run tests; if upsert behavior in fake-supabase needs an extension, add it**

```bash
npx vitest run src/lib/__tests__/creator-profile.test.ts
```
If the fake doesn't yet implement `.upsert()` for Map-backed tables, extend `fake-supabase.ts` to support it: when called on a Map-backed table with a row containing the table's primary key (`user_id`), write the row to the Map. Mirror the existing `from()` builder pattern.

- [ ] **Step 10: Commit**

```bash
git add src/lib/creator-profile.ts src/lib/__tests__/creator-profile.test.ts src/lib/__tests__/fake-supabase.ts
git commit -m "feat(creator-profile): add getCreatorProfile + upsertCreatorProfile helpers"
```

---

## Task 7: `/api/foundation-analysis` route

**Files:**
- Create: `src/app/api/foundation-analysis/route.ts`
- Create: `src/app/api/foundation-analysis/__tests__/prompt.test.ts`

- [ ] **Step 1: Write a failing test for prompt construction**

Create `src/app/api/foundation-analysis/__tests__/prompt.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildFoundationPrompt, type FoundationInput } from '@/app/api/foundation-analysis/prompt'

const baseInput: FoundationInput = {
  platform: 'instagram',
  niche: 'AI productivity for solopreneurs',
  followerCount: '12K',
  postingCadence: '4-5x / week',
  contentPillars: ['AI tool reviews', 'founder workflow', 'behind the build'],
  targetAudience: { description: 'indie hackers shipping their first SaaS', sophistication: 'intermediate' },
  growthGoal: 'engagement',
  monetizationStage: 'digital-products',
  formatStrengths: ['Carousels', 'Short-form video'],
  currentChallenges: 'Reach stalled after 10K. Reels feel forced.',
  analyzeHandle: '@iambigd',
  samplePosts: [
    { caption: 'Top 3 AI tools I run my business on (a thread)', metric: '48K saves, 220K reach', whyItWorked: "Curiosity hook + 'thread' format" },
    { caption: 'How I went from idea to $10K MRR in 60 days', metric: '12K likes', whyItWorked: 'Specific outcome' },
    { caption: 'I was wrong about Notion. Here\'s what changed.', metric: '8K likes' },
  ],
}

describe('buildFoundationPrompt', () => {
  it('includes the platform, niche, content pillars, and audience persona', () => {
    const prompt = buildFoundationPrompt(baseInput)
    expect(prompt).toContain('instagram')
    expect(prompt).toContain('AI productivity for solopreneurs')
    expect(prompt).toContain('AI tool reviews')
    expect(prompt).toContain('founder workflow')
    expect(prompt).toContain('indie hackers shipping their first SaaS')
    expect(prompt).toContain('intermediate')
  })

  it('includes the goal and monetization stage', () => {
    const prompt = buildFoundationPrompt(baseInput)
    expect(prompt).toContain('engagement')
    expect(prompt).toContain('digital-products')
  })

  it('includes each provided sample post with its metric and theory', () => {
    const prompt = buildFoundationPrompt(baseInput)
    expect(prompt).toContain('Top 3 AI tools')
    expect(prompt).toContain('48K saves, 220K reach')
    expect(prompt).toContain("Curiosity hook + 'thread' format")
    expect(prompt).toContain('How I went from idea to $10K MRR')
    expect(prompt).toContain('I was wrong about Notion')
  })

  it('omits a sample-post slot when its caption is empty', () => {
    const trimmed = { ...baseInput, samplePosts: [baseInput.samplePosts[0]] }
    const prompt = buildFoundationPrompt(trimmed)
    expect(prompt).toContain('Top 3 AI tools')
    expect(prompt).not.toContain('How I went from idea')
  })

  it('asks for the structured Creator Profile in the JSON response shape', () => {
    const prompt = buildFoundationPrompt(baseInput)
    expect(prompt).toContain('creatorProfile')
    expect(prompt).toContain('contentPillars')
    expect(prompt).toContain('voiceSignature')
    expect(prompt).toContain('audiencePersona')
    expect(prompt).toContain('growthStage')
    expect(prompt).toContain('monetizationPosition')
    expect(prompt).toContain('formatStrengths')
    expect(prompt).toContain('differentiators')
    expect(prompt).toContain('topBlockers')
  })

  it('asks for evidence-layer findings (top patterns, format lean, hook structures)', () => {
    const prompt = buildFoundationPrompt(baseInput)
    expect(prompt).toContain('topPostPatterns')
    expect(prompt).toContain('recommendedFormatLean')
    expect(prompt).toContain('repeatableHookStructures')
  })
})
```

- [ ] **Step 2: Run failing test**

```bash
npx vitest run src/app/api/foundation-analysis/__tests__/prompt.test.ts
```
Expected: FAIL — module `@/app/api/foundation-analysis/prompt` not found.

- [ ] **Step 3: Create `prompt.ts` with the input type and prompt builder**

Create `src/app/api/foundation-analysis/prompt.ts`:

```ts
export interface FoundationInput {
  platform: 'instagram' | 'tiktok' | 'youtube' | 'x' | 'facebook' | 'threads' | 'linkedin'
  niche: string
  followerCount?: string
  postingCadence?: string
  contentPillars: string[]                                              // 1-3
  targetAudience: { description: string; sophistication: 'beginner' | 'intermediate' | 'advanced' }
  growthGoal: 'followers' | 'engagement' | 'monetization' | 'authority' | 'community'
  monetizationStage: 'none' | 'brand-deals' | 'digital-products' | 'services' | 'multi-stream'
  formatStrengths: string[]
  currentChallenges?: string
  analyzeHandle?: string
  samplePosts: Array<{ caption: string; metric?: string; whyItWorked?: string }>
}

export function buildFoundationPrompt(input: FoundationInput): string {
  const pillars = input.contentPillars.filter((p) => p?.trim()).join(', ')
  const formats = input.formatStrengths.join(', ')
  const samples = input.samplePosts
    .filter((p) => p.caption?.trim())
    .map((p, i) => {
      const metric = p.metric ? ` (Metric: ${p.metric})` : ''
      const theory = p.whyItWorked ? `\n  Creator's theory: ${p.whyItWorked}` : ''
      return `Sample post #${i + 1}${metric}:\n  "${p.caption}"${theory}`
    })
    .join('\n\n')

  return `You are an expert creator strategist running a foundational, evidence-grounded audit of the user's ${input.platform} channel. You have access to their declared profile AND sample posts they have flagged as their best-performing. Your job is to (a) audit the channel, (b) extract patterns from their evidence, and (c) emit a structured Creator Profile that downstream tools will consume.

Creator profile (declared):
- Platform: ${input.platform}
- Handle / URL: ${input.analyzeHandle || 'not provided'}
- Niche: ${input.niche}
- Follower count: ${input.followerCount || 'not specified'}
- Posting cadence: ${input.postingCadence || 'not specified'}
- Content pillars: ${pillars}
- Target audience: ${input.targetAudience.description} (sophistication: ${input.targetAudience.sophistication})
- Primary growth goal: ${input.growthGoal}
- Monetization stage: ${input.monetizationStage}
- Format strengths (self-reported): ${formats || 'not specified'}
- Current challenges: ${input.currentChallenges || 'none specified'}

Evidence — best-performing posts the creator has flagged:
${samples}

Analyze the channel as if you were a hired strategist. Be specific. Reference 2026 ${input.platform} algorithm dynamics. Read the sample posts carefully — their wins reveal what the audience rewards. Prefer concrete recommendations over platitudes.

Return ONLY valid JSON in the following exact shape:
{
  "overallAssessment": "2-3 sentence honest read",
  "strengths": ["", "", ""],
  "gaps": ["", "", "", ""],
  "contentMix": { "observation": "", "recommendation": "" },
  "postingConsistency": { "observation": "", "recommendation": "" },
  "audienceEngagement": { "observation": "", "recommendation": "" },
  "missedOpportunities": ["", "", ""],
  "quickWins": [
    {"title": "", "action": "", "impact": "High"},
    {"title": "", "action": "", "impact": "High"},
    {"title": "", "action": "", "impact": "Medium"}
  ],
  "longTermMoves": [
    {"title": "", "action": "", "timeframe": "30 days"},
    {"title": "", "action": "", "timeframe": "60-90 days"},
    {"title": "", "action": "", "timeframe": "90+ days"}
  ],
  "topPostPatterns": ["pattern observed across their wins #1", "#2", "#3"],
  "recommendedFormatLean": "single bold recommendation for which format/style to lean into",
  "repeatableHookStructures": [
    {"pattern": "structure name", "example": "concrete example using their voice"},
    {"pattern": "", "example": ""}
  ],
  "creatorProfile": {
    "contentPillars": ["", "", ""],
    "voiceSignature": { "adjectives": ["", "", ""], "examplePhrasing": "1-line example of how they sound" },
    "audiencePersona": { "description": "", "sophistication": "${input.targetAudience.sophistication}" },
    "growthStage": "pre-traction | early-traction | scaling | established (pick one)",
    "monetizationPosition": { "stage": "${input.monetizationStage}", "primaryStreams": ["", ""] },
    "formatStrengths": ["", ""],
    "differentiators": ["what sets them apart in their niche", "", ""],
    "topBlockers": ["top blocker", "", ""]
  }
}

Rules:
- strengths: 3 items, gaps: 4 items, missedOpportunities: 3 items
- quickWins: 3 items, longTermMoves: 3 items
- topPostPatterns: 3 items, repeatableHookStructures: 2 items
- creatorProfile.contentPillars: 3 items derived from declared pillars + evidence
- creatorProfile.voiceSignature.adjectives: 3 items
- creatorProfile.differentiators: 3 items
- creatorProfile.topBlockers: 3 items
- Every recommendation must reference ${input.platform}-specific mechanics or ${input.niche}-specific dynamics
- Never use generic "post consistently" / "engage with your audience" advice — be specific about what/when/how
- Anchor evidence-layer findings in the actual sample posts above, not generic patterns`
}
```

- [ ] **Step 4: Run prompt tests — should all pass**

```bash
npx vitest run src/app/api/foundation-analysis/__tests__/prompt.test.ts
```
Expected: 6 tests pass.

- [ ] **Step 5: Create the route handler**

Create `src/app/api/foundation-analysis/route.ts`. Mirror the structure of `src/app/api/channel-analysis/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { checkAuthAndUsage, incrementUsage } from '@/lib/auth-usage'
import { crispGenerate } from '@/lib/crisp-engine'
import { parseLooseJson } from '@/lib/safe-json'
import { consumeCredits } from '@/lib/credits'
import { upsertCreatorProfile } from '@/lib/creator-profile'
import { buildFoundationPrompt, type FoundationInput } from './prompt'

export const maxDuration = 120

export interface FoundationAnalysisResult {
  overallAssessment: string
  strengths: string[]
  gaps: string[]
  contentMix: { observation: string; recommendation: string }
  postingConsistency: { observation: string; recommendation: string }
  audienceEngagement: { observation: string; recommendation: string }
  missedOpportunities: string[]
  quickWins: { title: string; action: string; impact: string }[]
  longTermMoves: { title: string; action: string; timeframe: string }[]
  topPostPatterns: string[]
  recommendedFormatLean: string
  repeatableHookStructures: { pattern: string; example: string }[]
  creatorProfile: {
    contentPillars: string[]
    voiceSignature: { adjectives: string[]; examplePhrasing: string }
    audiencePersona: { description: string; sophistication: 'beginner' | 'intermediate' | 'advanced' }
    growthStage: 'pre-traction' | 'early-traction' | 'scaling' | 'established'
    monetizationPosition: { stage: string; primaryStreams: string[] }
    formatStrengths: string[]
    differentiators: string[]
    topBlockers: string[]
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<FoundationInput>

  // Validate required fields
  const errors: string[] = []
  if (!body.platform) errors.push('platform is required')
  if (!body.niche?.trim()) errors.push('niche is required')
  if (!body.contentPillars?.filter((p) => p?.trim()).length) errors.push('at least 1 content pillar is required')
  if (!body.targetAudience?.description?.trim()) errors.push('targetAudience.description is required')
  if (!body.growthGoal) errors.push('growthGoal is required')
  if (!body.samplePosts?.filter((p) => p.caption?.trim()).length) errors.push('at least 1 sample post with caption text is required')
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const auth = await checkAuthAndUsage('foundation-analysis', { request })
  if (!auth.ok) return auth.response

  const input = body as FoundationInput
  const prompt = buildFoundationPrompt(input)
  const useRefine = auth.tier === 'elite'

  let text = ''
  let totalTokens = 0
  let refined = false
  const tStart = Date.now()
  try {
    const result = await crispGenerate({
      task: 'foundation-analysis',
      tier: auth.tier,
      prompt,
      maxTokens: 6000,    // bigger output cap than channel-analysis (4500) to fit creator profile + evidence findings
      refine: useRefine,
    })
    text = result.text
    totalTokens = result.totalTokens
    refined = result.refined
    console.log(`[foundation-analysis] crispGenerate done — tier=${auth.tier} refined=${refined} elapsedMs=${Date.now() - tStart} tokens=${totalTokens} model=${result.modelUsed}`)
  } catch (error) {
    console.error(`[foundation-analysis] model call failed after ${Date.now() - tStart}ms:`, error)
    return NextResponse.json({ error: 'AI provider error. Please try again in a moment.' }, { status: 502 })
  }

  let parsed: FoundationAnalysisResult
  try {
    parsed = parseLooseJson<FoundationAnalysisResult>(text)
  } catch (error) {
    console.error('Foundation analysis — JSON parse failed. First 500 chars:', text.slice(0, 500), error)
    return NextResponse.json({ error: 'AI returned malformed output. Please try again.' }, { status: 502 })
  }

  if (!parsed?.overallAssessment || !Array.isArray(parsed.strengths) || !parsed.creatorProfile) {
    console.error('Foundation analysis — unexpected shape:', { keys: Object.keys(parsed ?? {}), preview: text.slice(0, 300) })
    return NextResponse.json({ error: 'AI returned an unexpected response. Please try again.' }, { status: 502 })
  }

  // Persist generation row + Creator Profile (best-effort)
  let analysisId: string | null = null
  try {
    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)
    const { data: inserted } = await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'foundation_analysis',
      platform: input.platform,
      input_data: input,
      output_data: parsed,
      tokens_used: totalTokens,
    }).select('id').single()
    analysisId = inserted?.id ?? null
    await consumeCredits(auth.supabase, auth.userId, auth.creditCost, 'foundation-analysis')

    // Save the structured Creator Profile so downstream tools can read it
    const cp = parsed.creatorProfile
    await upsertCreatorProfile(auth.supabase, auth.userId, {
      content_pillars: cp.contentPillars,
      voice_signature: cp.voiceSignature,
      audience_persona: cp.audiencePersona,
      growth_stage: cp.growthStage,
      monetization_position: cp.monetizationPosition,
      format_strengths: cp.formatStrengths,
      differentiators: cp.differentiators,
      top_blockers: cp.topBlockers,
    }, analysisId)
  } catch (error) {
    console.error('Foundation analysis — persistence failed (non-fatal):', error)
  }

  return NextResponse.json({ ...parsed, analysis_id: analysisId })
}
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```
Expected: clean run.

- [ ] **Step 7: Run all tests**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/foundation-analysis
git commit -m "feat(api): add /api/foundation-analysis route with prompt builder + tests"
```

---

## Task 8: `/dashboard/foundation-analysis` page (form + result + FeatureGate)

**Files:**
- Create: `src/app/dashboard/foundation-analysis/page.tsx`

This is a UI-heavy task. Mirror `src/app/dashboard/channel-analysis/page.tsx` for the existing patterns (FeatureGate wrap, useState form, GenerationLoader, result rendering, save-to-library).

- [ ] **Step 1: Scaffold the page with FeatureGate, form skeleton, and submit-handler**

Create `src/app/dashboard/foundation-analysis/page.tsx`:

```tsx
"use client";
import { useState } from "react";
import { PLATFORMS, NICHES } from "@/lib/constants";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { EngineBadge } from "@/components/ui/EngineBadge";
import { FeatureGate } from "@/components/ui/FeatureGate";
import { GenerationLoader } from "@/components/ui/GenerationLoader";
import { InlineError } from "@/components/ui/ErrorBoundary";
import { useToast } from "@/components/ui/Toast";

type Sophistication = 'beginner' | 'intermediate' | 'advanced'
type GrowthGoal = 'followers' | 'engagement' | 'monetization' | 'authority' | 'community'
type MonetizationStage = 'none' | 'brand-deals' | 'digital-products' | 'services' | 'multi-stream'

interface SamplePost { caption: string; metric: string; whyItWorked: string }

interface Result {
  overallAssessment: string
  strengths: string[]
  gaps: string[]
  contentMix: { observation: string; recommendation: string }
  postingConsistency: { observation: string; recommendation: string }
  audienceEngagement: { observation: string; recommendation: string }
  missedOpportunities: string[]
  quickWins: { title: string; action: string; impact: string }[]
  longTermMoves: { title: string; action: string; timeframe: string }[]
  topPostPatterns: string[]
  recommendedFormatLean: string
  repeatableHookStructures: { pattern: string; example: string }[]
  creatorProfile: {
    contentPillars: string[]
    voiceSignature: { adjectives: string[]; examplePhrasing: string }
    audiencePersona: { description: string; sophistication: Sophistication }
    growthStage: 'pre-traction' | 'early-traction' | 'scaling' | 'established'
    monetizationPosition: { stage: string; primaryStreams: string[] }
    formatStrengths: string[]
    differentiators: string[]
    topBlockers: string[]
  }
  analysis_id: string | null
}

const CADENCES = ["Daily", "4-5x/week", "2-3x/week", "Weekly", "Less than weekly", "Not sure"];
const FORMATS = ["Carousels", "Short-form video", "Long-form video", "Lives", "Stills", "Threads", "Stories"];
const GOALS: { id: GrowthGoal; label: string }[] = [
  { id: 'followers', label: 'Followers' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'monetization', label: 'Monetization' },
  { id: 'authority', label: 'Authority' },
  { id: 'community', label: 'Community' },
];
const STAGES: { id: MonetizationStage; label: string }[] = [
  { id: 'none', label: 'None yet' },
  { id: 'brand-deals', label: 'Brand deals' },
  { id: 'digital-products', label: 'Digital products' },
  { id: 'services', label: 'Services' },
  { id: 'multi-stream', label: 'Multi-stream' },
];

const impactColor: Record<string, string> = {
  High: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  Medium: "bg-brand-500/10 text-brand-300 border-brand-500/20",
  Low: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

function emptySample(): SamplePost { return { caption: '', metric: '', whyItWorked: '' } }

export default function FoundationAnalysisPage() {
  // Section 1
  const [platform, setPlatform] = useState("instagram");
  const [analyzeHandle, setAnalyzeHandle] = useState("");
  const [niche, setNiche] = useState("");
  const [useCustomNiche, setUseCustomNiche] = useState(false);
  const [followerCount, setFollowerCount] = useState("");
  const [postingCadence, setPostingCadence] = useState("Weekly");
  // Section 2
  const [pillars, setPillars] = useState<[string, string, string]>(['', '', '']);
  const [audienceDesc, setAudienceDesc] = useState("");
  const [sophistication, setSophistication] = useState<Sophistication>('intermediate');
  const [growthGoal, setGrowthGoal] = useState<GrowthGoal>('engagement');
  const [monetizationStage, setMonetizationStage] = useState<MonetizationStage>('none');
  // Section 3
  const [formatStrengths, setFormatStrengths] = useState<string[]>([]);
  const [currentChallenges, setCurrentChallenges] = useState("");
  // Section 4 — evidence layer
  const [samples, setSamples] = useState<[SamplePost, SamplePost, SamplePost]>([emptySample(), emptySample(), emptySample()]);

  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const setPillar = (i: number, v: string) => setPillars((prev) => { const next = [...prev] as [string, string, string]; next[i] = v; return next });
  const setSample = (i: number, patch: Partial<SamplePost>) => setSamples((prev) => { const next = [...prev] as [SamplePost, SamplePost, SamplePost]; next[i] = { ...next[i], ...patch }; return next });
  const toggleFormat = (f: string) => setFormatStrengths((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);

  const handleAnalyze = async () => {
    if (!niche.trim()) { addToast("Enter or select your niche", "warning"); return }
    if (!pillars.some((p) => p.trim())) { addToast("Enter at least one content pillar", "warning"); return }
    if (!audienceDesc.trim()) { addToast("Describe your target audience", "warning"); return }
    if (!samples.some((s) => s.caption.trim())) { addToast("Paste at least one of your best-performing posts", "warning"); return }

    setLoading(true); setError(null); setResult(null);
    try {
      const data = await apiFetch<Result>("/api/foundation-analysis", {
        method: "POST",
        body: JSON.stringify({
          platform, niche, followerCount, postingCadence,
          contentPillars: pillars.filter((p) => p.trim()),
          targetAudience: { description: audienceDesc, sophistication },
          growthGoal, monetizationStage,
          formatStrengths,
          currentChallenges,
          analyzeHandle,
          samplePosts: samples.filter((s) => s.caption.trim()),
        }),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Foundation analysis failed");
    } finally { setLoading(false); }
  };

  return (
    <FeatureGate
      feature="foundation-analysis"
      featureLabel="Foundation Analysis"
      featureIcon="🧬"
      featureTagline="Evidence-grounded audit + a reusable Creator Profile that powers every other tool."
      valueProps={[
        "Real-signal audit — the AI evaluates your actual top-performing posts, not just your demographic",
        "Pinpoint the formats your audience rewards by 3-5x",
        "Extract the hook structures behind your wins, repeatable",
        "Saves a Creator Profile that Captions, Viral Ideas, and Bio Optimizer read on every generation",
      ]}
      previewSnapshotUrl="/foundation-analysis-preview.png"
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">🧬 Foundation Analysis</h1>
          <p className="text-zinc-500 mt-1">Set your strategic foundation. Captions, Viral Ideas, and Bio Optimizer will all build from this.</p>
        </div>

        {/* Form sections … the implementer copies the form from the brainstorm mockup at .superpowers/brainstorm/<session>/content/channel-analysis-form.html, swapping styled HTML for tailwind class equivalents already used by channel-analysis/page.tsx. The 4 sections are:
            1. Your channel — platform pill row, handle input, niche dropdown/custom, follower count + cadence row
            2. Your strategy — 3 pillar inputs in a grid; audience description + sophistication select side-by-side; growth goal pill row; monetization stage pill row
            3. Your reality — format strengths multi-select pill row; current challenges textarea
            4. Evidence layer — 3 sample-post cards, each with caption textarea + metric input + theory input
            Submit button row at the bottom: handleAnalyze
            Use existing components/styling from src/app/dashboard/channel-analysis/page.tsx as the visual baseline. */}

        {loading && <GenerationLoader variant="rocket" messages={[
          "Reading your evidence — your wins reveal what your audience rewards.",
          "Auditing your channel against 2026 platform dynamics...",
          "Extracting hook patterns from your top posts...",
          "Building your Creator Profile that Captions, Viral Ideas, and Bio Optimizer will use...",
          "Critiquing every recommendation for specificity...",
          "Almost there — finalizing your foundation.",
        ]} />}
        {error && !loading && <InlineError message={error} onRetry={handleAnalyze} />}

        {result && !loading && <FoundationResult result={result} />}
      </div>
    </FeatureGate>
  );
}

function FoundationResult({ result }: { result: Result }) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Profile-saved banner */}
      <div className="rounded-xl border border-brand-500/30 bg-brand-900/10 p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-300">✨ Your Creator Profile is saved.</p>
          <p className="text-xs text-zinc-400">Captions, Viral Ideas, and Bio Optimizer will read it on every generation.</p>
        </div>
        <a href="/dashboard/settings#profile" className="text-xs text-brand-300 hover:text-brand-200">Manage profile →</a>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-200">Your foundation audit</h2>
        <EngineBadge />
      </div>

      <div className="rounded-xl border border-brand-500/30 bg-brand-900/10 p-5">
        <h3 className="text-sm font-semibold text-brand-300 uppercase tracking-wider mb-2">Overall assessment</h3>
        <p className="text-sm text-zinc-200 leading-relaxed">{result.overallAssessment}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <h3 className="text-sm font-semibold text-zinc-100 mb-3">✅ Strengths</h3>
          <ul className="space-y-2">{result.strengths.map((s, i) => <li key={i} className="text-sm text-zinc-300 flex gap-2"><span className="text-emerald-400">▸</span>{s}</li>)}</ul>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <h3 className="text-sm font-semibold text-zinc-100 mb-3">⚠️ Gaps to close</h3>
          <ul className="space-y-2">{result.gaps.map((g, i) => <li key={i} className="text-sm text-zinc-300 flex gap-2"><span className="text-amber-400">▸</span>{g}</li>)}</ul>
        </div>
      </div>

      {/* Three observation/recommendation cards (content mix / consistency / engagement) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[
          { title: "Content mix", icon: "🎭", data: result.contentMix },
          { title: "Posting consistency", icon: "📅", data: result.postingConsistency },
          { title: "Audience engagement", icon: "💬", data: result.audienceEngagement },
        ].map((s) => (
          <div key={s.title} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
            <h3 className="text-sm font-semibold text-zinc-100 mb-3">{s.icon} {s.title}</h3>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Observation</p>
            <p className="text-sm text-zinc-300 mb-3">{s.data.observation}</p>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Recommendation</p>
            <p className="text-sm text-zinc-200">{s.data.recommendation}</p>
          </div>
        ))}
      </div>

      {/* Evidence-layer findings — top patterns + format lean + hook structures */}
      <div className="rounded-xl border border-brand-500/20 bg-surface-secondary p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 mb-2">🔬 Top post patterns</h3>
          <ul className="space-y-1">{result.topPostPatterns.map((p, i) => <li key={i} className="text-sm text-zinc-300 flex gap-2"><span className="text-brand-400">▸</span>{p}</li>)}</ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 mb-2">🎯 Recommended format lean</h3>
          <p className="text-sm text-zinc-200 font-medium">{result.recommendedFormatLean}</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 mb-2">🪝 Repeatable hook structures</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-zinc-500"><th className="pb-2">Pattern</th><th className="pb-2">Example</th></tr></thead>
            <tbody className="divide-y divide-brand-500/10">
              {result.repeatableHookStructures.map((h, i) => (
                <tr key={i}><td className="py-2 pr-4 text-zinc-300 align-top">{h.pattern}</td><td className="py-2 text-zinc-400 italic">{h.example}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick wins + long-term moves — same as channel-analysis */}
      <div>
        <h3 className="text-base font-semibold text-zinc-200 mb-3">⚡ Quick wins this week</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {result.quickWins.map((w, i) => (
            <div key={i} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4">
              <div className="flex items-center justify-between mb-2"><span className="text-xs font-semibold text-brand-300">#{i + 1}</span><span className={`text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${impactColor[w.impact] ?? ""}`}>{w.impact}</span></div>
              <h4 className="text-sm font-semibold text-zinc-100 mb-1">{w.title}</h4>
              <p className="text-xs text-zinc-400">{w.action}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold text-zinc-200 mb-3">🎯 Long-term moves</h3>
        <div className="space-y-2">
          {result.longTermMoves.map((m, i) => (
            <div key={i} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 flex items-start gap-4">
              <span className="text-2xs text-brand-300 bg-brand-500/10 px-2 py-1 rounded-full whitespace-nowrap">{m.timeframe}</span>
              <div className="flex-1"><h4 className="text-sm font-semibold text-zinc-100">{m.title}</h4><p className="text-xs text-zinc-400 mt-1">{m.action}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Fill in the form section markup**

The placeholder comment in step 1 marks where the implementer needs to write the form's tailwind markup for sections 1–4. Use `src/app/dashboard/channel-analysis/page.tsx:135-205` as the visual baseline (same `bg-surface-secondary`, `border-brand-500/10`, `rounded-xl` cards, `pill-btn` selectors). The 4 sections each go in their own `<div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">` with a section header.

For Section 4 (Evidence Layer): render three `<div>` slots iterating `samples.map`, each with a textarea (`samples[i].caption`), and below it a 2-column grid with metric input and theory input. Use `setSample(i, { caption: e.target.value })` etc.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```
Open `http://localhost:3000/dashboard/foundation-analysis` while signed in:
- As a Starter user: see the FeatureGate paywall (perks list + Upgrade CTA + preview image)
- As an Elite user: see the form. Fill out platform, niche, ≥1 pillar, audience description, ≥1 sample post; click Analyze
- Expect a result with all sections rendered, including evidence-layer findings and the "Creator Profile saved" banner

If the AI returns malformed JSON or missing fields, the route returns a 502 with a friendly message — verify the `<InlineError>` rendering with a Retry button works.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/foundation-analysis
git commit -m "feat(ui): foundation analysis page with form, evidence layer, result display"
```

---

## Task 9: Extend `<FeatureGate>` with `previewSnapshotUrl` prop + add static preview asset

**Files:**
- Modify: `src/components/ui/FeatureGate.tsx`
- Create: `public/foundation-analysis-preview.png`

- [ ] **Step 1: Add the prop and render block to FeatureGate**

In `src/components/ui/FeatureGate.tsx`:

Update the `FeatureGateProps` interface:

```ts
interface FeatureGateProps {
  feature: CrispTask
  featureLabel: string
  featureIcon: string
  featureTagline: string
  valueProps: string[]
  /** Optional preview screenshot shown below the perks grid in the paywall */
  previewSnapshotUrl?: string
  children: React.ReactNode
}
```

Update the function signature:

```ts
export function FeatureGate({ feature, featureLabel, featureIcon, featureTagline, valueProps, previewSnapshotUrl, children }: FeatureGateProps) {
```

Find the JSX block where the perks list renders. Below it (still inside the gate's blocked-state branch), add:

```tsx
{previewSnapshotUrl && (
  <div className="mt-6 rounded-xl border border-brand-500/10 overflow-hidden">
    <img
      src={previewSnapshotUrl}
      alt={`${featureLabel} preview`}
      className="w-full h-auto block"
    />
  </div>
)}
```

- [ ] **Step 2: Add the static preview asset**

Place a screenshot of the Foundation Analysis result page (or the high-fidelity mockup we already produced in `.superpowers/brainstorm/<session>/content/channel-analysis-form.html`) at:

```
public/foundation-analysis-preview.png
```

Recommended dimensions: 1600 × 900 PNG, < 200 KB. The implementer can capture this via DevTools full-page screenshot after step 4 of Task 8 is verified (using the Elite view), or use the brainstorm mockup as a stand-in for now.

- [ ] **Step 3: Smoke**

Verify a Starter-tier visit to `/dashboard/foundation-analysis` shows the new image below the perks grid.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/FeatureGate.tsx public/foundation-analysis-preview.png
git commit -m "feat(ui): FeatureGate previewSnapshotUrl + foundation-analysis preview asset"
```

---

## Task 10: Elite onboarding CTA on the dashboard + dismiss endpoint

**Files:**
- Create: `src/app/api/user/dismiss-foundation-cta/route.ts`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Create the dismiss API route**

Create `src/app/api/user/dismiss-foundation-cta/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { error } = await supabase
    .from('profiles')
    .update({ foundation_cta_dismissed_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Render the CTA card on the dashboard for Elite users with no profile and no dismissal**

In `src/app/dashboard/page.tsx`, locate where the page reads the user's `profile` (search for `subscription_tier`). Right after that, add:

```tsx
const { data: creatorProfile } = await supabase
  .from('creator_profiles')
  .select('user_id')
  .eq('user_id', user.id)
  .maybeSingle()

const showFoundationCta =
  profile?.subscription_tier === 'elite' &&
  !creatorProfile &&
  !profile?.foundation_cta_dismissed_at
```

In the JSX, render the CTA card near the top of the dashboard content (above the existing tools-grid):

```tsx
{showFoundationCta && (
  <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-amber-500/0 p-5 sm:p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
    <div className="text-3xl">🧬</div>
    <div className="flex-1">
      <h3 className="text-base font-semibold text-zinc-100">Set up your Foundation Analysis</h3>
      <p className="text-sm text-zinc-400 mt-0.5">Captions, Viral Ideas, and Bio Optimizer get noticeably sharper once you've filled this in.</p>
    </div>
    <div className="flex gap-2">
      <a href="/dashboard/foundation-analysis" className="px-4 py-2 rounded-lg bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400">Run now →</a>
      <DismissFoundationCtaButton />
    </div>
  </div>
)}
```

If `dashboard/page.tsx` is a Server Component (it likely is given the supabase server client), the dismiss button needs to be a Client Component. Add inline at the top of the file (or extract to its own file):

```tsx
'use client'
function DismissFoundationCtaButton() {
  return (
    <button
      onClick={async () => {
        await fetch('/api/user/dismiss-foundation-cta', { method: 'POST' })
        window.location.reload()
      }}
      className="px-3 py-2 rounded-lg bg-zinc-700/50 text-zinc-300 text-sm hover:bg-zinc-700"
    >
      Dismiss
    </button>
  )
}
```

If the existing `dashboard/page.tsx` mixes server and client patterns differently (look at how other interactive bits work), follow the existing pattern instead — don't fight the file. Likely there's already a small client island helper used elsewhere.

- [ ] **Step 3: Smoke test**

```bash
npm run dev
```
- As an Elite user with no profile: visit `/dashboard` → CTA card appears at top
- Click "Dismiss" → card disappears on reload, doesn't return
- Run Foundation Analysis → on next visit, CTA card no longer appears (because creator_profiles row exists)
- As a Creator user: card never appears

- [ ] **Step 4: Commit**

```bash
git add src/app/api/user/dismiss-foundation-cta src/app/dashboard/page.tsx
git commit -m "feat(dashboard): elite onboarding CTA for foundation analysis"
```

---

## Task 11: Settings → Profile section (view + manual edit + opt-out toggle)

**Files:**
- Modify: `src/app/dashboard/settings/page.tsx`
- Create: `src/app/api/user/creator-profile/route.ts`

This is the start of Phase 2.

- [ ] **Step 1: Create the PATCH endpoint for manual profile edits and toggle**

Create `src/app/api/user/creator-profile/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json() as {
    profilePatch?: Partial<{
      content_pillars: string[]
      voice_signature: { adjectives: string[]; examplePhrasing: string }
      audience_persona: { description: string; sophistication: 'beginner' | 'intermediate' | 'advanced' }
      growth_stage: 'pre-traction' | 'early-traction' | 'scaling' | 'established'
      monetization_position: { stage: string; primaryStreams: string[] }
      format_strengths: string[]
      differentiators: string[]
      top_blockers: string[]
    }>
    useFoundationInGenerations?: boolean
  }

  if (body.profilePatch) {
    const { error } = await supabase
      .from('creator_profiles')
      .update({ ...body.profilePatch, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (typeof body.useFoundationInGenerations === 'boolean') {
    const { error } = await supabase
      .from('profiles')
      .update({ use_foundation_in_generations: body.useFoundationInGenerations })
      .eq('id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Add a Profile section to the settings page**

In `src/app/dashboard/settings/page.tsx`, add a new `<section id="profile">` near the existing sections. The section has three parts:

1. **Toggle** — checkbox bound to `use_foundation_in_generations` from the profiles row. On change, PATCH `/api/user/creator-profile` with `{ useFoundationInGenerations: bool }`.
2. **Profile preview** — read the user's `creator_profiles` row server-side (or client-side via supabase). Render each field as a non-editable label/value pair, with an "Edit" button that flips it to an editable input.
3. **Manual edit** — when editing, fields become controlled inputs; a Save button PATCHes the changed fields via the same endpoint with `{ profilePatch: {...} }`.

For the editing UX, mirror the existing "edit profile" patterns elsewhere in the codebase. If none exist for nested JSON fields, the simplest acceptable UX is a single big textarea per field that round-trips JSON; that's adequate for an Elite-only escape hatch.

If no profile exists, show an empty state: *"You haven't run Foundation Analysis yet. [Run now →]"*

- [ ] **Step 3: Smoke test**

```bash
npm run dev
```
- Run Foundation Analysis → visit `/dashboard/settings#profile` → see the saved profile
- Toggle "Use my Foundation Analysis profile in generations" off → reload → still off
- Edit a field (e.g., content pillar #1), save → reload → reflects the change
- As a non-Elite user: section either hidden or shows the empty state with a link to upgrade

- [ ] **Step 4: Commit**

```bash
git add src/app/api/user/creator-profile src/app/dashboard/settings/page.tsx
git commit -m "feat(settings): add creator profile section with manual edit + toggle"
```

---

## Task 12: `creator-context-block.ts` formatter (TDD)

**Files:**
- Create: `src/lib/creator-context-block.ts`
- Create: `src/lib/__tests__/creator-context-block.test.ts`

A pure function that formats a profile + a "fields wanted" list into the prompt block. Keeps Phase 2 tools clean — they call one function instead of duplicating prompt-formatting logic.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/creator-context-block.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatCreatorContextBlock } from '@/lib/creator-context-block'
import type { CreatorProfile } from '@/lib/creator-profile'

const fakeProfile: CreatorProfile = {
  user_id: 'u',
  content_pillars: ['AI tools', 'founder workflow', 'behind the build'],
  voice_signature: { adjectives: ['plainspoken', 'contrarian', 'dry humor'], examplePhrasing: 'ship it ugly' },
  audience_persona: { description: 'indie hackers shipping their first SaaS', sophistication: 'intermediate' },
  growth_stage: 'early-traction',
  monetization_position: { stage: 'digital-products', primaryStreams: ['course'] },
  format_strengths: ['carousels', 'short-form video'],
  differentiators: ['builds in public', 'specifies actual prompts', 'anti-hype'],
  top_blockers: ['hook fatigue', 'reels feel forced'],
  source_analysis_id: null,
  created_at: '', updated_at: '',
}

describe('formatCreatorContextBlock', () => {
  it('returns null when profile is null', () => {
    expect(formatCreatorContextBlock(null, ['voice_signature'])).toBeNull()
  })

  it('includes only the requested fields', () => {
    const block = formatCreatorContextBlock(fakeProfile, ['voice_signature', 'audience_persona'])
    expect(block).toContain('plainspoken')
    expect(block).toContain('indie hackers')
    expect(block).not.toContain('AI tools')        // content_pillars not requested
    expect(block).not.toContain('digital-products') // monetization not requested
  })

  it('starts with the standard header and ends with the standard reminder', () => {
    const block = formatCreatorContextBlock(fakeProfile, ['content_pillars'])
    expect(block?.startsWith('## Creator context')).toBe(true)
    expect(block).toContain('ground your output in the user')
  })

  it('formats list fields as comma-separated', () => {
    const block = formatCreatorContextBlock(fakeProfile, ['content_pillars', 'format_strengths'])
    expect(block).toContain('AI tools, founder workflow, behind the build')
    expect(block).toContain('carousels, short-form video')
  })
})
```

- [ ] **Step 2: Run failing test**

```bash
npx vitest run src/lib/__tests__/creator-context-block.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the formatter**

Create `src/lib/creator-context-block.ts`:

```ts
import type { CreatorProfile } from './creator-profile'

export type ProfileField =
  | 'content_pillars'
  | 'voice_signature'
  | 'audience_persona'
  | 'growth_stage'
  | 'monetization_position'
  | 'format_strengths'
  | 'differentiators'
  | 'top_blockers'

export function formatCreatorContextBlock(
  profile: CreatorProfile | null,
  fields: ProfileField[],
): string | null {
  if (!profile) return null
  const lines: string[] = []
  for (const f of fields) {
    switch (f) {
      case 'content_pillars':
        lines.push(`- Content pillars: ${profile.content_pillars.join(', ')}`)
        break
      case 'voice_signature':
        lines.push(`- Voice: ${profile.voice_signature.adjectives.join(', ')} — phrases like "${profile.voice_signature.examplePhrasing}"`)
        break
      case 'audience_persona':
        lines.push(`- Audience: ${profile.audience_persona.description} (sophistication: ${profile.audience_persona.sophistication})`)
        break
      case 'growth_stage':
        lines.push(`- Growth stage: ${profile.growth_stage}`)
        break
      case 'monetization_position':
        lines.push(`- Monetization: ${profile.monetization_position.stage} (streams: ${profile.monetization_position.primaryStreams.join(', ') || 'none yet'})`)
        break
      case 'format_strengths':
        lines.push(`- Format strengths: ${profile.format_strengths.join(', ')}`)
        break
      case 'differentiators':
        lines.push(`- Differentiators: ${profile.differentiators.join(' · ')}`)
        break
      case 'top_blockers':
        lines.push(`- Top blockers: ${profile.top_blockers.join(' · ')}`)
        break
    }
  }
  return [
    `## Creator context (the user's saved Foundation Analysis profile):`,
    ...lines,
    ``,
    `Use this context to ground your output in the user's voice and audience. Do not generic-ify.`,
  ].join('\n')
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/lib/__tests__/creator-context-block.test.ts
```
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/creator-context-block.ts src/lib/__tests__/creator-context-block.test.ts
git commit -m "feat: creator-context-block formatter for downstream prompt injection"
```

---

## Task 13: Inject Creator Context into Captions prompt

**Files:**
- Modify: `src/app/api/generate/route.ts`

The Captions tool API route injects a Creator Context block when (a) the user has a saved profile AND (b) `profiles.use_foundation_in_generations` is true.

- [ ] **Step 1: Read the user's profile and toggle inside the route handler**

Open `src/app/api/generate/route.ts`. Locate where the `auth` object is established (after `checkAuthAndUsage`). Right after that, before the prompt is constructed, add:

```ts
import { getCreatorProfile } from '@/lib/creator-profile'
import { formatCreatorContextBlock } from '@/lib/creator-context-block'

// … inside the POST handler after `auth` is set …
const { data: profileRow } = await auth.supabase
  .from('profiles')
  .select('use_foundation_in_generations')
  .eq('id', auth.userId)
  .maybeSingle()
const useFoundation = profileRow?.use_foundation_in_generations !== false   // default ON
const creatorProfile = useFoundation ? await getCreatorProfile(auth.supabase, auth.userId) : null
const creatorContext = formatCreatorContextBlock(creatorProfile, ['voice_signature', 'audience_persona', 'content_pillars'])
```

- [ ] **Step 2: Splice the context block into the prompt**

Locate the variable that holds the assembled prompt (search for the existing `const prompt = \`...\`` template literal). Prepend the context block when present. The simplest pattern:

```ts
const prompt = [
  creatorContext,           // null becomes empty string after .filter
  /* existing prompt body */
].filter(Boolean).join('\n\n')
```

If the existing route builds the prompt with helpers, splice the block in just after the system intro and before the user-input section. The placement matters less than presence; AI quality lift comes from the block being available, not from a specific position.

- [ ] **Step 3: Smoke test**

```bash
npm run dev
```
- As an Elite user with a saved profile: generate a caption. In the server logs, the prompt body (logged at debug or via `console.log` you add temporarily) should include the `## Creator context` block.
- Toggle the Settings setting off → generate again → block is absent.
- As a Creator user: block is absent (no profile exists).

If the route doesn't currently log the prompt, add a `console.log('[generate] prompt has creator context:', creatorContext != null)` inside the handler for the duration of this verification, and remove it after.

- [ ] **Step 4: Run all tests**

```bash
npm test
```
Expected: all existing tests pass. The change is additive — no existing test should fail.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/generate/route.ts
git commit -m "feat(captions): inject creator context block from foundation profile"
```

---

## Task 14: Inject Creator Context into Viral Ideas prompt

**Files:**
- Modify: `src/app/api/viral-ideas/route.ts`

- [ ] **Step 1: Apply the same pattern as Task 13 with different profile fields**

In `src/app/api/viral-ideas/route.ts`, after `auth` is established:

```ts
import { getCreatorProfile } from '@/lib/creator-profile'
import { formatCreatorContextBlock } from '@/lib/creator-context-block'

const { data: profileRow } = await auth.supabase
  .from('profiles')
  .select('use_foundation_in_generations')
  .eq('id', auth.userId)
  .maybeSingle()
const useFoundation = profileRow?.use_foundation_in_generations !== false
const creatorProfile = useFoundation ? await getCreatorProfile(auth.supabase, auth.userId) : null
const creatorContext = formatCreatorContextBlock(creatorProfile, ['content_pillars', 'audience_persona', 'format_strengths'])
```

Splice `creatorContext` into the prompt the same way as Task 13 step 2.

- [ ] **Step 2: Smoke test**

Generate viral ideas as an Elite user with a saved profile. Confirm the AI's ideas reflect the user's pillars and format strengths (e.g., if pillars include "AI tool reviews" and format strengths include "carousels", ideas should lean toward those).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/viral-ideas/route.ts
git commit -m "feat(viral-ideas): inject creator context block from foundation profile"
```

---

## Task 15: Inject Creator Context into Bio Optimizer prompt

**Files:**
- Modify: `src/app/api/bio-optimizer/route.ts`

- [ ] **Step 1: Apply the same pattern as Task 13**

In `src/app/api/bio-optimizer/route.ts`, after `auth`:

```ts
import { getCreatorProfile } from '@/lib/creator-profile'
import { formatCreatorContextBlock } from '@/lib/creator-context-block'

const { data: profileRow } = await auth.supabase
  .from('profiles')
  .select('use_foundation_in_generations')
  .eq('id', auth.userId)
  .maybeSingle()
const useFoundation = profileRow?.use_foundation_in_generations !== false
const creatorProfile = useFoundation ? await getCreatorProfile(auth.supabase, auth.userId) : null
const creatorContext = formatCreatorContextBlock(creatorProfile, ['monetization_position', 'differentiators', 'audience_persona', 'growth_stage'])
```

Splice `creatorContext` into the bio prompt.

- [ ] **Step 2: Smoke test**

Generate a bio as an Elite user with a saved profile. The bio should reference monetization stage and differentiators (e.g., for a "digital-products" + "builds in public" creator: bios suggest a "shipping a course about X · building in public" style).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/bio-optimizer/route.ts
git commit -m "feat(bio-optimizer): inject creator context block from foundation profile"
```

---

## Phase 1 ship checkpoint (after Task 10)

Before moving to Phase 2, verify:
- DB schema applied in production Supabase
- Foundation Analysis end-to-end works for an Elite user (form → API → result page → profile saved)
- Starter/Creator users see the paywall correctly
- The dashboard CTA appears for Elite users without profiles, dismisses correctly
- Marketing site shows 3 tiers, no Team
- All 8 commits are clean; tests are green

If the engine refine pass on Foundation Analysis runs over 90s repeatedly, raise `maxTokens` carefully or split into a faster non-refine path. Monitor Vercel function logs.

## Phase 2 ship checkpoint (after Task 15)

After all three downstream tools are wired:
- Manually compare Captions / Viral Ideas / Bio Optimizer output for a single user, before vs after running Foundation Analysis. The "after" version should reference the user's pillars/voice/audience explicitly.
- Confirm the Settings toggle reverts behavior cleanly when off.
- Bio Optimizer is the highest-stakes integration because the bio is short and any context bloat shows up immediately — pay extra attention to its prompt length and quality.

---

## Self-Review

**Spec coverage check:**

| Spec section | Tasks |
|---|---|
| Drop Team tier | 1 (CHECK), 2, 3, 4 |
| `creator_profiles` table + `profiles` columns | 1 |
| Engine + feature-access + tools-meta registration | 5 |
| `creator-profile.ts` helper | 6 |
| `/api/foundation-analysis` route | 7 |
| `/dashboard/foundation-analysis` page | 8 |
| FeatureGate `previewSnapshotUrl` extension | 9 |
| Elite onboarding CTA + dismiss endpoint | 10 |
| Settings → Profile section + opt-out toggle | 11 |
| `creator-context-block.ts` formatter | 12 |
| Captions / Viral Ideas / Bio Optimizer profile injection | 13 / 14 / 15 |
| Result UI sections (top patterns, format lean, hook structures) | 8 (Step 1) |
| Profile saved banner | 8 (Step 1, FoundationResult) |
| Credit cost (8) | 5 |
| Marketing site 3-card grid + FAQ | 4 |
| Out of scope: scraping, multi-channel, history table — not implemented (correct) | — |

All spec sections traced to a task. No gaps.

**Placeholder scan:** all code blocks contain real code. Comments inside Task 8 Step 1 ("the implementer copies the form …") describe a non-trivial UI block and reference an exact source file (`src/app/dashboard/channel-analysis/page.tsx:135-205`) for the pattern, which is the lowest-noise way to direct a fresh engineer. Step 2 of Task 8 then explicitly calls out filling in that markup.

**Type consistency:**
- `CreatorProfile.user_id` is the Map key in tests; matches DB primary key.
- `growth_stage` enum strings are identical across `creator-profile.ts`, `prompt.ts`, `creator-context-block.ts`, and the Settings PATCH route.
- `Sophistication` is `'beginner' | 'intermediate' | 'advanced'` in all of: page form, prompt input type, helper, schema CHECK is implicit (no DB constraint, so any string is permitted; defensive validation lives in the API route).
- `getCreatorProfile` returns `CreatorProfile | null` — referenced consistently by Phase 2 tasks.
- `formatCreatorContextBlock` accepts `CreatorProfile | null` so callers don't have to null-check before calling.

No issues found.

**Note on testing scope:** UI pages (Tasks 8, 10, 11) rely on manual smoke tests rather than automated tests. The codebase doesn't have an established pattern for testing React Server Components or interactive forms, and adding one is out of scope. The unit-tested surface area covers the highest-leverage logic: prompt construction, profile helper CRUD, and the context-block formatter — all the places where a regression would silently produce wrong output.
