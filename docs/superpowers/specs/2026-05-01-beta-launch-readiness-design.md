# Beta Launch Readiness — Design Spec

**Date:** 2026-05-01
**Status:** Draft, awaiting user review
**Author:** Claude (via brainstorming session)
**Type:** Ops / launch spec (not a code-feature spec)

## Summary

Ship the `foundation-analysis` branch to `main` and run a **hand-picked, expanded-invite-only beta wave** starting 2026-05-02 (Saturday) using **soft cutover (B)**. Recruitment via a video posted Saturday — viewers express interest, user manually selects + invites. Same access-control gate already in production; no Stripe activation, no public marketing surface, no self-serve signup.

This spec is the punchlist that turns the current branch state ("✅ no hard blockers, brainstorm in progress") into ("🟢 wave 1 invites sent, monitoring open").

## Why now

- `foundation-analysis` branch is 24 commits ahead of `main` with full subagent-reviewed changes (FA feature + Team tier drop + NDA bump v1.1)
- All planned features for this milestone (Foundation Analysis + Voice Trainer + rocket loader + brand refresh + single-use invite codes + MFA hardening) are shipped on the branch
- No hard blockers identified during brainstorming; pre-flight punchlist is small and well-scoped
- User wants to start the beta wave now and gather signal on Foundation Analysis in real use, before further feature work

## Decisions locked (during brainstorming)

- **Beta = expanded invite-only.** Same access-control gate, larger invite-code batch, no Stripe, no public marketing surface
- **Tester provisioning is manual.** User adjusts `subscription_tier` per tester at `/admin/users/[id]` and grants credits at `/admin/credit-adjustments`
- **NDA bumped 1.0 → 1.1**, alpha → beta language across `src/lib/alpha-agreement.ts`, `src/app/accept-terms/page.tsx`, `docs/alpha-tester-agreement.md`. Internal symbol names (`ALPHA_AGREEMENT_*`, `alpha_nda` JSONB key, `/api/user/alpha-acceptance` route, `requireAlphaAcceptance()`) intentionally NOT renamed — implementation detail, no user-visible benefit
- **Existing alpha testers will be re-prompted** to accept v1.1 on next dashboard hit. Captain admin (`captain@postcrisp.com`) bypasses
- **Recruitment via Saturday video** — user hand-picks testers from response funnel. No public signup form, no auto-recruitment
- **Soft cutover (B) chosen over hard cutover (A)** — Fri-night fix → Sat-AM gates verified → trickle invites as user picks → Sun-AM wave-blast if green
- **Tester-support chatbot deferred** — saved for a later feature. `beta@postcrisp.com` reply-able alias serves as support channel for this wave

## Out of scope for this wave

- Stripe activation
- Public marketing
- Auto-recruitment / public tester signup form
- In-app support chatbot
- Any new features (FA + Voice Trainer + rocket loader already shipped on branch — no further code work expected before launch)
- Renaming `alpha_*` internal symbols to `beta_*` (deferred indefinitely; no user-visible benefit)

## Success criteria (for the wave)

- ≥80% of invited testers complete signup (invite redemption rate)
- ≥50% of signed-up testers finish the 5-step tutorial
- Sentry issue rate stays within ~2× baseline through Sat–Sun
- Zero invite-code race-condition incidents (single-use enforcement holds under real concurrency)
- ≥2 testers run Foundation Analysis end-to-end **and** their saved Creator Profile influences a downstream Captions / Viral Ideas / Bio Optimizer run (the entire reason FA exists)
- Anthropic spend stays under $20 for the wave
- Zero NDA-acceptance-flow regressions reported by testers
- No critical user-flow regression that requires Vercel rollback

## The 7-section punchlist

### 1. Pre-flight code gates ⚠️ **Friday 2026-05-01 evening**

Must complete before any tester gets an invite.

- **Capture `public/foundation-analysis-preview.png`** (1600×900) — screenshot of `/dashboard/foundation-analysis` Elite result page. **Without this, the paywall card renders broken to every Starter tester within seconds of signup. This is the highest-likelihood "oh no" of the launch — non-negotiable.**
- **Confirm `STRIPE_ELITE_MONTHLY` and `STRIPE_ELITE_YEARLY` env vars** are set in Vercel production env (Team prices were removed from `src/lib/stripe.ts`; missing Elite vars would 500 `/dashboard/billing` on first paid-tier click)
- **Apply `src/lib/supabase-schema.sql` to PRODUCTION Supabase project.** Session 16 applied schema to dev; prod DB still needs the new `creator_profiles` table + RLS policies + `updated_at` trigger + the two tightened CHECK constraints (`profiles.subscription_tier` and `feature_access.min_tier`). The file is now fully re-runnable post-session-16 idempotency patch, so re-applying is safe. **If skipped, FA writes will silently fail in prod with no surfaced error.**
- **Merge `foundation-analysis` → `main`** at user's discretion (squash vs merge-commit). Recent style is merge-commit
- **Vercel auto-deploys main** — verify deploy is green before sending any invites
- **Smoke-test on a real Elite tester account end-to-end** (NOT `captain@postcrisp.com` — captain bypasses the NDA gate, so it won't exercise the v1.1 acceptance flow). Use a separate Elite-tier account, or temporarily set a new test email to `subscription_tier='elite'`. Path: dashboard loads → FA CTA visible → run Foundation Analysis with full 11-field input → confirm Creator Profile written to DB → run captions → confirm "Creator Context" block appears in the prompt. **Also do the FA + Voice Trainer combined-flow check on this same account** (honest-pushback flag: that combo hasn't been exercised together by a real user)

