# Phase 0 exit report

**Gate result:** **BLOCKED for Phase 0 exit and Phase 1; repository integration was explicitly approved on 2026-08-20.**

**Recorded:** 2026-08-20 (America/Los_Angeles)

**Current checkpoint:** evidence and correction-wave verification refreshed through approximately 2026-08-20T23:42Z

**Branch:** `codex/phase-0-containment`

**Current-status update (2026-09-29):** Dennis directed the project to close Phase 0 and start Phase 1 despite the unpassed technical exit criteria. This owner transition is recorded in [the phase-transition decision](../../2026-09-29-phase-transition.md); this report's original `BLOCKED` verdict remains the accurate result of the dated verification, not a verified pass. The council-tool requirement was retired. The approved AI routing read policy is live and merged in PR #14; an authenticated-role probe sees all 72 configured overrides, but a real non-admin generation remains unverified. Completed backups were confirmed again at 20:51 UTC, but the newest predates that migration. Dennis declined a paid restore now, so backup availability is verified while the isolated drill remains deferred and unverified. He chose to retain both OpenAI and Anthropic APIs; provider-key ownership and effective spend controls remain open. Vercel/provider-control evidence and a fresh independent exit review remain open.

Phase 0 has closed the migration-history, object-parity, optional-extension, client-role grant, leaked-password, and reserved-role disposition gates. At this dated checkpoint, it had not closed the isolated restore, Vercel/provider-console, or independent review gates. The branch therefore remained fail-closed **BLOCKED**.

## Closed gates

| Gate | Result | Evidence |
| --- | --- | --- |
| Production/local migration history | `VERIFIED` | Fresh linked listing returned exactly ten paired versions through `20260820220303`. The linked `--skip-vault` dry run exited `0`, reported the remote database up to date, and performed no apply. |
| Optional `pg_graphql` drift | `VERIFIED` | The CLI-generated non-`CASCADE` removal migration is applied; production/local inventories contain five extensions and no `pg_graphql`. |
| Object parity | `VERIFIED` | Reviewed post-hardening production and fresh-reset local contract-v2 source captures each contain 325 grants, zero application types, and are byte-identical at SHA-256 `184BAF24BEE2823173F4C9564F01F547DA103B110BD39DF4813FEEC03AC9C9EE`. The tracked copies advance only the contract marker to v3's expanded type coverage; they are byte-identical at `8D117BFF7BDE8B42896EC61DE4E4131DE716D9946D9BBD765883CF67B9D1386D` and comparator-clean. |
| Client-role grant hardening | `VERIFIED` | The applied reviewed migration removed exactly 154 grant rows: 128 current table, 12 current sequence, and 14 `postgres` defaults. Fresh metadata reports 0 forbidden current tables / 0 current sequences and 0 forbidden `postgres` table / 0 sequence defaults. No non-grant inventory section drifted. |
| Preserved application grants | `VERIFIED` | The reviewed probe checks exact grantee/schema/object/privilege tuples for table CRUD, column ACL, and function identities/signatures, rejects missing and extra tuples, and preserves intended `service_role` access. |
| HIBP leaked-password protection | `VERIFIED` | Enabled. The fresh security advisor reports exactly three `INFO` policyless-RLS items and no `WARN` or `ERROR`; the leaked-password warning is absent. |
| Source restore preflight | `VERIFIED` | At `2026-08-20T22:52:11.037108Z`: no cron catalog/jobs, no `pg_net` queue, 0 foreign servers/mappings, 0 subscriptions, 0 replication slots including unclassified, vault present with 0 secrets; only metadata helper `extensions.grant_pg_net_access()` remains while `pg_net` is absent. |
| Auth restore signature | `VERIFIED` | At `2026-08-20T22:52:15.711197Z`: exact reviewed 10-key shape, Auth schema/users relation present, uncapped aggregate, PostgreSQL 17 membership options represented; no raw identities retained. |

## Whole-branch review correction

Greybeard review of `0664934` found three Important repository defects and one Minor comparator defect. The correction wave:

- refreshed the canonical reconciliation guide and migration README to the ten-pair applied state and corrected historical version labels;
- deprecated `src/lib/supabase-schema.sql` as a non-operational snapshot, making paired migrations the only supported bootstrap path;
- replaced the invalid inline restore aggregate with a committed one-statement query, bounded credential-free launcher, strict output allowlist, hash-bound three-capture comparator, and RED/GREEN tests;
- restored order-sensitive enum/composite comparison, added composite/range/base type metadata, and advanced the inventory contract to v3; and
- restored this tracked command/exit ledger.

The correction wave changed no migration SQL and made no production mutation. It used only fresh local rebuilds and read-only linked inventory/lineage/dry-run queries.

Exact-head whole-branch re-review of correction commit `f53485cb38bf9a85799928f1326e60f55e5b992a` returned `APPROVED`: no Critical, Important, or Minor findings. The reviewer independently verified all four corrections and retained the three external blockers below.

## Exact candidate verification

The complete candidate tree was verified sequentially on 2026-08-20 between approximately `23:34Z` and `23:42Z`:

