# Foundation Analysis — Design Spec

**Date:** 2026-04-30
**Status:** Draft, awaiting user review
**Author:** Claude (via brainstorming session)

## Summary

Ship **Foundation Analysis** — a new Elite-tier feature that produces a deep, evidence-grounded creator audit AND saves a structured **Creator Profile** that downstream tools (Captions, Viral Ideas, Bio Optimizer in Phase 2) read on every generation. Drop the Team tier from pricing.

The existing **Channel Analysis** stays exactly as-is (Creator+ tier, 5 credits, 7-field form, single-shot inferred audit). Foundation Analysis is a separate, more powerful feature — not a replacement.

## Why this exists

The current Channel Analysis is bottlenecked by inference: the AI never actually looks at the user's content. It guesses from 7 declared fields. Foundation Analysis fixes the inference ceiling with two changes — richer declared fields AND user-pasted sample posts (the "evidence layer") — and turns the output into reusable state instead of a one-shot read.

The strategic frame for Elite subscribers: **Foundation Analysis is the foundation every other tool reads from.** Once filled, captions match the user's voice, viral ideas match their pillars, bio optimizes for their actual monetization stage. No more re-explaining yourself per tool.

## Tier strategy changes

**Drop the Team tier entirely.** Confirmed: zero current Team subscribers. Removal scope:

- `src/lib/crisp-engine-config.ts` — strip `'team'` from `Tier` union, remove from `effectiveTier`, `tierFromDbValue`, `TIER_LABELS`, `TIER_BADGE_LABEL`, `TIER_ALLOWANCE`
- `src/app/page.tsx` — remove Team `PricingCard`; collapse 4-card grid to 3-card grid; update FAQ at line 108–112 to remove Team references
- `src/app/dashboard/billing/page.tsx` — remove Team `PaidTier`, Team `PricingCard`, Team gradient styling
- `src/hooks/useSubscription.ts` — remove `'team'` from `upgrade` union and `isTeam` flag
- `src/lib/voice-profile.ts` — strip `'team'` from tier union
- `src/components/ui/EngineBadge.tsx` — remove team color variant
- `src/lib/stripe.ts` — remove `team_monthly` / `team_yearly` price entries
- `src/app/api/stripe/checkout/route.ts` — remove `team` from valid tiers
- `src/app/api/admin/feature-access/route.ts` — strip from `VALID_TIERS`
- `src/app/api/admin/users/[id]/route.ts` — strip from `VALID_TIERS`
- `src/app/admin/users/page.tsx` and `[id]/page.tsx` — remove `<option value="team">` entries
- `src/app/admin/feature-access/page.tsx` — remove from `TIER_OPTIONS` array
- `README.md` — sweep Team mentions

Final tier ladder: **Starter / Creator / Elite**.

## Feature scope

### Phase 1 — Foundation Analysis ships (~3 days)

The new feature is fully usable; the saved profile is written to DB but not yet consumed by other tools.

### Phase 2 — Downstream consumption (~2 days, ships immediately after Phase 1)

Three tools read the saved Creator Profile and inject it into their prompts as a "Creator Context" block:

- **Captions** — voice signature + audience persona + content pillars
- **Viral Ideas** — content pillars + audience persona + format strengths
- **Bio Optimizer** — monetization position + differentiators + audience persona

Phase 3+ (rolling, not in this spec) — Brand Pitch, Scripts, CTA Optimizer, etc.

## Engine + admin registration

Add to `src/lib/crisp-engine-config.ts`:

```ts
export type CrispTask =
  // ... existing tasks
  | 'foundation-analysis'  // NEW

TASK_TIER_PROFILE['foundation-analysis'] = {
  starter: 'PREMIUM', creator: 'PREMIUM', elite: 'PREMIUM',
}

CREDITS_PER_TASK['foundation-analysis'] = 8

TASK_LABELS['foundation-analysis'] = 'Foundation Analysis'
```

Add to `src/lib/feature-access-config.ts`:

```ts
DEFAULT_MIN_TIER['foundation-analysis'] = 'elite'
```

Add to `src/lib/tools-meta.ts` under OPTIMIZE_TOOLS:

