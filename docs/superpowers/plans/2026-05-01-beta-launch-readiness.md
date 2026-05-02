# Beta Launch Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `foundation-analysis` branch (24 commits ahead of `main`) to production and run a hand-picked, expanded-invite-only beta wave starting Saturday 2026-05-02 using soft cutover (B): canary Saturday → wave-blast Sunday if green.

**Architecture:** This is an **ops / launch plan**, not a code-feature plan. Application code is already shipped on the `foundation-analysis` branch (Foundation Analysis + Team tier drop + NDA bump v1.1 + Voice Trainer + rocket loader + brand refresh + single-use invite codes + MFA hardening). The work in this plan is verification, configuration, deployment, and tester provisioning — performed mostly through the production console, the running app, and `git`.

**Tech Stack:** Vercel (production hosting + env vars + rollback), Supabase (production Postgres + RLS), Anthropic + OpenAI consoles (spending caps), Resend (`beta@` alias), the running PostCrisp app at `https://postcrisp.com`, `git` + `npm`.

**Spec:** `docs/superpowers/specs/2026-05-01-beta-launch-readiness-design.md`

**Cutover plan:**

| When | Tasks |
|------|-------|
| Fri 2026-05-01 evening | Tasks 1–11 (pre-flight + merge + post-merge verification) |
| Sat 2026-05-02 AM | Task 12 (open monitoring + backout criteria); user posts recruitment video |
| Sat 2026-05-02 AM–PM | Task 13 (canary tester provisioning + invites) |
| Sat 2026-05-02 PM | Task 14 (afternoon monitoring + go/no-go review) |
| Sun 2026-05-03 AM | Task 15 (wave-blast or rollback) |
| Sun 2026-05-03 evening | Task 16 (update PICKUP.md, capture learnings) |

**File structure (changes from this plan):**

| File | Purpose | Task |
|---|---|---|
| `public/foundation-analysis-preview.png` (new) | Paywall-card preview image; without it the FA CTA card on every Starter dashboard renders broken | 2 |
| `docs/beta-tester-feedback-focus.md` (new) | One-page "what we want feedback on" doc sent with each invite | 6 |
| `PICKUP.md` (modify) | Update tracker after launch with state of the wave + learnings | 16 |
| Production Supabase schema | Apply `src/lib/supabase-schema.sql` (creator_profiles + RLS + trigger + 2 CHECK updates + idempotency patch) | 1 |
| Vercel production env vars | Confirm `STRIPE_ELITE_MONTHLY` / `STRIPE_ELITE_YEARLY` / Anthropic + OpenAI keys | 3 |
| Anthropic + OpenAI consoles | Set monthly spending caps | 4 |
| Resend (or DNS) | `beta@postcrisp.com` reply-able alias | 5 |

---

## Pre-flight (Friday 2026-05-01 evening, before merge)

### Task 1: Apply DB schema to production Supabase

**Why first:** If `creator_profiles` table doesn't exist in prod when the merged code runs there, Foundation Analysis will silently fail to write profiles — defeating the entire reason FA exists. Schema must land before the deploy.

**Files:**
- Read: `src/lib/supabase-schema.sql` (already idempotent post-session-16 patch — re-runnable)

- [ ] **Step 1: Verify the schema file is current**

Run from repo root:

```powershell
git log --oneline -5 src/lib/supabase-schema.sql
```

Expected: most recent commit references the idempotency patch (`b227084 fix(db): make all 38 CREATE POLICY statements re-runnable`) or later. If not, you're on the wrong branch.

- [ ] **Step 2: Open production Supabase SQL editor**

Navigate to the **production** PostCrisp project at https://supabase.com/dashboard → SQL Editor → New query.

**⚠️ CRITICAL:** Confirm you're in the production project, NOT the dev project. Verify by checking the project name in the top-left dropdown matches the production URL referenced in Vercel env vars.

- [ ] **Step 3: Paste the full contents of `src/lib/supabase-schema.sql`**

Paste the entire file. The file is fully idempotent (every CREATE has DROP IF EXISTS or IF NOT EXISTS guards as of `b227084`). Re-running is safe.

- [ ] **Step 4: Run the schema and verify zero errors**

Click **Run**. Expected: "Success. No rows returned." or similar success message. No red error toast.

If you see an error, **stop and diagnose before merging.** Common failure modes:
- Type collision on existing policies (should be impossible post-idempotency patch — investigate)
- Permission error (user running query lacks DDL privileges)
- Syntax error from a manual edit that didn't get committed

- [ ] **Step 5: Verify `creator_profiles` table exists**

Run in the SQL editor:

```sql
select count(*) from creator_profiles;
select table_name, column_name from information_schema.columns
where table_name = 'creator_profiles' order by ordinal_position;
```

Expected:
- First query: `count = 0` (or however many rows exist if any test data)
- Second query: shows columns including `id`, `user_id`, `voice_signature`, `audience_persona`, `content_pillars`, etc.

