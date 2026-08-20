# Phase 0 database reconciliation runbook

**Status:** Phase 0 is `BLOCKED`. Fresh local inventory-v2 matches production exactly after an explicit local-only migration disables unused `pg_graphql`, and the current linked dry run lists only that migration with empty seed and role lists. The migration is not applied and still requires an authorized apply/post-apply checkpoint. Captured production client-role grants, leaked-password protection, source/UI restore eligibility, the authorized restore drill, live Vercel/provider-control access, and the council/Auditor verdict remain unresolved; independent scoped review approved `7be975d` with no findings.
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
| Docker verification | Historical Task 5 refresh at `2026-08-20T20:06:54.2150569Z`: Docker Desktop Linux engine unavailable and `supabase db reset --local` exited 1. Current evidence: engine `29.6.1` completed fresh local resets before and after `20260820210852_disable_unused_pg_graphql.sql`; the post-migration reset applied all nine local migrations. |

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

The eight-file list above is the immutable production-history baseline. `20260820210852_disable_unused_pg_graphql.sql` is a new forward migration, generated with the CLI and currently local-only. It must not be added to the exact-production-statement artifact until production applies it under explicit authorization.

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

The historical inventory v1 captures matched across 18 tables, 147 columns, 58 constraints, 2 sequences, 42 indexes, 39 policies, 4 functions/procedures, 6 triggers, and 479 object/default grants. Inventory contract v2 also covers the `public` application schema, installed extensions, public views/materialized views, foreign tables, and public enum/domain/range/composite/base types. A pre-migration fresh reset reproduced exactly one remaining difference: the local PostgreSQL 17 image installed `graphql.pg_graphql`, while production did not. The CLI-generated `20260820210852_disable_unused_pg_graphql.sql` contains only the idempotent non-`CASCADE` drop. After a second fresh reset, the tracked local-v2 artifact matched production-v2 exactly, all foreign-option-presence flags were false, the default-grant probe exited `0`, and all 13 schema-inventory tests passed. See [the schema parity evidence](evidence/phase-0/2026-08-20-schema-parity.md).

**Production security blocker:** exact historical parity currently preserves `TRUNCATE`, `REFERENCES`, `TRIGGER`, and `MAINTAIN` for `anon`/`authenticated` on 16 public tables plus default table ACLs, and gives both client roles `USAGE`/`SELECT`/`UPDATE` on the two application sequences. Those sequence privileges should be service-only. The pending `pg_graphql` migration does not address this blast radius. Separately authorized forward-hardening work must add another migration, preserve required `service_role` access, verify application behavior, and refresh the grant/advisor evidence before Phase 0 can pass.

The fresh read-only security-advisor query still reports leaked-password protection disabled plus the same three informational policyless-RLS findings on client-CRUD-denied tables. The earlier performance-advisor capture remains 89 notices. No finding or setting changed.

## Task 4 recovery and external controls

The timestamped [platform-control evidence](evidence/phase-0/2026-08-20-platform-controls.md) records the live read-only state without exposing credentials, connection strings, account data, or table rows:

- Supabase returned eight completed physical backups, with the latest at `2026-08-20T10:56:15.704Z`. The authenticated organization is Pro, and the observed restore points cover the documented seven-day Pro access window.
- PITR is explicitly disabled, so no PITR retention window exists. The scheduled physical backups are not directly downloadable; a manual logical dump is a separate unexecuted path.
- Paid-plan and physical-backup eligibility is verified, but actual source eligibility and the operator-visible **Restore to a New Project** action remain `BLOCKED BY ACCESS`. Execution is `REQUIRES AUTHORIZATION`; the [isolated restore drill](phase-0-restore-drill.md) now requires two fresh outbound/Vault/subscription/replication-slot preflights, a conservative final-configuration estimate below the USD 8 abort threshold, explicit residual-billing-risk acceptance, executable Auth validation, and post-deletion billing evidence. It has not run.
- The live Supabase security advisor reports leaked-password protection disabled. Enabling it is the intended Phase 0 control change, but no Auth setting was changed on this read-only pass.
- The Vercel connector reconfirmed the project and READY production deployment, but still exposes neither project-specific firewall state nor production environment-variable names. A 30-day `crisp-engine` log query exceeded the billing limit, a 24-hour query timed out, and a deployment-scoped one-hour query returned no matches; that empty result is not proof of no provider calls. Firewall, environment inventory, and runtime linkage remain `BLOCKED BY ACCESS`.
- Anthropic and OpenAI are the two real provider adapters configured in code. Their current spend enforcement, alerts, and rate limits remain `BLOCKED BY ACCESS`; no runtime key or secret was inspected or reused.

Phase 0 cannot pass its exit gate until the exact access checkpoints in the platform-control evidence are satisfied, the restore drill is authorized and completed, cleanup is confirmed, and the still-missing council/Auditor verdict is obtained. The independent scoped review of `7be975d` is approved with no Critical, Important, or Minor findings.

## Task 5 exit gate

The timestamped [Phase 0 exit report](evidence/phase-0/2026-08-20-exit-report.md) records the refreshed migration-lineage, schema/Auth/preflight contracts, focused tests, app tests, typecheck, lint, diff, and worktree results. The read-only linked migration list pairs the original eight versions and shows `20260820210852` local-only. The current linked dry run lists exactly that migration and no seeds or roles; no apply occurred. The fresh local reset/capture and production-v2/local-v2 comparator pass.

These repository results do not make Phase 0 complete. The local Auth launcher returned its exact 10-key contract; the local preflight launcher returned its reviewed shape but also recorded one active unclassified local replication slot, so it is not evidence of a clean production outbound gate. Auth `PASS_BOUNDED` requires stable view definitions, column ACLs, enum labels, trigger enabled state, and password-free global role fingerprints whose membership items include `admin_option`, `inherit_option`, and `set_option`. The pending `pg_graphql` apply/post-apply checkpoint, production grant blocker, and Task 4 `NOT ENABLED`, `BLOCKED BY ACCESS`, and `REQUIRES AUTHORIZATION` controls remain; the restore drill has not run or received its required authorization/residual-cost acceptance.

Independent scoped review approved `7be975d` with no findings. The separate council preflight remains failed closed: current `three-aimigos doctor` returned `Action required` / `Configuration unavailable` with Anthropic, OpenAI, and optional xAI healthy; `configure` reported the project uninitialized. A non-writing `init` inspection showed `GPT-5.5 (openai)` recommended for the first Architect-model choice and was cancelled before any selection. No configuration was written, no council started, and no Auditor verdict exists. Do not proceed to Phase 1 until the exit report's external-control, restore, migration-apply, production-grant, and council blockers are all resolved and freshly reverified.
