# Production-to-local public schema parity

**Recorded:** 2026-08-20 (America/Los_Angeles)

**Production project:** `sikabeqzypvllimyostg`

**Production access:** read-only catalog query through `supabase db query --linked`

**Local source:** a fresh `supabase db reset --local` using Supabase CLI `2.115.0`

**Verdict:** **exact parity for the captured scope**

## Scope and exclusions

The committed [catalog query](../../../../scripts/phase0/schema-inventory.sql) records stable metadata for:

- public tables and their RLS/replica-identity flags;
- columns, constraints, sequences, and indexes;
- RLS policies, public-schema functions/procedures, and user-defined triggers;
- schema, table, column, sequence, function, procedure, and public-schema default grants.

The query reads only PostgreSQL catalogs. It excludes table rows, sequence current values, secrets, OIDs, owners/grantors, capture timestamps, and raw connection information. Default grants are grouped without exposing their owning roles; `source_count` preserves multiplicity when otherwise-identical owner-specific ACL rows exist.

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
| Triggers | 5 |
| Grants, including grouped default grants | 443 |

The dependency-free Node comparator canonicalizes object-key/array order, line endings, and explicitly ignored capture noise (`captured_at`, `generated_at`, `oid`, and `owner`). It exits nonzero and prints exact missing, extra, or changed fields for all other differences.

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
- `api.auto_expose_new_tables = true` reproduces production's existing legacy object and default grants during a blank local rebuild. This is a parity setting, not a recommendation to broaden production access. It should be removed only with an authorized migration that deliberately changes production grants.

After a second fresh `supabase db reset --local`, all 443 captured grants and every other captured object matched. The seven non-composite migration files still hash-match their exact production statements, and the composite migration still ends with the exact production v1 statement.

## Production advisors

Supabase security and performance advisors were run read-only after parity was established. No advisor finding was changed in Task 3 because doing so would expand scope and require a production schema or platform change.

Security advisor: 4 findings.

- `WARN`: leaked-password protection is disabled. This is a platform-control blocker for a later authorized task. [Remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- `INFO` x3: RLS is enabled with no policies on `public.onboarding_events`, `public.processed_stripe_events`, and `public.tutorial_redemptions`. These are intentionally service-role-only tables in the current design; the finding is recorded, not waived from schema comparison. [Advisor description](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)

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
