# ADR: Phase 0 migration reconciliation architecture

**Decision date:** 2026-08-20
**Status:** Accepted and implemented for Task 2
**Scope:** repository representation only; production remained read-only

## Context

Production records eight migration versions. The repository has seven migration files whose timestamps have zero overlap with the production versions, and it lacks production's earliest v1 file. Renaming the seven local files and adding the literal v1 statement aligns history, but it does not create a blank database because v1 assumes `public.profiles` already exists.

The repository's current practical baseline is `src/lib/supabase-schema.sql`. That file also contains internal forward references that are harmless when run against the existing production schema but prevent a literal top-to-bottom blank bootstrap: `credit_transactions` references `generations` before its definition, `channels` alters `saved_content` before its definition, and two triggers use `handle_updated_at` before its definition.

## Decision

Select a **composite baseline at the earliest production version**:

- Version `20260707062202` becomes a clearly marked clean-room representation, not a claim that the entire baseline ran historically at that timestamp.
- It contains the current baseline schema.
- Immediately after `profiles`, it hoists idempotent definitions for `generations`, `saved_content`, and `handle_updated_at` so the baseline's existing forward references can run on a blank database. Their later `IF NOT EXISTS` / `OR REPLACE` definitions remain in the baseline.
- It appends the exact production `protect_privileged_profile_columns_v1` statement verbatim after the baseline portion.
- The other seven production-timestamp files use the exact normalized production statement bodies preserved in the migration-history artifact. They are not assumed to match the current local files.

This representation preserves all eight production version identifiers and keeps the literal remote SQL reviewable, while honestly distinguishing local clean-room bootstrap structure from literal historical execution.

The latest-version squashed alternative was not tested: the composite candidate reset cleanly and produced a no-pending linked dry run, so the task's fallback condition was not met. A latest-only squash would also be a worse fit for the requirement to keep all eight production identifiers visible.

## Experimental evidence

All experiment files were disposable and ignored under `.superpowers/sdd/2026-08-20-phase-0-containment/lab/`. No tracked migration was edited.

### Timestamp-aligned history alone

The lab used the exact missing v1 SQL followed by the seven existing migrations under production timestamps. Against a blank local database it failed at the earliest migration because `public.profiles` did not exist. This is the expected proof that timestamp alignment alone is not a bootstrap.

### Exact-statement comparison and corrected composite baseline

Review of the first experiment found that its seven mapped files came from the repository rather than the exact production bodies. A normalized SHA-256 comparison then proved that only `processed_stripe_events` and `purchased_credits_bucket` match. The prelaunch, profiles-insert, tutorial-redemptions, and onboarding-events differences are comments/formatting only; `service_role_table_grant_lockdown` also has a material DDL difference because the local file revokes feedback `UPDATE` and `DELETE` while the stored production statement does not.

The ignored lab was rebuilt from the exact production artifact. The earliest composite file retained the baseline/hoisted-prerequisite architecture and ended with the exact v1 body. Each of the remaining seven lab files hash-matched its captured production statement. This corrected composite started successfully, applied all eight production-version files, and completed an explicit blank local reset. Its linked migration list paired every local version with the same remote version, and the linked dry run returned `upToDate: true` with no migrations, seeds, or roles pending.

Supabase startup printed local development credentials. They were transient local defaults and are intentionally omitted from this evidence.

The required secret-pattern scan returned matches because the pattern includes the non-secret database role name. Changed-file matches are migration identifiers, role-name descriptions, or the scan command itself; the broader scan also finds pre-existing variable-name-only documentation. Manual review found no credential value, token, or connection string in the staged files.

## Exact command record

Commands are shown exactly as invoked from `C:\Projects\postcrisp-phase-0-containment`; `EXIT` is the observed process exit code.