| Command / check | Exit | Result |
| --- | ---: | --- |
| `supabase db reset --local` | 0 | Fresh rebuild applied all ten migrations through `20260820220303`. |
| `supabase db query --local --file scripts/phase0/probe-client-role-grants.sql --output-format json` | 0 | Returned `DO`; exact current/preserved client and service-role tuples passed. |
| `supabase db query --local --file scripts/phase0/probe-default-grants.sql --output-format json` | 0 | Returned `DO`; customer-owned default-grant contract passed. |
| `node scripts/phase0/capture-application-restore-aggregates.mjs --local` | 0 | Exact five-relation, `100001`-cap output; all fresh-reset counts were zero. |
| `node --test scripts/phase0/*.test.mjs` | 0 | 69 passed, 1 intentionally skipped, 0 failed. The skip requires explicit `PHASE0_PG17_CONTAINER`; that PostgreSQL 17 mutation case passed in the earlier isolated membership-option gate. |
| `npm test -- --run` | 0 | 26 files, 240/240 tests passed. |
| `npm run typecheck` | 0 | TypeScript completed without errors. |
| `npm run lint` | 0 | Completed with the four baseline warnings: three hook-dependency warnings and one `no-img-element` warning. |
| Fresh contract-v3 linked/local inventory capture | 0 | Production and local matched after parse: 18 tables, 0 application types, 325 grants. Fresh local also matched the tracked v3 artifact through the repository comparator. |
| `supabase migration list --linked` | 0 | Exactly ten paired versions through `20260820220303`. |
| `supabase db push --dry-run --linked --skip-vault` | 0 | `upToDate: true`; no migrations, seeds, or roles. No apply occurred. |
| Tracked inventory comparator | 0 | Production/local tracked v3 artifacts match; both SHA-256 `8D117BFF7BDE8B42896EC61DE4E4131DE716D9946D9BBD765883CF67B9D1386D`. |
| High-confidence secret scan of all 20 intended changed/new paths | 0 | No hit files and no scan errors. |
| Current stale-claim scan | 0 | No current operator surface says either forward migration/HIBP/grant hardening is pending, references nonexistent `public.purchased_credits`, or instructs operators to run the deprecated schema snapshot. |
| `git diff --check` | 0 | No whitespace errors. |
| Post-commit tracked/untracked status | 0 | Clean: no tracked modification and no untracked non-ignored path remained after the bounded correction commit. |

## Open blockers

### 1. Restore drill

The source preflight is clean, but the drill has **not executed** and no target was created. Official read-only Management API evidence shows source compute `ci_micro` at USD 0.01344/hour with gp3 8 GB, 3000 IOPS, and 125 MiB/s. The reviewed five-billable-hour plus 0.1 GB egress model totals USD 0.0762, below the USD 8 threshold.

That bounded estimate is not clone-specific Dashboard confirmation. Dashboard/browser access was unavailable, and the restore tool requires explicit organization confirmation before it exposes final cost or creates the target. Required next: verify the selected backup action and final non-sensitive cost/configuration, obtain explicit organization/user and production-sensitive-handling authorization, execute and validate the isolated restore, delete it, and retain settled billing/cleanup evidence.

### 2. Vercel and provider controls

Vercel firewall state, production environment-variable names, and secrets-free successful runtime/provider linkage remain inaccessible. Anthropic and OpenAI current spend caps, enforcement modes, allowed models, and effective rate limits also require unavailable provider Billing/Admin read-only access. No runtime key was inspected or reused.

### Historical council-tool attempt — retired

The 2026-08-20 attempts produced no valid verdict. This tool is no longer used and its verdict is not required for Phase 0. A fresh independent exit review of the final evidence and current repository state remains required after the operational blockers close.

## Current security-advisor result

Exactly three `INFO` findings remain, all `rls_enabled_no_policy`:

- `public.onboarding_events`
- `public.processed_stripe_events`
- `public.tutorial_redemptions`

There are no current `WARN` or `ERROR` findings. These three observations are follow-up items, not a waiver of the open Phase 0 gates.

## Accepted informational residual

`supabase_admin` retains exactly 8 table-default plus 6 sequence-default rows. Independent review accepts this platform-owned conditional residual as non-blocking: official guidance identifies the reserved role as internal automation/upgrade infrastructure, it cannot authenticate through the Data API, current forbidden objects and customer-owned `postgres` defaults are zero, and connected non-superuser `postgres` has neither `USAGE` nor `SET` on it. Reopen the finding if platform automation actually creates a public table/sequence as `supabase_admin` or an official customer remediation path emerges.

## Safety and provenance

The production/local inventory artifacts were refreshed from the reviewed ignored post-hardening captures:

- production source: `.superpowers/sdd/2026-08-20-phase-0-containment/post-hardening-production-inventory.json`;
- local source: `.superpowers/sdd/2026-08-20-phase-0-containment/grant-hardening-fix-local-inventory.json`.

This correction wave made read-only linked queries but no production mutation. No migration or application code changed; no restore, paid resource, external setting change, push, merge, or branch switch occurred.

## Historical intermediate checkpoints (superseded)

Earlier evidence on 2026-08-20 recorded eight paired migrations, then a ninth local-only `pg_graphql` migration; 479 grants; broad client privileges; HIBP disabled; transient Docker unavailability; and object parity still unverified. Those statements were accurate at their timestamps but are not current operator guidance. The current authoritative state is ten paired migrations, empty dry run, applied extension and grant migrations, 325 byte-identical grants, enabled HIBP, and verified object parity.

## Exit decision

At the 2026-08-20 verification checkpoint, Phase 0 remained **BLOCKED** and the plan prohibited Phase 1 until the restore and platform-control blockers closed with fresh evidence and an independent exit review. On 2026-09-29 the owner explicitly directed the project to proceed to Phase 1. The outstanding checks remain unverified work; the owner decision changes sequencing but does not turn this report into a passing technical verdict. See [the owner transition record](../../2026-09-29-phase-transition.md).
