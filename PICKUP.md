# PostCrisp — Where We Left Off

**Last updated:** 2026-04-30 (session 16 — Foundation Analysis feature + Team tier dropped)
**Build status:** ✅ `foundation-analysis` branch (23 commits ahead of main) ready to merge after smoke test
**Production URL:** **https://postcrisp.com** (primary)
**Dev server:** `npm run dev` (port 3000 or next available)
**Pre-launch status:** 🟡 1 item blocking — **Stripe production verification (up to 2 days)**

---

## Session 16 shipped — Foundation Analysis (Elite-only) + Team tier dropped

**23 commits on the `foundation-analysis` branch.** Designed via `superpowers:brainstorming` → `writing-plans` → executed via `subagent-driven-development` with full implementer + spec-reviewer + code-quality-reviewer loops on the heavy tasks. SQL applied successfully and end-to-end smoke test passed.

### 🧬 Foundation Analysis — new Elite-only feature

A deep, evidence-grounded creator audit that **also saves a structured Creator Profile** that downstream tools (Captions, Viral Ideas, Bio Optimizer in Phase 2) read on every generation. The strategic frame: *Foundation Analysis is the foundation every other tool reads from.*

**What it does differently from Channel Analysis (which stays untouched at 5 credits, Creator+):**
- 11 declared input fields grouped into 4 sections (channel / strategy / reality / evidence)
- **Evidence layer** — 3 user-pasted sample posts (caption + metric + theory). The AI evaluates real content, not just inferred patterns.
- Structured **Creator Profile** output written to a new `creator_profiles` table on every run
- 8 credits per run; PREMIUM AI tier across all subscription tiers (gated to Elite by `DEFAULT_MIN_TIER`)
- Refine pass enabled for Elite (Opus + gpt-4o-mini critic)

**Phase 2 wired in same session:** Captions / Viral Ideas / Bio Optimizer prompts now inject a "Creator Context" block (formatted by `formatCreatorContextBlock` from `@/lib/creator-context-block`) when the user has a saved profile. Settings → Profile section lets users view/edit the saved profile and toggle injection off.

### 🪦 Team tier dropped (zero subscribers, clean removal)

Tier ladder is now **Starter / Creator / Elite** (3 tiers). Sweep across ~15 files: types, billing, Stripe, admin UI, landing page, README, ROADMAP. Two SQL CHECK constraints tightened (`profiles.subscription_tier` and `feature_access.min_tier`). Defensive `case 'team': return 'creator'` fallback kept in `tierFromDbValue` for any in-flight legacy rows.

### 🔧 Plan-gap fixes (caught by code review during execution)

The subagent-driven flow's two-stage review pipeline caught **6 plan gaps**, all patched inline before next task:
1. `creator_profiles` table missing RLS policies (would have silently broken client-side reads in Settings + dashboard CTA)
2. Missing `updated_at` trigger on `creator_profiles` (made the index meaningless)
3. `tierFromDbValue` had no defensive fallback for legacy `'team'` rows after Team type union narrowing
4. `feature_access.min_tier` SQL CHECK still permitted `'team'` (Task 1 was scoped to `subscription_tier` only)
5. SaaS pricing convention violated on Elite features array (Foundation Analysis was placed before "Everything in Creator")
6. `/api/foundation-analysis` route had profile upsert nested inside the same try/catch as the generations insert — a generations failure would have silently skipped the profile write (the entire reason this feature exists). Split into isolated try/catches with their own log tags.

Plus a 7th: `CREATE POLICY` statements throughout the schema file weren't idempotent. Hit it on schema re-run; patched all 38 policies via `scripts/make-policies-idempotent.mjs` to add `DROP POLICY IF EXISTS` guards. File is now fully re-runnable.

### 📁 Key files touched

- DB: `src/lib/supabase-schema.sql` (creator_profiles table + RLS + trigger + 2 CHECK updates + idempotency patch)
- Engine config: `src/lib/crisp-engine-config.ts` (registered foundation-analysis task; dropped Team)
- Helpers: `src/lib/creator-profile.ts` (CRUD), `src/lib/creator-context-block.ts` (formatter + `loadCreatorContext` one-call helper)
- API: `src/app/api/foundation-analysis/route.ts` + `prompt.ts` (TDD-tested prompt builder, 6 tests)
- API: `src/app/api/user/dismiss-foundation-cta/route.ts` + `creator-profile/route.ts` (PATCH for edits + toggle)
- UI: `src/app/dashboard/foundation-analysis/page.tsx` (447 lines, form + result + paywall)
- UI: `src/app/dashboard/page.tsx` (Elite onboarding CTA), `src/app/dashboard/settings/page.tsx` (Profile section)
- UI: `src/components/ui/FeatureGate.tsx` (added `previewSnapshotUrl?` prop)
- 3 downstream injections: `src/app/api/generate/route.ts`, `viral-ideas/route.ts`, `bio-optimizer/route.ts`
- Marketing: `src/app/page.tsx` (3-tier pricing grid + FAQ rewrite), `src/lib/stripe.ts` (PLANS dropped Team), `README.md`, `ROADMAP.md`
- Spec + plan: `docs/superpowers/specs/2026-04-30-foundation-analysis-design.md`, `docs/superpowers/plans/2026-04-30-foundation-analysis.md`

### 🧪 Test counts

41/41 tests pass across 7 vitest files. New suites: `creator-profile.test.ts` (3 tests), `creator-context-block.test.ts` (4 tests), `foundation-analysis/__tests__/prompt.test.ts` (6 tests). Plus `fake-supabase.ts` extended with `creator_profiles` Map + `.upsert()` support; existing fixtures in `credits.test.ts` and `tutorial-bypass.test.ts` updated for the new field.

### 📋 Manual follow-ups still pending

1. **Capture the paywall preview screenshot** — `/dashboard/foundation-analysis` Elite result page → 1600×900 → `public/foundation-analysis-preview.png`. Paywall renders a broken image without it.
2. **Confirm `STRIPE_ELITE_*` price IDs** are set in Vercel env vars (Team prices are gone from `lib/stripe.ts`).
3. **Merge `foundation-analysis` → `main`** when ready to deploy.
4. **Optional cleanup in 2 weeks:** remove the defensive `case 'team': return 'creator'` line in `tierFromDbValue` once you've confirmed zero `'team'` rows exist anywhere in production. (Scheduled via background agent.)

### 🛠 Process notes (worth re-reading)

- **Subagent-driven development paid back hard on this session.** Two-stage review (spec compliance → code quality) caught 6 plan gaps that would otherwise have shipped as silent bugs (RLS, trigger, profile upsert isolation, SaaS bullet ordering). The cost was ~3-5 agent dispatches per task; the value was the bugs that never made it to prod.
- **Pragmatic abbreviation:** for trivial mechanical tasks (adding 5 lines to a config, applying a verbatim plan code block) I skipped formal review and trusted typecheck + tests + self-review. Reserved full review for the high-risk surfaces (DB schema, API route, UI page).
- **Plan deviated mid-flight twice** — first I drafted an "addon table" architecture, then user reframed to a separate feature, then user proposed renaming the tier itself. Pushed back on the tier rename (Foundation as a top-tier name has industry semantic risk — usually means entry-level), kept the feature name, dropped Team. Brainstorming was the right place to surface those forks.

---

## Session 15 shipped — "Request Timed Out" root cause + rocket loader

3 commits. Started from a tester complaint and ended with a brand-grade waiting experience for the longest AI calls.

### 🔍 Root cause of "Request Timed Out" — stale client timeout overrides

Tester reported intermittent "Request Timed Out" errors on long generations. Vercel logs showed channel-analysis succeeding at 70.3s on the server (pass1 48.6s + pass2 21.7s), well under the 120s `maxDuration`. So the server wasn't timing out — but the user saw the error anyway.

The bug: commit `419a1fe` raised the global `apiFetch` default 60s → 120s, but **18 separate AI feature pages + tutorial steps were passing their own explicit `timeout: 45000` / `timeout: 60000` / `timeout: 90000` overrides**, silently shadowing the new default. Stale values from when defaults were 15s, then 60s. The pages never benefited from the bump.

Tutorial channel-analysis at 90s was the worst case — 70s of AI work + 5–15s pre/post + Vercel cold start could push end-to-end past 90s on a slow run, firing the client AbortController while the server was finishing post-AI persistence.

### ✅ Fix 1 — sync all client AI-call timeouts to 125s default (commit `61d3ac2`)