| Command | EXIT | Result |
| --- | ---: | --- |
| `supabase --version` | 0 | `2.115.0` |
| `docker desktop status` | 0 | Docker Desktop reported `running` |
| `docker version` | 0 | Client/server engine `29.6.1`; Docker Desktop `4.82.0` |
| `supabase migration list --linked` | 1 | Before local link metadata existed: `LegacyProjectNotLinkedError` |
| `supabase db push --dry-run --linked` | 1 | Before local link metadata existed: `LegacyProjectNotLinkedError` |
| `supabase link --project-ref sikabeqzypvllimyostg --yes` | 0 | Wrote ignored local link metadata; no remote mutation |
| `supabase migration list --linked` | 0 | Current tracked repo showed seven local-only and eight remote-only versions |
| `supabase db push --dry-run --linked` | 1 | `LegacyDbPushMissingLocalError`; remote versions were absent locally |
| `supabase --workdir "C:\Projects\postcrisp-phase-0-containment\.superpowers\sdd\2026-08-20-phase-0-containment\lab\history" start` | 1 | `SQLSTATE 42P01`: `public.profiles` did not exist when v1 reached its trigger statement |
| `supabase --workdir "C:\Projects\postcrisp-phase-0-containment\.superpowers\sdd\2026-08-20-phase-0-containment\lab\history" stop --no-backup` | 0 | Disposable history stack stopped without backup |
| `supabase --workdir "C:\Projects\postcrisp-phase-0-containment\.superpowers\sdd\2026-08-20-phase-0-containment\lab\composite" start` | 0 | All eight production-version files applied |
| `supabase --workdir "C:\Projects\postcrisp-phase-0-containment\.superpowers\sdd\2026-08-20-phase-0-containment\lab\composite" db reset --local` | 0 | Blank local database rebuilt with all eight versions |
| `supabase --workdir "C:\Projects\postcrisp-phase-0-containment\.superpowers\sdd\2026-08-20-phase-0-containment\lab\composite" link --project-ref sikabeqzypvllimyostg --yes` | 0 | Wrote ignored lab link metadata; no remote mutation |
| `supabase --workdir "C:\Projects\postcrisp-phase-0-containment\.superpowers\sdd\2026-08-20-phase-0-containment\lab\composite" migration list --linked` | 0 | Eight local/remote version pairs matched exactly |
| `supabase --workdir "C:\Projects\postcrisp-phase-0-containment\.superpowers\sdd\2026-08-20-phase-0-containment\lab\composite" db push --dry-run --linked` | 0 | Remote database up to date; no pending migrations |
| `supabase --workdir "C:\Projects\postcrisp-phase-0-containment\.superpowers\sdd\2026-08-20-phase-0-containment\lab\composite" stop --no-backup` | 0 | Disposable composite stack stopped without backup |
| `npm test -- --run` | 0 | 26 files and 240 tests passed |
| `npm run typecheck` | 0 | TypeScript completed without errors |
| `npm run lint` | 0 | Completed with four pre-existing warnings |
| `git diff --check` | 0 | No unstaged whitespace errors |
| `git diff --cached --check` | 0 | No staged whitespace errors after correction |
| `rg -n --hidden "(service_role\|SUPABASE_SERVICE_ROLE_KEY\|postgres(ql)?://\|sbp_[A-Za-z0-9]\|sk_(live\|test)_)" docs/operations docs/superpowers` | 0 | Matches reviewed; no secret value found in staged files |
| `& '.superpowers\sdd\2026-08-20-phase-0-containment\lab\rebuild-exact-history.ps1'` | 1 | Initial ignored helper used unavailable `Convert.ToHexString`; no production or tracked migration state changed |
| `& '.superpowers\sdd\2026-08-20-phase-0-containment\lab\rebuild-exact-history.ps1'` | 0 | Five local mismatches reproduced; all seven exact-statement lab files hash-matched production and the composite v1 suffix matched |
| `supabase --workdir "C:\Projects\postcrisp-phase-0-containment\.superpowers\sdd\2026-08-20-phase-0-containment\lab\composite" start` | 0 | Corrected exact-statement composite applied all eight files |
| `supabase --workdir "C:\Projects\postcrisp-phase-0-containment\.superpowers\sdd\2026-08-20-phase-0-containment\lab\composite" db reset --local` | 0 | Corrected exact-statement composite rebuilt a blank database |
| `supabase --workdir "C:\Projects\postcrisp-phase-0-containment\.superpowers\sdd\2026-08-20-phase-0-containment\lab\composite" migration list --linked` | 0 | Corrected lab showed eight exact local/remote version pairs |
| `supabase --workdir "C:\Projects\postcrisp-phase-0-containment\.superpowers\sdd\2026-08-20-phase-0-containment\lab\composite" db push --dry-run --linked` | 0 | Corrected lab was up to date with no pending migration |
| `supabase --workdir "C:\Projects\postcrisp-phase-0-containment\.superpowers\sdd\2026-08-20-phase-0-containment\lab\composite" stop --no-backup` | 0 | Corrected disposable composite stack stopped without backup |

## Consequences and follow-up

- Task 2 must clearly label the earliest tracked migration as a composite clean-room representation.
- The hoisted prerequisites are a bootstrap-only ordering accommodation and must be reviewed as part of the earliest migration.
- All eight exact normalized production statements remain independently preserved in the migration-history artifact with stable hashes.
- Task 2 must use those captured bodies for the seven production-timestamp files. Four current differences are comments/formatting; the service-role grant difference is material DDL and must remain visible until deterministic schema parity resolves current state.
- The final schema still needs Task 3's deterministic local-versus-production object comparison; a successful reset and an empty migration dry run prove lineage mechanics, not full schema parity.
- Production migration history was not repaired, hidden, or otherwise mutated.

## Task 2 implementation evidence

The tracked implementation promoted the reviewed exact-statement composite candidate without reconstructing SQL from memory. The earliest migration is labeled as a composite clean-room representation, and its final production v1 body remains verifiable under the artifact's documented single-terminal-LF rule. Each of the other seven tracked production-timestamp files normalized to the captured production SHA-256.

Two consecutive blank `supabase db reset --local` runs applied all eight migrations successfully. The linked migration list then showed eight exact local/remote version pairs, and `supabase db push --dry-run --linked` returned `upToDate: true` with no pending migrations, seeds, or roles. No production migration, schema, or history state was mutated.

The exact stored service-role grant statement intentionally replaces the previous local-only form, so the narrower production `feedback` revocation stays visible for Task 3's deterministic schema-parity comparison rather than being hidden in reconstructed history.
