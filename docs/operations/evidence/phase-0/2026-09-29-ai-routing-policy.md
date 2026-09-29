# AI routing override read policy — 2026-09-29

**Scope:** production `postcrisp` Supabase project `sikabeqzypvllimyostg`; read-only probes plus one approved forward migration. No provider key value, user record, or AI output was read.

The live `ai_config_overrides` table had 72 rows: 24 Starter tasks configured for Claude Haiku 4.5, 24 Creator tasks for Claude Sonnet 5.5, and 24 Elite tasks for Claude Opus 5.5. The app's `loadOverrides()` uses a user-scoped Supabase client. Before this change, the only SELECT policy was admin-only, so an authenticated non-admin role saw **0** rows in a read-only transaction. The committed regression probe also reported `authenticated_read_policy_present = false`; RLS, the authenticated SELECT grant, the admin write policy, and the absence of an anonymous read policy were already true.

Migration `20260929182158_authenticated_read_ai_config_overrides.sql` adds a `FOR SELECT TO authenticated USING (true)` policy. It leaves the admin write policy and application code unchanged. Supabase's migration list recorded the applied version/name after the connector returned success.

After application, the same read-only authenticated-role probe saw **72** rows, while the `anon` role saw **0**. All five checks in `scripts/phase0/probe-ai-routing-policy.sql` returned true. The security advisor remained at the same three `INFO` `rls_enabled_no_policy` findings (`onboarding_events`, `processed_stripe_events`, `tutorial_redemptions`), with no new warning or error.

The Mac's Homebrew `supabase` binary exited 137. The pinned `npx supabase@2.118.0` CLI ran, but Docker was unavailable, so a local database reset was not run. The production role probes verify database visibility; no end-to-end non-admin generation was run. The separate `feature_access` portion of security-review M4, Vercel provider-key ownership, and provider spend controls remain open.