- Removed all 22 explicit `timeout:` overrides on AI feature pages + tutorial steps. Pages now track the global default forever; no more drift.
- Bumped `apiFetch` default 120s → 125s. The 5s buffer above server `maxDuration = 120s` means when the server actually does hit its ceiling, the client stays alive long enough to receive a structured 504 instead of racing to AbortError (which masks the failure mode and looks indistinguishable from a network timeout).

19 files changed: `src/lib/api.ts`, `src/components/onboarding/TutorialSteps.tsx`, 17 dashboard pages.

**Lesson saved as memory** (`feedback_apifetch_timeout_drift.md`): when changing a global default in shared client config, sweep for explicit per-call overrides and reconcile. Prefer dropping overrides entirely on calls that should track the default.

### 🚀 Fix 2 — rocket loader on 7 heavy AI pages (commit `ad289af`)

User asked for "an animation that runs while people are waiting that looks like a rocket… 'Please Stand By, Creating Your Social Media Journey'". Reframed copy to **"STAND BY / Charting your trajectory…"** — same naval/aviation feel as the brand palette (Gunmetal + Electric Blue), tighter words.

Architecture: added `variant?: "default" | "rocket"` prop to existing `GenerationLoader` so heavy pages opt in with a single prop and the 11 fast pages (hashtags, captions, polls, etc.) keep the existing 3-dot loader unchanged.

Visual stack:
- 5-star twinkling background
- Inline-SVG rocket: Electric Blue ellipse body, Hangar White window, Gunmetal fins, orange→yellow flickering flame, 3 staggered fading exhaust puffs
- Gentle bob (rocket-bob keyframe), flame-flicker, puff-rise, twinkle — all CSS keyframes, no Lottie, no new deps
- "STAND BY" headline (tracking-widest) + "Charting your trajectory…" subline + existing rotating per-feature `messages` prop + existing shimmer bar
- Honors `prefers-reduced-motion: reduce` — motion stops, copy + static rocket remain visible

7 pages opted in: channel-analysis, viral-ideas, brand-pitch, blog-to-social, repurpose, trends, sounds.

**Originally specced 9 pages** — `thumbnail-analyzer` (custom 5-stage progress card) and `voice` (in-button spinner) don't use `GenerationLoader`, deferred for separate post-launch refactor.

Spec + plan: `docs/superpowers/specs/2026-04-29-rocket-loader-design.md`, `docs/superpowers/plans/2026-04-29-rocket-loader.md`.

### 🐛 Followup fix — register rocket animations in tailwind.config.ts (this commit)

After the rocket commit shipped, manual smoke showed the rocket rendering but **not animating** — static SVG. Diagnosis: defining `.animate-rocket-bob { animation: ... }` directly in `globals.css` lost the specificity battle with Tailwind's `@layer utilities` block emitted from `@tailwind utilities;`. The canonical pattern in this codebase (see `pulse-dot`, `fade-in-up`) is to register animations in `tailwind.config.ts` `theme.extend.animation` so Tailwind emits them in its own utility layer with the right priority.

Moved the 4 animation utility names into `tailwind.config.ts`. Kept the `@keyframes` blocks in `globals.css` (matching the existing pattern). Removed the manual `.animate-*` rules from `globals.css`. Kept the `@media (prefers-reduced-motion: reduce)` block.

**Lesson:** custom `.animate-*` rules in `globals.css` can be shadowed by Tailwind's emitted utility layer. Always register animation utilities in `tailwind.config.ts`.

### 📝 Process notes

- Followed superpowers skills end-to-end: brainstorming (with spec) → writing-plans → executing-plans → manual smoke → save. Worked well; spec deviation (9 → 7 pages) caught at execution time when those two pages turned out not to use `GenerationLoader`.
- Two-commit split with manual hunk staging: temporarily reverted `variant="rocket"` in 7 mixed files, committed timeout fix alone, re-applied variants, committed rocket loader. Cleaner history than one combined commit.

---

## Session 14c shipped — brand refresh + single-use invite codes + Phase 1 refine + mobile audit + MFA hardening

**17 commits + significant external work.** Pre-launch went from "5 items remain" to "1 item blocking" (Stripe verification).

### 🎨 Brand refresh — new logo, "Creation Gateway" tagline (commits 26e6478, 9b69450, 9c1b186, 7e521bf, 5c0ea88)

User shipped a new PostCrisp logo (with sparkles + wordmark + tagline). Two variants:
- `public/postcrisp-logo.png` — full art with grey background, used in landing hero
- `public/postcrisp-logo-header.png` — wordmark-only, transparent BG, used in headers + footers + sidebars

Surfaces updated:
- Landing page: hero logo above the badge, header bar (top-left), footer (bottom-left). Header logo wrapped in `<Link href="/">` for click-home.
- App sidebar: collapsed state shows ⚡ icon, expanded state shows wordmark logo.
- Admin sidebar: wordmark logo + "Admin" pill on the right (preserves the admin-context cue).
- Demo sidebar: same wordmark logo, links to `/`.
- Demo dashboard: refreshed to mirror real dashboard structure (channels row, BRS card, browse-all-22-tools grid, diversified recent generations including CTA Optimizer + Thumbnail Analyzer + Channel Analysis + Brand Pitch).
- Demo sidebar nav: regrouped into Create / Optimize / Grow / Monetize. Interactive demos (4) link to their pages; rest get 🔒 + redirect to `/signup?from=demo&tool=<key>`.

**Tagline change**: "Your Social Media Copilot" → "Your Social Media Creation Gateway" — applied to:
- Hero H1
- `<title>` (browser tab + Google search)
- OpenGraph title (social link previews)

**Layout decision worth knowing**: removed the original ⚡ + "PostCrisp" placeholder header on the landing page first (user wanted minimal), then re-added it as the new wordmark logo. Header is `justify-between` again with logo left + buttons right.

### 🎟️ Single-use invite codes for beta (commit dab6278)

Real feature, not just config. Replaces the shared invite_code in `platform_settings.access_control` as the primary path for beta tester rollout.

- **New `invite_codes` table** — `code` PK (8-char alphanumeric, no ambiguous chars 0/O/1/I/L), `created_at`, `created_by`, `notes`, `used_at`, `used_by`. RLS: admin-only SELECT; all writes through service role. SQL migration documented in PICKUP.md SQL block (user already ran).
- **`src/lib/invite-codes.ts`** — `generateCode()`, `formatCodeForDisplay()` (XXXX-XXXX), `normalizeCode()` (case-insensitive, dash-tolerant), `claimInviteCode()` (atomic UPDATE...WHERE used_at IS NULL — race-safe), `generateInviteCodeBatch()` (1-100 with retry on collision), `isInviteCodeAvailable()`.
- **`/api/admin/invite-codes`** — GET list+stats, POST batch generate (1-100 + optional notes), DELETE unused.
- **`/admin/invite-codes` page** — stats cards (total/used/available), batch generate form, filter pills, table with per-row Copy + Delete, "📋 Copy all available" bulk action.
- **Signup action** — validates against `invite_codes` first, falls back to legacy shared code (transition path), atomically claims the code post-signup. Code input normalized (case-insensitive, dashes stripped).
- **Sidebar nav** — new 🎟️ Invite Codes admin nav item.
- **Access Control admin page** — labels the legacy shared code as legacy + points users to `/admin/invite-codes`.

**Race behavior**: atomic UPDATE-WHERE-NULL means two testers racing on the same code → only one wins. Other gets a soft "code already used" log on signup; their account still creates. Acceptable for beta scale.

### 🤖 Phase 1 refine pass — Channel Analysis (commits 3af72e7, 3a26fb8, c63ec98, 9d15b5c, 5065853, 52efbcc, e7d1ee3, a2da5ed)

The agentic pipeline experiment. **Shipped + quality-validated.**

**What it does**: After the first-pass model output, runs a second "critique + rewrite" model call that flags vague claims, generic advice, and missing specifics — then rewrites the entire JSON to fix them. Result is measurably more niche-specific and actionable.

**Architecture in `src/lib/crisp-engine.ts`**:
- `crispGenerate({..., refine: true })` — opt-in per call
- Pass 1: caller's tier model (Opus for Elite)
- Pass 2: hardcoded `gpt-4o-mini` regardless of caller tier (3-5x faster than Sonnet for QA-style rewriting)
- Critic system prompt flags vague claims, generic advice, missing specifics, surface depth, redundancy, niche-irrelevance
- Critic `maxTokens` capped at min(args.maxTokens, **2500**) — rewriting doesn't need full output budget
- **Safety nets**: throw → fall back to first-pass; refined output isn't loose-parseable JSON → fall back to first-pass. Refinement is additive value, never gating.
- Per-pass timing logs: `[crisp-engine] task=X pass1 done — model=Y tokens=N elapsedMs=N`. Visible in Vercel function logs.

