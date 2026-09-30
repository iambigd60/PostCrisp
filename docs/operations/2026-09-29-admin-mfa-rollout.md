# Admin MFA rollout — 2026-09-29

**Owner direction:** require MFA for PostCrisp admins first. Regular beta users continue with the existing email login. This record describes the branch implementation and the remaining live steps; it does not claim that any admin has enrolled or that the migration is applied.

A read-only production count on 2026-09-29 found **zero verified admin TOTP factors**. The first admin enrollment is a required live step; no factor secret or account identity was read.

## Implementation

- Supabase TOTP enrollment and verification are enabled in the local `supabase/config.toml`, matching the live Dashboard setting observed during the security review.
- `/mfa` is reachable by a signed-in admin at AAL1. It starts TOTP enrollment, shows the QR/setup key only in the browser, verifies a six-digit code, and challenges an already enrolled admin on later password sign-ins. Interrupted unverified factors can be restarted. Non-admin users cannot render this page.
- `requireAdmin()` requires a validated user, `profiles.role='admin'`, and both current and next authenticator assurance levels of `aal2` before constructing a service-role client. The admin layout applies the same gate and redirects AAL1 admins to `/mfa`. Admin API callers receive `403` with `MFA_REQUIRED`.
- Migration `20260930030242_admin_mfa_write_policies.sql` changes admin-only RLS read and write policies to require the `aal2` JWT claim. Restrictive policies also protect direct Data API writes to `feature_access` and `ai_config_overrides`. Ordinary users' own-row policies and shared AI configuration reads remain available.
- No authenticator secret, QR content, factor ID, or one-time code belongs in the repository, tracker, screenshots, support messages, or logs.

## Safe live sequence

1. Review and deploy the app change first, including `/mfa` and the server-side admin gate. Confirm the deployment is ready and the project has TOTP enrollment and verification enabled. Do not apply the SQL migration before the app flow is reachable.
2. Dennis signs in to PostCrisp with his admin account and opens `/mfa`. He scans the QR in his own authenticator app and enters the code directly in PostCrisp. He should keep the QR/setup key private and confirm that `/admin` opens after verification. An AAL1 admin session should be redirected to `/mfa`; admin API routes should respond `MFA_REQUIRED` until verification.
3. Once at least one authorized admin can complete the flow, apply the reviewed migration through the Supabase migration mechanism. Recheck `pg_policies` for the AAL2 predicates and the [Supabase security advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). Check an ordinary beta user still signs in and uses the app normally.
4. Confirm a fresh admin password login requires a new TOTP challenge. If an admin loses the device, the project owner must use a controlled Supabase admin recovery process to remove or reset the verified factor; ordinary app support must not bypass AAL2.

**Rollout boundary:** no production Auth factor was enrolled, no SQL was applied, and no production login was exercised while preparing this branch. The historical paid restore and billing work remain deferred.

**Rollback:** if the app flow fails before SQL application, revert the app deployment. If the SQL has been applied, restore the prior admin policy definitions through a reviewed follow-up migration while rolling back the app. Keep a second authorized administrator available when practical to reduce recovery risk.
