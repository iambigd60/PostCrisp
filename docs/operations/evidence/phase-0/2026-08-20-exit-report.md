# Phase 0 exit report

**Gate result:** **BLOCKED — do not push, merge, change `main`, or start Phase 1.**

**Recorded:** 2026-08-20 (America/Los_Angeles)

**Current checkpoint:** evidence refreshed through approximately 2026-08-20T22:52Z

**Branch:** `codex/phase-0-containment`

Phase 0 has closed the migration-history, object-parity, optional-extension, client-role grant, leaked-password, and reserved-role disposition gates. It has not closed the isolated restore, Vercel/provider-console, or independent council gates. The branch therefore remains fail-closed **BLOCKED**.

## Closed gates

| Gate | Result | Evidence |
| --- | --- | --- |
| Production/local migration history | `VERIFIED` | Fresh linked listing returned exactly ten paired versions through `20260820220303`. The linked `--skip-vault` dry run exited `0`, reported the remote database up to date, and performed no apply. |
| Optional `pg_graphql` drift | `VERIFIED` | The CLI-generated non-`CASCADE` removal migration is applied; production/local inventories contain five extensions and no `pg_graphql`. |
| Object parity | `VERIFIED` | Reviewed post-hardening production and fresh-reset local contract-v2 source captures each contain 325 grants and are byte-identical at SHA-256 `184BAF24BEE2823173F4C9564F01F547DA103B110BD39DF4813FEEC03AC9C9EE`. The tracked prior-key-order copies are byte-identical at `16386F28EE7F40EF2CC69FF8F83497FC246D6DB61FB5C0CF9877DDDA878E0D8F`, semantically identical to the reviewed captures, and comparator-clean. |
| Client-role grant hardening | `VERIFIED` | The applied reviewed migration removed exactly 154 grant rows: 128 current table, 12 current sequence, and 14 `postgres` defaults. Fresh metadata reports 0 forbidden current tables / 0 current sequences and 0 forbidden `postgres` table / 0 sequence defaults. No non-grant inventory section drifted. |
| Preserved application grants | `VERIFIED` | The reviewed probe checks exact grantee/schema/object/privilege tuples for table CRUD, column ACL, and function identities/signatures, rejects missing and extra tuples, and preserves intended `service_role` access. |
| HIBP leaked-password protection | `VERIFIED` | Enabled. The fresh security advisor reports exactly three `INFO` policyless-RLS items and no `WARN` or `ERROR`; the leaked-password warning is absent. |
| Source restore preflight | `VERIFIED` | At `2026-08-20T22:52:11.037108Z`: no cron catalog/jobs, no `pg_net` queue, 0 foreign servers/mappings, 0 subscriptions, 0 replication slots including unclassified, vault present with 0 secrets; only metadata helper `extensions.grant_pg_net_access()` remains while `pg_net` is absent. |
| Auth restore signature | `VERIFIED` | At `2026-08-20T22:52:15.711197Z`: exact reviewed 10-key shape, Auth schema/users relation present, uncapped aggregate, PostgreSQL 17 membership options represented; no raw identities retained. |

## Open blockers

### 1. Restore drill

The source preflight is clean, but the drill has **not executed** and no target was created. Official read-only Management API evidence shows source compute `ci_micro` at USD 0.01344/hour with gp3 8 GB, 3000 IOPS, and 125 MiB/s. The reviewed five-billable-hour plus 0.1 GB egress model totals USD 0.0762, below the USD 8 threshold.

That bounded estimate is not clone-specific Dashboard confirmation. Dashboard/browser access was unavailable, and the restore tool requires explicit organization confirmation before it exposes final cost or creates the target. Required next: verify the selected backup action and final non-sensitive cost/configuration, obtain explicit organization/user and production-sensitive-handling authorization, execute and validate the isolated restore, delete it, and retain settled billing/cleanup evidence.

### 2. Vercel and provider controls

Vercel firewall state, production environment-variable names, and secrets-free successful runtime/provider linkage remain inaccessible. Anthropic and OpenAI current spend caps, enforcement modes, allowed models, and effective rate limits also require unavailable provider Billing/Admin read-only access. No runtime key was inspected or reused.

### 3. Independent council

Three AImigos beta.16 has no valid verdict. Grok 4.6 produced malformed responses twice; Grok 4.3 failed access. Gemini 3.5 access was verified, but `doctor` remains `Unknown` because the installed adapter's `detect()` always reports unknown authentication. Model access alone is not a council/Auditor verdict.

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

This documentation task made no production call or mutation. No migration/script/application code changed; no restore, paid resource, external setting change, push, merge, or branch switch occurred.

## Historical intermediate checkpoints (superseded)

Earlier evidence on 2026-08-20 recorded eight paired migrations, then a ninth local-only `pg_graphql` migration; 479 grants; broad client privileges; HIBP disabled; transient Docker unavailability; and object parity still unverified. Those statements were accurate at their timestamps but are not current operator guidance. The current authoritative state is ten paired migrations, empty dry run, applied extension and grant migrations, 325 byte-identical grants, enabled HIBP, and verified object parity.

## Exit decision

Phase 0 remains **BLOCKED**. Do not merge this branch or begin Phase 1 until all three open blockers above are closed with fresh evidence and a valid independent exit verdict.