### 2. Tester provisioning

Done per-tester as user picks them from the video response funnel; not a single batch.

- **Generate invite codes at `/admin/invite-codes`** — wave size + 25% buffer (e.g. 8 codes for a 6-tester wave). Single-use enforcement is already in place post-session-14c
- **For each picked tester:** set `subscription_tier` via `/admin/users/[id]` to `elite` (so they have FA access) — or `creator` if specifically testing the non-FA flow
- **Grant credits per tester** via `/admin/credit-adjustments` — recommend **100 credits** (≈$2-5 of API spend at typical usage; covers FA + several downstream runs + buffer for re-runs)
- **Send invite email manually** with the single-use code + link to `/accept-terms`

### 3. Cost & abuse defense ⚠️

Defense in depth — rate limiter is already in place, this is the second line.

- **Anthropic monthly spending cap: $50–$100.** Set in Anthropic console. A misbehaving prompt loop or compromised tester credentials could otherwise burn through credits before the rate limiter throttles them
- **OpenAI monthly spending cap: $25–$50.** Per `src/lib/crisp-engine-config.ts:96`, the FAST `PowerProfile` is `openai/gpt-4o-mini` and FAST is the default profile for nearly every feature on Starter tier (~16 of the 18 task entries). The Elite refine pass on FA also uses `gpt-4o-mini` as critic. So Starter testers will hit OpenAI on most calls; cap it
- **Spot-check Upstash dashboard** for pre-launch anomalies (no unexpected rate-limit pressure or stuck keys before invites go out)

### 4. Tester feedback loop ⚠️

The chatbot is deferred — `beta@` alias is the only support channel for this wave. Make sure it works.

- **`FeedbackButton` already wired in `src/app/dashboard/layout.tsx:28`** — manual test from a non-admin account: submit feedback → confirm `/api/feedback` notification surfaces to user's inbox in real time
- **Set up reply-able `beta@postcrisp.com` alias** since `noreply@postcrisp.com` is sender-only. Forwarding to user's primary inbox; verify reply-from works (a tester who replies to the invite email must reach a real human)
- **Send testers a one-page "what we want feedback on" doc** when sending the invite. Suggested focus areas: FA result quality, Creator Profile accuracy after edits, downstream tool coherence (do captions actually match the voice?), tutorial clarity, anything broken or confusing

### 5. Real-environment regression checks ⚠️

The branch hasn't been exercised cold since the brand refresh + 3-tier pricing + FA CTA shipped.