```ts
{
  key: 'foundation_analysis',
  category: 'optimize',
  icon: '🧬',
  label: 'Foundation Analysis',
  tagline: 'Evidence-grounded audit + reusable Creator Profile.',
  bestFor: 'The strategic foundation every other tool reads from.',
  href: '/dashboard/foundation-analysis',
}
```

Admin Feature Access page (`/admin/feature-access`) auto-picks up the new feature — no admin UI changes needed.

## Form structure

12 input fields grouped into 4 sections, plus a 3-slot evidence-layer panel (Section 4). Heavier than Channel Analysis on purpose; this is a quarterly-or-less form, not a daily one.

### Section 1: Your channel (5 fields, all from Channel Analysis)
- **Platform** — single-select pill row, 7 platforms
- **Channel handle / URL** — text input, optional
- **Niche** — preset dropdown OR custom free text
- **Follower count** — text input, optional
- **Posting cadence** — single-select dropdown, 6 buckets

### Section 2: Your strategy (4 NEW fields, all tiers if we ever lower the gate)
- **Content pillars** — 3 free-text inputs, each ≤60 chars. Required: ≥1.
- **Target audience** — 1-line free-text persona + sophistication dropdown (Beginner / Intermediate / Advanced)
- **Primary growth goal** — single-select pill row: Followers / Engagement / Monetization / Authority / Community
- **Monetization stage** — single-select pill row: None yet / Brand deals / Digital products / Services / Multi-stream

### Section 3: Your reality (1 NEW field + 1 from Channel Analysis)
- **Format strengths** — multi-select pill row: Carousels / Short-form video / Long-form video / Lives / Stills / Threads / Stories
- **Current challenges** — textarea, optional

### Section 4: Evidence layer (NEW, Elite-only — required for Foundation Analysis to run)
Three sample-post slots. Each slot has:
- **Caption text** — textarea, ≤500 chars per slot
- **Metric** — text input, e.g. "12K likes" / "200K reach" / "48K saves"
- **Why it worked (your theory)** — text input, ≤200 chars, optional but encouraged

At least 1 slot must have caption text. All 3 are encouraged for best signal.

### Required fields summary
- Required: platform, niche, ≥1 content pillar, target audience, growth goal, ≥1 evidence-layer slot with caption text
- Optional: everything else

## API contract

**POST `/api/foundation-analysis`**

Request body:
```ts
{
  platform: 'instagram' | 'tiktok' | 'youtube' | 'x' | 'facebook' | 'threads' | 'linkedin'
  niche: string
  followerCount?: string
  postingCadence?: string
  contentPillars: [string, string?, string?]  // 1–3
  targetAudience: { description: string; sophistication: 'beginner' | 'intermediate' | 'advanced' }
  growthGoal: 'followers' | 'engagement' | 'monetization' | 'authority' | 'community'
  monetizationStage: 'none' | 'brand-deals' | 'digital-products' | 'services' | 'multi-stream'
  formatStrengths: string[]
  currentChallenges?: string
  analyzeHandle?: string
  samplePosts: Array<{ caption: string; metric?: string; whyItWorked?: string }>  // 1–3
}
```

Response body — extends Channel Analysis output with profile + evidence findings:
```ts
{
  // Same shape as ChannelAnalysisResult — backwards-compatible audit fields
  overallAssessment: string
  strengths: string[]
  gaps: string[]
  contentMix: { observation: string; recommendation: string }
  postingConsistency: { observation: string; recommendation: string }
  audienceEngagement: { observation: string; recommendation: string }
  missedOpportunities: string[]
  quickWins: { title: string; action: string; impact: string }[]
  longTermMoves: { title: string; action: string; timeframe: string }[]

  // NEW — evidence-layer findings
  topPostPatterns: string[]        // what your wins have in common
  recommendedFormatLean: string    // single recommendation for which format to lean into
  repeatableHookStructures: { pattern: string; example: string }[]

  // NEW — saved Creator Profile (also written to creator_profiles table)
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

  analysis_id: string | null
}
```

