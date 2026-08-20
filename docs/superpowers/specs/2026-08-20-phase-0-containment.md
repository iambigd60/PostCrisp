# PostCrisp Phase 0: Production Containment and Database Reconciliation

**Approved:** 2026-08-20
**Base commit:** `c449867`
**Implementation branch:** `codex/phase-0-containment`
**Supabase project:** `sikabeqzypvllimyostg` (`postcrisp`, `us-east-2`)
**Vercel project:** `prj_jk99T7FADZ391B7LWt9g8SYwLn9w`

## Objective

Make the repository a trustworthy, reproducible description of the production database before any billing, authorization, onboarding, or release work continues. Phase 0 must prove what exists in production, reconcile the local migration lineage without changing production on the first pass, and leave a reviewable recovery and platform-control record.

## Starting evidence

- Production and `main` were clean at `c449867` when Phase 0 began.
- Baseline verification in the isolated worktree passed: 240 tests, typecheck, and lint with four pre-existing warnings.
- Production reports eight applied Supabase migration versions, while the repository has seven differently timestamped files.
- Production includes an earliest migration, `20260707062202_protect_privileged_profile_columns_v1`, that is absent locally.
- Replaying only the current local migration files against a blank database cannot create `public.profiles`; the repository therefore lacks a complete clean-room bootstrap path.
- All 18 production `public` tables currently have RLS enabled.
- Supabase's security advisor reports leaked-password protection disabled and informational policyless-RLS findings for service-role-only tables.
- Backup retention, PITR enablement, a non-production restore drill, Vercel firewall configuration, and provider spend caps are not yet evidenced.

## Required outcomes

1. Freeze unsafe schema actions while reconciliation is in progress.
2. Capture a secrets-free production inventory covering migration history, schema objects, grants, policies, functions, triggers, and indexes.
3. Preserve the exact production migration statements and map every repository migration to its production version.
4. Establish a local migration representation that:
   - matches production's recorded versions;
   - produces no unexpected SQL from `supabase db push --dry-run`;
   - rebuilds a blank local Supabase database with `supabase db reset --local`; and
   - has no unexplained schema, grant, policy, function, trigger, or index differences from production.
5. Verify and record backup/PITR status, leaked-password protection, Vercel firewall posture, and AI/provider spend caps.
6. Perform a restore drill only in an isolated non-production target and only after any cost or external-state change receives explicit authorization.
7. Obtain independent Phase 0 exit review before Phase 1 begins.

## Safety invariants

- The first pass is read-only against production.
- Do not run `supabase db push`, `supabase migration repair`, `supabase db reset --linked`, remote SQL DDL, `apply_migration`, firewall mutation, or a production restore.
- Every database reset must explicitly target `--local` or an isolated disposable target.
- Do not create a paid Supabase branch/project, enable a paid add-on, publish firewall rules, or change provider limits without an explicit user checkpoint.
- Do not commit credentials, connection strings, access tokens, user data, or database row contents. Catalog metadata and migration SQL are allowed.
- Keep all work on `codex/phase-0-containment`; do not push, merge, or modify `main`.
- If a local reconstruction can only pass by falsifying production history or hiding a material diff, stop and report the conflict.

## Non-goals

- Phase 1 billing/runtime-control fixes.
- Phase 2 ownership/authentication changes.
- Phase 3 onboarding/observability changes.
- Phase 4 release automation beyond the Phase 0 evidence gate.
- Any production schema, migration-history, authentication, firewall, billing, or provider-cap mutation.

## Exit gate

Phase 0 is complete only when all repository and clean-room checks pass, live controls are evidenced, the isolated restore drill has passed, and the independent exit review has no unresolved blocker. If cost, credentials, or external authorization prevents the restore or platform checks, Phase 0 remains explicitly blocked at that checkpoint rather than being described as complete.