- [ ] **Step 6: Verify RLS is enabled**

Run:

```sql
select tablename, rowsecurity from pg_tables where tablename = 'creator_profiles';
```

Expected: `rowsecurity = true`

- [ ] **Step 7: Verify the two tightened CHECK constraints**

Run:

```sql
select conname, pg_get_constraintdef(oid) from pg_constraint
where conname like '%subscription_tier%' or conname like '%min_tier%';
```

Expected: neither constraint definition contains `'team'`. Both should reference `('starter', 'creator', 'elite')` only.

- [ ] **Step 8: Spot-check there are zero `'team'` rows in production**

Run:

```sql
select count(*) from profiles where subscription_tier = 'team';
select count(*) from feature_access where min_tier = 'team';
```

Expected: both return `0`. If non-zero, the CHECK constraint apply will have failed in step 4 — investigate before proceeding.

---

### Task 2: Capture FA paywall preview screenshot

**Why critical:** The dashboard renders an FA CTA card to every Starter tester (`src/app/dashboard/page.tsx`). The card's `<FeatureGate previewSnapshotUrl="/foundation-analysis-preview.png" />` reference will 404 without this file, leaving every Starter tester staring at a broken image within seconds of signup.

**Files:**
- Create: `public/foundation-analysis-preview.png` (1600×900 PNG)

- [ ] **Step 1: Start dev server**

Run from repo root:

```powershell
npm run dev
```

Expected: server starts on port 3000 (or next available); console shows `Local: http://localhost:3000`.

- [ ] **Step 2: Sign in as an Elite-tier account on dev**

Open http://localhost:3000 in a browser. Sign in with an Elite-tier account (or temporarily promote a dev account: Supabase dev → SQL Editor → `update profiles set subscription_tier = 'elite' where email = '<your-test-email>';`).

- [ ] **Step 3: Run Foundation Analysis end-to-end on dev**

Navigate to http://localhost:3000/dashboard/foundation-analysis. Fill all 11 fields with realistic but generic content (this image will be visible to every Starter tester — don't expose your real strategy). Submit and wait for the result page.

- [ ] **Step 4: Take a 1600×900 screenshot of the result page**

Use Windows Snipping Tool (Windows+Shift+S) or browser dev-tools:
1. Open Chrome DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Set custom dimensions: 1600 × 900
4. Take a screenshot of the FA result panel (everything below the "Results" header — the executive summary, voice signature, content pillars, evidence interpretation)

Save as `public/foundation-analysis-preview.png` in the repo.

- [ ] **Step 5: Verify the file exists and is not corrupted**

Run:

```powershell
Get-ChildItem public/foundation-analysis-preview.png | Select-Object Name, Length
```

Expected: file exists, `Length` > 50000 (50 KB minimum — a realistic screenshot will be 200-800 KB).

- [ ] **Step 6: Verify the paywall card renders correctly on dev**

In another browser/incognito, sign in as a Starter-tier account. Navigate to `/dashboard/foundation-analysis`. The FeatureGate paywall page should render the preview image — not a broken-image icon.

- [ ] **Step 7: Commit the screenshot**

```powershell
git add public/foundation-analysis-preview.png
git commit -m "feat: add Foundation Analysis paywall preview image"
```

Expected: commit succeeds, file shows up in `git log --oneline -1`.

---

### Task 3: Verify Vercel production env vars

**Files:** None (Vercel dashboard config)

- [ ] **Step 1: Open Vercel project settings**

Navigate to Vercel Dashboard → PostCrisp project → Settings → Environment Variables → Production.

- [ ] **Step 2: Confirm Stripe Elite price IDs are present**

Required keys:
- `STRIPE_ELITE_MONTHLY` (price ID, starts with `price_`)
- `STRIPE_ELITE_YEARLY` (price ID, starts with `price_`)

