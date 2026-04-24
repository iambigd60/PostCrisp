# PostCrisp — Where We Left Off

**Last updated:** 2026-04-22 (session 11 — brand palette, channels, dashboard, onboarding)
**Build status:** ✅ Live on Vercel — big visual + UX shift shipped this session
**Production URL:** your Vercel project (`postcrisp-*.vercel.app`) — see https://vercel.com/dashboard
**Dev server:** `npm run dev` (port 3000 or next available)

---

## Session 9 shipped — admin password reset + recovery flow fix

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

## Session 11 shipped — brand palette + channels + living dashboard + onboarding

Four strategic pieces, all architecturally aligned so they compound.

### 1. Brand palette adopted — Gunmetal + Electric Blue (`133fc2d`)
- Official hex values locked per user spec. Aviation/naval theme.
  - Gunmetal Black `#0E1216` / Deep Steel `#181E24` / Gunmetal `#2D343C`
  - Electric Blue `#4A9EE0` (brand-500) / Warship Grey `#8C949C` / Hangar White `#E8ECEF`
- `tailwind.config.ts` brand ramp rebuilt around Electric Blue. `surface-*` → Gunmetal family. `shadow-glow` pulses Electric Blue. New `crisp-*` + `paper` semantic tokens.
- `globals.css` fully migrated — new `--brand-*` variables, legacy `--violet-*` aliased for backwards compat, every hardcoded rgba violet → Electric Blue rgba.
- Per-component hex fixes: landing hero gradient, dashboard usage ring, demo usage ring, demo heatmap, billing pill.
- New memory: `project_brand_palette.md` captures naming + conventions. Strategic decision record updated — prior "defer palette until post-launch" call was superseded.

