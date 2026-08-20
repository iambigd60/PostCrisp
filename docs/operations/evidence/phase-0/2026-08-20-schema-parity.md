# Production-to-local public schema parity

**Recorded:** 2026-08-20 (America/Los_Angeles)

**Production project:** `sikabeqzypvllimyostg`

**Production access:** read-only catalog query through `supabase db query --linked`

**Local source:** a fresh `supabase db reset --local` using Supabase CLI `2.115.0`

**Verdict:** **exact parity for the captured scope**

## Scope and exclusions

The committed [catalog query](../../../../scripts/phase0/schema-inventory.sql) records stable metadata for:

- public tables and their RLS/replica-identity flags;
- columns, constraints, sequences (including `OWNED BY` targets), and indexes;
- RLS policies, public-schema functions/procedures, and user-defined triggers on public tables or invoking public application functions;
- schema, table, column, sequence, function, procedure, and public-schema default grants.

The query reads only PostgreSQL catalogs. It excludes table rows, sequence current values, secrets, OIDs, owners/grantors, capture timestamps, and raw connection information. Default grants retain creator-to-ACL correlation through deterministic ACL-set fingerprints without exposing creator identities. Duplicate identities remain separate entries, and the comparator checks their multiplicity.

## Capture and comparison

The production and local files were captured from the same `SELECT` and contain only the returned `inventory` object:

- [production inventory](2026-08-20-production-schema-inventory.json)
- [local inventory](2026-08-20-local-schema-inventory.json)

Each inventory contains the same counts:

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

The dependency-free Node comparator canonicalizes object-key/array order, line endings, and explicitly ignored capture noise (`captured_at`, `generated_at`, `oid`, and `owner`). It exits nonzero and prints exact missing, extra, or changed fields for all other differences.

Default-grant behavior is verified separately from the fast Node suite because it requires a running fresh local stack:

```text
supabase db query --local --file scripts/phase0/probe-default-grants.sql --output-format json
```

The probe is one atomic `DO` statement. It creates controlled `postgres` and no-default-creator objects, compares actual ACLs with the captured defaults, raises on any mismatch, and removes every probe object and role on success. A raised assertion rolls the statement back and returns a nonzero CLI exit.

Final command and result:

```text
node scripts/phase0/compare-schema-inventory.mjs docs/operations/evidence/phase-0/2026-08-20-production-schema-inventory.json docs/operations/evidence/phase-0/2026-08-20-local-schema-inventory.json
Schema inventories match.
EXIT 0
```

## Differences found and reconciled locally

The first fresh-reset comparison failed with two concrete reconstruction defects:

1. Twenty-one column ordinal differences: 14 in `public.profiles` and 7 in `public.saved_content`. The composite baseline's clean-room definitions used the repository's convenient declaration order instead of the order present in production.
2. One hundred sixty-three missing explicit object grants across `anon`, `authenticated`, and `service_role`. The local stack used the new non-auto-exposed default while production retains the legacy Data API grant behavior.

The clean-room representation was corrected without changing production:

- The composite baseline now declares `profiles` and its hoisted `saved_content` prerequisite in production column order. `purchased_credits` is again added by its exact production-timestamp migration, placing it at ordinal 18.
- The composite bootstrap explicitly reproduces the captured `postgres` default ACLs before application DDL; the deprecated global `api.auto_expose_new_tables` compatibility toggle is not enabled. Supabase seeds the reserved `supabase_admin` creator defaults before migrations, and the inventory correlates that second creator by its normalized ACL-set fingerprint because the non-superuser migration role cannot safely impersonate or alter it.

After a fresh `supabase db reset --local`, all 479 captured grants and every other captured object matched byte-for-byte at SHA-256 `138c91b56e1d7e21101bc232f09c071459c4e52603ff6147f15a09f2221c6d8b`. A local future-object probe proved that `postgres`-created tables, sequences, and functions receive exactly its captured default ACL set, while a newly created role with no captured defaults receives no legacy Data API grants. The reserved `supabase_admin` creator could not be safely impersonated, so its production/local correlation is proved through matching creator ACL fingerprints instead. The seven non-composite migration files still hash-match their exact production statements, and the composite migration still ends with the exact production v1 statement.

The broad default ACLs remain a security risk because they are current production state. Hardening them requires an authorized production migration; Task 3 proves parity and does not claim remediation.

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
