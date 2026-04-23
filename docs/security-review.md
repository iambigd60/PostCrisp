# PostCrisp — Security Review

> **Date:** 2026-04-22
> **Scope:** Code-level security audit of PostCrisp app (auth, API routes, RLS policies, secrets, headers, dependencies) ahead of scaling to 20 alpha testers.
> **Reviewer:** Claude (Opus 4.7) — automated code review.
> **Not covered:** infrastructure audit (Vercel/Supabase configuration itself), penetration testing, social engineering vectors, third-party service audits. For paid-public launch, supplement with a professional audit ($2-5K range: Cure53, NCC Group, Trail of Bits).

---

## Executive summary

Overall posture is **good for a pre-launch alpha** — auth and RLS fundamentals are in place, admin/user separation is well-enforced, service-role usage is disciplined. No critical data-leak vulnerabilities found.

Biggest concerns for the 20-tester milestone:
1. **Orphaned `src/app/login/actions.ts`** — dead code that bypasses the access-control + onboarding flow. Delete before anyone accidentally imports it.
2. **Dead-but-dangerous `src/lib/supabase.ts`** — unused factory that exposes the service role key via `createBrowserClient`. A future import from a client component would bundle the service role key into the browser. Delete.
3. **`/api/stripe/checkout` accepts arbitrary priceId** — a signed-in user can subscribe to the wrong tier by sending the wrong price. Mitigated today because Stripe prod prices aren't wired up, but this must be fixed before paywall activation.
4. **No security headers** — no CSP, HSTS, X-Frame-Options, etc. Vercel sets some defaults; the rest need explicit config.
5. **No rate limiting anywhere** — feedback spam, auth attack surface.
6. **Next.js 14.2.35 has known high-severity DoS vulnerabilities** — all patched in Next.js 15+. Upgrade is a semver-major lift.
7. **RLS over-locks `feature_access` and `ai_config_overrides`** — real users can't read admin-configured overrides, silently falling back to code defaults. Functional bug, not a security issue.
8. **Alpha NDA acceptance is client-writable** — a user can POST a fake acceptance record via `/api/user/preferences` without seeing the form. Weakens legal audit trail.

Nothing found would block onboarding 20 testers today. All findings below are prioritized for pre-launch / pre-paywall hardening.

---

## Findings — by severity

### 🔴 HIGH

#### H1. `/api/stripe/checkout` accepts arbitrary `priceId` from client

**File:** `src/app/api/stripe/checkout/route.ts:13-44`

Client POSTs `{ priceId }` which is passed directly to Stripe. A signed-in user could send any price ID their Stripe account knows about — including $0 products, test prices, or a lower-tier price while intending to get Creator-tier features.

**Impact:** revenue leakage. Someone subscribes to the $19 tier but pays whatever price they sent. Only practically exploitable once real Stripe prod prices are configured (not yet per ROADMAP).

**Fix:** client sends `{ tier, cycle }`; server looks up the priceId from a whitelist driven by env vars (same pattern as `/api/stripe/credit-pack` uses for pack IDs).

```ts
const TIER_PRICE_IDS: Record<string, { monthly: string; yearly: string }> = {
  creator: { monthly: process.env.STRIPE_CREATOR_MONTHLY_PRICE_ID!, yearly: ... },
  team:    { ... },
  elite:   { ... },
}
// inside POST:
const { tier, cycle } = body
const priceId = TIER_PRICE_IDS[tier]?.[cycle]
if (!priceId) return NextResponse.json({ error: 'invalid plan' }, { status: 400 })
```

**Must fix before paywall activation. Current blast radius = $0 because Stripe prod isn't wired.**

---

#### H2. Orphaned `src/app/login/actions.ts` bypasses all access controls

**File:** `src/app/login/actions.ts` (full file)

Exports `login()` and `signup()` server actions that:
- Don't check `readAccessControl()` (would accept signups even when mode=`closed`)
- Don't validate invite codes (would accept signups even when mode=`invite`)
- Redirect to `/dashboard` instead of `/onboarding` after signup
- Never existed in the active UI — `src/app/(auth)/*` is the live flow — but these are still imported-compatible functions.

