# PostCrisp — Where We Left Off

**Last updated:** 2026-04-20 (session 7 — GitHub backup, admin password rotation, cost tracking)
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
| Admin Phase 2 — Users + Analytics | ✅ Done this session |
| Admin Phase 2 — Billing / Moderation / Audit viewer | ⏳ Next option |
| Step 7 — Launch prep | ⏳ |

---

## Next session — options

1. **Finish Admin Phase 2** — Billing admin (real Stripe MRR, failed payments, refund tooling), Audit Log viewer (UI over `admin_actions`), Moderation queue.
2. **Cost tracking** — log `provider` + `model` on every `generations` row, surface $ cost per feature on Analytics. Small but valuable.
3. **Step 7 launch prep** — drop starter daily cap from 100 to 10, rotate captain password, wire real Stripe product IDs, deploy to Vercel.
4. **Step 5.5 design refresh** — waiting on user's logo.

No blockers — pick whichever next session.

---

## SQL migrations run this session

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