The endpoint follows the Channel Analysis pattern: tutorial-mode bypass, credit gate via `checkAuthAndUsage`, persistence to `generations` (best-effort), parsed via `parseLooseJson`. Same `maxDuration = 120`.

## Database schema

New table `creator_profiles`:

```sql
create table creator_profiles (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  content_pillars      jsonb not null,                -- string[]
  voice_signature      jsonb not null,                -- { adjectives, examplePhrasing }
  audience_persona     jsonb not null,                -- { description, sophistication }
  growth_stage         text not null,
  monetization_position jsonb not null,               -- { stage, primaryStreams }
  format_strengths     jsonb not null,                -- string[]
  differentiators      jsonb not null,                -- string[]
  top_blockers         jsonb not null,                -- string[]
  source_analysis_id   uuid references generations(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index creator_profiles_updated_at_idx on creator_profiles(updated_at desc);
```

Upsert pattern: each Foundation Analysis run replaces the row. No history table; the `generations` table already holds the full input/output snapshot of every run.

New helper at `src/lib/creator-profile.ts`:

```ts
export async function getCreatorProfile(supabase, userId): Promise<CreatorProfile | null>
export async function upsertCreatorProfile(supabase, userId, profile, sourceAnalysisId)
```

## Phase 2 — Downstream consumption

After Phase 1 ships and is verified, three tools read the saved profile.

**Pattern:** at the top of each tool's prompt, inject a "Creator Context" block when a profile exists:

```text
## Creator context (the user's saved Foundation Analysis profile):
- Content pillars: AI tool reviews, founder workflow, behind the build
- Voice: plainspoken, contrarian, dry humor — phrases like "ship it ugly"
- Audience: indie hackers, intermediate sophistication, ship-curious
- Format strengths: carousels (3.2x reach lift), short-form video
- Differentiators: builds in public, specifies actual prompts, anti-hype
- Top blockers: reels feel forced, hook fatigue

Use this context to ground your output in the user's voice and audience. Do not generic-ify.
```

**Per-tool integration:**

| Tool | Profile fields injected |
|---|---|
| Captions | voice_signature, audience_persona, content_pillars |
| Viral Ideas | content_pillars, audience_persona, format_strengths |
| Bio Optimizer | monetization_position, differentiators, audience_persona, growth_stage |

**Opt-out toggle:** new `profiles.use_foundation_in_generations` boolean column, default `true`. User-facing toggle in `/dashboard/settings` → Profile section: *"Use my Foundation Analysis profile in generations."*