**Impact:** if any future code (or an accidental import) references `@/app/login/actions`, the access-control gate is bypassed end-to-end.

**Verified:** no current import references this file (grepped `from ['"]@/app/login['"]`, `from ['"]\./login/actions['"]`).

**Fix:** delete `src/app/login/actions.ts`. Zero consumers, zero risk.

---

#### H3. `src/lib/supabase.ts` exposes service-role key via browser-compatible factory

**File:** `src/lib/supabase.ts:97-102`

```ts
export function createServiceSupabaseClient() {
  return createBrowserClient<Database>(          // <-- BROWSER client
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!        // <-- SERVICE ROLE key
  )
}
```

`createBrowserClient` is the client-side factory from `@supabase/ssr`. If any client component imports and uses this function, Next.js will bundle `process.env.SUPABASE_SERVICE_ROLE_KEY` into the browser JS bundle — even though the env var isn't prefixed `NEXT_PUBLIC_`, Next.js's build-time substitution will still inline it because the code path is reachable from a client component.

**Verified:** no live code imports `createServiceSupabaseClient` (grepped). The whole `src/lib/supabase.ts` file is dead code — the active clients live in `src/utils/supabase/{server,client}.ts`.

**Impact:** none today. One future careless import away from catastrophic service-role-key leak to every browser.

**Fix:** delete `src/lib/supabase.ts` entirely. It's dead, dangerous, and shadows the live factories.

---

#### H4. Next.js 14.2.35 — 5 known vulnerabilities (4 high)

**File:** `package.json` → `"next": "14.2.35"`

From `npm audit`:
- GHSA-9g9p-9gw9-jx7f — DoS via Image Optimizer remotePatterns (moderate)
- GHSA-h25m-26qc-wcjf — DoS via RSC deserialization (high)
- GHSA-ggv3-7p47-pfv8 — HTTP request smuggling in rewrites (moderate)
- GHSA-3x4c-7xq6-9pq8 — Unbounded next/image cache (moderate)
- GHSA-q4gf-8mx6-v5v3 — DoS with Server Components (high)

All patched in Next.js 15.5.14+. Current patch path: `npm audit fix --force` → Next 16.2.4 (SemVer major, breaking).

**Impact for 20-tester alpha:** DoS vulnerabilities, not RCE/data leakage. Exploitation requires specific request patterns; low likelihood from friendly testers. Real concern post-launch when unknown attackers may target.

**Fix:** upgrade Next.js to 15 (minor migration) or 16 (major, app-router already compatible). Budget ~1-2 hours for config/API shape updates. Do before public launch.

---

### 🟡 MEDIUM

#### M1. Alpha NDA acceptance is client-writable, weakening legal audit trail

**File:** `src/app/api/user/preferences/route.ts:6-16` + `src/app/accept-terms/page.tsx:50-65`

The `/api/user/preferences` PUT endpoint whitelists `alpha_nda` as a writable key. A user can POST:

```json
{
  "alpha_nda": {
    "accepted_at": "2026-04-22T12:00:00Z",
    "full_name": "Fake Name",
    "version": "1.0",
    "user_agent": ""
  }
}
```

…without ever rendering `/accept-terms` or seeing the agreement text. The server-side gate (`requireAlphaAcceptance`) reads this field as truth, so fabricated acceptance passes the gate.

**Impact:** ESIGN Act compliance weakened. A tester who later disputes acceptance could claim they never saw the form. Our audit trail is based on a field they can write freely.

**Fix:** move acceptance to a dedicated endpoint that:
1. Renders the current agreement hash (not trust-client) into the response it captures
2. Stamps `accepted_at` server-side using `new Date()` (not client-supplied value)
3. Captures IP via request headers (not just user-agent from client)
4. Writes through a service-role client so normal preferences update can't touch it
5. Remove `alpha_nda` from the preferences whitelist

Quick version: separate `/api/auth/accept-nda` endpoint, remove from preferences whitelist. ~30 min.

---

