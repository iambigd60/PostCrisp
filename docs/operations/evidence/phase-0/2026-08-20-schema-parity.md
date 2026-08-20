# Production-to-local public schema parity

**Recorded:** 2026-08-20 (America/Los_Angeles)

**Production project:** `sikabeqzypvllimyostg`

**Production access:** read-only catalog query through `supabase db query --linked`

**Local source:** a fresh `supabase db reset --local` using Supabase CLI `2.115.0`

**Verdict:** **BLOCKED — the historical v1 captured scope matched, but inventory contract v2 has no fresh local capture. Docker is now available for an isolated PostgreSQL 17 regression; the full local Supabase reset/capture was not rerun in that membership-only task.**

## Scope and exclusions

Inventory contract v2 in the committed [catalog query](../../../../scripts/phase0/schema-inventory.sql) records stable metadata for:

- the `public` application-schema record and installed extension name/version/schema/relocatability state;
- public tables, views, materialized views, foreign tables, and their relevant definition/state metadata;
- columns across those relations, constraints, sequences (including `OWNED BY` targets), indexes, and public enum/domain/range/composite/base type definitions;
- RLS policies, public-schema functions/procedures, and user-defined triggers on public tables or invoking public application functions;
- schema, table, column, sequence, function, procedure, and public-schema default grants.

The query reads only PostgreSQL catalogs. It excludes table rows, sequence current values, secrets, OIDs, owners/grantors, capture timestamps, raw connection information, and foreign table/server option values. For foreign tables it records only whether table/column options exist; any positive option-presence flag is a separate transient-review blocker because retaining option values could expose secrets. Default grants retain creator-to-ACL correlation through deterministic ACL-set fingerprints without exposing creator identities. Duplicate identities remain separate entries, and the comparator checks their multiplicity.

## Capture and comparison

The production file was refreshed read-only from inventory contract v2. The local file remains the earlier v1 capture. Docker Desktop's Linux engine was unavailable during the prior Task 5 attempt; it was available later for an isolated PostgreSQL 17 membership-fingerprint regression, but that narrow task did not rerun the full local Supabase reset/capture:

- [production inventory](2026-08-20-production-schema-inventory.json)
- [local inventory](2026-08-20-local-schema-inventory.json)

The v2 production capture completed on 2026-08-20 with contract version `2`: one `public` application schema, five installed extensions, zero public views/materialized views, zero public foreign tables, and zero public application types. The historical v1 production/local captures had matching counts for the previously covered classes:

| Category | Count |
| --- | ---: |
| Tables | 18 |
| Columns | 147 |
| Constraints | 58 |
| Sequences | 2 |
| Indexes | 42 |
| Policies | 39 |
| Functions/procedures | 4 |
| Triggers | 6 |
| Grants, including creator-correlated default grants | 479 |

The dependency-free Node comparator canonicalizes object-key/array order, line endings, and explicitly ignored capture noise (`captured_at`, `generated_at`, `oid`, and `owner`). It now requires contract version `2` and every required section before comparison. An old or partial snapshot exits `2` instead of producing a false match; missing, extra, or changed objects in valid v2 inventories exit `1` with exact fields.

Default-grant behavior is verified separately from the fast Node suite because it requires a running fresh local stack:

```text
supabase db query --local --file scripts/phase0/probe-default-grants.sql --output-format json
```

The probe is one atomic `DO` statement. It creates controlled `postgres` and no-default-creator objects, compares actual ACLs with the captured defaults, raises on any mismatch, and removes every probe object and role on success. A raised assertion rolls the statement back and returns a nonzero CLI exit.

Current command and result:

```text
node scripts/phase0/compare-schema-inventory.mjs docs/operations/evidence/phase-0/2026-08-20-production-schema-inventory.json docs/operations/evidence/phase-0/2026-08-20-local-schema-inventory.json
Schema inventory contract invalid: local inventory_contract_version must equal 2
EXIT 2
```

This is a Phase 0 exit blocker. With Docker available, run `supabase db reset --local` as its own later gate, capture inventory v2 with the committed query, require every foreign-option-presence flag to be false or complete a separately authorized secrets-safe transient review, and rerun the comparator. Do not describe the isolated PostgreSQL 17 regression or historical v1 match as current exact schema parity.