If toggle is off OR no profile exists → tools fall back to current behavior. No behavioral change for Starter/Creator users (they don't have a profile to inject).

## Result UI

`src/app/dashboard/foundation-analysis/page.tsx` mirrors the Channel Analysis result layout (overall, strengths, gaps, three-column observation/recommendation cards, quick wins, long-term moves) PLUS:

- New section: **Top post patterns** — bulleted list of what their wins have in common
- New section: **Recommended format lean** — single bold recommendation
- New section: **Repeatable hook structures** — table: pattern + example
- Banner at the top of the result: *"✨ Your Creator Profile is saved. It will be used by Captions, Viral Ideas, and Bio Optimizer on every future generation. [Manage Profile →]"*

## Paywall preview UX (Starter / Creator)

Reuse the existing `<FeatureGate>` component (`src/components/ui/FeatureGate.tsx`). Verified current props: `feature`, `featureLabel`, `featureIcon`, `featureTagline`, `valueProps[]`, `children`.

Two changes:

1. Foundation Analysis page wraps its content in `<FeatureGate feature="foundation-analysis" ...>` with `valueProps` describing real-signal / format-diagnosis / repeatable-hook benefits. Below-tier users see the gate with the perks grid and an "Upgrade to Elite — 8 credits per run" CTA linking to `/dashboard/billing`.
2. **Extend** `<FeatureGate>` with one new optional prop, `previewSnapshotUrl?: string`, that renders a static example output screenshot below the perks grid. The image is shipped as a static asset under `public/foundation-analysis-preview.png`.

## Onboarding integration

Elite users (and only Elite users) see a one-time CTA on the dashboard until Foundation Analysis has been run at least once:

> **🧬 Set up your Foundation Analysis** — *Captions, Viral Ideas, and Bio Optimizer get noticeably sharper once you've filled this in.*  [Run now →]

Implementation: existing dashboard page reads `creator_profiles` via the new helper; if `null` AND tier === 'elite' → renders the CTA card. Dismissable (stored in `profiles.foundation_cta_dismissed_at`).

## Marketing site updates

`src/app/page.tsx`:

1. **Pricing section** — drop the Team `PricingCard`. Adjust grid to 3-card layout (`md:grid-cols-3 xl:grid-cols-3`). The Elite card gets new feature line: *"Foundation Analysis — your reusable Creator Profile that powers every other tool."*
2. **FAQ** — line 108: drop "Team" from the credit-cycle list (`Creator / Elite`). Line 111: rewrite question as *"What's the difference between Creator and Elite?"* and rewrite answer to remove Team and lead Elite's pitch with Foundation Analysis.

(Verified: there is no separate feature-comparison table on the landing page — pricing cards carry the feature lists.)

## Credit cost rationale

Channel Analysis (Elite) currently costs ~$0.27/run at 5 credits. Foundation Analysis adds:
- ~+1200 input tokens (3 sample posts + structured analysis instructions)
- ~+1500 output tokens (evidence findings + Creator Profile JSON)
- ~+500 refine-pass tokens
- **Net additional API cost: ~$0.13/run (~50% lift)**

At 8 credits per run on the Elite tier (2000 credits/mo allowance), 8 credits = $0.20–0.40 of allowance against ~$0.40 actual API cost. Margin holds at scale.

## What's NOT in this spec

- Phase 3 downstream tools (Brand Pitch, Scripts, CTA Optimizer, etc.) — separate spec when Phase 2 lift is validated
- Auto-scraping of public profile content — explicitly out (fragile, weeks of work)
- Multi-channel profile (one profile per platform) — single profile only; user re-runs with a different platform if needed
- Profile versioning / history — no history table; `generations` is the source of truth for past runs
- Team tier migration — confirmed zero subscribers; clean drop

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Form length kills conversion | 11 fields grouped into clearly-labeled sections; only 6 are required; quarterly cadence (not daily) earns the depth |
| AI gets confused by sample posts in prompt | Strict prompt structure with section headers; refine pass catches generic outputs |
| Profile feels "stuck" — users want to update one field | Settings → Profile manual edit page (Phase 2) lets users override any field without re-running the audit |
| Creator Profile JSON parse failure | Same `parseLooseJson` resilience as Channel Analysis; profile upsert is best-effort, audit still returned to user |
| Phase 2 prompt bloat slows generation | Profile injection adds ~300 tokens; negligible against existing 1500–4000 token prompts |
| Marketing site looks empty after dropping Team | 3-card pricing layout reads cleaner than 4-card; adjust grid breakpoints accordingly |

## Out-of-scope follow-ups

- Routine to remind users to refresh their Foundation Analysis every 90 days
- Voice Trainer integration — Voice Trainer is the next planned build per project memory; when it ships, voice_signature should sync between the two
- Public Creator Profile share link (e.g. for media kits) — not in MVP

## Implementation order

1. DB migration: `creator_profiles` table + `profiles.use_foundation_in_generations` + `profiles.foundation_cta_dismissed_at`
2. Engine + feature-access + tools-meta config entries
3. `src/lib/creator-profile.ts` helper
4. `/api/foundation-analysis` route + types + prompt
5. `/dashboard/foundation-analysis` page (form + result)
6. Dashboard onboarding CTA card for Elite users with no profile
7. Team tier removal sweep (parallel with steps 1–6, can ship independently)
8. Marketing site update (parallel with step 7)
9. **Ship Phase 1.** Verify in alpha.
10. Settings → Profile page (view + edit + opt-out toggle)
11. Captions: inject Creator Context block
12. Viral Ideas: inject Creator Context block
13. Bio Optimizer: inject Creator Context block
14. **Ship Phase 2.**

Estimated effort: Phase 1 ~3 days, Phase 2 ~2 days. Total ~5 days end-to-end.