#### M2. No rate limiting on any endpoint

**Impact:**
- `/api/feedback` — authenticated user can spam thousands of submissions, filling the DB and your notification inbox
- `/api/auth/signup` signup action — attacker can brute-force invite codes (1-in-62^8 entropy on a random 8-char code is low for a malicious burst)
- `/api/voice-profile/samples` — 25-sample cap is bounded but add-remove-add cycles aren't rate-limited
- Generation routes — credit system caps usage per user but doesn't cap request rate; a malicious user could overload the AI providers at burst

**Fix:** add Upstash Redis + `@upstash/ratelimit`. Minimal setup:
- `/api/feedback`: 10 requests / minute / user
- `/api/auth/signup` (server action): 5 / 10 minutes / IP
- `/api/voice-profile/*`: 30 / minute / user
- Generation routes (post-credit-check): 30 / minute / user

~30-45 min to wire across all routes. Free Upstash tier covers alpha volume.

---

#### M3. No security headers — missing CSP, X-Frame-Options, Referrer-Policy

**File:** `next.config.mjs`

Currently returns no custom headers. Vercel ships some defaults (HSTS on custom domain, basic X-Content-Type-Options) but explicit CSP + X-Frame-Options are missing.

**Impact:**
- **Clickjacking:** no X-Frame-Options means PostCrisp can be iframed by any site. Attacker could overlay a transparent iframe and trick users into unintended clicks (tier upgrades, account deletion).
- **XSS blast radius:** no CSP means if an XSS slips through React's defaults, it can exfiltrate data to any domain. React is generally safe but `dangerouslySetInnerHTML`-style escapes (none found today, but easy to add) would have no secondary defense.
- **Referrer leakage:** no Referrer-Policy means navigation links leak full URL (including query params that might contain tokens) to third-party sites.

**Fix:** add to `next.config.mjs`:

```js
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // Next.js needs these
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https:",
              "connect-src 'self' https://*.supabase.co https://api.resend.com https://api.anthropic.com https://api.openai.com https://www.youtube.com https://*.googlevideo.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}
```

~20 min to add + test. Verify no functionality breaks (Stripe Checkout redirects out, so CSP needs `form-action` tuned if inline forms hit Stripe).

---

#### M4. RLS on `feature_access` + `ai_config_overrides` blocks regular users from reading

**Files:**
- `src/lib/supabase-schema.sql:232-234` (feature_access SELECT only for admins)
- `src/lib/supabase-schema.sql:256-258` (ai_config_overrides SELECT only for admins)
- `src/lib/feature-access.ts:45-48` (reads via user-scoped client)
- `src/lib/crisp-engine.ts:60-64` (reads via user-scoped client)

Non-admin users querying these tables get an empty result (RLS returns zero rows). Both files silently catch the error and fall back to `DEFAULT_MIN_TIER` / code-default routing. This means the admin-configurable overrides in `/admin/feature-access` and `/admin/ai-config` are effectively non-functional for real users.

**Impact:** admin controls don't do what they claim. Not a security issue — a functional bug.

**Fix options:**
1. Relax RLS: allow any authenticated user to SELECT on `feature_access` and `ai_config_overrides` (tables contain no sensitive data — just tier gates and model names)
2. Read via service-role client from server-side code (adds friction; requires updating both lib files)

Option 1 is simpler. Add:
```sql
CREATE POLICY "Authenticated read feature_access"
  ON public.feature_access FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read ai_config_overrides"
  ON public.ai_config_overrides FOR SELECT
  USING (auth.role() = 'authenticated');
```

Keep write policies admin-only (already in place).

---

#### M5. Forgot-password flow trusts Host header for redirect URL

**File:** `src/app/(auth)/forgot-password/actions.ts:12-15`

```ts
const h = headers()
const host = h.get('host')
const proto = h.get('x-forwarded-proto') ?? ...
const origin = host ? `${proto}://${host}` : ...
// Passed to resetPasswordForEmail's redirectTo
```

Attacker sending a request with `Host: evil.example.com` header could make Supabase send recovery emails with `redirectTo=https://evil.example.com/auth/reset-password`. Supabase's Auth URL Configuration allowlist is the real defense here — reject unknown redirect URLs.

