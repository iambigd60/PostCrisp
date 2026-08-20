# PostCrisp Phase 0 Containment Implementation Plan

> **Spec:** `docs/superpowers/specs/2026-08-20-phase-0-containment.md`
>
> **Global constraints:** Work only in `C:\Projects\postcrisp-phase-0-containment` on `codex/phase-0-containment`. Production is read-only throughout the first pass. Never run `supabase db push`, `supabase migration repair`, `supabase db reset --linked`, remote DDL, `apply_migration`, a production restore, or a firewall mutation. Never commit secrets or row data. Use explicit `--local` targets for resets. Do not push or merge. A paid or state-changing external step requires a fresh user checkpoint.

## Task 1: Establish the safety record and choose the reconciliation architecture

**Files:**

- Create: `docs/operations/phase-0-database-reconciliation.md`
- Create: `docs/operations/evidence/phase-0/2026-08-20-production-migration-history.md`
- Create: `docs/operations/evidence/phase-0/2026-08-20-reconciliation-adr.md`
- Include in the task commit: `docs/superpowers/specs/2026-08-20-phase-0-containment.md`
- Include in the task commit: `docs/superpowers/plans/2026-08-20-phase-0-containment.md`

**Steps:**

1. Record the base commit, worktree/branch, Supabase and Vercel identifiers, installed Supabase CLI version, baseline verification results, and the production-read-only prohibitions in the runbook.
2. Record the eight production migration versions and the seven local-to-production timestamp mappings. Preserve the exact SQL for the missing `20260707062202_protect_privileged_profile_columns_v1` migration in the migration-history evidence file.
3. Use disposable, ignored lab directories under `.superpowers/sdd/2026-08-20-phase-0-containment/lab/`; do not edit tracked migrations during the experiments.
4. Prove the expected failure of the timestamp-aligned eight-file history alone against a blank local database: it cannot create `public.profiles` before the earliest recorded migration.
5. Test the composite-baseline design in the disposable lab: fold the current baseline schema plus the exact missing v1 statement into version `20260707062202`, then replay the remaining seven migrations under production timestamps.
6. Test a latest-version squashed baseline only if the composite design cannot reset cleanly or cannot remain a no-pending-migration dry run. Do not select a design that hides remote-only versions or requires a production migration-history mutation.
7. In the ADR, select the design only if it preserves all eight production version identifiers, retains exact remote SQL as evidence, cleanly resets a blank local database, and leaves no pending versions during a linked dry run. Record any difference between the local bootstrap representation and the literal historical statements.
8. Run a secret-pattern scan over the new documents and inspect the complete diff.

**Verification:**

```powershell
supabase --version
supabase migration list --linked
supabase db push --dry-run --linked
supabase --workdir "C:\Projects\postcrisp-phase-0-containment\.superpowers\sdd\2026-08-20-phase-0-containment\lab\composite" db reset --local
git diff --check
rg -n --hidden "(service_role|SUPABASE_SERVICE_ROLE_KEY|postgres(ql)?://|sbp_[A-Za-z0-9]|sk_(live|test)_)" docs/operations docs/superpowers
```

The ADR must include the exact commands and exit codes actually observed.

**Commit:** `docs: establish phase 0 reconciliation strategy`

## Task 2: Reconstruct the repository migration lineage

**Files:**

- Create: `supabase/migrations/20260707062202_protect_privileged_profile_columns_v1.sql`
- Rename: `supabase/migrations/20260706093000_processed_stripe_events.sql` -> `supabase/migrations/20260707062213_processed_stripe_events.sql`
- Rename: `supabase/migrations/20260723120000_prelaunch_security_hardening.sql` -> `supabase/migrations/20260724124907_prelaunch_security_hardening.sql`
- Rename: `supabase/migrations/20260724130000_profiles_insert_lockdown.sql` -> `supabase/migrations/20260724134848_profiles_insert_lockdown.sql`
- Rename: `supabase/migrations/20260724140000_service_role_table_grant_lockdown.sql` -> `supabase/migrations/20260724163923_service_role_table_grant_lockdown.sql`
- Rename: `supabase/migrations/20260724150000_purchased_credits_bucket.sql` -> `supabase/migrations/20260724215224_purchased_credits_bucket.sql`
- Rename: `supabase/migrations/20260818120000_tutorial_redemptions.sql` -> `supabase/migrations/20260819010825_tutorial_redemptions.sql`
- Rename: `supabase/migrations/20260818121000_onboarding_events.sql` -> `supabase/migrations/20260819010835_onboarding_events.sql`
- Modify: `docs/operations/phase-0-database-reconciliation.md`
- Modify: `docs/operations/evidence/phase-0/2026-08-20-reconciliation-adr.md`

**Steps:**

1. Implement the Task 1 ADR. The default approved candidate is a clearly marked clean-room baseline folded into the earliest already-applied production version; if Task 1 disproves it, stop and revise this plan before changing tracked migrations.
2. Keep the exact missing v1 production statement intact after the baseline portion and explain at the file header why the version is a composite bootstrap representation rather than a byte-for-byte historical file.
3. Create each of the seven production-timestamp files from the exact production statement body captured by Task 1, using Task 1's documented LF/UTF-8 normalization where production stored statement arrays. Do not treat the current files as byte-identical: four differ from production in comments/formatting, and `service_role_table_grant_lockdown` has a material DDL difference in the feedback revocations. Keep the composite baseline only in `20260707062202`; any desired post-production hardening beyond the exact captured statements must be isolated, explained in the ADR, and reviewed as a production-parity risk.
4. Run a blank local reset twice. The second reset guards against hidden state in the first run.
5. Confirm the linked migration list has identical local and remote version sets and the linked dry run reports no pending migration.
6. Inspect the migration diff and scan it for credentials or data.

