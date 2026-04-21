# PostCrisp — Where We Left Off

**Last updated:** 2026-04-21 (session 9 — admin password reset + recovery flow fix)
**Build status:** ✅ Live on Vercel, invite-only signups via `/admin/access-control`
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
| Step 5.5 — Design refresh | ⏸ Waiting on logo |
| Step 6 — Landing page | ✅ Done |
| Step 6.5 — Cost optimization | ✅ Done |
| Step 6.75 — Credit system | ✅ Done |
| Admin Phase 2 — Users + Analytics | ✅ Done (session 6) |
| Admin Phase 2 — Cost tracking + Audit viewer | ✅ Done (session 7) |
| Admin Phase 2 — Access Control | ✅ Done (session 8) |
| Admin Phase 2 — Password reset + recovery fix | ✅ Done (session 9) |
| Admin Phase 2 — Billing admin / Moderation | ⏳ Remaining |
| **Alpha deployment** | ✅ **Live on Vercel (session 8)** |
| Step 7 — Launch prep | 🟡 Partial (alpha live, MFA + Stripe prod + custom domain remain) |

---

## Next session — options

1. **Voice Trainer (IDEA-12)** — the locked Phase 1 priority per the strategic decision record. Foundational personalization layer under every content feature. Plan is captured at the top of ROADMAP. **Recommended path if no tester feedback is urgent.**
2. **Triage tester feedback** — once UAT produces real bug reports / feature requests, that becomes top priority over Voice Trainer. Review `/admin/analytics` for usage patterns, act on specific findings.
3. **Billing admin** — real Stripe MRR/churn/refunds, replacing list-price estimate. Unblocks paywall activation.
4. **Stripe production setup** — create 6 price IDs for Creator/Team/Elite Monthly/Yearly, wire webhook, test full paywall. Needed before opening signups to paying users.
5. **Custom domain on Vercel** — point `postcrisp.com` to Vercel, swap Supabase Site URL, update Resend sender. ~15 min.

Pick whichever is highest-leverage given the tester feedback you get.

---

## SQL migrations run this session (for your records)

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
