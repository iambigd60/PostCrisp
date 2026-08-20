# Production-to-local public schema parity

**Recorded:** 2026-08-20 (America/Los_Angeles)

**Current checkpoint:** 2026-08-20T23:42Z

**Production project:** `sikabeqzypvllimyostg`

**Verdict:** **VERIFIED — tracked post-hardening production and fresh-reset local inventory-v3 artifacts are byte-identical. Phase 0 remains BLOCKED on separate restore, platform-access, and council gates.**

## Current authoritative result

The tracked artifacts derive from the reviewed post-hardening captures:

- [production inventory](2026-08-20-production-schema-inventory.json), refreshed from ignored capture `.superpowers/sdd/2026-08-20-phase-0-containment/post-hardening-production-inventory.json`;
- [local inventory](2026-08-20-local-schema-inventory.json), refreshed from ignored capture `.superpowers/sdd/2026-08-20-phase-0-containment/grant-hardening-fix-local-inventory.json`.

The two reviewed source captures remain byte-identical contract-v2 evidence at SHA-256 `184BAF24BEE2823173F4C9564F01F547DA103B110BD39DF4813FEEC03AC9C9EE`. Both contain zero application types. The tracked copies preserve their catalog content and key order while advancing only the contract marker to v3, whose added enum/composite/range/base-type coverage is therefore vacuous for this checkpoint. The two tracked files are byte-identical at SHA-256 `8D117BFF7BDE8B42896EC61DE4E4131DE716D9946D9BBD765883CF67B9D1386D`, and the contract-v3 comparator exits `0` with `Schema inventories match.` Their shared counts are:

| Category | Count |
| --- | ---: |
| Application schemas | 1 |
| Installed extensions | 5 |
| Public views/materialized views/foreign tables/application types | 0 each |
| Tables | 18 |
| Columns | 147 |
| Constraints | 58 |
| Sequences | 2 |
| Indexes | 42 |
| Policies | 39 |
| Functions/procedures | 4 |
| Triggers | 6 |
| Grants, including creator-correlated default grants | 325 |

At approximately `2026-08-20T22:52Z`, the linked migration list returned exactly ten paired local/remote versions through `20260820220303`, and the linked `--skip-vault` dry run exited `0` with the remote database up to date. There is no pending migration, seed, or role work.

## Grant-hardening result

The authorized `20260820220303_harden_client_role_grants.sql` apply removed exactly 154 semantic grant rows relative to the reviewed pre-hardening capture:

- 128 current-table grants;
- 12 current-sequence grants;
- 14 `postgres` public-schema default grants.

No non-grant inventory section drifted. Fresh metadata-only production verification reports zero forbidden current table grants, zero forbidden current sequence grants, and zero forbidden `postgres` table/sequence defaults for `anon` and `authenticated`. The exact client-role probe separately preserves and checks intended table CRUD, column ACL, schema/function identity, and `service_role` tuples while rejecting missing or extra tuples.

The remaining reserved-role default ACLs are not hidden by the aggregate inventory result: `supabase_admin` still contributes exactly 8 table-default rows and 6 sequence-default rows for the two client roles. The connected SQL session is non-superuser `postgres` and has neither `USAGE` nor `SET` authorization on `supabase_admin`. Independent review accepts this as an Informational platform-owned conditional residual, not a blocker: official guidance treats the reserved role as internal automation/upgrade infrastructure, it cannot authenticate through the Data API, current forbidden objects and customer-owned `postgres` defaults are zero, and documented customer remediation is `postgres`-only. Reopen if a reserved-role-created public table/sequence appears or official customer remediation emerges.

## Security-advisor state

HIBP leaked-password protection is enabled. A fresh Supabase security-advisor refresh reports exactly three `INFO` findings and no `WARN` or `ERROR` findings:

- `rls_enabled_no_policy` on `public.onboarding_events`;
- `rls_enabled_no_policy` on `public.processed_stripe_events`;
- `rls_enabled_no_policy` on `public.tutorial_redemptions`.

These policyless-RLS items are recorded follow-up observations, not production/local parity differences.

## Inventory contract and safety

The committed [catalog query](../../../../scripts/phase0/schema-inventory.sql) reads PostgreSQL catalogs only. Contract v3 records stable metadata for public relations, columns, constraints, sequences, indexes, policies, routines, triggers, types, extensions, and schema/object/default grants. Type coverage preserves enum-label and composite-attribute order and includes behavior-defining range/base-type fields. It excludes application rows, sequence values, secrets, OIDs, owners/grantors, raw connection information, and foreign option values. Creator identities are represented only through normalized ACL-set fingerprints.

The comparator canonicalizes object-key order, unordered catalog collections, line endings, and explicitly ignored capture noise while preserving order for `types[].enum_labels` and `types[].composite_attributes`. It requires contract version `3` and every required section; invalid/partial snapshots exit `2`, and valid inventories with missing, extra, or changed objects exit `1` with exact fields.

No linked reset, remote DDL, restore, or production mutation was performed while refreshing this documentation. The two production mutations described here occurred earlier at separately authorized checkpoints and were independently verified.

## Historical reconstruction notes (superseded)

Before the two forward migrations were applied, the clean-room work reconstructed the original eight production migrations, fixed column ordinals and legacy Data API grants, and exposed one remaining local-only `pg_graphql` difference. A CLI-generated ninth migration dropped unused `pg_graphql` without `CASCADE`, first locally and then at an authorized production checkpoint. A tenth migration later hardened client-role grants.

The earlier 479-grant, eight-versus-nine-migration, local-only migration, leaked-password-disabled, Docker-unavailable, and object-parity-unverified statements described intermediate checkpoints. They are superseded by the current 325-grant, ten-pair, byte-identical evidence above and must not be used as current operator guidance.