**Wired only on Channel Analysis Elite tier** in `src/app/api/channel-analysis/route.ts`:
- `useRefine = auth.tier === 'elite'`
- `export const maxDuration = 120` (function timeout headroom)
- Persisted `refined: true|false` in `generations.input_data` for future A/B cohort comparison
- Client `apiFetch` timeout bumped to 120s
- `GenerationLoader` rotates 7 messages including `"Running deep analysis — this takes 30-60 seconds because we're going further than a typical AI tool."` so the wait feels intentional

**Real-world timing** (from production runs):
- Creator (Sonnet, no refine): ~50s
- Elite (Opus + gpt-4o-mini critic, refined): ~62-66s

Both are long but acceptable for a quarterly-checkup feature. **Not** acceptable for high-frequency features (captions/hashtags) — refine correctly gated to analytical-depth tasks only.

**Iteration story (the messy bit)** — first attempt used Sonnet for the critic at the same maxTokens as pass 1; that blew the timeout. Fix v1 used Sonnet (still slow), fix v2 swapped to gpt-4o-mini and capped maxTokens. Lesson: critic latency budget is non-negotiable. Don't reuse pass-1's model or token budget for the critic.

**Side effect — caching gotcha discovered**: `/admin/ai-config` overrides weren't taking effect on Vercel because each function instance has its own in-memory override cache. `invalidateOverrideCache()` only clears the local cache. **Fix**: dropped TTL 60s → 10s in `crisp-engine.ts` so config edits propagate within 10s across instances. Could remove the cache entirely (10ms DB cost is dwarfed by AI call latency) if 10s still feels stale.

### 🤫 Sentry noise suppression (commits 0fb6525, 093d23c)

Two false-positive classes filtered:

1. **Hydration mismatch from browser extensions** — Grammarly + LastPass + 1Password inject attributes onto `<body>` after SSR but before hydration. Fix: `suppressHydrationWarning` on `<body>` in `layout.tsx` (React-recommended for known-extension cases) + `beforeBreadcrumb` filter in Sentry config dropping `console.error` breadcrumbs containing "hydrat".
2. **Transient Supabase Auth fetch errors** — `'An unexpected response was received from the server.'` and `'AuthRetryableFetchError'` added to Sentry `ignoreErrors`. These fire when a user's auth fetch hits a transient 5xx, network blip, or ad-blocker intercept. Our actions handle them gracefully via `{error}` returns; no need to surface every blip as a Sentry event.

Server-side `captureException` calls still fire — those carry actual diagnostic context with the user/tier/role/task tags from session 14.

### 📱 Mobile audit (commit 9e75280)

Audited all user-facing pages with the Explore agent. Real blockers vs cosmetic noise:

**Fixed (real blockers):**
- Landing page stats: `grid-cols-2 md:grid-cols-4 gap-6` → `grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6`. Bumps 4-col layout from 768px to 640px breakpoint, tightens gap on mobile.
- 3 sidebar drawer close buttons (Sidebar.tsx, DemoSidebar.tsx, AdminSidebar.tsx): `w-9 h-9` (36px) → `w-11 h-11` (44px). Apple HIG touch target minimum. Real tester win — 36px next to tappable nav items meant accidental nav clicks.

**Skipped (audit was over-cautious):**
- Dashboard metrics 2-col grid (renders fine at 320px with short numeric content)
- Settings channel URLs (already responsive: `grid-cols-1 sm:grid-cols-2`)
- Hashtags action bar (flex-wrap handles wrapping fine)
- Channel-analysis platform buttons (usable, wrap correctly)

Lesson: Explore agent identifies aesthetic concerns + real blockers indistinguishably. Triage carefully; ship the real wins, defer the cosmetics.

### 🔐 MFA — Tier 1 external accounts complete

External work, no commits. User enabled TOTP MFA on all 7 highest-blast-radius accounts:
- Supabase Dashboard
- Vercel
- GitHub
- Stripe
- Anthropic
- Resend
- Sentry

All backup codes saved. Order matters: Supabase first (service role key, can drop tables), Vercel second (env vars, deploy attacks), GitHub third (push-to-deploy), Stripe (revenue), Anthropic (API key burn), Resend (phishing email from postcrisp.com), Sentry (source code disclosure).

**Tier 2 (in-app MFA UI for end users)** is still deferred until post-launch. Builds a `/dashboard/settings/security` panel using `supabase.auth.mfa.enroll()` + `aal2` upgrade flow on login. Estimate 4-6 hrs.

### 💰 Stripe production prep — BLOCKED

User initiated Stripe live-mode activation. Stripe is verifying business info (up to 2 days). Once cleared, the playbook is:
1. Create 9 products in live mode: 6 subscription prices (Creator/Team/Elite × Monthly/Yearly) + 3 credit packs (Small $5/100, Medium $15/500, Large $40/1500)
2. Add 11 env vars to Vercel Production: `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (live), 6 subscription price IDs, 3 credit pack price IDs
3. Register webhook at `https://postcrisp.com/api/stripe/webhook` for: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Add `STRIPE_WEBHOOK_SECRET` to Vercel.
4. Activate Customer Portal in Stripe → Settings → Billing
5. Force redeploy (build-cache off — `NEXT_PUBLIC_*` env vars only inline in bundle on rebuild)
6. **Smoke test**: real $19 Creator-Monthly upgrade in incognito → verify success_url + DB tier update + webhook delivery → refund yourself

Note: `STRIPE_PRO_*` is the legacy var name for Creator (pre-rename). Code reads `STRIPE_PRO_MONTHLY_PRICE_ID || STRIPE_CREATOR_MONTHLY_PRICE_ID`. Keep the `_PRO_` name when adding env var or rename the fallback in code.

---

## Session 14b shipped — custom domain `postcrisp.com` live (no code changes)

External setup only — no commits. Step 7 of Step-7 launch prep done.

**Done:**
- Vercel → PostCrisp project → Domains → added `postcrisp.com` and `www.postcrisp.com` (apex canonical, www redirects)
- Squarespace Domains → DNS → custom A record `@` → `216.150.1.1` (Vercel rotated from the legacy `76.76.21.21`); CNAME `www` → `cname.vercel-dns.com.`
- SSL cert auto-issued by Vercel after DNS propagation
- **`NEXT_PUBLIC_APP_URL`** added fresh in Vercel env vars (Production + Preview + Development) → `https://postcrisp.com`. **Latent bug surfaced**: this var was never set, so any Stripe checkout in production would have built `success_url=undefined/dashboard/billing?success=true`. Caught now before launch. After save, force-redeployed with build-cache off so the new value lands in the bundle.
- Supabase → Authentication → URL Configuration → Site URL = `https://postcrisp.com`; Redirect URLs = `https://postcrisp.com/**` (with wildcard) + kept `https://postcrisp.vercel.app/**` for transition
- Resend sender (`noreply@postcrisp.com`) was already verified in session 8 — no change needed

**Lessons captured (session 14b):**
- **Vercel edge IP rotated** from `76.76.21.21` → `216.150.1.1`. Vercel's docs lag the rotation; trust the IP shown in the Domains page over any tutorial. Wrong IP produces `DEPLOYMENT_NOT_FOUND` (Vercel's edge sees the request but routes to the "no project" handler).
- **Supabase Redirect URLs need the `/**` wildcard** to match paths. A bare `https://postcrisp.com` entry only matches that exact URL — not `/auth/reset-password`. When the redirectTo doesn't match the allowlist, Supabase silently falls back to **Site URL** with no path (so users land on the homepage with a `?code=...` query param that's never exchanged).
- **`NEXT_PUBLIC_*` env-var changes require a build-cache-off redeploy** to actually land in the client bundle. Same gotcha that bit Sentry DSN updates in session 12.
- **Squarespace's Domain Connect CNAME** (`_domainconnect`) is harmless — it's a separate namespace from `@` and `www`; don't remove it.

**Pre-launch list now:** MFA, Stripe prod prices, mobile audit. (Custom domain ✅, Next 15 ✅.)

---

## Session 14 shipped — Sentry close-out + admin RLS + parser hardening + CTA Optimizer + Next.js 15