- **Cold-account walkthrough from a fresh email + incognito window:** signup → `/accept-terms` (NDA v1.1) → dashboard → FA CTA card → run FA → tutorial → captions. Note any rough edges or surprises
- **Email deliverability spot-check:** invite-style email to gmail + outlook — confirm not landing in spam (Resend SMTP is in use; spot-check is cheap)
- **OG card preview for `postcrisp.com`** — paste the link into Twitter / Slack / LinkedIn / iMessage and confirm the card renders (post-logo-refresh, this hasn't been re-verified)
- **Mobile sanity check:** Foundation Analysis form is long (11 fields, 4 sections) — verify it's usable on viewport <420px. Rocket loader animation on the same viewport

### 6. Saturday-AM monitoring + rollback

- **Sentry filter pinned** to last 24h, errors only, in a separate browser tab through Sat–Sun
- **Anthropic Usage dashboard refreshed every 2-3 hours** through Sat afternoon. Watch for spend curve — flat line is good, exponential is bad
- **Stripe webhook delivery dashboard** open in a tab — should stay quiet (no Stripe activity expected this wave; signal of unexpected activity = something's wrong)
- **Vercel rollback path known:** Promote previous deployment from Vercel UI. **This reverts FA + Team-drop together** (cost of bundling them on one branch — acceptable given session 16 is fully tested, but user should know rollback isn't surgical)
- **Backout criteria written before merging:** "If Sentry error rate > 5× baseline, OR Anthropic spend > $30/hour, OR a critical user-flow regression is reported by a canary tester — promote previous deployment immediately. Diagnose offline, fix forward."

### 7. Post-NDA-bump smoke-test ⚠️ **NEW** (added by NDA v1.1 bump this session)

- Sign in as a non-admin tester (Rodney, or a fresh staging account)
- Hit `/dashboard` → confirm redirect to `/accept-terms`
- Page shows: title **"Beta Tester Agreement"**, version **1.1**, effective date **"Effective 2026-05-01"** (or whatever the page renders for `2026-05-01`), and the new section text (alpha → beta language)
- Click accept → redirect to dashboard works
- Re-load dashboard → no further redirect (acceptance persisted)
- **Captain admin path:** sign in as `captain@postcrisp.com` → confirm bypass (no `/accept-terms` redirect)
- **If user has any v1.0 alpha testers in production**, confirm one of them is re-prompted to accept v1.1 on next dashboard hit (intended consequence; v1.0 record preserved in audit log)

## Cutover plan (soft cutover B)

| When | Step |
|------|------|
| Fri 2026-05-01 evening | Punchlist sections 1–7 completed; merge `foundation-analysis` → `main`; verify Vercel deploy green |
| Sat 2026-05-02 AM | User posts recruitment video. Sections 5+7 verified one more time on production main |
| Sat 2026-05-02 AM–PM | User reviews response funnel, hand-picks 2–3 **canary testers**, provisions and sends invites |
| Sat 2026-05-02 PM | Watch Sentry + Anthropic spend + FeedbackButton inbox. Confirm canary testers complete signup + tutorial + ideally one FA run without incident |
| Sun 2026-05-03 AM | **If green:** send remaining wave invites (the rest of the picked testers). **If red:** investigate root cause, fix forward or rollback per section 6 |

Hard cutover (A) — all-at-once Saturday — is **rejected**. Same total work, much worse blast-radius control. Soft cutover gives 12-24h to catch a deploy-time regression before it hits the full wave.

## Risks & honest pushback

### Risks called out

- **Paywall preview screenshot is the highest-likelihood "oh no"** — every Starter tester sees it within seconds of signup. If missing, the dashboard FA CTA card renders broken. **Section 1 must complete before any tester gets an invite**
- **Foundation Analysis + Voice Trainer haven't been exercised together** by a real user. Combined prompt-length and saved-profile interaction not smoke-tested. Recommend a single-account combined run during section 1 smoke-test
- **Bundled rollback** — FA + Team-drop ship together on one branch. Vercel rollback reverts both. Acceptable cost given session 16 is fully tested, but user should mentally price in "rollback = lose Team-drop too, briefly"
- **Anthropic spend cap may surprise on a Voice Trainer-heavy tester** — Voice Trainer is more chatty than FA. The $50-$100 cap has plenty of headroom for the wave size, but worth knowing the per-tester cost ceiling isn't the same per feature

### Honest pushback applied during brainstorming

- **Chatbot deferred** — adding a tester-support chatbot to this launch was scope expansion (2-5 days of build right at launch). Rejected; deferred to a later feature. `beta@` alias serves as the support channel for this wave
- **Hard cutover rejected** in favor of soft cutover B — same total work, dramatically better blast-radius control given the launch surface (FA is the headline Elite differentiator, regression risk is asymmetric)
- **Public auto-recruitment rejected** — user controls tester picks via the video response funnel. Avoids invite-code waste, lets user steer for diverse representative testers, removes the need to harden self-serve signup before launch

## Followups (post-launch, not blocking)

- After 2 weeks of zero `'team'` rows confirmed in production, remove the defensive `case 'team': return 'creator'` line in `tierFromDbValue` (already scheduled via background agent)
- Capture FA + Voice Trainer combined-flow learnings; if the combined prompt is brittle, ship a prompt-length guard or sequencing refactor
- Wave 2 planning: what we learned + decision on tester-support chatbot (build it now vs continue with `beta@` alias indefinitely)
- Optional: rename `alpha_*` internal symbols to `beta_*` if a future refactor justifies the diff size (not blocking; current names are an implementation detail)

## Files this spec touches

This is an ops / launch spec; **no application-code changes flow from it**. Code changes for this milestone are already shipped on the `foundation-analysis` branch.

The plan generated by `writing-plans` from this spec will reference:

- Vercel env-var settings (no file)
- `public/foundation-analysis-preview.png` (new image asset, captured manually from the running app)
- Anthropic + OpenAI console settings (no file)
- Resend `beta@` alias config (no file in repo)
- A possible `docs/beta-tester-feedback-focus.md` for the one-page "what we want feedback on" doc (section 4)

Everything else is a verification / monitoring step, not a code edit.