## Differences found and reconciled locally

The first fresh-reset comparison failed with two concrete reconstruction defects:

1. Twenty-one column ordinal differences: 14 in `public.profiles` and 7 in `public.saved_content`. The composite baseline's clean-room definitions used the repository's convenient declaration order instead of the order present in production.
2. One hundred sixty-three missing explicit object grants across `anon`, `authenticated`, and `service_role`. The local stack used the new non-auto-exposed default while production retains the legacy Data API grant behavior.

The clean-room representation was corrected without changing production:

- The composite baseline now declares `profiles` and its hoisted `saved_content` prerequisite in production column order. `purchased_credits` is again added by its exact production-timestamp migration, placing it at ordinal 18.
- The composite bootstrap explicitly reproduces the captured `postgres` default ACLs before application DDL; the deprecated global `api.auto_expose_new_tables` compatibility toggle is not enabled. Supabase seeds the reserved `supabase_admin` creator defaults before migrations, and the inventory correlates that second creator by its normalized ACL-set fingerprint because the non-superuser migration role cannot safely impersonate or alter it.

Historically, after a fresh `supabase db reset --local`, all 479 captured grants and every other v1-captured object matched byte-for-byte at SHA-256 `138c91b56e1d7e21101bc232f09c071459c4e52603ff6147f15a09f2221c6d8b`. A local future-object probe proved that `postgres`-created tables, sequences, and functions receive exactly its captured default ACL set, while a newly created role with no captured defaults receives no legacy Data API grants. The reserved `supabase_admin` creator could not be safely impersonated, so its production/local correlation was proved through matching creator ACL fingerprints instead. That historical result remains useful evidence but is not v2 completion proof. The seven non-composite migration files still hash-match their exact production statements, and the composite migration still ends with the exact production v1 statement.

## Production security blocker: client-role blast radius

The captured production grants are a Phase 0 security blocker, not a benign parity note. `anon` and `authenticated` retain `TRUNCATE`, `REFERENCES`, `TRIGGER`, and `MAINTAIN` on 16 current public tables and through captured default table ACLs. Both client roles also retain `USAGE`, `SELECT`, and `UPDATE` on the two application sequences; those sequence privileges should be service-only. RLS does not neutralize all of these privileges or their blast radius.

Historical fidelity is preserved in the eight applied migration bodies, and this branch intentionally adds no pending migration. Separately authorized forward-hardening work must add and deploy a new production migration that revokes those high-blast-radius table/default privileges from `anon`/`authenticated`, revokes their application-sequence/default-sequence privileges while retaining required `service_role` access, validates application behavior, and captures fresh production advisors/grants. Phase 0 must remain blocked until that production change is authorized, executed, and evidenced.

## Production advisors

Supabase security and performance advisors were run read-only after parity was established. No advisor finding was changed in Task 3 because doing so would expand scope and require a production schema or platform change.

Security advisor: 4 findings.

- `WARN`: leaked-password protection is disabled. This is a platform-control blocker for a later authorized task. [Remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- `INFO` x3: RLS is enabled with no policies on `public.onboarding_events`, `public.processed_stripe_events`, and `public.tutorial_redemptions`. Client CRUD is denied on these tables in the current design; the finding is recorded, not waived from schema comparison. [Advisor description](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)

Performance advisor: 89 findings.

- `WARN` x39: `auth_rls_initplan` across 15 public tables.
- `WARN` x30: multiple permissive policies across `ai_config_overrides`, `creator_profiles`, `credit_transactions`, `feature_access`, and `generations`.
- `INFO` x10: unindexed foreign keys across 8 public tables.
- `INFO` x9: unused indexes across 8 public tables.
- `INFO` x1: Auth uses an absolute rather than percentage-based database connection allocation.

These findings remain follow-up work. They do not create a production/local parity difference because both inventories capture the current production definitions exactly.

## Safety record

- Production received catalog `SELECT` queries and advisor reads only.
- No database push, migration repair, linked reset, remote DDL, restore, firewall mutation, push, or merge was performed.
- The committed JSON contains catalog metadata only; it contains no rows, credentials, tokens, connection strings, or local stack state.