9 commits across 5 themes. Started where session 13 left off (just-shipped tracker) and ran straight through into the Next.js 15 upgrade by end of session.

### 🔭 Sentry close-out (commits dfbd5e8, 5f96848, a8b5e7b)

Closed the observability loop opened in session 12:

- **Per-request user tagging** in `src/lib/auth-usage.ts` — `Sentry.setUser({ id: user.id })` + `Sentry.setTag('tier' | 'role' | 'task')` after profile load. Issues now show *who* hit them.
- **`src/app/global-error.tsx`** — App Router catch-all that wraps an `<html><body>` shell; reports the error via `Sentry.captureException` and shows a minimal inline-styled fallback. Required because `error.tsx` doesn't catch root-layout failures.
- **Alert rule live** — Sentry → Alerts → "When new issue created" → email captain@postcrisp.com → environment filter set on production. Verified on test event.
- **Source-map upload** — created Sentry auth token (scopes: `project:releases` Admin + `org:read`), added `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` to Vercel; pushed a no-op README commit (`a8b5e7b`) to force a rebuild that picks up the env. Release `a8b5e7bd...` showed up in Sentry → Releases. Stack traces now symbolicated end-to-end.

Net: build warnings gone, every Sentry issue has user identity + tier + role + task, root-level crashes captured, stack traces are real instead of minified.

### 🔐 Admin RLS fix — admins viewing another user's generation (commit dfbd5e8)

Triggered by tester report: "I click Rodney's generation in admin panel and get '⚠️ Generation not found'."

Two-part fix:

1. **SQL migration** — added admin SELECT policy on `generations` matching the pattern already used on `credit_transactions` and `admin_actions`:
   ```sql
   CREATE POLICY "Admins can view all generations"
     ON public.generations FOR SELECT
     USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
   ```
2. **UI guard in `src/app/dashboard/generations/[id]/page.tsx`** — detects `gen.user_id !== viewerId`, hides Save / Delete actions, shows an amber "👁 Admin view" pill. Even without the migration the UI was safe; the migration just unlocks the data.

User ran the migration in Supabase. Verified.

### 🩹 Thumbnail Analyzer fixes — defensive errors + parser rewrite (commits caf9fb2, 6720626, ea51e86)

Tester report: "Failed to analyze thumbnail. Please try again." Generic catch-all hid the real cause. Two-step fix:

1. **`src/app/api/thumbnail-analyzer/route.ts` — defensive 4-phase split** (model / parse / shape / persistence) following session 13's pattern, plus **status-aware error messages**: 429 → "AI provider is rate-limiting us", 413 → "image too large", 5xx → "AI provider issues, try again". Each phase logs structured Sentry context.
2. **`src/lib/safe-json.ts` — brace-balanced extraction** — the real bug surfaced in user's second test: "AI returned malformed output". Diagnosed `parseLooseJson`'s greedy regex `/\{[\s\S]*\}/` matching from the first `{` to the *last* `}` in the string — when LLM output had trailing prose containing a `}`, this swallowed garbage. Rewrote as a string-aware brace-depth walker (`extractFirstBalancedObject`) that tracks `inString` / escape state and returns at depth 0. Affects all 20+ AI routes that go through `parseLooseJson`, not just thumbnail.
3. **`src/lib/__tests__/safe-json.test.ts`** — 14 new unit tests: happy path, LLM-quirk tolerance (markdown fences, trailing commas, `//` comments, raw newlines in strings), brace-balanced extraction (preamble/trailing prose, `}` in trailing prose, fenced JSON with surrounding prose, `}` inside string literals), and failure modes (no JSON, truncated JSON throws as load-bearing signal). All 28 tests green.

User retested: "everything tested and good".

### ✨ CTA Optimizer (IDEA-08) shipped (commit b56bded)

First Optimize-hub feature past launch-day. End-to-end:

- **`src/app/api/cta-optimizer/route.ts`** — validates `goal` against `ALLOWED_GOALS` (clicks/comments/follows/shares/signups/purchases/dms/other), `MAX_CONTENT_LEN` 8000, voice-aware via `loadVoicePromptSnippet`, 4-phase defensive errors. Persists with `feature: 'cta_optimizer'`.
- **`src/app/dashboard/cta-optimizer/page.tsx`** — form (textarea + platform pills + goal select + optional audience/linkUrl), result UI (hero "★ Recommended" card + 4 alternatives + 3 patterns + optional warnings), save-to-library wired with `type='cta_optimization'`, `formatResultAsText` helper for markdown output.
- **System prompt** — added `cta-optimizer` task role in `src/lib/system-prompts.ts` addressing goal-fit, platform-fit, friction, voice match, anti-spam (no '🔥 CLICK HERE', no DM-pyramid energy).
- **Tier ladder** — registered in `crisp-engine-config.ts` with FAST/STANDARD/PREMIUM profile, 2-credit cost. All-tier access in `feature-access-config.ts`.
- **Surfaces** — sidebar Optimize group, dashboard `FEATURE_META`, saved-page `TYPE_META` badge (🎯 brand tone), `tools-meta.ts` Optimize hub card.

2 credits per run. Lives at `/dashboard/cta-optimizer`.

### ⬆️ Next.js 14 → 15 upgrade — shipped to production (commits 64e3d2f, a8b5e7b, 3bc8dcd)

Closed the highest-priority deferred security debt (known DoS vulns in 14.2.35).

**Branch workflow:**
- Built on isolated `nextjs-15-upgrade` branch. Smoke-tested as Vercel preview.
- Merged main → branch mid-stream to bring the 4 hot commits above (admin RLS, thumbnail fixes, parser tests, CTA Optimizer) onto the upgrade branch. Clean merge.
- Merged via GitHub PR #1 button → `3bc8dcd` on main → auto-deployed to production.

**What changed (41 files):**
- `package.json`: `next` 14.2.35 → ^15.5.15, `eslint-config-next` ^15. React 18 retained intentionally to decouple risk.
- `src/utils/supabase/server.ts`: `cookies()` → `await cookies()`, `createClient` becomes async.
- 29 server-side files: `createClient()` → `await createClient()`.
- 4 lib files use `type ServerClient = Awaited<ReturnType<typeof createClient>>` to unwrap the now-async return.
- 6 dynamic route handlers: `params: { id: string }` → `params: Promise<{ id: string }>` + `const { id } = await params`.

**Verification before merge:** local typecheck clean, 28/28 vitest, lint warnings pre-existing only, `next build` green.

**Smoke test (preview deploy):** user verified login → dashboard → caption → thumbnail → admin user view → generation detail → voice all worked. "Everything seems to be working."

Production URL now serves Next 15. Sentry observability + smoke-test affordance means any regression should surface fast.

---

## Session 13 shipped — defensive error handling + dashboard UX + per-category hub pages

8 commits. Three themes:

### 🛡 Defensive error handling on 5 long-output AI routes

Started when a tester hit "Failed to load trends. Please try again." on Trend Radar. Root cause: `maxTokens` 4000 was too tight for the 20-trend output, so Claude produced truncated JSON that crashed `parseLooseJson`'s `JSON.parse`. The route's single try/catch wrapping model + parse + DB persistence surfaced an opaque generic error.

Fixed Trend Radar, then swept the same pattern across the other 4 routes most likely to exhibit it: channel-analysis, repurpose, blog-to-social, viral-ideas. Each route now:

- **Bumps maxTokens** with headroom: `channel-analysis` 3500→4500, `repurpose` 4000→5000, `blog-to-social` 3500→4500, `trend-radar` 4000→6000. (`viral-ideas` already had dynamic budget.)
- **Splits the catch into 4 phases** — model call → parse → shape validation → DB persistence. Each phase returns a different specific error code (502 with one of: "AI provider error" / "AI returned malformed output" / "AI returned an unexpected response").
- **Logs structured context** (operation + first 500 chars of model output) so Sentry's `captureRequestError` produces useful stacks.
- **Persistence is non-fatal** — generation succeeds, audit row insert fails, user still gets the content. Audit row is the loss; logged for follow-up.

This pattern is now established. The remaining short-output AI routes (captions, hashtags, polls, comment-reply, etc.) could get the same treatment if a Sentry pattern shows them losing audit rows, but lower priority.

### 🎨 Dashboard UX polish

