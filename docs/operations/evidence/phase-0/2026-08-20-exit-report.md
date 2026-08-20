# Phase 0 exit report

**Gate result:** **BLOCKED — do not start Phase 1.**
**Recorded:** 2026-08-20 (America/Los_Angeles)
**Final-review fix-wave base:** `03137e8`
**Verification state:** working tree on `codex/phase-0-containment`; commit recorded after this evidence update

The optional-extension unblock makes local PostgreSQL 17 extension state reproducible: a CLI-generated migration explicitly drops unused `pg_graphql`, and a fresh local inventory-v2 capture now matches production-v2 exactly. It does not make Phase 0 complete. The migration is still local-only, current production grants expose high-blast-radius privileges to client roles, and the platform-control/restore/final-independent-review gates remain unresolved.

## Safety boundary

Production remained read-only. No restore or paid resource was created; no Auth, firewall, provider, production schema, or migration-history setting was changed; no database push or dry-run, repair, linked reset, remote DDL, browser launch, push, merge, or Phase 1 work occurred. Two explicit `supabase db reset --local` runs erased the prior manual local experiment and replayed the repository before and after the new migration. Raw launcher output was held only in process memory long enough to validate reviewed shapes/counts and was not persisted.

All eight production-applied migration versions and captured statement bodies remain unchanged from `03137e8`. `20260820210852_disable_unused_pg_graphql.sql` is a new local-only pending migration; its single statement is not client-role hardening and must not be pushed without the explicit production checkpoint.

## Production security blocker: client-role grants

Exact historical parity preserves unsafe current production state. The captured grant inventory gives both `anon` and `authenticated` `TRUNCATE`, `REFERENCES`, `TRIGGER`, and `MAINTAIN` on 16 public tables plus captured default table ACLs. Both roles also have `USAGE`, `SELECT`, and `UPDATE` on `onboarding_events_id_seq` and `tutorial_redemptions_id_seq`; those application-sequence privileges should be service-only.

This is a Phase 0 production security blocker. Separately authorized forward-hardening work must add and deploy another production migration that revokes the client-role table/default/sequence blast radius, retains required `service_role` access, verifies application behavior, and refreshes production grant/advisor evidence. The pending `pg_graphql` migration does not address these grants.

## Fresh verification evidence

All timestamps below are UTC on 2026-08-20.

