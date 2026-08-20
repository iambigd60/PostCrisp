# Phase 0 database reconciliation runbook

**Status:** Phase 0 is `BLOCKED` only on the isolated restore drill, Vercel/provider-console controls, and a valid independent council verdict. Production and local history pair exactly ten versions through `20260820220303`; the linked `--skip-vault` dry run is empty. The `pg_graphql` removal and client-role grant-hardening migrations are applied, contract-v3 production/local inventories match with 325 grants, leaked-password protection is enabled, and the source preflight is clean.
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
| Docker verification | Historical Task 5 refresh at `2026-08-20T20:06:54.2150569Z`: Docker Desktop Linux engine unavailable and `supabase db reset --local` exited 1. Current evidence: engine `29.6.1` completed a fresh reset at exact branch head and applied all ten local migrations. |

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

The eight-file list above remains the immutable historical production-body baseline. Two reviewed forward migrations now follow it and are applied in production: `20260820210852_disable_unused_pg_graphql.sql` and `20260820220303_harden_client_role_grants.sql`. They are recorded in the current migration-history evidence but are not retroactively folded into the eight-body reconstruction artifact.

The disposable composite lab rebuilt a blank local database and its linked dry run reported no pending migrations. The latest-version squashed alternative was therefore not tested or selected.

## Forward repair and rollback

Treat every post-reconciliation database correction as a new forward migration. Do not edit, reapply, or repair the ten paired versions, and do not restore the historical broad client/default grants as a rollback. If application access regresses, derive the smallest missing exact object/column/function tuple from the reviewed probes and add a scoped forward grant. Re-enabling `pg_graphql` would likewise require a separately reviewed forward migration and dependency/security assessment; do not add `CASCADE` to the existing removal.

## Historical Task 2 reconstruction result

At the end of Task 2, before the two later forward migrations, the selected representation had these results:

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

The historical inventory v1 captures matched across 18 tables, 147 columns, 58 constraints, 2 sequences, 42 indexes, 39 policies, 4 functions/procedures, 6 triggers, and 479 object/default grants. Inventory contract v2 also covers the `public` application schema, installed extensions, public views/materialized views, foreign tables, and public enum/domain/range/composite/base types. A pre-migration fresh reset reproduced exactly one remaining difference: the local PostgreSQL 17 image installed `graphql.pg_graphql`, while production did not. The CLI-generated `20260820210852_disable_unused_pg_graphql.sql` contains only the idempotent non-`CASCADE` drop. After a second fresh reset, the tracked local-v2 artifact matched production-v2 exactly, all foreign-option-presence flags were false, the default-grant probe exited `0`, and all 13 schema-inventory tests passed. See [the schema parity evidence](evidence/phase-0/2026-08-20-schema-parity.md).

**Client-role hardening is closed:** the reviewed `20260820220303_harden_client_role_grants.sql` forward migration is applied. It removed exactly 154 grant rows: 128 current-table, 12 current-sequence, and 14 `postgres` default rows. Current forbidden table/sequence grants and forbidden customer-owned defaults are all zero; exact-tuple probes preserve the required table, column, function-signature, schema, and `service_role` access. Production/local inventories match at 325 grants with no non-grant drift.

The reserved `supabase_admin` 8-table-default/6-sequence-default fingerprint is an independently accepted Informational platform-owned residual, not a blocker. Reopen it only if platform automation creates an actual public relation with those grants or official customer remediation becomes available. The fresh security advisor reports only three `INFO` policyless-RLS findings and no `WARN`/`ERROR`; leaked-password protection is enabled.

## Task 4 recovery and external controls

The timestamped [platform-control evidence](evidence/phase-0/2026-08-20-platform-controls.md) records the live read-only state without exposing credentials, connection strings, account data, or table rows:

- Supabase returned eight completed physical backups, with the latest at `2026-08-20T10:56:15.704Z`. The authenticated organization is Pro, and the observed restore points cover the documented seven-day Pro access window.
- PITR is explicitly disabled, so no PITR retention window exists. The scheduled physical backups are not directly downloadable; a manual logical dump is a separate unexecuted path.
- Paid-plan and physical-backup eligibility is verified, but actual source eligibility and the operator-visible **Restore to a New Project** action remain `BLOCKED BY ACCESS`. Execution is `REQUIRES AUTHORIZATION`; the [isolated restore drill](phase-0-restore-drill.md) now requires two fresh outbound/Vault/subscription/replication-slot preflights, a conservative final-configuration estimate below the USD 8 abort threshold, explicit residual-billing-risk acceptance, executable Auth validation, and post-deletion billing evidence. It has not run.
- HIBP leaked-password protection is enabled. The current security advisor contains exactly three `INFO` policyless-RLS findings and no `WARN` or `ERROR`.
- The Vercel connector reconfirmed the project and READY production deployment, but still exposes neither project-specific firewall state nor production environment-variable names. A 30-day `crisp-engine` log query exceeded the billing limit, a 24-hour query timed out, and a deployment-scoped one-hour query returned no matches; that empty result is not proof of no provider calls. Firewall, environment inventory, and runtime linkage remain `BLOCKED BY ACCESS`.
- Anthropic and OpenAI are the two real provider adapters configured in code. Their current spend enforcement, alerts, and rate limits remain `BLOCKED BY ACCESS`; no runtime key or secret was inspected or reused.

Phase 0 cannot pass its exit gate until the exact access checkpoints in the platform-control evidence are satisfied, the restore drill is authorized and completed, cleanup is confirmed, and the still-missing council/Auditor verdict is obtained. Independent scoped reviews approved both forward migrations; the whole-branch correction wave remains subject to final re-review.

## Task 5 exit gate

The timestamped [Phase 0 exit report](evidence/phase-0/2026-08-20-exit-report.md) records the refreshed migration-lineage, schema/Auth/preflight contracts, focused tests, app tests, typecheck, lint, diff, and worktree results. The read-only linked migration list pairs all ten versions through `20260820220303`; the current linked `--skip-vault` dry run is empty. Fresh-reset production/local contract-v3 inventories compare cleanly.

These repository results do not make Phase 0 complete. The linked Auth launcher returned its exact 10-key contract with PostgreSQL 17 membership options. The linked source preflight is clean: no cron catalog/jobs, `pg_net` queue, foreign servers/mappings, subscriptions, replication slots, or Vault secrets. The restore drill still has not run; clone-specific cost/configuration confirmation, organization/production-sensitive handling authorization, cleanup evidence, Vercel/provider-console evidence, and a valid council verdict remain open.

The council gate remains failed closed. Three AImigos beta.16 returned malformed Grok 4.6 responses twice, Grok 4.3 access failed, and Gemini 3.5 access was verified but `doctor` remains `Unknown` because the installed adapter reports unknown authentication. No valid Auditor verdict exists. Do not proceed to Phase 1 until the exit report's restore, external-control, and council blockers are resolved and freshly reverified.