**Impact:** low. Mitigated by Supabase's redirect URL allowlist configured at the dashboard level (currently set to `https://postcrisp.vercel.app/**`). Forged Host header won't pass that gate.

**Fix:** belt-and-suspenders — use `NEXT_PUBLIC_SITE_URL` as primary source, fall back to Host only when env var missing. Same pattern for `/api/admin/users/[id]/reset-password/route.ts` (line 34).

---

### 🟢 LOW

#### L1. Type mismatch in `src/lib/supabase.ts` Database type

`Database` definition in dead-code file `src/lib/supabase.ts` is stale. Missing: `channels`, `voice_profiles`, `feedback`, `admin_actions`, `feature_access`, `ai_config_overrides`, `platform_settings`, `credit_transactions`. Uses outdated tier enum (`'free' | 'pro' | 'business'` instead of `'free' | 'creator' | 'team' | 'elite'`).

**Fix:** deletion of the whole file (see H3) resolves this.

---

#### L2. `full_name` and other TEXT fields have no length limits

Many routes accept unbounded TEXT input:
- `/api/user/profile` — `full_name` (no max)
- `/api/saved` — `content`, `topic`, `type` (no max)
- `/api/channels` — `handle`, `label`, `url` have max, but `platform` + free-form fields don't on all writes
- `/api/voice-profile/samples` — `label`, `platform` unbounded (only `content` is capped at 10k)
- `/api/feedback` — capped at 5000 ✓

**Impact:** storage abuse. A malicious user could save megabytes of content in a single field. Postgres TEXT is unbounded. Would cost DB space + potentially slow down queries that touch those rows.

**Fix:** add explicit `.slice(0, MAX)` or validation on all user-supplied text inputs. Suggested caps:
- `full_name`: 200
- `handle`: 120 (already has it)
- `label`: 80 (already has it for channels)
- `url`: 500 (already has it)
- `saved_content.content`: 20,000
- `voice_sample.content`: 10,000 (already has it)
- `voice_sample.label`: 100 (missing)
- `voice_sample.platform`: 50 (missing)

---

#### L3. Voice profile samples store platform + label unsanitized

**File:** `src/app/api/voice-profile/samples/route.ts:21-22`

User-supplied `platform` and `label` stored as-is in JSONB. If ever rendered into HTML without React's auto-escape (e.g., future `dangerouslySetInnerHTML` or a react-markdown node), XSS is possible.

**Impact:** minimal today. React auto-escapes text nodes in all current renders.

**Fix:** add an optional platform whitelist check (already partially done for `channels` — reuse `isValidPlatform` helper from `@/lib/channels` here too).

---

#### L4. Middleware skips auth if Supabase env vars are unset

**File:** `src/utils/supabase/middleware.ts:12-15`

```ts
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  return supabaseResponse
}
```

If production env vars ever get misconfigured (e.g., typo in Vercel settings), every protected route becomes public.

**Impact:** depends on Vercel env-var discipline. Low likelihood, high impact if triggered.

**Fix:** fail-closed in production. `if (process.env.NODE_ENV === 'production' && !env-vars) throw new Error(...)` — a loud 500 beats a silent open-door.

---

#### L5. Feedback endpoint returns user email in responses even if the feedback user is null

Not a code issue observed — just noting that `feedback.user_id` is nullable (FK uses `ON DELETE SET NULL`). If a user deletes their account, their feedback stays with `user_id=NULL`. Admin feedback viewer currently handles this gracefully (renders "anonymous"). ✓

---

#### L6. `/api/user/export` missing tables from GDPR export

**File:** `src/app/api/user/export/route.ts:12-17`

