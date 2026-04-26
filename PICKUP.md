# PostCrisp — Where We Left Off

**Last updated:** 2026-04-26 (session 13 — defensive error handling + UX polish + per-category hub pages)
**Build status:** ✅ Live on Vercel — production verified end-to-end
**Production URL:** https://postcrisp.vercel.app/
**Dev server:** `npm run dev` (port 3000 or next available)

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
| **Alpha deployment** | ✅ Live on Vercel (postcrisp.vercel.app) |
| Step 7 — Launch prep (custom domain, MFA, Stripe prod, mobile audit, Next.js 15) | 🟡 Partial |

---

## ⏭️ Next session — recommended order

**Manual items (yours, ~10 min total):**
1. Sentry alert rule — create at https://crusher-brands-llc.sentry.io/alerts/rules/ → "When new issue created" → email yourself
2. SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT env vars in Vercel — eliminates build warnings + symbolicates stack traces. Token: Sentry → Settings → Account → API → Auth Tokens, scope `project:releases` + `org:read`

**Code (next big build — pick one):**
3. **Next.js 15 upgrade** on its own branch. Semver-major, half-day work. Closes known DoS vulns in 14.2.35. Should be its own focused session.
4. **CTA Optimizer** (IDEA-08) — depends on Voice Trainer (now solid). 2–3 hrs.
5. **Brand Deal Maker** (IDEA-09) — needs separate scoping session.
6. Phase 3 daily-suggestion widget — only build if Phase 2 NextToolsCard data shows drop-off.

**Smaller polish (queue up if you want low-effort wins):**
- Mobile sidebar audit — the new clickable category-label + arrow-button split should be eyeballed on mobile to confirm touch targets aren't cramped
- Settings + Billing currently nested under Library group; future "Account" group could split them off cleanly
- Defensive error-handling sweep on the remaining short-output AI routes (captions, hashtags, polls, comment-reply, etc.) — pattern is established; only worth doing if Sentry shows them losing audit rows
- Tool-level channel picker (~1 hr) — replace platform dropdown on tools with the user's channels picker
- Library reorg by channel tabs (~1 hr)

**Pre-public-launch (Step 7 remaining):**
7. Custom domain `postcrisp.com` → Vercel + Supabase Site URL update
8. Stripe production prices (6 price IDs) + webhook for production
9. MFA enrollment for `captain@postcrisp.com`
10. Mobile responsive audit (full app, not just sidebar)
11. Next.js 15 upgrade (above)
12. Error boundary audit on new pages

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
- `src/app/login/actions.ts` is orphaned (the real login action is at `src/app/(auth)/login/actions.ts`). Safe to delete.
- `MOCK_BEST_TIMES` constant still dead code

## Manual setup still pending (for production)

- Custom domain `postcrisp.com` → Vercel (add in Vercel → Domains, update DNS)
- Update Supabase Site URL + Resend sender if custom domain ships
- Create Stripe products: Creator/Team/Elite Monthly/Yearly (6 price IDs)
- Register Stripe webhook endpoint for production
- Google OAuth in Supabase Auth settings (currently disabled in our invite-only flow anyway)
- MFA enrollment for `captain@postcrisp.com`