**Verification:**

```powershell
supabase db reset --local
supabase db reset --local
supabase migration list --linked
supabase db push --dry-run --linked
git diff --check
git diff --find-renames -- supabase/migrations docs/operations
```

**Commit:** `fix(db): reconcile production migration lineage`

## Task 3: Add deterministic schema-parity evidence

**Files:**

- Create: `scripts/phase0/schema-inventory.sql`
- Create: `scripts/phase0/compare-schema-inventory.mjs`
- Create: `scripts/phase0/compare-schema-inventory.test.mjs`
- Create: `docs/operations/evidence/phase-0/2026-08-20-production-schema-inventory.json`
- Create: `docs/operations/evidence/phase-0/2026-08-20-local-schema-inventory.json`
- Create: `docs/operations/evidence/phase-0/2026-08-20-schema-parity.md`
- Modify: `docs/operations/phase-0-database-reconciliation.md`

**Steps:**

1. Write a read-only catalog query that emits stable JSON for public tables/columns/constraints, sequences, indexes, RLS flags/policies, functions, triggers, and grants. Exclude table rows, role secrets, owner names that vary by environment, OIDs, timestamps, and other nondeterministic identifiers.
2. Write Node's built-in test-runner tests first for canonical ordering, ignored nondeterministic fields, missing-object detection, changed-definition detection, and readable diff output.
3. Implement the comparator with no new runtime dependency. It must exit nonzero on any unexplained missing, extra, or changed object.
4. Capture production inventory through a read-only query and local inventory after a fresh local reset. Keep only catalog metadata in the committed JSON.
5. Run the comparator. Every difference must be fixed in migrations or explicitly justified in the parity report; security-relevant grants, policies, functions, and triggers cannot be waived as environment noise.
6. Run Supabase security/performance advisors read-only and record relevant results in the parity report.

**Verification:**

```powershell
node --test scripts/phase0/compare-schema-inventory.test.mjs
node scripts/phase0/compare-schema-inventory.mjs docs/operations/evidence/phase-0/2026-08-20-production-schema-inventory.json docs/operations/evidence/phase-0/2026-08-20-local-schema-inventory.json
npm test -- --run
npm run typecheck
npm run lint
git diff --check
```

**Commit:** `test(db): prove production schema parity`

## Task 4: Verify recovery and external platform controls

**Files:**

- Create: `docs/operations/evidence/phase-0/2026-08-20-platform-controls.md`
- Create: `docs/operations/phase-0-restore-drill.md`
- Modify: `docs/operations/phase-0-database-reconciliation.md`

**Steps:**

1. Record, with timestamp and source, current Supabase backup retention, the latest successful backup, PITR status/retention, and whether backup download or restore-to-new-project is available on the current plan. Do not infer settings from plan defaults.
2. Define a restore drill using an isolated non-production target, validation queries based on schema metadata and bounded aggregate counts, cleanup ownership, expected duration, rollback, and cost ceiling. Never restore over production.
3. If the drill requires a paid branch/project, add-on, or other state-changing action, stop at an explicit user authorization checkpoint. Do not mark the drill passed until it actually runs.
4. Record current leaked-password protection status and the exact intended control change for Phase 0; do not change it on the read-only pass.
5. Record current Vercel firewall configuration using authenticated read-only inspection. If the connector cannot expose the configuration, record the exact CLI/browser evidence gap rather than treating a default as verified.
6. Record AI/provider hard and soft spend/rate limits for every configured production provider without exposing credentials. Unknown or UI-only settings remain blockers.
7. Classify each control as `VERIFIED`, `NOT ENABLED`, `BLOCKED BY ACCESS`, or `REQUIRES AUTHORIZATION`; include no ambiguous green state.

**Verification:**

```powershell
git diff --check
rg -n --hidden "(service_role|SUPABASE_SERVICE_ROLE_KEY|postgres(ql)?://|sbp_[A-Za-z0-9]|sk_(live|test)_)" docs/operations
```

**Commit:** `docs(ops): evidence recovery and platform controls`

## Task 5: Assemble and independently review the Phase 0 exit package

**Files:**

- Create: `docs/operations/evidence/phase-0/2026-08-20-exit-report.md`
- Modify: `docs/operations/phase-0-database-reconciliation.md`

**Steps:**

1. Re-run every repository, clean-room reset, linked dry-run, migration-list, schema-parity, test, typecheck, and lint command from a clean working tree and record command, time, exit code, and result.
2. Confirm all Task 4 controls are `VERIFIED` and the isolated restore drill passed. If any are not, record Phase 0 as blocked and do not proceed to Phase 1.
3. Generate a whole-branch review package from `c449867` to `HEAD`.
4. Run an independent Greybeard and Three AImigos exit review against the spec, plan, evidence, SQL, scripts, and complete branch diff.
5. Return every actionable finding to the owning implementer, rerun the relevant checks, and repeat independent review until no blocker remains or the user must resolve an external checkpoint.
6. Do not push, merge, or start Phase 1 without an explicit handoff after the gate result.

**Verification:**

```powershell
supabase db reset --local
supabase migration list --linked
supabase db push --dry-run --linked
node --test scripts/phase0/compare-schema-inventory.test.mjs
node scripts/phase0/compare-schema-inventory.mjs docs/operations/evidence/phase-0/2026-08-20-production-schema-inventory.json docs/operations/evidence/phase-0/2026-08-20-local-schema-inventory.json
npm test -- --run
npm run typecheck
npm run lint
git diff --check c449867..HEAD
git status --short --branch
```

**Commit:** `docs(ops): record phase 0 exit evidence`