| Start | Command | Exit | Result |
| --- | --- | ---: | --- |
| `21:07Z` | pre-migration `supabase db reset --local` | 0 | Recreated the local database and replayed only the eight committed migrations, erasing the prior manual local extension drop. |
| `21:08Z` | fresh local inventory-v2 capture and comparator before the migration | 1 | Authentic RED: the only difference was `extra in local: extensions graphql.pg_graphql`. |
| `21:08Z` | `supabase migration new disable_unused_pg_graphql` | 0 | CLI created `20260820210852_disable_unused_pg_graphql.sql`; its final body contains only `drop extension if exists pg_graphql;` and no `CASCADE`. |
| `21:09Z` | post-migration `supabase db reset --local` | 0 | Recreated the local database and applied all nine local migrations, including the non-`CASCADE` extension drop. |
| `21:09Z` | fresh local inventory-v2 capture and comparator | 0 | GREEN: contract `2`, five extensions, no `pg_graphql`, every foreign-option-presence flag false, and `Schema inventories match.` The tracked stale local-v1 artifact was replaced with this v2 capture. |
| `21:10Z` | local Auth launcher, source-preflight launcher, and default-grant probe | 0 each | Auth returned exactly 10 keys with 1,149 metadata and 74 global-role items. Preflight returned exactly 10 reviewed keys but recorded one active unclassified local replication slot; the probe passed. Raw outputs were discarded. |
| `21:10Z` | `node --test scripts/phase0/compare-schema-inventory.test.mjs` | 0 | All 13 tests passed, including the three database-backed inventory checks. |
| `21:11Z` | all seven Phase 0 Node test files | 0 | 62 tests: 61 passed and the optional standalone PostgreSQL membership-container test skipped; no failure. |
| `21:11Z` | local migration list and local advisors | 0 each | All nine local migrations were applied. Advisors completed with 64 existing WARN-level findings; no production advisor or setting was changed. |
| `21:11Z` | app tests, typecheck, and lint, run sequentially | 0 each | 26 files/240 app tests passed; typecheck passed; lint retained the four baseline warnings and existing tool deprecations. |
| `21:12Z` | `supabase migration list --linked` | 0 | Read-only listing paired the original eight versions and showed `20260820210852` local-only. No `db push` or dry-run followed. |
| `21:16Z` | final migration/body, inventory, secret, scope, and whitespace checks | 0 | The migration remained the exact one-statement non-`CASCADE` drop; both inventories parsed as contract v2 and compared exactly; the high-confidence credential-value scan found no matches (`rg` exit 1); `git diff --check` passed; only the seven reviewed tracked paths were in scope. |
| `20:54Z` | `node --test scripts/phase0/auth-restore-signature-query.test.mjs` before the SQL change | 1 | Authentic RED: 3 passed, 1 failed, 1 skipped. The failure was `membership fingerprint omits inherit_option`, the expected omitted-option reason. |
| `20:57Z` | the same query test with `PHASE0_PG17_CONTAINER` against isolated PostgreSQL `17.6` before the SQL change | 1 | Database-backed RED: 3 passed and 2 failed. With the membership item count unchanged, changing `inherit_option` left the global-role signature unchanged. No raw catalog row, role identity, or hash is retained here. |
| `20:57Z` | the same PostgreSQL 17-backed query test after the minimal SQL change | 0 | GREEN: all 5 passed. Omitting either named option is rejected, and independently changing `inherit_option` or `set_option` changes the global-role signature without changing the item count. |
| `20:57Z` | focused Auth query/capture/comparator tests | 0 | 40 tests passed with no skip. The PostgreSQL 17 mutations change the fingerprint, and the comparator fails rather than returning `PASS_BOUNDED` when the global-role signature differs. |
| `20:57Z` | `node scripts/phase0/capture-auth-restore-signature.mjs --linked` | 0 | Read-only linked capture returned exactly 10 reviewed keys, 1,157 Auth metadata items, and 68 global-role items. Raw output was discarded and no signature hash or identity was retained. |
| `20:58Z` | `npm test -- --run` | 0 | 26 files and 240 tests passed. npm emitted its existing `--run` configuration warning. |
| `20:58Z` | `npm run typecheck` | 0 | TypeScript completed without errors. |
| `20:58Z` | `npm run lint` | 0 | Completed with the same four baseline warnings below, plus the existing Next.js/Sentry deprecation notices. |
| `20:59Z` | high-confidence credential-value scan over all changed tracked files and the ignored task report | 1 | No matching files; `rg` exit 1 is the expected no-match result. |
| `20:59Z` | `git diff --check` and changed-path scope check | 0 | No whitespace errors; exactly six tracked files changed, with no migration or `progress.md` path. |
| `20:42:34.9890544Z` | `node --test` over all seven Phase 0 query/launcher/comparator test files | 1 | 60 tests: 57 passed; only the 3 local-database inventory tests failed because the Docker-backed local database was unavailable. All credential-free/static/unit contracts passed. |
| `20:37:57.7662633Z` | `supabase db reset --local` | 1 | Docker Desktop's `dockerDesktopLinuxEngine` named pipe was absent; no reset occurred. |
| `20:37:57Z` | `node scripts/phase0/compare-schema-inventory.mjs <production-v2> <local-v1>` | 2 | Failed closed: `local inventory_contract_version must equal 2`. The historical local artifact is not accepted as current parity proof. |
| `20:37:57Z` | local Auth and source-preflight launchers | 1 each | Both failed without partial output because no local Supabase database was reachable. |
| `20:38:21.1450553Z` | linked inventory v2 query plus bounded Auth/preflight launchers | 0 each | Prepared read-only paths executed. Inventory contract `2` returned 1 application schema, 5 extensions, 0 views/materialized views, 0 foreign tables, and 0 public application types. Auth returned the exact 10-key contract with 1,157 Auth metadata items and 68 global-role items. Preflight returned the exact 10-key contract with zero subscriptions, replication slots, and foreign servers. Raw output was not retained. |
| `20:38:41.9886464Z` | `supabase migration list --linked` | 0 | Returned the same eight local/remote version pairs from `20260707062202` through `20260819010835`. |
| `20:38:41Z` | `supabase db push --dry-run --linked` | 0 | `upToDate: true`; no migrations, seeds, or roles pending. Production was not changed. |
| `20:38:41Z` | exact migration evidence verifier and `git diff --exit-code 03137e8 -- supabase/migrations` | 0 each | Seven captured normalized bodies and the composite migration's exact v1 suffix matched; migration files have no fix-wave diff. |
| `20:42:49.0352549Z` | `npm test -- --run` | 0 | 26 files and 240 tests passed. |
| `20:42:49Z` | `npm run typecheck` | 0 | TypeScript completed without errors. |
| `20:42:49Z` | `npm run lint` | 0 | Completed with the same four baseline application warnings below, plus Next.js/Sentry deprecation notices. |
| `20:41Z` | high-confidence credential-value scan over every changed file | 1 | No matches; `rg` exit 1 means no credential-value pattern matched. Generic reviewed words such as `service_role`, `token`, and `secret_count` were not treated as credential values. |
| `20:41Z` | stale-claim search over tracked operations evidence | 1 | No old exact-parity, old Auth-role exclusion, old direct-preflight command, or superseded query-hash claim remained. |
| `20:41Z` | `git diff --check` | 0 | No whitespace errors. |
| `20:41Z` | production/local inventory JSON parse | 0 | Production is valid contract v2; the valid historical local JSON intentionally has no v2 contract field. |

