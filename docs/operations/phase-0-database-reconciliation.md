# Phase 0 database reconciliation runbook

**Status:** Task 1 architecture selected; tracked migration reconstruction is deferred to Task 2.
**Recorded:** 2026-08-20 (America/Los_Angeles)

## Safety record

| Item | Recorded value |
| --- | --- |
| Base commit | `c449867` |
| Worktree | `C:\Projects\postcrisp-phase-0-containment` |
| Branch | `codex/phase-0-containment` |
| Supabase project | `sikabeqzypvllimyostg` (`postcrisp`, `us-east-2`) |
| Vercel project | `prj_jk99T7FADZ391B7LWt9g8SYwLn9w` |
| Supabase CLI | `2.115.0` |
| Docker verification | Docker Desktop running; engine `29.6.1` |

The repository baseline was reverified in this worktree on 2026-08-20:

| Command | Exit | Result |
| --- | ---: | --- |
| `npm test -- --run` | 0 | 26 files and 240 tests passed |
| `npm run typecheck` | 0 | TypeScript completed without errors |
| `npm run lint` | 0 | Completed with four pre-existing warnings: three hook dependency warnings and one `no-img-element` warning |

## Production read-only boundary

Until Phase 0 has passed its exit gate:

- Do not run a non-dry-run database push.
- Do not repair production migration history.
- Do not reset a linked database.
- Do not execute remote DDL or apply a remote migration.
- Do not restore over production.
- Do not mutate firewall rules or provider limits.
- Do not create a paid project, branch, add-on, or other paid resource without explicit authorization.
- Do not push, merge, or modify `main`.
- Never record credentials, connection strings, tokens, row data, or local stack credentials in evidence.

Every reset in this phase must explicitly use `--local` or target a separately authorized disposable environment. The Task 1 experiments were confined to the ignored directory `.superpowers/sdd/2026-08-20-phase-0-containment/lab/` and did not edit tracked migrations.

## Reconciliation decision

Use the composite-baseline architecture established in [the reconciliation ADR](evidence/phase-0/2026-08-20-reconciliation-adr.md):

1. Preserve all eight production migration versions locally.
2. Represent version `20260707062202` as a documented clean-room bootstrap: the current repository baseline, three hoisted bootstrap prerequisites required by that baseline's existing forward references, and then the exact production v1 statement.
3. Replay the remaining seven production-timestamp files from the exact captured production bodies, not from assumed timestamp-only renames of the current local files.
4. Keep all eight normalized production bodies and stable hashes in [the exact statement artifact](evidence/phase-0/2026-08-20-production-migration-statements.json), with the query and comparison evidence in [the production migration history](evidence/phase-0/2026-08-20-production-migration-history.md).

The disposable composite lab rebuilt a blank local database and its linked dry run reported no pending migrations. The latest-version squashed alternative was therefore not tested or selected.

## Task 2 handoff

Task 2 may implement the selected representation in tracked migrations. It must preserve the exact production v1 statement after the bootstrap portion and use the captured exact production bodies for the other seven versions. Only two current local files hash-match production; four differ in comments/formatting, and the service-role grant file has a material feedback-revocation difference. Task 2 must keep that difference explicit, reset the blank local database twice, and repeat the linked version/dry-run checks before claiming reconciliation complete.
