# Onboarding Audit — PostCrisp (2026-08-18)

Goal under review: a new user should sign in and reach a pleasant, low-friction
onboarding that delivers **3-5 quick wins**. This document is the host's (Claude
Opus 5) first-pass audit. It is submitted for independent challenge.

## Context

- Next.js 14 App Router + TypeScript, Supabase (Auth + Postgres + RLS), Vercel.
- 32 tool directories under `src/app/dashboard/`.
- An onboarding wizard already exists at `src/app/onboarding/page.tsx` (7 steps).
- Tutorial grants free AI runs via `src/lib/tutorial-bypass.ts` (server-authoritative,
  one free run per feature: channel_analysis, captions, hashtags, viral_ideas).
- Credit costs (docs/credit-matrix.md): channel-analysis 5, viral-ideas 3,
  captions 1, hashtags 1 = **10 credits** of free value per new user.
- Creator Trial allowance is 10 credits/day for 3 days.

## Findings as drafted

### F1 — Single entrance, no return path. Severity: CRITICAL
`src/app/(auth)/signup/actions.ts:82` `redirect('/onboarding')` is the ONLY
navigation to /onboarding in the codebase. `src/app/(auth)/login/actions.ts:38`
hardcodes `redirect('/dashboard')`. `src/utils/supabase/middleware.ts` has no
onboarding gate (it gates unauth -> /login and /admin role only).
Implication: any interruption permanently exits onboarding. The resume logic at
`src/app/onboarding/page.tsx:96-141` (rehydrates step, niche, captionTopic,
selectedChannel from tutorial_progress) is effectively dead code for dropouts
because nothing routes them back.
Proposed fix: middleware gate — logged-in user with preferences.onboarded_at null
AND tutorial_progress.completed !== true hitting /dashboard -> redirect /onboarding.

### F2 — Email confirmation may bypass onboarding entirely. Severity: CRITICAL (UNVERIFIED)
`src/app/auth/callback/route.ts:17` defaults safeNext to '/dashboard'.
`supabase/config.toml:226` sets enable_confirmations = false, but that is LOCAL
CLI config and does not prove the production setting.
Implication IF confirmations are ON in prod: signUp() returns no session; the
redirect('/onboarding') lands a session-less browser on the wizard, whose useEffect
bounces it to /login; the real entry becomes the email link -> /auth/callback ->
/dashboard. Onboarding would never run for anyone, silently.
Explicitly labelled an ASSUMPTION — cannot be verified from the repo.

### F3 — "Skip all" silently destroys ~10 credits of value. Severity: HIGH
`src/app/onboarding/page.tsx:151` finish(skipped=true) writes completed:true.
`src/lib/tutorial-bypass.ts:52` returns false permanently once completed.
The button is in the top bar on every step including welcome. No confirmation,
no statement of what is forfeited.
Proposed fix: skip should mean "later", not "never" — record a snooze instead of
setting completed.

### F4 — 7 steps, no output until step 3. Severity: HIGH
Flow: welcome -> channels -> analyze -> captions -> hashtags -> viral -> save.
Step 1 is prose; step 2 is data entry hard-gated by
`disabled={channels.length === 0}` (page.tsx:262). First real output is step 3.
Brief asked for 3-5 quick wins. Proposed fix: re-sequence to value-first.

### F5 — Dropout cannot see their unclaimed free credits. Severity: MEDIUM
`src/app/dashboard/page.tsx:570` showNextTools = tutorialDone || !!onboardedAt,
so dropouts do not get the Phase-2 card. They DO get GettingStartedCard (renders
unconditionally), so they are not fully stranded. But nothing anywhere surfaces
the 10 free credits still valid in their account.

### F6 — 32 tools, no progressive disclosure at entry. Severity: MEDIUM
Choice overload at the front door, worst for the users F1 already dropped.

## Named production-readiness gaps

- NO funnel instrumentation. No telemetry on step transitions; cannot answer
  "where do people drop off". Every finding above is therefore a hypothesis.
  tutorial_progress.step is already persisted per user, so aggregate reporting
  is cheap.
- Accessibility: StepIndicator is nested divs, no nav/ol semantics, no aria-current.
- Mobile: step labels are `hidden md:inline` (page.tsx:52) — phone users see bare
  numbers. Consumer product, phone likely majority.
- Error states mid-wizard on a failed generation not confirmed.

## Cost note

Fixing F1 and F3 will INCREASE AI spend, because more users will claim the
giveaway that is already on offer. Channel Analysis alone is 5 of the 10 credits
and is the obvious lever if volume modelling comes back too high.

## Proposed fix order

1. Verify production email-confirmation setting (F2) — gates everything.
2. Middleware onboarding gate (F1).
3. "Skip all" means later (F3).
4. Re-sequence to value-first, the actual 3-5 quick wins redesign (F4).
5. Instrument the funnel — arguably belongs before 4.

## What is being asked of the council

1. Challenge any finding you think is wrong, overstated, or understated.
2. Challenge the severity ranking.
3. Challenge the fix order — in particular whether instrumentation should
   precede the F4 redesign.
4. Propose what the 3-5 quick wins should actually BE for a creator-tools
   product, and whether re-sequencing the existing wizard or replacing it is
   the better call.
5. Name anything material this audit missed.
