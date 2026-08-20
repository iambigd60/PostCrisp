# Phase 0 database reconciliation runbook

**Status:** Task 5 exit evidence refreshed; Phase 0 is `BLOCKED`. The Auth-signature CLI invocation is resolved and its linked read-only launcher passed, but the local Docker engine is unavailable for a fresh clean-room reset. Leaked-password protection, source/UI restore eligibility, the authorized restore drill, live Vercel/provider-control access, and independent exit review remain unresolved.
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
| Docker verification | Historical evidence: Docker Desktop running; engine `29.6.1`. Current Task 5 refresh at `2026-08-20T20:06:54.2150569Z`: Docker Desktop Linux engine unavailable (`dockerDesktopLinuxEngine` named pipe absent); `supabase db reset --local` exited 1, so fresh local clean-room verification is blocked. |

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

## Task 2 reconstruction result

Task 2 implemented the selected representation in tracked migrations:

- `20260707062202_protect_privileged_profile_columns_v1.sql` is explicitly labeled as a composite clean-room bootstrap rather than a byte-for-byte historical migration. Its final SQL body matches the exact captured production v1 statement under the documented single-terminal-LF comparison rule.
- The other seven files use the production timestamps and exact normalized production statement bodies. Their normalized SHA-256 values match the evidence artifact.
- The production `service_role_table_grant_lockdown` body was preserved exactly, including its narrower `feedback` revocation. The previously local-only `UPDATE`/`DELETE` revocations were not folded into historical SQL.
- Two consecutive `supabase db reset --local` runs rebuilt a blank database and applied all eight migrations.
- `supabase migration list --linked` paired the same eight versions locally and remotely.
- `supabase db push --dry-run --linked` reported `upToDate: true` with no migrations, seeds, or roles pending.

These checks reconcile the repository migration lineage without changing production. At the end of Task 2 they did not yet establish full object-level schema parity; Task 3 supplies that evidence below.

## Task 3 deterministic schema parity

Task 3 added a catalog-only inventory and dependency-free comparator. Production was queried read-only, and local inventory was captured only after a fresh `supabase db reset --local`.

After each verification reset, run the database-backed default-grant integration check separately from the Node unit suite:

```text
supabase db query --local --file scripts/phase0/probe-default-grants.sql --output-format json
```

The first comparison exposed 21 column-order differences and 163 missing legacy Data API grants. Both were clean-room reconstruction defects:

- the composite baseline now preserves production order for `profiles` and the hoisted `saved_content` prerequisite, while `purchased_credits` remains added by its exact production-timestamp migration; and
- local resets explicitly reproduce the captured production object/default ACLs from the composite bootstrap without enabling the deprecated global `api.auto_expose_new_tables` compatibility toggle. The reserved `supabase_admin` defaults remain platform-seeded and are correlated by normalized ACL-set fingerprint.

The final inventories match exactly across 18 tables, 147 columns, 58 constraints, 2 sequences, 42 indexes, 39 policies, 4 functions/procedures, 6 triggers, and 479 object/default grants. Broad default ACLs remain because they are current production state; changing them requires an authorized production migration. See [the schema parity evidence](evidence/phase-0/2026-08-20-schema-parity.md).

The production advisors still report leaked-password protection disabled, three informational policyless-RLS findings on client-CRUD-denied tables, and 89 performance notices. Task 3 records those results without expanding into production mutation or performance remediation.

## Task 4 recovery and external controls

The timestamped [platform-control evidence](evidence/phase-0/2026-08-20-platform-controls.md) records the live read-only state without exposing credentials, connection strings, account data, or table rows:

- Supabase returned eight completed physical backups, with the latest at `2026-08-20T10:56:15.704Z`. The authenticated organization is Pro, and the observed restore points cover the documented seven-day Pro access window.
- PITR is explicitly disabled, so no PITR retention window exists. The scheduled physical backups are not directly downloadable; a manual logical dump is a separate unexecuted path.
- Paid-plan and physical-backup eligibility is verified, but actual source eligibility and the operator-visible **Restore to a New Project** action remain `BLOCKED BY ACCESS`. Execution is `REQUIRES AUTHORIZATION`; the [isolated restore drill](phase-0-restore-drill.md) now requires two fresh outbound/Vault/subscription/replication-slot preflights, a conservative final-configuration estimate below the USD 8 abort threshold, explicit residual-billing-risk acceptance, executable Auth validation, and post-deletion billing evidence. It has not run.
- The live Supabase security advisor reports leaked-password protection disabled. Enabling it is the intended Phase 0 control change, but no Auth setting was changed on this read-only pass.
- Vercel project identity was verified, but project-specific firewall state remains `BLOCKED BY ACCESS`: the connector does not expose it, the current CLI session is not authenticated, and Chrome was not running. Repository firewall instructions are not live proof.
- Anthropic and OpenAI are the two real provider adapters configured in code. Their current spend enforcement, alerts, and rate limits—and the Vercel production environment-variable name inventory—remain `BLOCKED BY ACCESS`; no runtime key or secret was inspected or reused.

Phase 0 cannot pass its exit gate until the exact access checkpoints in the platform-control evidence are satisfied, the restore drill is authorized and completed, cleanup is confirmed, and independent exit review finds no unresolved blocker.

## Task 5 exit gate

The timestamped [Phase 0 exit report](evidence/phase-0/2026-08-20-exit-report.md) records the refreshed migration-lineage, committed-schema-comparator, focused-test, full-test, typecheck, lint, diff, and worktree results. The linked list paired all eight versions and the linked dry run was up to date. The fresh clean-room reset and local schema capture could not run because Docker Desktop's Linux-engine pipe was unavailable; the committed production/local inventory artifacts still compare equal.

These repository results do not make Phase 0 complete. The fresh Task 5 refresh could not run `supabase db reset --local` because Docker Desktop's Linux-engine pipe was unavailable, so its three database-backed schema tests and local Auth launcher remain unrefreshed. The committed schema inventories still compare equal, the focused Auth query/capture/comparator tests passed 2/9/23, and the bounded credential-free launcher completed successfully against linked production without persisting its raw JSON. This closes the prior CLI multi-command execution defect without making the restore drill complete. Task 4 still contains `NOT ENABLED`, `BLOCKED BY ACCESS`, and `REQUIRES AUTHORIZATION` controls, and the restore drill has not run or received the explicit authorization and residual-cost acceptance it requires.

Independent council preflight remains failed closed: immediately before this refresh, the controller's required `three-aimigos doctor` returned `Action required`, `Configuration unavailable`, required Anthropic/OpenAI healthy, and optional xAI authentication required. Per the preflight contract, this task did not run `status`, `start`, `init`, `configure`, or a repeat `doctor`; no council was started and no Auditor verdict exists. Do not proceed to Phase 1 until the exit report's repository, external-control, restore, and independent-review blockers are all resolved and freshly reverified.