Exports `profiles`, `generations`, `saved_content`, `usage_stats`. Missing:
- `channels`
- `voice_profiles` (includes user-submitted samples)
- `feedback` (user's own submissions)
- `credit_transactions` (user's own ledger)
- `admin_actions` where `target_user_id = user.id` (actions taken ON them)

**Impact:** GDPR/CCPA right-to-export technically incomplete. Not a critical vulnerability, but a compliance gap before EU users are allowed in.

**Fix:** add the four additional queries to the `Promise.all`. ~10 min.

---

#### L7. `DELETE` policy missing on `profiles` table

**File:** `src/lib/supabase-schema.sql:317-324`

`profiles` has SELECT + UPDATE policies but no DELETE. Relies on cascade-from-auth.users deletion when admin calls `auth.admin.deleteUser`. Works today because the cascade deletes the row without needing DELETE policy. But anyone calling delete through the regular Supabase client (instead of the auth admin API) would fail silently.

**Impact:** none today. `/api/user/account` uses `auth.admin.deleteUser` which works via cascade.

**Fix:** optional. Add a DELETE policy if you ever want client-initiated profile removal without going through auth.users.

---

### ℹ️ INFO — good patterns observed

- ✅ **Every write-heavy user endpoint scopes queries to `auth.uid()`** — checked all 48 auth-gated routes
- ✅ **Admin routes correctly split user-scoped (`auth.supabase`) vs service-role (`auth.supabaseAdmin`)** — no accidental service-role leaks
- ✅ **Stripe webhook signature verification is present** and uses the proper `constructEvent` with webhook secret
- ✅ **Open-redirect protection in `/auth/callback`** — filters `//` and `://` in the `next` param
- ✅ **No `dangerouslySetInnerHTML` anywhere in the codebase**
- ✅ **CSRF: Next.js server actions are CSRF-protected by default** via origin check
- ✅ **Supabase anon key is fine in the browser** — RLS makes it safe
- ✅ **Admin middleware gate** redirects non-admins away from `/admin/*`
- ✅ **Admin action audit log** (`admin_actions`) captures tier changes, disables, password resets, access-control changes, credit adjustments — good forensics
- ✅ **Constant-time compare on invite codes** in `platform-settings.ts` — prevents timing-based code enumeration
- ✅ **Credit system has atomic debit** via the `consume_user_credits` RPC — prevents double-spend races
- ✅ **Password reset uses PKCE** via Supabase — safer than implicit flow

---

## Remediation priority — "what to do before 20 testers"

**Must fix:**
1. Delete `src/app/login/actions.ts` (H2) — 1 minute
2. Delete `src/lib/supabase.ts` (H3) — 1 minute
3. Add security headers to `next.config.mjs` (M3) — 20 minutes
4. Move NDA acceptance to a server-controlled endpoint + remove from preferences whitelist (M1) — 30 minutes
5. Fix `feature_access` / `ai_config_overrides` RLS (M4) — 5 minutes of SQL
6. Length caps on all TEXT inputs (L2) — 30 minutes

**Strongly recommend:**
7. Rate limiting with Upstash (M2) — 45 minutes
8. MFA on admin account (separate from this review but launch-critical) — 30 minutes
9. Set spending caps on Anthropic + OpenAI dashboards (external) — 10 minutes

**Can wait until pre-paywall:**
10. Fix `/api/stripe/checkout` priceId validation (H1) — only matters once Stripe prices are wired
11. Upgrade Next.js 14 → 15 (H4) — before paying customers
12. Complete GDPR export (L6) — before EU users allowed in

**Total time to clear the "must fix" list:** ~90 minutes of focused work.

---

## What this review does NOT cover

- **Infrastructure security** — Vercel and Supabase configuration (auth URLs, RLS at DB level, Supabase Auth MFA setup)
- **Secret rotation** — current policy: none. Should be quarterly or incident-based.
- **Dependency supply chain** — how packages are installed, lockfile integrity, subresource integrity for CDN scripts
- **DoS testing** — review identified DoS vectors but didn't attempt to verify exploitability under load
- **Social engineering** — admin account compromise via phishing, etc.
- **Professional penetration test** — strongly recommended ($2-5K) before paid public launch
- **SOC 2 / compliance audits** — out of scope for alpha

---

*Generated 2026-04-22. Re-run on any material change to auth, RLS, or new API routes.*