### 2. Channels + Living Dashboard v1-lite (`3fc7481`)
- New `channels` table (user_id, platform, handle, label, url, sort_order). RLS + 20/user cap + updated_at trigger.
- `saved_content.channel_id` FK added (nullable, backwards-compatible).
- `src/lib/channels.ts` — typed helpers, `PLATFORM_META` with branded chip styles, `loadChannels`, `defaultChannelForPlatform`.
- Four API routes: `GET/POST /api/channels`, `PATCH/DELETE /api/channels/[id]`.
- `ChannelsSection` reusable component — dropped into Settings + Onboarding.
- Dashboard rebuilt: **typed daily briefing** (deterministic, references user's channels + usage, typewriter on mount), **channels row** (horizontal-scroll cards with per-channel week counts + add-channel affordance), metrics grid + credits (reordered into one row), **proactive suggestions panel** (rule-based: low credits / no channels / quiet channel / unused Voice Trainer, max 3, urgency-colored left border), recent content list with branded platform chips.

### 3. Guided onboarding (`d99f519`)
- 3-step wizard at `/onboarding`: Welcome → Channels → Pick impact feature. Skippable.
- Signup action now redirects to `/onboarding` instead of `/dashboard` (existing login flow untouched).
- Six impact-feature cards: Captions, Viral Ideas, Hashtags, Best Times, Bio Optimizer, Repurpose. Each has icon + 1-liner + ETA + "Try it" deep link.
- Captions tool reads URL params (topic/platform/from) and auto-prefills + shows welcome banner.
- New `GettingStartedCard` component — persistent 5-item checklist on dashboard, progress bar, live-computed from real state (channels / first gen / first save / 3 features / voice trained). Dismissible or auto-hides at 100%.
- No schema changes — `onboarded_at` + `getting_started_dismissed` live in `profiles.preferences` JSONB (whitelist extended).

### 4. Alpha Tester Agreement + in-product acceptance gate (`b74f2d4` + `8663f90`)

Prepping for wider tester wave. Legal + product pieces:

- **NDA template** at `docs/alpha-tester-agreement.md` — one-page agreement for sending to testers out-of-band if ever needed. Includes usage flow, email script, future-us checklist. Governing law: Nevada.
- **In-product acceptance gate** at `/accept-terms` — every authenticated non-admin user must accept before reaching `/dashboard/**` or `/onboarding/**`. Typed full-name signature (min 2 chars) + explicit "I have read and agree" checkbox + submit. Both required before button enables.
- **Audit record** saved to `profiles.preferences.alpha_nda = { accepted_at, full_name, version, user_agent }`. Versioned via `ALPHA_AGREEMENT_VERSION` constant — bump version to force re-acceptance after text changes.
- **Server-side guard** `requireAlphaAcceptance()` in `src/lib/alpha-agreement-server.ts` — called from dashboard + onboarding layouts. Admins (role='admin') bypass entirely.
- **Canonical agreement text** in `src/lib/alpha-agreement.ts` (version-locked with code, no runtime file reads).
- **Reset path** for testing: `UPDATE profiles SET preferences = preferences - 'alpha_nda' WHERE id = '<uuid>';`
- **Fit for Klar brothers onboarding** — Ken and Kevin will hit the gate automatically on first sign-in. No paper NDA needed; clickwrap + typed signature + ESIGN compliance covers the legal moment in-product.

### 5. Voice Trainer UX refactor — put on hold (`94a4f20`)
- YouTube URL import confirmed to be blocked by Vercel IP bot-detection (`player_response_json_length: 3820` diagnostic — see memory).
- Removed URL import UI block. Reframed the page as caption/written-content analyzer. Added "How this works" 3-step section + clear "coming soon" note listing the deferred integrations.
- Server-side importer lib + API route kept in repo (ready to re-activate when we pick a real transcript solution — SearchAPI.io / YouTube OAuth / browser extension).
- Voice Trainer is off the critical path per the new strategic direction — channels + dashboard + onboarding now carry the "platform starts feeling personalized" role.

### 6. Failed-but-learned-from Voice Trainer URL import attempts (earlier today)
- `b4d96e1` → `091cf30` → `f5cffb9` → `9b973f9` → `de9bd47` — four successive approaches (youtube-transcript pkg → youtubei.js → timedtext endpoint → HTML scrape → full diagnostic output). All ultimately blocked by YouTube's IP detection on Vercel's datacenter range.
- Lesson captured: server-side YouTube scraping from Vercel is a dead end. Long-term options are paid APIs (SearchAPI.io) or YouTube OAuth (own-content only). Deferred both.

---

## Session 10 shipped — Voice Trainer v1 (IDEA-12 from brainstorm)

The foundational personalization layer is live. Previously locked as the
Phase 1 priority per the 2026-04-20 strategic decision record.

### Architecture
- New `voice_profiles` table (one row per user; `samples` jsonb array, `traits` jsonb)
- `src/lib/voice-profile.ts` — read/write helpers, Claude-driven trait extraction, and
  `loadVoicePromptSnippet()` that generates a system-prompt fragment from stored traits
- `crispGenerate()` extended with an optional `voiceSnippet` arg that gets appended to
  the system prompt when provided — one-line retrofit per feature
- User control at `/dashboard/voice` — add samples, analyze, view extracted traits,
  clear profile. Samples are capped at 25 per user, 10k chars each.

### User flow
1. New user lands on Voice Trainer (top-level nav, tagged "New" badge)
2. Pastes 3+ content samples with optional platform/label tags
3. Clicks "Analyze voice" → Claude returns structured traits (tone, rhythm,
   vocabulary, signature phrases, openers, closers, emoji style, punctuation,
   energy, avoid patterns, notes)
4. Traits auto-feed into content-generation features going forward

### Features retrofitted with voice injection (v1)
- Captions (`/api/generate`) — highest volume
- Scripts (`/api/script`)
- Repurpose (`/api/repurpose`)
- Blog → Social (`/api/blog-to-social`)
- Bio Optimizer (`/api/bio-optimizer`)

Remaining 15+ routes degrade gracefully — they work without voice injection;
next session can retrofit them in a sweep since the pattern is now established.

### Things deliberately NOT built in v1
- Multiple voice profiles per user (TikTok voice ≠ newsletter voice). Single profile
  for v1; add later when there's demand.
- Voice-profile feedback loop ("this output didn't sound like me, adjust").
- Auto-triggered analysis after adding a sample — user must click "Analyze" explicitly
  so they don't burn credits on every paste.

### Schema migration to run
```sql
CREATE TABLE IF NOT EXISTS public.voice_profiles (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  samples JSONB NOT NULL DEFAULT '[]'::jsonb,
  traits JSONB,
  last_analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.voice_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own voice profile" ON public.voice_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own voice profile" ON public.voice_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own voice profile" ON public.voice_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own voice profile" ON public.voice_profiles FOR DELETE USING (auth.uid() = user_id);
CREATE OR REPLACE TRIGGER voice_profiles_updated_at BEFORE UPDATE ON public.voice_profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

---

## Session 9 shipped (earlier today)

- Feedback system: floating FAB, `/admin/feedback` triage view, overview widget on admin home
- Email notification to admin on every feedback submission (Resend REST)
- Admin "Set temporary password" button on user detail — Outlook-safe onboarding
- Admin "Send password reset" button with working PKCE recovery flow
- Password recovery flow fixed (routes directly to `/auth/reset-password` to let
  SDK auto-detect PKCE code; admin-initiated reset uses same plumbing)

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