- **Thumbnail Analyzer save-to-library** — added "Save analysis to library" button. Flattens the structured analysis (click prediction + strengths + prioritized improvements + visual analysis dimensions) into markdown-style text and POSTs to `/api/saved` with `type='thumbnail_analysis'`.
- **Saved library page renderer fix** — bug pre-existed: ANY type other than `caption`/`hashtags`/`viral_idea` was rendering as a green "🚀 Viral Idea" badge. Affected existing Channel Reports too. Replaced nested ternaries with a `TYPE_META` map driving filter buttons + badges. New entries: 🪞 Channel Reports (purple), 🖼️ Thumbnail Analyses (amber). Filter buttons hide when count is 0. `SavedItem.type` widened from a literal union to plain string.
- **"Show hidden checklists" affordance** — once user dismisses GettingStartedCard or NextToolsCard there was no way to bring them back. New subtle button at the bottom of dashboard, only renders when at least one card is dismissed; one click resets both flags.
- **Channels row promoted to top of dashboard** — was buried below 4 other modules. Now fires immediately after the greeting header. Empty state gracefully gated (zero-channel users still hit GettingStartedCard's "Add your channels" prompt).
- **Channel profile pictures via unavatar.io** — `<ChannelAvatar>` component renders user's actual profile pic from each platform with a platform-emoji fallback when fetch fails. CSP updated to allow unavatar.io + major CDN redirect targets (googleusercontent, twimg, cdninstagram, tiktokcdn, licdn, etc.). Reliability varies by platform — IG/TikTok occasionally blocked; emoji fallback handles those cleanly.

### 🗂 Per-category hub pages (brainstormed mid-session)

User flagged the sidebar as clunky — wanted clicking a top-level category (Create / Optimize / Grow / Monetize / Library) to go to a dashboard listing all tools in that category, with the user's recent activity and "how to use them" guidance.

Designed and shipped 4 hub pages + Library sidebar relabel:

- **`<CategoryHub>` reusable component** at `src/components/CategoryHub.tsx`. Each category page is a thin 10-line wrapper passing in title + description + tools array.
- **`src/lib/tools-meta.ts`** — single source of truth for the 21 tools across 4 categories. Each tool has `key` (matches generations.feature), category, icon, label, tagline, "Best for: ..." line, and href.
- **Hub layout**: header (category + tool count + 1-sentence orientation copy) → tool grid (3-col on desktop) with cards showing tagline + "Best for:" + a green "USED" pill if user has past generations for that tool → recent activity filtered to category's tools (last 8) → graceful empty state.
- **Sidebar refactor**: `NavGroup` gained an optional `hubHref` field. Categories with a hub render a split header — clickable Link for the label + separate disclosure-arrow button for expanding the inline tool list. Power-user direct access preserved; new users discover via the hub.
- **Library hub = relabeled `/dashboard/saved`**, no new code. Sidebar Library group label points there.

Routes: `/dashboard/create` (8 tools), `/dashboard/optimize` (6), `/dashboard/grow` (4), `/dashboard/monetize` (3). Each ~580 B in the build thanks to the shared component.

---

## Session 12 shipped — hardening sprint + onboarding completion + 2 new features

A massive session: ~30 commits across 8 distinct lanes. Closed all P0 security review items, finished the onboarding arc started in session 11, and shipped two strategic features (Thumbnail Analyzer + Brand Readiness Score). Everything verified live in production.

### 🛡 Phase 0 hardening sprint — production safety net

Closed every P0 from the security review + ChatGPT/Claude codebase assessments in one push:

- **Sentry error monitoring** wired across server / edge / client runtimes via `@sentry/nextjs` v10. Gated on `VERCEL_ENV` so local dev stays quiet. Bug fixed mid-session: client gate originally read `NEXT_PUBLIC_VERCEL_ENV` (which Vercel doesn't auto-inject) — switched to gate on DSN presence only.
- **Upstash Redis rate limiting** on all 20 AI generation routes + feedback. 30/min per user, 60/min per IP backstop, 10/hr feedback. Wired through `opts.request` on `checkAuthAndUsage` so all 20 AI routes get the limiter in one helper change.
- **Server-authoritative Stripe priceId mapping** (security review H1). Client now sends `{tier, cycle}`; server resolves Stripe price ID from a hardcoded map. Closes the revenue-manipulation exploit before paywall activation.
- **Server-only Alpha NDA acceptance endpoint** (M-tier). New `/api/user/alpha-acceptance` captures `accepted_at` + `version` + `user_agent` server-side. `alpha_nda` removed from preferences whitelist so it can't be forged client-side.
- **Baseline security headers** in `next.config.mjs`: CSP (with Sentry/Stripe origins), HSTS w/ preload, frame-ancestors none, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy.
- **Vitest test runner** + 8 critical-path tests on `consumeCredits` + `checkAuthAndUsage` + `isInActiveTutorial`. Lightweight in-memory Supabase fake instead of mocking the full client.
- **GitHub Actions CI** running lint + typecheck + tests on every PR + push to main. First merge gate the project has had.

Production now has error visibility, cost-spike protection, server-authoritative billing, audit-trail integrity, and a regression-blocking CI gate. Solo-founder ops went from "git push to main = deploy + pray" to "PR → CI green → safe merge."

### 🎓 Tutorial Phase 1 — bug-fix sweep + replay lock

Continuing from morning's tutorial work, fixed several mid-flow bugs surfaced by manual testing:

- Channel Analysis was tier-gated on top of credit-gated — bypass extended to feature-gate too
- Hashtags step was POSTing to a GET-only endpoint (405) — switched to GET with query params + correct category enum
- Viral Ideas had no fallback when niche didn't carry through — added inline niche input
- Channel Analysis got a 5-stage progress indicator (animated bar + cycling messages); same pattern then applied to Viral Ideas
- Tutorial credit bypass extended to all 4 generation steps (was only step 1)
- **Replay lock**: once any step is finished, server-side `shouldGrantTutorialBypass` denies further free runs by querying the `generations` table for prior `tutorialMode: true` rows. Client-side: sidebar Tutorial link hidden + `/onboarding` redirects to `/dashboard` when `tutorial_progress.completed === true`.
- **Tutorial ctx persistence** — niche / captionTopic / selectedChannel now persist to `profiles.preferences.tutorial_progress` on every step transition. Refresh mid-flow no longer resets state.

### 🧹 Dead code cleanup (security review H2/H3)

- Deleted orphaned `src/app/login/actions.ts` (H2) — bypassed access-control gate
- Deleted dead `src/lib/supabase.ts` (H3) — exposed service-role key via `createBrowserClient` factory; verified zero callers before delete
- Deleted `MOCK_BEST_TIMES` dead-code constant from `src/lib/constants.ts`

### 🎙 Voice Trainer — 3 polish items

- **Voice analyze timeout** was hitting the 15 s default `apiFetch` timeout while Claude was still processing 11 trait dimensions. Bumped to 120 s. Same root cause pattern as the tutorial Channel Analysis fix earlier in the session.
- **Voice retrofit sweep** — added `loadVoicePromptSnippet` injection on 6 voice-relevant routes (brand-pitch, comment-reply, dm-template, polls, viral-ideas, youtube-seo). 5 → 11 voice-aware routes. Skipped intentionally on 9 analytical routes where voice shouldn't bias the answer (hashtags, best-times, rate-calculator, trend-radar, sounds, competitor-analysis, channel-analysis, platform-tips, collab-finder).
- **Caption-clarity copy** — rewrote 8 surfaces on `/dashboard/voice` to lead with "paste captions" instead of burying them in lists of 4–6 content types. Feature name stays "Voice Trainer" (captions are the input; voice is the output).

### 📚 Onboarding Phase 2 — 10-tool discovery checklist

New `<NextToolsCard>` on `/dashboard` that surfaces post-tutorial. Auto-checks each tool when the matching feature key appears in `generations.feature` — no manual marking. Tools (ranked by impact per ROADMAP): Scripts, Repurpose, Channel Analysis, Trend Radar, Platform Tips, Bio Optimizer, Sound Tracker, Blog→Social, Comment Replies, Brand Pitch.

Visibility: `tutorial_progress.completed === true` OR `onboarded_at` set (backfill for grandfathered alpha testers). Auto-hides at 10/10 or user dismisses (persists via `preferences.next_tools_dismissed`).

### 🆕 Two new feature builds

**Thumbnail Analyzer** (`/dashboard/thumbnail-analyzer`) — first multimodal feature in the platform. Drag-drop upload → Claude vision critique with structured output:

- Click prediction (1–10 score + reasoning)
- Visual hierarchy / emotional hook / subject framing / color contrast / platform fit
- Text legibility (score + specific issues, sized to platform's actual thumbnail-display dimensions)
- 2–3 strengths + 3–5 prioritized improvements (high/medium/low badges, with the "why")

4 credits, all tiers (acquisition feature), Sonnet for Starter+Creator, Opus for Elite. API calls Anthropic SDK directly since `crispGenerate` doesn't yet accept image content blocks; auth + credits + rate limit still flow through `checkAuthAndUsage`. Image stays in the request → Anthropic → discarded; only metadata lands in `generations.input_data`.

**Brand Readiness Score lite** (IDEA-10) — deterministic 0–100 dashboard hero card. Score across 5 dimensions (channel coverage 20pts / voice training 20pts / tool variety 25pts / saved library 15pts / recent activity 20pts), letter grade A–F, top 3 highest-leverage actions sorted by points-to-gain. Pure rule-based: no AI call, no credit cost, instant, predictable. Lives in `src/lib/brand-readiness.ts` with 6 unit tests covering scoring + grade thresholds + action sorting.

### Sentry runtime debugging (live in production)

End-to-end Sentry verification took multiple hours of debugging across the session:

1. Built and shipped initial Sentry config + DSN inlined in bundle — confirmed via probing `_next/static/chunks/main-app-*.js`
2. First test event → **403** from Sentry — Brave / extensions ruled out as ad-blocker locally
3. Discovered DSN's public key in bundle (`7a0329d8...`) didn't match the active Sentry project key (`f412bc85...`) — old DSN was stale
4. Updated `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` in Vercel env vars → forced fresh build (uncheck build-cache)
5. Bundle re-probed: new key inlined ✅
6. Browser test → **403** persisted → fixed Allowed Domains on the new client key
7. Final test → **200**, event landed in `crusher-brands-llc/javascript-nextjs` Issues. End-to-end verified.

Lessons captured: Vercel env-var changes don't take effect until next build (must redeploy with build-cache off); Sentry's "Allowed Domains" is per-Client-Key, not project-wide.

---

## Status snapshot

| Step | Status |
|---|---|
| Step 1 — Polish existing | ✅ Done |
| Step 2 — Admin Phase 1 (AI config) | ✅ Done |
| Step 3 — Tiers | ✅ Done |
| Step 4 — 16+ AI features (now 17 with Thumbnail Analyzer) | ✅ Done |
| Step 5 — Moderate features (Calendar, Media Kit, Analytics) | ⏸ Deferred post-launch |
| Step 5.5 — Brand palette | ✅ Done 2026-04-22 |
| Step 6 — Landing page | ✅ Done |
| Step 6.5 — Cost optimization | ✅ Done |
| Step 6.75 — Credit system | ✅ Done |
| Admin Phase 2 — Users + Analytics + Cost + Audit + Access | ✅ Done sessions 6–8 |
| Admin Phase 2 — Password reset + recovery | ✅ Done session 9 |
| Admin Phase 2 — Billing admin / Moderation | ⏳ Remaining |
| Voice Trainer v1 + retrofit (11 of 20 routes) | ✅ Done (session 10 + 12) |
| Channels + Living Dashboard v1-lite | ✅ Done session 11 |
| Guided onboarding v1 (3-step) | ✅ Done session 11 |
| Alpha Tester Agreement + acceptance gate | ✅ Done session 11 |
| Progressive tutorial Phase 1 (5-step) | ✅ Done 2026-04-25 |
| Phase 2 onboarding (10-tool discovery) | ✅ Done 2026-04-25 |
| Thumbnail Analyzer (multimodal) | ✅ Done 2026-04-25 |
| Brand Readiness Score lite (IDEA-10) | ✅ Done 2026-04-25 |
| **Phase 0 hardening sprint** (Sentry + rate limit + headers + Stripe + alpha_nda + Vitest + CI) | ✅ Done 2026-04-25 |
| Defensive error-handling sweep on 5 long-output AI routes | ✅ Done 2026-04-26 |
| Per-category hub pages (Create / Optimize / Grow / Monetize) + Library relabel | ✅ Done 2026-04-26 |
| Dashboard polish (channels promoted, profile pictures, show-hidden affordance, Saved badges) | ✅ Done 2026-04-26 |
| Thumbnail Analyzer save-to-library | ✅ Done 2026-04-26 |
| **Sentry close-out** (global-error + user tagging + alert rule + source-map upload) | ✅ Done 2026-04-26 (s14) |
| Admin RLS fix — admin generation view | ✅ Done 2026-04-26 (s14) |
| `parseLooseJson` brace-balanced rewrite + 14 unit tests | ✅ Done 2026-04-26 (s14) |
| Thumbnail Analyzer defensive error handling + status-aware messages | ✅ Done 2026-04-26 (s14) |
| CTA Optimizer (IDEA-08) | ✅ Done 2026-04-26 (s14) |
| **Next.js 14 → 15 upgrade — shipped to production** | ✅ Done 2026-04-26 (s14) |
| **Custom domain postcrisp.com live** | ✅ Done 2026-04-27 (s14b) |
| Brand refresh — new logo + 'Creation Gateway' tagline | ✅ Done 2026-04-28 (s14c) |
| Single-use invite codes for beta tester rollout | ✅ Done 2026-04-28 (s14c) |
| Phase 1 refine pass — Channel Analysis on Elite | ✅ Done 2026-04-28 (s14c) |
| Sentry false-positive suppression (hydration + Supabase fetch) | ✅ Done 2026-04-28 (s14c) |
| Mobile audit — landing stats + 44px touch targets on sidebar drawers | ✅ Done 2026-04-28 (s14c) |
| MFA on Tier 1 external accounts (Supabase/Vercel/GitHub/Stripe/Anthropic/Resend/Sentry) | ✅ Done 2026-04-28 (s14c) |
| **Alpha deployment** | ✅ Live (https://postcrisp.com) |
| Step 7 — Launch prep | 🟡 1 item blocking (Stripe verification, up to 2 days) |

---

## ⏭️ Next session — recommended order

**Pre-public-launch (Step 7 remaining):**
1. ~~Custom domain~~ ✅ Done s14b
2. ~~MFA Tier 1 external accounts~~ ✅ Done s14c
3. ~~Mobile responsive audit~~ ✅ Done s14c (real blockers fixed; cosmetic noise deferred)
4. **Stripe production prices + webhook — BLOCKED on Stripe verification (up to 2 days)**. Playbook captured in session 14c block above. Resume with the 6-step checklist when verification clears.

**Pre-beta launch — soft (do once Stripe clears + first wave of testers in):**
5. Generate first batch of invite codes at `/admin/invite-codes` and DM to TikTok-recruited testers
6. Set Anthropic monthly spending cap ($50-100) in Billing settings — defense in depth even if API key leaks
7. Verify Resend SMTP delivers to first wave from the production domain

**Post-launch experiments to watch:**
8. **Phase 2 refine expansion** — roll refine to CTA Optimizer + Brand Pitch + Competitor Analysis IF Phase 1 cohort metrics validate the lift. Don't pre-emptively expand.
9. **Refine cohort A/B** — query `generations` filtered to channel_analysis, group by `input_data->>'refined'` boolean, compare save-to-library rates after 1-2 weeks of beta data. Decides Phase 2.
10. **In-app MFA Tier 2** — `/dashboard/settings/security` panel using `supabase.auth.mfa.enroll()` + `aal2` upgrade flow (~4-6 hrs).

**Smaller polish (queue up if you want low-effort wins):**
- Mobile audit: revisit channel-analysis platform buttons, hashtags action bar — both work but feel cramped at 320px
- Modal form max-width on iPhone SE (cosmetic, not a blocker)
- Defensive sweep on remaining short-output AI routes if Sentry shows audit-row losses
- Tool-level channel picker (~1 hr)
- Library reorg by channel tabs (~1 hr)
- Error boundary audit on newer pages (CTA Optimizer, Voice Trainer, Thumbnail Analyzer)

**First 24-48 hrs after Stripe ships + beta announcement:**
- Watch Sentry issue rate vs baseline
- Watch Stripe webhook delivery success rate
- Check that first tester signups consume invite codes correctly
- Spot-check refined Channel Analysis outputs are landing well

**Code (next big build — pick one):**
5. **Brand Deal Maker** (IDEA-09) — needs separate scoping session before build
6. Phase 3 daily-suggestion widget — only build if Phase 2 NextToolsCard data shows drop-off
7. **Billing admin** — replace list-price MRR estimate with real Stripe API pull

**Smaller polish (queue up if you want low-effort wins):**
- Mobile sidebar audit — the clickable category-label + arrow-button split should be eyeballed on mobile to confirm touch targets aren't cramped
- Settings + Billing currently nested under Library group; future "Account" group could split them off cleanly
- Defensive error-handling sweep on the remaining short-output AI routes (captions, hashtags, polls, comment-reply, etc.) — pattern is established; only worth doing if Sentry shows them losing audit rows
- Tool-level channel picker (~1 hr) — replace platform dropdown on tools with the user's channels picker
- Library reorg by channel tabs (~1 hr)
- Error boundary audit on the newer pages (CTA Optimizer, hubs, Voice Trainer, Thumbnail Analyzer)

**Watch first 24–48 hrs after Next 15 deploy:**
- Sentry issue rate vs. baseline — async cookie/params migration is the riskiest surface; any regression should fire there first
- A few production smoke-test runs on the live URL (login → dashboard → caption → admin user view) to confirm prod parity with the smoke-tested preview

---

## Background routine scheduled

A one-time agent fires **Sat May 2 2026 at 9 AM Pacific** to produce a week-1 retrospective punch list. Reads commits since `1c782ec`, checks CI run status, surfaces what's still pending. Manage at https://claude.ai/code/routines/trig_01CzDXzPumyCMQVxYsbdorgV

---

## Earlier session history (kept for context)

### Session 11 (2026-04-22) — brand palette + channels + onboarding wizard

Brand palette adopted (Gunmetal + Electric Blue), Channels + Living Dashboard v1-lite, 3-step guided onboarding wizard, Alpha Tester Agreement + in-product acceptance gate. Voice Trainer URL import parked.

### Session 10 (2026-04-21) — Voice Trainer v1

`voice_profiles` schema + `/dashboard/voice` UI + Claude trait extraction + 5 feature retrofits (captions, scripts, repurpose, blog→social, bio-optimizer). Remaining 6 voice-relevant routes retrofitted in session 12.

### Session 9 — admin password reset + recovery flow fix

### 🔑 Admin-initiated password reset
- New **Send password reset** button on `/admin/users/[id]` (Account actions panel, next to Save changes)
- POST `/api/admin/users/[id]/reset-password` looks up email via service role, calls `supabase.auth.resetPasswordForEmail()` which fires the email through our Resend SMTP
- Logs to `admin_actions` with action `password_reset` — visible in `/admin/audit` with a sky-blue 🔑 badge and in the action-type filter dropdown
- Browser confirm before sending ("Send a password reset email to X?")

### 🛠 Recovery flow actually works now
Three compounding bugs prevented users from completing password recovery in production:

1. **Missing reset form.** No `/auth/reset-password` page existed. Even if routing worked, users had no UI to set a new password. Created a dedicated page that:
   - Verifies the recovery session is present (shows "Recovery link invalid" with a request-new-link CTA if not)
   - Provides a form with new password + confirm
   - Calls `supabase.auth.updateUser({ password })` and redirects to `/dashboard` on success

2. **Callback ignored `next` param.** `/auth/callback/route.ts` always redirected to `/dashboard` after exchanging the recovery code. Now honors the `next` query param (sanitized to local paths only — refuses `//`, `://`, or absolute URLs to prevent open-redirect).

3. **redirectTo used unset env var.** Both the admin reset route and the self-serve `/forgot-password` action built `redirectTo` using `process.env.NEXT_PUBLIC_SITE_URL ?? ''`, which is unset on Vercel. That produced a relative URL Supabase couldn't use, so it fell back to the Site URL root. Both now derive origin from request headers at runtime — no env var dependency.

**Flow end-to-end:**
Email link → Supabase verify → `/auth/callback?next=/auth/reset-password` → code exchange creates recovery session → redirected to reset form → submit updates password → `/dashboard` signed in.

---

## Session 8 shipped — deployment pipeline + alpha gate

### 🚀 Production deployment is live
- **GitHub:** `iambigd60/PostCrisp` (private), auto-deploys on push to `main`
- **Vercel:** project connected to GitHub, 5 env vars set (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY)
- **Supabase:** Site URL + Redirect URLs updated to point at Vercel subdomain (`https://<project>.vercel.app/**`)
- **SMTP:** Resend configured via Supabase custom SMTP. Domain `postcrisp.com` verified with SPF + DKIM + MX + DMARC records; sender `noreply@postcrisp.com` (or similar) works end-to-end. Password recovery + signup confirmation both deliver reliably.

### 🚪 Access Control feature
- New admin page at `/admin/access-control` with three signup modes (Open / Invite-only / Closed) plus a separate login-enabled toggle
- New `platform_settings` table (key/value JSONB, admin-only RLS)
- `readAccessControl()` helper with 30s in-process cache
- Constant-time invite-code compare in `matchesInviteCode()`
- Login gate bypasses admins (role=admin) so you can't lock yourself out
- Every change logs to `admin_actions` with action=`access_control_change`, visible in the audit viewer
- **Supabase dashboard setting:** public signups disabled (Auth → Providers → Email) so nobody can bypass the gate by calling Supabase's auth endpoint directly

### 🐛 Bugs fixed for production build
- `src/app/api/viral-ideas/route.ts` — recovery loop used raw `JSON.parse` on slices, dropped all remaining ideas after first malformed one. Now uses `parseLooseJson` and continues past bad objects.
- `src/app/dashboard/platform-tips/page.tsx` + `trends/page.tsx` — unused `useToast` imports failed Vercel's strict ESLint; removed
- `src/app/dashboard/settings/page.tsx` — `Profile.preferences` type missing `channels` field; added
- `src/lib/providers/anthropic.ts` — SDK's `TextBlockParam` doesn't declare `cache_control` yet; cast through `unknown` to unblock build
- `src/lib/platform-settings.ts` — `writeAccessControl` was swallowing Supabase errors; now throws with underlying message
- `src/app/api/access-control/public/route.ts` — Next.js 14 cached the GET at build time, making DB changes invisible. Added `export const dynamic = 'force-dynamic'`.

### 🧪 Alpha flow verified end-to-end
- Admin toggles signup mode + sets invite code → saves to DB → public endpoint reflects immediately
- Incognito `/signup` shows invite-code field when invite mode is active
- Wrong code rejected, right code proceeds with signup flow
- Confirmation email arrives from postcrisp.com via Resend
- Tester can now sign up with the shared code; admin can rotate the code any time to revoke access

### Key gotchas captured for future sessions
- **Next.js 14 GET route caching:** any API route reading mutable DB state needs `export const dynamic = 'force-dynamic'`. Admin routes that call `requireAdmin()` are automatically dynamic (auth/cookies). Public endpoints are NOT.
- **Supabase error silent-swallow:** any Supabase query result should destructure `{ data, error }` and throw/return on error. Empty try/catch hides real problems.
- **Resend sandbox mode:** until your domain is fully verified (all 4 records: SPF, DKIM, MX, DMARC) you can only send to the account owner's email. DMARC is easy to miss — Resend's docs flag the first three clearly but DMARC is a more recent addition.

---

## Session 7 recap

- GitHub backup + `/save` slash command + `scripts/backup.sh`
- `scripts/rotate-admin-password.mjs` + admin password rotated
- `FREE_DAILY_LIMIT` 100→10
- Analytics cost tracking ($ estimates per feature + top users)
- Audit Log viewer at `/admin/audit`
- Brainstorm doc ingested (`docs/ideas/`) + strategic decision record

## Session 6 recap

- Admin Phase 2: Users list + detail pages, tier/role change, disable/enable, credit adjust link
- Admin Phase 2: Analytics v1 (8 KPI tiles, tier distribution, daily chart, feature breakdown, top users)

---

## Status snapshot

| Step | Status |
|---|---|
| Step 1 — Polish existing | ✅ Done |
| Step 2 — Admin Phase 1 (AI config) | ✅ Done |
| Step 3 — Tiers | ✅ Done |
| Step 4 — 16 new features + paywalls | ✅ Done |
| Step 5 — Moderate features | ⏸ Deferred post-launch |
| Step 5.5 — Brand palette | ✅ Done 2026-04-22 — Gunmetal + Electric Blue applied |
| Step 6 — Landing page | ✅ Done |
| Step 6.5 — Cost optimization | ✅ Done |
| Step 6.75 — Credit system | ✅ Done |
| Admin Phase 2 — Users + Analytics | ✅ Done (session 6) |
| Admin Phase 2 — Cost tracking + Audit viewer | ✅ Done (session 7) |
| Admin Phase 2 — Access Control | ✅ Done (session 8) |
| Admin Phase 2 — Password reset + recovery fix | ✅ Done (session 9) |
| Admin Phase 2 — Billing admin / Moderation | ⏳ Remaining |
| Voice Trainer v1 | ✅ Core shipped (s10), URL import on hold (s11) |
| Brand palette (Gunmetal + Electric Blue) | ✅ Done (session 11) |
| Channels + Living Dashboard v1-lite | ✅ Done (session 11) |
| Guided onboarding + Getting Started checklist | ✅ Done (session 11) |
| Alpha Tester Agreement template + in-product acceptance gate | ✅ Done (session 11) |
| **Alpha deployment** | ✅ **Live on Vercel (session 8)** |
| Step 7 — Launch prep | 🟡 Partial (alpha live, MFA + Stripe prod + custom domain remain) |

---

## ⏭️ Next session (2026-04-23) — DECIDED PLAN

**Building:** Progressive onboarding tutorial — 5-step guided walkthrough + the groundwork for the post-tutorial 10-tool progressive checklist. Full design + decisions captured in ROADMAP.md under "🔜 Next phase — Progressive onboarding tutorial + post-onboarding tour".

**Start-of-session sequence:**

1. Ask the 5 unanswered decision questions (listed in ROADMAP "Decisions still needed"). Quick answers unblock the build.
2. Build Phase 1 (5-step tutorial, ~6-8 hrs unattended).
3. Commit + push.
4. Defer Phase 2 (next-10-tools checklist) to the session after — only build once we have tester signal on the initial tutorial.

**Default answers if user says "go with your recs":**
- Credits during tutorial: platform absorbs step 1 (~$0.05-0.10/user); steps 2-5 use user's normal credits
- Half-viewable: show-summary-lock-specifics (overall assessment + 2 of 3 strengths + 1 of 4 gaps visible; Quick Wins + Long-Term Moves + remaining gaps locked)
- Paywall: inline upgrade CTA next to locked content, not a modal
- Grandfathered users: Rodney + Klar brothers DON'T see tutorial on next login (optional "Take the tour" button on Getting Started card)
- Sequence: Channel Analysis → Captions → Hashtags → Viral Ideas → Save-to-library

**Branding does NOT block this build.** Palette is applied app-wide. Logo is a single-component swap whenever final asset lands. Tutorial is live/contextual (users run real tools), no screenshots to reshoot later.

**Security review findings to handle IN PARALLEL (or after Phase 1):**
See `docs/security-review.md`. Must-fix-before-20-testers items (~90 min total) can be batched as their own commit before the next tester wave:
- Delete orphaned `src/app/login/actions.ts` (H2)
- Delete dead `src/lib/supabase.ts` (H3)
- Security headers in `next.config.mjs` (M3)
- Server-side NDA acceptance endpoint (M1)
- RLS fix on `feature_access` + `ai_config_overrides` (M4)
- TEXT length caps (L2)

---

## Backlog (not prioritized for next session)

1. **Tool-level channel picker** (~1 hr) — replace platform dropdown with `channels` picker; starts populating `saved_content.channel_id`
2. **Library reorg by channel tabs** (~1 hr)
3. **Brand Readiness Score** (IDEA-10, ~3-4 hrs) — gamification, pure Claude + internal DB
4. **Thumbnail Analyzer** (IDEA-04, ~2 hrs) — Claude vision
5. **Billing admin** — real Stripe MRR replacing list-price estimate
6. **Stripe production price IDs** — needed before paywall activation
7. **Custom domain** (`postcrisp.com` → Vercel, ~15 min)
8. **Rate limiting via Upstash** (~45 min, M2 from security review)
9. **MFA on admin account** (external, ~30 min in Supabase dashboard)
10. **Triage Rodney/tester feedback** — ongoing default

Voice Trainer URL import parked. Two real long-term paths: SearchAPI.io (~$0.005/req) or YouTube OAuth (own-content only, Google review required).

---

## ⚠️ SQL migrations pending from session 11 (run these in Supabase)

```sql
-- Channels
CREATE TABLE IF NOT EXISTS public.channels (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  platform    TEXT NOT NULL,
  handle      TEXT NOT NULL,
  label       TEXT,
  url         TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS channels_user_id_idx ON public.channels (user_id, sort_order, created_at);
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own channels" ON public.channels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own channels" ON public.channels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own channels" ON public.channels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own channels" ON public.channels FOR DELETE USING (auth.uid() = user_id);
CREATE OR REPLACE TRIGGER channels_updated_at BEFORE UPDATE ON public.channels FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- saved_content channel FK
ALTER TABLE public.saved_content ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS saved_content_channel_id_idx ON public.saved_content (channel_id);
```

Session 10 `voice_profiles` migration still applicable if not already run.

---

## ⚠️ SQL migration from session 14b (run this in Supabase)

```sql
-- Single-use invite codes for beta tester rollout. Replaces the shared
-- invite_code in platform_settings.access_control as the primary path.
CREATE TABLE IF NOT EXISTS public.invite_codes (
  code        TEXT PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes       TEXT,
  used_at     TIMESTAMPTZ,
  used_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS invite_codes_used_at_idx ON public.invite_codes (used_at);
CREATE INDEX IF NOT EXISTS invite_codes_created_at_idx ON public.invite_codes (created_at DESC);
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read invite_codes"
  ON public.invite_codes FOR SELECT
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
-- No INSERT/UPDATE/DELETE RLS — all writes go through service role from
-- admin API routes (generation) or the signup action (atomic claim).
```

After running, generate codes at `/admin/invite-codes`. The signup action
checks the new table first, then falls back to the legacy shared code in
`platform_settings.access_control.invite_code` (if set) for a clean
transition.

---

## ⚠️ SQL migration from session 13 (run this in Supabase)

```sql
-- Admins can read every user's generation rows so the admin user-detail
-- view can show 'Recent generations' and the per-row detail page works.
-- Without this, admins clicking another user's generation get
-- "Generation not found" because RLS filters the row.
CREATE POLICY "Admins can view all generations"
  ON public.generations FOR SELECT
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
```

The detail page UI also now hides Save / Delete buttons when an admin is
viewing someone else's generation, with a small "👁 Admin view" pill in
the header. So even before you run the migration, the UI is safe — it
just won't load anyone else's row until the policy is in place.

---

## SQL migrations run in earlier sessions (for your records)

```sql
-- Session 8: platform_settings for access control
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read platform_settings"
  ON public.platform_settings FOR SELECT
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
INSERT INTO public.platform_settings (key, value)
  VALUES ('access_control', '{"signup_mode":"open","invite_code":null,"login_enabled":true}'::jsonb)
  ON CONFLICT (key) DO NOTHING;
```

No other DB changes this session.

---

## Known issues / punchlist

- Admin password rotated 2026-04-20. Rotate again on a schedule (quarterly or after any suspected exposure) via `scripts/rotate-admin-password.mjs`.
- Azure provider shows in admin dropdowns but falls back to Anthropic (not yet wired)
- Generations don't log `provider` + `model` — analytics cost shown is current-routing inference, not historical accuracy
- Anthropic cache-read tokens count at full value in analytics but bill at ~10%; cost totals skew high when caching is hot
- Est. MRR uses list prices, ignores yearly discounts — replaced once Billing admin ships
- ~~`src/app/login/actions.ts` orphaned~~ deleted in s12 hardening sprint
- ~~`MOCK_BEST_TIMES` dead code~~ deleted in s12 hardening sprint

## Manual setup still pending (for production)

- ~~Custom domain `postcrisp.com` → Vercel~~ ✅ Done 2026-04-27
- ~~Update Supabase Site URL + Resend sender~~ ✅ Done 2026-04-27
- ~~MFA on platform accounts~~ ✅ Done 2026-04-28 (Tier 1 — all 7 accounts)
- 🟡 **Create Stripe products in live mode** — BLOCKED on Stripe verification. Playbook in session 14c block.
- 🟡 **Register Stripe webhook endpoint for production** — same blocker
- Set Anthropic monthly spending cap ($50-100) — defense in depth (5 min, do anytime)
- Google OAuth in Supabase Auth settings (currently disabled in invite-only flow anyway)
- MFA in-app for captain@postcrisp.com (Tier 2, requires UI build, ~4-6 hrs, post-launch)
