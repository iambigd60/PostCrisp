# Admin MFA rollout — 2026-09-29

**Owner direction:** require MFA for PostCrisp admins first. Regular beta users continue with the existing email login. The app and database enforcement were deployed on 2026-09-30.

A read-only production count on 2026-09-29 found zero verified admin TOTP factors. On 2026-09-30 Dennis reported successfully testing MFA, and a second read-only count found **one verified admin TOTP factor**. No factor secret or account identity was read.

## Implementation

- Supabase TOTP enrollment and verification are enabled in the local `supabase/config.toml`, matching the live Dashboard setting observed during the security review.
- `/mfa` is reachable by a signed-in admin at AAL1. It starts TOTP enrollment, shows the QR/setup key only in the browser, verifies a six-digit code, and challenges an already enrolled admin on later password sign-ins. Interrupted unverified factors can be restarted. Non-admin users cannot render this page.
- `requireAdmin()` requires a validated user, `profiles.role='admin'`, and both current and next authenticator assurance levels of `aal2` before constructing a service-role client. The admin layout applies the same gate and redirects AAL1 admins to `/mfa`. Admin API callers receive `403` with `MFA_REQUIRED`.
- Migration `20260930172208_admin_mfa_write_policies.sql` changes admin-only RLS read and write policies to require the `aal2` JWT claim. Restrictive policies also protect direct Data API writes to `feature_access` and `ai_config_overrides`. Ordinary users' own-row policies and shared AI configuration reads remain available.
- No authenticator secret, QR content, factor ID, or one-time code belongs in the repository, tracker, screenshots, support messages, or logs.

## Live rollout evidence

1. PR [#15](https://github.com/iambigd60/PostCrisp/pull/15) merged as `7685128`; its CI and Vercel preview passed. The production deployment for that commit reached READY and was assigned `postcrisp.com`. An unauthenticated request to `/mfa` redirected to `/login`.
2. Dennis reported the MFA flow working. Supabase recorded one verified TOTP factor for a profile with `role='admin'`.
3. After production reached READY, Supabase accepted migration `20260930172208_admin_mfa_write_policies`. A read-only `pg_policies` query found all 10 revised admin policies and all 6 restrictive write policies with AAL2 checks. The security advisor still reports three INFO policyless-RLS findings on `onboarding_events`, `processed_stripe_events`, and `tutorial_redemptions`, with no WARN or ERROR.

## Follow-up checks

- Confirm a fresh admin password login on production requires a new TOTP challenge and reaches `/admin` after verification. Dennis tested MFA on the preview before merge; no authenticated production browser session was exercised here.
- Check that an ordinary beta user signs in and uses the app normally. The database policy inspection does not replace that user flow.
- If an admin loses the device, the project owner must use a controlled Supabase admin recovery process to remove or reset the verified factor; ordinary app support must not bypass AAL2.

## Safe live sequence

1. Review and deploy the app change first, including `/mfa` and the server-side admin gate. Confirm the deployment is ready and the project has TOTP enrollment and verification enabled. Do not apply the SQL migration before the app flow is reachable.
2. Dennis signs in to PostCrisp with his admin account and opens `/mfa`. He scans the QR in his own authenticator app and enters the code directly in PostCrisp. He should keep the QR/setup key private and confirm that `/admin` opens after verification. An AAL1 admin session should be redirected to `/mfa`; admin API routes should respond `MFA_REQUIRED` until verification.
3. Once at least one authorized admin can complete the flow, apply the reviewed migration through the Supabase migration mechanism. Recheck `pg_policies` for the AAL2 predicates and the [Supabase security advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). Check an ordinary beta user still signs in and uses the app normally.
4. Confirm a fresh admin password login requires a new TOTP challenge. If an admin loses the device, the project owner must use a controlled Supabase admin recovery process to remove or reset the verified factor; ordinary app support must not bypass AAL2.

**Rollout boundary:** the preview MFA flow was reported working by Dennis and a verified production-project factor was observed. A fresh authenticated production login has not yet been observed. The historical paid restore and billing work remain deferred.

**Rollback:** if the app flow fails before SQL application, revert the app deployment. If the SQL has been applied, restore the prior admin policy definitions through a reviewed follow-up migration while rolling back the app. Keep a second authorized administrator available when practical to reduce recovery risk.
