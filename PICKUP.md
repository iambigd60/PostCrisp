# PostCrisp — Where We Left Off

**Last updated:** 2026-04-20 (session 7 — GitHub backup, admin password rotation, cost tracking, audit log, strategic brainstorm ingestion)
**Build status:** ✅ Working
**Dev server:** `npm run dev` (port 3000 or next available)

---

## What session 7 shipped (short ~30-min session)

- **GitHub backup** — pushed to private `iambigd60/PostCrisp` repo; `origin/HEAD` set to `main`
- **`/save` slash command + `scripts/backup.sh`** — project-scoped, travels with repo (via `.gitignore` whitelist of `.claude/commands/`)
- **`scripts/rotate-admin-password.mjs`** — interactive Supabase admin password rotation via service role; masks input, enforces ≥12 chars, confirmation match, explicit `yes` to execute. Used it to rotate `captain@postcrisp.com`.
- **FREE_DAILY_LIMIT 100 → 10** — legacy const dropped back; credits are the real cap anyway
- **Analytics cost tracking** — added `MODEL_BLENDED_PRICE_PER_1M` pricing table in analytics API and an `estimateCostUSD(feature, tokens)` helper. KPI "Tokens" tile now shows est. cost, Feature Breakdown adds $ per feature, Top Users table adds Est. cost column. Labeled as estimate (uses current Creator-tier routing — doesn't know historical tier or mid-window routing changes).
- **Audit Log viewer** — new `/admin/audit` page over the existing `admin_actions` table. Filters by action type, target email search, and time window. Shows actor, target (link-through), change (from → to), reason, relative timestamp. Also wired credit grant/adjust into `admin_actions` so they appear in the log.
- **Strategic brainstorm ingested** — 12 new feature ideas + Living Dashboard mockup archived under `docs/ideas/`. Three decisions locked in (see ROADMAP strategic decision record): Voice Trainer elevated to Phase 1 critical, Living Dashboard deferred to v1-lite (internal data only), color scheme change deferred post-launch.

## What session 6 shipped

### Admin Phase 2: User Management
- `/admin/users` list — search by email, filter tier/role, sort newest/oldest/credits/usage, paginated 50/page, colored avatars, tier badges
- `/admin/users/[id]` detail — header with tier/role/disabled badges, 4-stat grid (credits/gens/tokens/saved), tier+role change form (reason required, logged), disable/enable via Supabase auth ban, link to credit adjustments, feature breakdown grid, recent generations + credit transactions, audit log
- New `admin_actions` audit table tracking every tier/role/disable change with actor, reason, before/after values
- `requireAdmin()` now returns `supabaseAdmin` service-role client alongside user client — needed because `profiles` RLS only allows users to see their own row. Four admin routes (users list, user detail, ban, credit-adjustments) now use `supabaseAdmin` for cross-user reads/writes.

### Admin Phase 2: Analytics v1
- `/admin/analytics` — 8 KPI tiles (DAU, MAU, new signups 30d, paid users, est. MRR, 30d generations/tokens/credits), tier distribution strip, generations-per-day SVG bar chart with peak+total footer, feature breakdown (count + tokens, ranked, with progress bars), top-10 users by token consumption (with link-through to user detail)
- All data aggregated in-process from `profiles` + `generations` + `credit_transactions` — no new schema
- Est. MRR = `Σ(TIER_MRR[tier] for all profiles)` using list prices (creator=$19, team=$49, elite=$79). To be replaced by real Stripe MRR in the Billing admin phase.

### Bugfixes along the way
- Users list showed only the admin's own row — root cause was RLS on `profiles`, fixed by introducing `auth.supabaseAdmin` for cross-user queries
- 500 error on `/admin/users` — missing `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`; user added it
- Daily bar chart rendered with zero-height bars — flex children had no defined height for `%` to resolve against; fixed by restructuring into a flex row with `h-full` columns
- `column profiles.credits_balance does not exist` — DB predated Step 6.75 credits migration; user ran the `ALTER TABLE` migration + `credit_transactions` table + `consume_user_credits` RPC

---

## Status snapshot

| Step | Status |
|---|---|
| Step 1 — Polish existing | ✅ Done |
| Step 2 — Admin Phase 1 (AI config) | ✅ Done |
| Step 3 — Tiers (Starter/Creator/Team/Elite) | ✅ Done |
| Step 4 — 16 new features + paywalls | ✅ Done |
| Step 5 — Moderate features (Calendar, Media Kit, Analytics) | ⏸ Deferred post-launch |
| Step 5.5 — Design refresh | ⏸ Waiting on logo |
| Step 6 — Landing page | ✅ Done |
| Step 6.5 — Cost optimization | ✅ Done |
| Step 6.75 — Credit system | ✅ Done |
| Admin Phase 2 — Users + Analytics | ✅ Done (session 6) |
| Admin Phase 2 — Analytics cost tracking + Audit viewer | ✅ Done (session 7) |
| Admin Phase 2 — Billing admin / Moderation / Support tools | ⏳ Remaining |
| Step 7 — Launch prep | 🟡 Partial (admin password rotated, FREE_DAILY_LIMIT dropped; MFA + Stripe prod + deploy remain) |

---

## Next session — LOCKED IN

**Build Voice Trainer (IDEA-12).** Full context in [docs/ideas/postcrisp-new-ideas.md](docs/ideas/postcrisp-new-ideas.md). ROADMAP top section has the rough shape. This is the foundational personalization layer under every content feature — elevated to Phase 1 critical after the 2026-04-20 brainstorm processing.

Plan next session:
1. Schema: `voice_profiles` table + RLS
2. API: `/api/voice-profile` (POST analyze, GET fetch, PATCH manual edit)
3. Onboarding: sample-paste step that builds baseline profile on first feature use
4. UI: `/dashboard/voice` to review/edit/add samples
5. Retrofit: inject voice-profile summary into system prompts across all 20 feature routes (graceful degrade when profile empty)

Effort: 2-3 focused sessions solo.

## Other open items (after Voice Trainer)

- **Living Dashboard v1-lite** — typed briefing + usage-pattern suggestions using only PostCrisp internal data, no social API deps. Sets new aesthetic tone.
- **Per-row cost accuracy** — log provider+model on `generations`, switch analytics to stored values.
- **Billing admin** — real Stripe MRR/churn + refund tooling.
- **Step 7 launch push** — MFA gate on /admin/*, wire Stripe production price IDs, Vercel deploy.
- **Code hygiene pass** — orphaned `login/actions.ts`, `api/viral-ideas` JSON parse bug, dead `MOCK_BEST_TIMES`.
- **Color palette migration** — deferred to post-launch refresh (waiting on logo, palette candidate captured: `#22d3a0` + `#080c14`).

---

## SQL migrations (ran in session 6; no new DB changes in session 7)

```sql
-- admin_actions audit table
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_user_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  action          TEXT NOT NULL,
  from_value      TEXT, to_value TEXT, reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- + target/actor indexes + admin-only SELECT RLS

-- Step 6.75 credits (migration for users whose DB predates credit system)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credits_balance  INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS credits_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- + credit_transactions table + RLS + consume_user_credits RPC + tier backfill
```

---

## Known issues / punchlist
- ~~`FREE_DAILY_LIMIT = 100` — drop to 10 before launch~~ ✅ Done 2026-04-20 (and it was legacy anyway; credits are the real cap)
- Admin password was rotated on 2026-04-20 via `scripts/rotate-admin-password.mjs`. Rotate again on a schedule (quarterly or after any suspected exposure).
- Azure provider shows in admin dropdowns but falls back to Anthropic (not yet wired)
- Generations don't log `provider` + `model` — blocks real $ cost tracking
- Anthropic cache-read tokens count at full value in analytics but bill at ~10%; cost totals skew high when caching is hot
- Est. MRR uses list prices, ignores yearly discounts and cancellation grace periods — will be replaced by Stripe Billing admin

## Manual setup still pending (for production)
- Create Stripe products: Creator/Team/Elite Monthly/Yearly (6 price IDs)
- Register Stripe webhook endpoint for production
- Google OAuth in Supabase Auth settings
- Vercel project + production env vars
- MFA enrollment for `captain@postcrisp.com`