The four baseline lint warnings are distinct from a clean lint result:

- `src/app/admin/ai-config/page.tsx:81`: missing `load` dependency.
- `src/app/admin/credit-adjustments/page.tsx:49`: missing `load` dependency.
- `src/app/admin/feature-access/page.tsx:44`: missing `load` dependency.
- `src/components/ui/FeatureGate.tsx:113`: `@next/next/no-img-element`.

## Contract changes and local proof

- `restore-source-preflight.sql` is now one read-only prepared statement. Its launcher pins Supabase CLI `2.115.0`, applies the existing 45-second deadline/process-tree termination contract, accepts only linked/local/validated project-ref targets, validates the exact metadata-only shape, and suppresses partial output.
- Schema inventory contract v2 covers application-schema state, installed extensions, public views/materialized views, foreign tables, and public types. The fresh local-v2 snapshot now matches the committed production-v2 snapshot exactly after the pending migration removes unused `pg_graphql`.
- The Auth fingerprint now includes view definitions, column ACLs, enum labels, trigger enabled state, and a password-free aggregate fingerprint of global roles, memberships, and all-database/current-database settings. Each PostgreSQL 17 membership item names and deterministically renders `admin_option`, `inherit_option`, and `set_option`. `PASS_BOUNDED` requires this evidence and stable hashes across captures.
- Auth launcher normalization reconstructs only the exact 10-key reviewed contract; extra identity/secret-like keys such as `email` and `token` are dropped.

Docker is currently available, and the full local reset, database-backed inventory tests, local Auth/preflight launchers, local inventory-v2 capture, default-grant probe, and production-v2/local-v2 comparator all ran. The local preflight's one active unclassified replication slot is expected local-stack evidence, not a clean production outbound-safety result. Production still requires the separately authorized migration checkpoint and all live restore/control gates.

## Live-control gate

| Control | Exit classification | Required checkpoint |
| --- | --- | --- |
| Completed physical backups and paid-plan eligibility | `VERIFIED` | Recheck immediately before any authorized drill. |
| PITR | `NOT ENABLED` | No PITR recovery window exists. |
| Actual source eligibility and operator-visible **Restore to a New Project** action | `BLOCKED BY ACCESS` | An authenticated Supabase Dashboard operator must inspect the selected backup and final non-sensitive configuration/cost fields, stopping before confirmation. |
| Isolated restore drill | `REQUIRES AUTHORIZATION` | The drill has not run. It requires safe fresh preflights, a five-billable-hour estimate below USD 8, explicit production-sensitive handling authorization, explicit residual-cost acceptance, validation, deletion, and settled billing evidence. |
| Supabase leaked-password protection | `NOT ENABLED` | It remains off. Enabling it requires explicit authorization followed by a fresh security-advisor check. |
| Vercel firewall/configuration/runtime linkage | `BLOCKED BY ACCESS` | Provide authenticated read-only Vercel CLI/API access or an already-open authenticated browser session. |
| Anthropic/OpenAI spend/rate limits and runtime linkage | `BLOCKED BY ACCESS` | Provide appropriate Billing/Admin read-only evidence; do not inspect or reuse runtime keys. |

## Independent exit review

The Greybeard final review produced the four Important and one Minor findings addressed by this fix wave. The complete post-fix diff has not yet received the required independent approval, and the Three AImigos council gate remains unavailable from the prior failed doctor preflight. No favorable post-fix Auditor/council verdict exists. This remains a blocker rather than an implied approval.

## Exit decision

Phase 0 remains **BLOCKED**. Do not push, merge, change `main`, or begin Phase 1. Explicitly authorize and complete the pending migration dry-run/apply/recapture checkpoint; authorize, deploy, and evidence the separate client-role grant hardening; satisfy the exact live-control/restore checkpoints; and obtain independent post-fix approval before reconsidering the gate.