If either is missing or empty, copy the price ID from Stripe Dashboard → Products → PostCrisp Elite → Pricing. **Do not** leave Team variables in env (they're not referenced anymore but stale env vars are noise).

- [ ] **Step 3: Confirm AI provider keys**

- `ANTHROPIC_API_KEY` — non-empty, starts with `sk-ant-`
- `OPENAI_API_KEY` — non-empty, starts with `sk-`

- [ ] **Step 4: Confirm Supabase + auth keys**

- `NEXT_PUBLIC_SUPABASE_URL` — points to **production** project URL (not dev)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — production anon key
- `SUPABASE_SERVICE_ROLE_KEY` — production service-role key
- `NEXTAUTH_SECRET` (or whatever auth secret env var is in use) — non-empty

- [ ] **Step 5: Confirm Resend / mail keys**

- `RESEND_API_KEY` — non-empty, starts with `re_`
- Any `FROM_EMAIL` / `REPLY_TO` env vars — match `noreply@postcrisp.com` / `beta@postcrisp.com` per Task 5

- [ ] **Step 6: Note Upstash keys**

- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` — non-empty (rate limiter uses these)

- [ ] **Step 7: Document the state**

In a private note (not committed), write down: `Vercel env vars verified <timestamp>: Stripe Elite ✓, AI keys ✓, Supabase prod ✓, Resend ✓, Upstash ✓`. This is the audit trail for the launch.

No commit (no file change).

---

### Task 4: Set spending caps and Upstash spot-check

**Files:** None (provider consoles)

- [ ] **Step 1: Set Anthropic monthly spending cap**

Navigate to https://console.anthropic.com/ → Settings → Billing → Usage limits. Set monthly spending cap to **$100** (with $50 alert threshold). Recommended values per the spec:
- Hard cap: $100
- Email alert at: $50

Confirm the limit is "Hard limit" (blocks API calls when reached) not "Soft limit" (only alerts).

- [ ] **Step 2: Verify Anthropic cap saved**

Refresh the page; confirm the limit shows `$100` and is active.

- [ ] **Step 3: Set OpenAI monthly spending cap**

Navigate to https://platform.openai.com/ → Settings → Billing → Usage limits. Set monthly spending cap to **$50** (with $25 alert threshold). FAST `PowerProfile` is openai/gpt-4o-mini and is the default profile for ~16 of 18 features on Starter tier — will hit OpenAI on most tester calls.

- [ ] **Step 4: Verify OpenAI cap saved**

Refresh; confirm both `Hard limit: $50` and `Soft limit: $25` are saved.

- [ ] **Step 5: Spot-check Upstash dashboard**

Navigate to https://console.upstash.com/ → PostCrisp Redis instance → Metrics. Confirm:
- No error spikes in the last 24h
- Connections are within healthy range
- No hot keys flagged
- Memory usage is normal (well below limit)

If anything looks off, investigate before launching. The rate limiter is the first line of defense; if Upstash is degraded, abuse will hit the spending caps directly.

No commit (no file change).

---

### Task 5: Set up `beta@` alias and verify FeedbackButton

**Files:** None (Resend / DNS config)

The chatbot is deferred. `beta@postcrisp.com` is the only synchronous support channel for this wave. It must work before invites go out.

- [ ] **Step 1: Configure `beta@postcrisp.com` forwarding in Resend (or DNS provider)**

In Resend Dashboard → Domains → postcrisp.com → Email forwarding (or in your DNS provider's email-forwarding settings):

Add forwarding rule: `beta@postcrisp.com` → **your primary inbox** (e.g., the address in `iambigd@gmail.com` user-memory if that's the inbox you check).

If Resend doesn't host inbound email forwarding for your plan, alternatives:
- Use ImprovMX or Cloudflare Email Routing as a free forwarder layered on the domain's MX records
- Use a Google Workspace alias if the domain is on Workspace

- [ ] **Step 2: Verify forwarding works (live test)**

From a different email address (e.g., a personal gmail not connected to your primary inbox), send an email to `beta@postcrisp.com`. Subject: `BETA FORWARD TEST`. Body: `Reply path validation`.

Expected: email lands in your primary inbox within 1-2 minutes. Check spam folder if not in inbox after 5 minutes.

- [ ] **Step 3: Verify reply-from works**

Reply to the email from your primary inbox. Subject: `Re: BETA FORWARD TEST`. Confirm the reply appears in the original sender's inbox with `From:` set to either your primary address OR `beta@postcrisp.com` (depending on forwarder config — either is acceptable as long as the conversation can two-way).

- [ ] **Step 4: Verify FeedbackButton notifies your inbox**

On dev (`npm run dev`), sign in as a non-admin tester account. Navigate to `/dashboard`. Click the FeedbackButton in the layout (ref: `src/app/dashboard/layout.tsx:28`). Submit a test feedback message: "BETA TEST — feedback flow live check". Submit.

Expected: notification arrives in your primary inbox within 1-2 minutes via the `/api/feedback` route's email send. If not, check Resend dashboard for delivery status and Sentry for `/api/feedback` errors.

- [ ] **Step 5: Confirm FeedbackButton works on production after merge (deferred to Task 11)**

Note: this same flow must be re-verified on production after Task 7 merge. The Task 11 cold walkthrough covers it.

No commit (no file change).

---

### Task 6: Write `docs/beta-tester-feedback-focus.md`

**Files:**
- Create: `docs/beta-tester-feedback-focus.md`

- [ ] **Step 1: Create the file with this content**

Write to `docs/beta-tester-feedback-focus.md`:

```markdown
# PostCrisp Beta — What We Want Feedback On

Welcome — and thanks for testing PostCrisp. You're one of a small number of creators getting hands-on with the product before public launch. Your honest reactions are what we need.

## Where to send feedback

- **In-app**: hit the **Feedback** button (bottom-right of every dashboard page). Notifications come straight to a human.
- **Reply to your invite email** or write to `beta@postcrisp.com`. Real human reads every reply.

## What we want most

### 1. Foundation Analysis (Elite testers only)

This is our headline differentiator. We want to know:
- Did the result feel insightful, or generic?
- Were the **Voice Signature** and **Content Pillars** accurate to your real channel?
- Did the AI seem to actually read your three sample posts, or did it ignore them?
- After you saved the Creator Profile, did your **Captions** / **Viral Ideas** / **Bio Optimizer** results feel more "you" than before?

### 2. The 5-step tutorial

Run it cold. Was anything confusing, broken, or boring? Did you bail before finishing? If yes, where and why?

### 3. Anything broken or weird

- Pages that hang or 500
- Buttons that don't work
- Loading states that never resolve
- Mobile rendering glitches
- Anything that surprised you in a bad way

### 4. The price → value gap

If you had to pay for this today at $19 / $39 / $99 (Starter / Creator / Elite per month), what would feel fair? What would feel like robbery?

## What we're NOT looking for in this wave

- Stripe / billing flow (not active yet for beta)
- Public marketing critique (we know the website is sparse)
- Feature requests for things we haven't shipped (we have a backlog)

## Response time

We read every reply within 24 hours. If you hit a critical bug (can't sign in, lost work, billing weirdness), reply with **URGENT** in the subject and we'll move faster.

Thanks again — this wave is small on purpose, and your input directly shapes what ships next.

— PostCrisp team
```

- [ ] **Step 2: Verify the file was written**

```powershell
Get-ChildItem docs/beta-tester-feedback-focus.md | Select-Object Name, Length
```

Expected: file exists, `Length` ≈ 1700-2200 bytes.

- [ ] **Step 3: Commit**

```powershell
git add docs/beta-tester-feedback-focus.md
git commit -m "docs: add beta tester feedback focus doc"
```

---

### Task 7: Merge `foundation-analysis` → `main` and verify Vercel deploy

**Files:** None (git op + Vercel auto-deploy)

- [ ] **Step 1: Confirm working tree is clean and on the right branch**

```powershell
git status
git branch --show-current
```

Expected:
- `git status` shows: `On branch foundation-analysis`, working tree clean (after Tasks 2 + 6 commits)
- `git branch --show-current` returns: `foundation-analysis`

- [ ] **Step 2: Run typecheck on the branch as final pre-merge gate**

```powershell
npx tsc --noEmit
```

Expected: clean, zero errors. (Reference: PICKUP says typecheck was clean post-NDA bump.)

- [ ] **Step 3: Run vitest as final pre-merge gate**

```powershell
npm test -- --run
```

Expected: 41/41 tests pass across 7 vitest files (matching session 16 baseline). If any fail, **stop and investigate** — do not merge a red branch.

- [ ] **Step 4: Switch to main and pull**

```powershell
git checkout main
git pull origin main
```

Expected: main is up to date with origin (no surprise commits from another machine).

- [ ] **Step 5: Merge `foundation-analysis` with a merge commit**

```powershell
git merge --no-ff foundation-analysis -m "merge: foundation-analysis branch (FA + Team drop + NDA v1.1 + beta-launch readiness)"
```

Expected: merge succeeds with no conflicts. (`--no-ff` per session 14c convention; preserves the branch's commit history visibly.)

- [ ] **Step 6: Push to origin**

```powershell
git push origin main
```

Expected: push succeeds; Vercel webhook fires on push.

- [ ] **Step 7: Watch Vercel deploy**

Open https://vercel.com/[your-team]/postcrisp/deployments. Watch the latest deploy progress.

Expected:
- Build completes (≈90-120s typical)
- Status: **Ready** (green)
- Domain alias `postcrisp.com` updates to point at the new deployment

If build fails, **STOP**. Read the build log carefully. Common causes: missing env var (Task 3 should have caught this), TypeScript error in production build mode, dependency resolution issue. Fix forward; do NOT push more commits chasing the failure.

- [ ] **Step 8: Verify production loads**

Open `https://postcrisp.com` in a browser. Expected: home page loads, no console errors in DevTools, brand palette + 3-tier pricing visible.

- [ ] **Step 9: Verify production health**

Hit `https://postcrisp.com/api/health` (if such a route exists) OR sign in as captain admin and load `/dashboard`. Expected: dashboard loads cleanly, no 500 errors.

---

## Post-merge verification (Friday evening, on production main)

### Task 8: NDA v1.1 acceptance flow smoke-test

**Files:** None (manual UI test)

- [ ] **Step 1: Sign in as a non-admin test account**

Use a non-`captain@` test account (or create one fresh; if so, also temporarily set its `subscription_tier` to test the right gate). Captain bypasses NDA — won't exercise this flow.

- [ ] **Step 2: Hit `/dashboard`**

Navigate to `https://postcrisp.com/dashboard`. Expected: redirect to `/accept-terms` (because the test account doesn't have a v1.1 acceptance record yet).

- [ ] **Step 3: Verify accept-terms page content**

Confirm the rendered page shows:
- Page title: **"Beta Tester Agreement"** (not "Alpha")
- Version: **1.1**
- Effective date: **"Effective May 1, 2026"** (or whatever format `2026-05-01` renders as)
- New section text reflects beta language (not alpha)
- Checkbox label uses `{ALPHA_AGREEMENT_TITLE}` variable (renders as "Beta Tester Agreement")

If any item is wrong, **stop and investigate** — the NDA bump didn't deploy correctly.

- [ ] **Step 4: Accept and verify redirect**

Click the agreement checkbox; click **Accept**. Expected: redirect to `/dashboard` and dashboard loads cleanly.

- [ ] **Step 5: Reload `/dashboard`**

Press F5 / Ctrl+R. Expected: no further redirect to `/accept-terms`. Dashboard loads directly. (Acceptance was persisted to the user's `alpha_nda` JSONB key.)

- [ ] **Step 6: Verify captain bypass**

Sign out; sign in as `captain@postcrisp.com`. Hit `/dashboard`. Expected: dashboard loads directly with no `/accept-terms` redirect.

- [ ] **Step 7: If any v1.0 alpha testers exist in production, verify re-prompt**

If applicable: have any pre-existing alpha tester load `/dashboard`. Expected: redirect to `/accept-terms` with v1.1 page rendered. (Their old v1.0 record stays in audit log; they need to accept v1.1 to proceed.)

If no alpha testers in production yet, skip this step.

No commit (verification only).

---

### Task 9: Cold-account end-to-end walkthrough

**Files:** None (manual UI test)

The branch hasn't been exercised cold since the brand refresh + 3-tier pricing + FA CTA shipped. This is the test that catches the kind of bug that Sentry won't.

- [ ] **Step 1: Open an incognito window with a fresh email**

Use a fresh email address (Gmail/Outlook + alias works: `youremail+betatest1@gmail.com`).

- [ ] **Step 2: Navigate to `https://postcrisp.com`**

Expected: home page renders with brand palette (Gunmetal + Electric Blue), 3-tier pricing visible, no "Team" tier anywhere, FAQ reflects Starter/Creator/Elite only.

- [ ] **Step 3: Click "Sign up" or equivalent CTA**

Generate a single-use invite code at `/admin/invite-codes` (signed in separately as captain admin in another browser) and use it on this signup. Complete signup form → verify email if applicable.

- [ ] **Step 4: Hit `/dashboard`**

Expected: redirect to `/accept-terms` (NDA v1.1).

- [ ] **Step 5: Accept NDA and continue to dashboard**

Expected: dashboard loads. **Capture mental notes on what feels rough** — anything visually off, slow, confusing, or surprising.

- [ ] **Step 6: Confirm Starter-tier dashboard renders correctly**

Check:
- Foundation Analysis CTA card renders **with the preview image** (not broken). This is the Task 2 verification on production.
- Tutorial onboarding fires (5-step flow)
- All tiles / cards render with correct colors and copy

- [ ] **Step 7: Run the 5-step tutorial as a Starter user**

Expected: tutorial completes end-to-end. Note: which step (if any) is friction-heavy or unclear.

- [ ] **Step 8: Run captions feature**

Generate captions on the test account. Expected: rocket loader animates (per Task in session 15), result returns successfully, no Sentry errors.

- [ ] **Step 9: Submit a feedback message via FeedbackButton**

Submit "Cold walkthrough complete — production verification". Expected: notification arrives in your inbox via `/api/feedback`.

- [ ] **Step 10: Note any rough edges in a private journal**

Write down anything that surprised you or felt clunky. These are not necessarily blockers — but worth knowing before testers see them.

No commit (verification only).

---

### Task 10: FA + Voice Trainer combined-flow check

**Files:** None (manual UI test)

Honest-pushback flag from spec: FA + Voice Trainer haven't been exercised together by a real user. This is the test for that.

- [ ] **Step 1: Sign in as Elite test account**

Use a separate Elite account (NOT captain — captain bypasses NDA so doesn't represent real tester experience). Set `subscription_tier='elite'` if needed via admin.

- [ ] **Step 2: Run Foundation Analysis with full 11-field input**

Navigate to `/dashboard/foundation-analysis`. Fill every field, including the 3 evidence posts. Submit; wait for result.

Expected: result returns under 90s. Creator Profile gets written (verify by going to Settings → Profile section, or by checking Supabase `creator_profiles` table for the user_id).

- [ ] **Step 3: Run Voice Trainer on the same account**

Navigate to `/dashboard/voice` (or whatever the Voice Trainer route is — `src/app/dashboard/voice` per the engine config). Run a full Voice Trainer pass. Note: with a saved Creator Profile, the Voice Trainer prompt may include the Creator Context block.

Expected: completes successfully. No timeout, no 500.

- [ ] **Step 4: Run a Captions generation**

Navigate to `/dashboard/captions` (or equivalent). Generate captions for a sample topic.

Expected: completes successfully. Output should reflect both the voice signature from FA AND any Voice Trainer adjustments. (This is the integration-quality check, not just a does-it-run check.)

- [ ] **Step 5: Inspect the prompt**

In Vercel logs OR by adding a one-off `console.log` (don't commit) in the captions route, capture the actual prompt sent to Anthropic. Verify:
- Creator Context block from FA is present
- No truncation of the user's input or system prompt
- No obvious malformed JSON or duplicate sections

- [ ] **Step 6: Check Anthropic Usage**

Navigate to Anthropic Console → Usage. Note the spend on this single Elite walkthrough. Expected: well under $1 for a single account running FA + Voice Trainer + captions. If it's higher, the prompt-length is concerning — flag for post-launch follow-up.

No commit (verification only).

---

### Task 11: OG card + email deliverability + mobile sanity

**Files:** None (multi-platform verification)

- [ ] **Step 1: OG card preview**

Paste `https://postcrisp.com` into:
- Twitter (DM to yourself or the compose box)
- Slack (DM to yourself)
- LinkedIn (post draft)
- iMessage (send to yourself)

Expected: each platform renders an OG card with the post-brand-refresh logo and tagline. If any shows the OLD logo or no image, the OG image cache may need busting (Twitter / LinkedIn cache aggressively; use https://www.opengraph.xyz/ to inspect raw OG tags first).

- [ ] **Step 2: Email deliverability check (gmail)**

From the dev or production app, trigger an email send to a fresh Gmail address (e.g., signup invite, password reset, or feedback notification). Confirm:
- Lands in **Inbox**, not spam
- Sender shows as `noreply@postcrisp.com` with proper display name
- DKIM/SPF passes (check email headers via Gmail "Show original")

- [ ] **Step 3: Email deliverability check (outlook / hotmail)**

Same as step 2 but to a fresh Outlook / Hotmail address.

If either lands in spam: investigate Resend domain verification status; check SPF/DKIM/DMARC records; do NOT proceed with launch until clean (testers will miss invites).

- [ ] **Step 4: Mobile sanity check on FA form**

Open `https://postcrisp.com/dashboard/foundation-analysis` on a phone (or Chrome DevTools device emulation at 390×844 — iPhone 14). Sign in as Elite. Confirm:
- All 11 fields are reachable without horizontal scroll
- Input fields are tappable and don't get hidden by keyboard
- Submit button is reachable
- Validation errors render correctly

- [ ] **Step 5: Mobile sanity check on rocket loader**

Trigger a heavy AI feature (channel-analysis, viral-ideas, brand-pitch, etc.) on the mobile viewport. Confirm:
- Rocket loader renders
- Animations play (or static if `prefers-reduced-motion` is on)
- "STAND BY" headline + "Charting your trajectory…" subline render correctly
- No layout overflow

No commit (verification only).

---

## Launch (Saturday 2026-05-02 AM)

### Task 12: Open monitoring tabs + write backout criteria

**Files:** None (browser tabs + private note)

- [ ] **Step 1: Open Sentry filter pinned to last 24h, errors only**

Navigate to https://sentry.io/ → PostCrisp project → Issues. Filter: `is:unresolved level:error` for last 24h. Pin this tab; refresh manually every 30-60 minutes through the day.

- [ ] **Step 2: Open Anthropic Usage dashboard**

https://console.anthropic.com/ → Usage. Pin tab. Refresh every 2-3 hours.

- [ ] **Step 3: Open OpenAI Usage dashboard**

https://platform.openai.com/usage. Pin tab. Refresh every 2-3 hours alongside Anthropic.

- [ ] **Step 4: Open Stripe webhook delivery dashboard**

https://dashboard.stripe.com/webhooks. Pin tab. **Should stay quiet this wave** (no Stripe activity expected). Activity here = signal that something's wrong.

- [ ] **Step 5: Open Vercel deployments page (rollback path)**

https://vercel.com/[your-team]/postcrisp/deployments. Pin tab. Confirm you know which deployment is "previous" — that's the one you'd promote on rollback.

- [ ] **Step 6: Write backout criteria in a private note**

In a `LAUNCH_NOTES.md` (NOT committed to repo — this is operational scratch) or a notes app:

```
Beta Wave 1 — Backout criteria

Promote previous Vercel deployment IMMEDIATELY if any of:
- Sentry error rate > 5× baseline (baseline ≈ N events/hour pre-launch)
- Anthropic spend > $30/hour sustained
- OpenAI spend > $15/hour sustained
- Critical user-flow regression reported by canary tester:
  - Cannot sign in
  - Cannot access FA / Captions / Voice Trainer
  - Lost work / generations not persisted
  - NDA acceptance loop (re-prompts after accepting)

Vercel rollback URL: https://vercel.com/[your-team]/postcrisp/deployments
Previous-good deploy: <write the deployment ID here after Task 7>

Diagnosis happens AFTER rollback, not before. Stabilize first, fix forward.
```

No commit (operational note, not source-controlled).

---

### Task 13: Saturday — pick canary testers, provision, send invites

**Files:** None (admin UI ops)

User's recruitment video posts in this window. Pick canary testers from the response funnel as they come in.

- [ ] **Step 1: Generate invite codes**

Sign in as captain admin → `/admin/invite-codes` → Generate batch of **8 codes** (covers a 6-tester wave + 25% buffer for re-issues). Confirm codes are single-use (post-session-14c enforcement).

- [ ] **Step 2: Pick 2-3 canary testers from video responses**

Criteria for canary picks (suggested, not locked):
- Active creators (have a real channel, real audience)
- Mix of platforms (YouTube + TikTok + Instagram preferred, not all-one-platform)
- Mix of size (one ≤10k subs, one 10k-100k, one ≥100k)
- Reachable via reliable email
- Likely to give honest feedback (not just "looks great!")

- [ ] **Step 3: Provision each canary tester**

For each picked tester, in this order:

1. Have the tester sign up via the provided invite code at `https://postcrisp.com/signup?code=<CODE>` (or whatever the signup route is)
2. Tester accepts NDA v1.1 at `/accept-terms`
3. Sign in as captain admin → `/admin/users/[id]` for the new tester → set `subscription_tier`:
   - **2 of 3** canary testers → `elite` (so FA gate is open)
   - **1 of 3** canary testers → `creator` (validate non-FA flow gracefully)
4. Sign in as captain → `/admin/credit-adjustments` → grant `+100` credits to the tester with reason "Beta wave 1 canary"

- [ ] **Step 4: Send personal invite email**

For each canary tester, send an email (from `beta@postcrisp.com` or your primary inbox) with:
- Personal greeting (mention what you saw on their channel — proves it's not a mass blast)
- Link to `https://postcrisp.com`
- Their single-use invite code
- Attach `docs/beta-tester-feedback-focus.md` (or paste its contents inline)
- Sign with your name (not "the team") — single-creator brand integrity

Reply-to header should be `beta@postcrisp.com`.

- [ ] **Step 5: Verify each canary tester completed signup + NDA + tutorial**

Wait 1-3 hours. In Supabase prod → SQL editor:

```sql
select email, subscription_tier, alpha_nda, credits, created_at
from profiles
where email in ('canary1@...', 'canary2@...', 'canary3@...');
```

Expected for each: `subscription_tier` set correctly, `alpha_nda->>'version' = '1.1'`, `credits >= 100`, `created_at` recent.

- [ ] **Step 6: Spot-check Sentry for any new errors tied to canary user IDs**

Filter Sentry by `user.id` for each canary tester. Expected: zero unhandled errors. If any, investigate before sending more invites.

No commit (operational ops).

---

### Task 14: Saturday afternoon — monitoring + go/no-go review

**Files:** None (review + decision)

- [ ] **Step 1: 4 hours after canary invites sent, refresh all monitoring tabs**

- Sentry: error count vs baseline?
- Anthropic Usage: spend curve flat or exponential?
- OpenAI Usage: spend curve flat or exponential?
- Stripe webhooks: should be quiet (zero activity expected). If activity → investigate
- Inbox: any tester replies / FeedbackButton notifications?

- [ ] **Step 2: Verify ≥1 canary tester has run Foundation Analysis end-to-end**

In Supabase prod:

```sql
select user_id, count(*) from creator_profiles group by user_id;
select user_id, generation_type, status, created_at
from generations
where generation_type = 'foundation-analysis' and created_at > '2026-05-02'
order by created_at desc;
```

Expected: at least one canary tester has a creator_profile row AND a corresponding successful FA generation.

If zero FA runs by Saturday evening, this is a soft signal — not a blocker, but the FA CTA card might be less compelling than expected. Note for follow-up.

- [ ] **Step 3: Read every tester reply / feedback notification**

For each piece of feedback received, decide:
- **Critical** (rollback-worthy) → stop, evaluate against backout criteria
- **High priority** (fix in next wave) → log it
- **Nice-to-have** (post-launch backlog) → log it

- [ ] **Step 4: Make go/no-go call for Sunday wave-blast**

**GO conditions** (all must be true):
- Zero critical regressions reported
- Sentry error rate within 2× baseline
- Anthropic spend < $5 for the day
- ≥1 canary tester completed FA end-to-end successfully
- Email deliverability not flagging spam complaints

**NO-GO conditions** (any one is enough to delay):
- Critical user-flow regression reported
- Sentry error rate > 5× baseline
- Anthropic spend > $30/hour at any point
- Email deliverability complaints
- Tester says "I can't sign in" / "lost my work"

- [ ] **Step 5: Document the call**

Update `LAUNCH_NOTES.md` (not committed) with:
- Time of go/no-go call
- Decision (GO / NO-GO / DELAY)
- Reasoning (1-3 sentences)
- Action: Sunday-blast / rollback / extend canary another day

No commit (operational decision).

---

### Task 15: Sunday — wave-blast (or rollback)

**Files:** None (admin ops + send invites)

#### Path A: GO — wave-blast

- [ ] **Step A1: Pick remaining wave testers from video response funnel**

Apply same criteria as Task 13 step 2. Goal: ~6 total testers including the 2-3 canaries. So 3-4 more invites.

- [ ] **Step A2: For each new tester, repeat Task 13 steps 3-4 (provision + invite)**

Same flow: signup with code → NDA → tier-up → grant 100 credits → personal email with feedback-focus doc.

- [ ] **Step A3: Continue monitoring through Sunday**

Refresh Sentry / Anthropic / OpenAI hourly. Same monitoring discipline as Task 14 step 1.

- [ ] **Step A4: At end of Sunday, verify wave success criteria**

Against the success criteria in the spec:
- ≥80% of invited testers completed signup?
- ≥50% finished tutorial?
- Sentry error rate within 2× baseline?
- Zero invite-code race conditions?
- ≥2 testers ran FA end-to-end with downstream coherence check?
- Anthropic spend < $20 for the wave?
- Zero NDA regressions reported?

#### Path B: NO-GO — rollback

- [ ] **Step B1: Promote previous Vercel deployment**

Vercel Dashboard → Deployments → previous "Ready" deployment (the pre-merge one) → "..." menu → **Promote to Production**.

Confirm: production domain `postcrisp.com` now serves the previous build.

- [ ] **Step B2: Revert the merge in git locally**

```powershell
git checkout main
git revert -m 1 HEAD
git push origin main
```

This creates a revert commit on main, keeping history honest. Do NOT force-push.

- [ ] **Step B3: Notify canary testers**

Email each canary: "Hi — we've rolled back today's update while we investigate an issue. Your account is fine; please pause testing until you hear from us. We'll be back online within 24-48 hours. Thanks for your patience."

- [ ] **Step B4: Diagnose offline**

Open new branch from main; investigate Sentry errors / canary feedback / logs. Fix forward. Do NOT re-merge until cause identified and fix verified.

No commit unless rollback (B2).

---

### Task 16: Sunday evening — update PICKUP.md

**Files:**
- Modify: `PICKUP.md`

- [ ] **Step 1: Update PICKUP.md with launch state**

Replace or update the "🟡 Session 17 — IN PROGRESS" section with a new "Session 17 shipped — Beta Wave 1 launched" section. Include:
- Final tester count (sent vs accepted)
- Wave success-criteria results (one bullet per criterion: ✅/❌ + brief metric)
- Any rollback events + cause
- Top 3 pieces of tester feedback (most actionable)
- What ships next based on feedback

Format consistent with previous "Session N shipped" sections (see lines 78+ for session 16 format).

- [ ] **Step 2: Update tracker header**

At top of PICKUP.md, update:
- `**Last updated:**` to Sunday's date
- `**Pre-launch status:**` to a launched/post-launch status
- `**Build status:**` to reflect main being current

- [ ] **Step 3: Commit and push**

```powershell
git add PICKUP.md
git commit -m "docs: session 17 shipped — beta wave 1 launched"
git push origin main
```

- [ ] **Step 4: Save user memory for the launch**

Update the auto-memory `project_alpha_deployment.md` (or create `project_beta_deployment.md` if structurally cleaner) with the post-wave state. Reference the `superpowers:save` skill if available.

---

## Self-review notes

Verified against spec:
- ✅ Section 1 (pre-flight code gates): Tasks 1, 2, 3, 7 (split: DB schema → screenshot → env vars → merge)
- ✅ Section 2 (tester provisioning): Tasks 13, 15 (canary first, then wave)
- ✅ Section 3 (cost & abuse defense): Task 4
- ✅ Section 4 (tester feedback loop): Tasks 5, 6 (alias + FeedbackButton + focus doc)
- ✅ Section 5 (regression checks): Tasks 9, 11 (cold walk + OG/email/mobile)
- ✅ Section 6 (Saturday monitoring + rollback): Tasks 12, 14, 15 path B
- ✅ Section 7 (NDA v1.1 smoke): Task 8
- ✅ FA + Voice Trainer combined check (honest pushback): Task 10
- ✅ Cutover plan (soft B): tasks ordered Fri pre-flight → Sat canary → Sun wave/rollback
- ✅ Success criteria measurable: Task 15 step A4 maps each success bullet to a verification

No placeholders, no "TBD", no "similar to Task N", no missing commands.
