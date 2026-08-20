# Production migration-history evidence

**Initial capture:** 2026-08-20
**Current checkpoint:** 2026-08-20T22:52Z
**Project:** `sikabeqzypvllimyostg` (`postcrisp`, `us-east-2`)
**Current status:** **VERIFIED — all ten local/production versions pair through `20260820220303`, and the linked `--skip-vault` dry run reports the remote database up to date with no pending migration, seed, or role work.**

The first eight normalized bodies below are the historical clean-room capture that established lineage. The two later forward migrations were CLI-generated, independently reviewed, authorized, applied, and post-verified. No application rows were queried or recorded for this evidence.

## Exact extraction and reproduction method

This secrets-free query was executed against production. It joins each stored statement array with LF, normalizes CRLF/CR to LF, hashes the normalized UTF-8 bytes with SHA-256, and returns the same bytes as base64:

```sql
with history as (
  select
    version,
    name,
    regexp_replace(
      array_to_string(statements, E'\n'),
      E'\r\n?',
      E'\n',
      'g'
    ) as normalized_sql
  from supabase_migrations.schema_migrations
)
select
  version,
  name,
  octet_length(convert_to(normalized_sql, 'UTF8')) as normalized_utf8_bytes,
  encode(
    extensions.digest(convert_to(normalized_sql, 'UTF8'), 'sha256'),
    'hex'
  ) as normalized_sha256,
  encode(convert_to(normalized_sql, 'UTF8'), 'base64') as normalized_sql_base64
from history
order by version;
```

The complete normalized bodies are preserved in [the exact statement artifact](2026-08-20-production-migration-statements.json). Each `normalized_sql_base64` value decodes directly to the normalized UTF-8 statement bytes; the JSON records the byte length and SHA-256 needed to verify the decode. Production stored one statement-array element for each of these eight versions, so the LF join did not add a separator in this capture.

For comparison with editor-created local files, normalize CRLF/CR to LF and remove at most one terminal LF before hashing; do not otherwise trim whitespace. That terminal-LF rule avoids treating an editor-added end-of-file newline as a SQL-body difference while retaining every other byte.

## Initial eight production versions and hashes (historical lineage capture)

| Order | Production version | Production name | UTF-8 bytes | Normalized SHA-256 |
| ---: | --- | --- | ---: | --- |
| 1 | `20260707062202` | `protect_privileged_profile_columns_v1` | 1,236 | `860ab63f91b809daee891494ab4ec72d0cfec977042bfcd03cf5d708d82a2fc9` |
| 2 | `20260707062213` | `processed_stripe_events` | 315 | `d7c53aa46615b8bd106e80ed21e25bf1ab3202d309bf75d4129a7c92cba67929` |
| 3 | `20260724124907` | `prelaunch_security_hardening` | 4,601 | `0b4d90ea1df93a8bd19344999d5162622a4e9a5924e289f82b177531ddce7cb9` |
| 4 | `20260724134848` | `profiles_insert_lockdown` | 2,113 | `b4169216759dc75dca33372b81ee4784f9f1622b52d9538cc0cc9f387230b311` |
| 5 | `20260724163923` | `service_role_table_grant_lockdown` | 923 | `fb2705f78bf3db7a6214d5e75dc94ac1516f5daec51d94d12a75d5ccd04e8527` |
| 6 | `20260724215224` | `purchased_credits_bucket` | 4,784 | `5ccc59a7e6667165a8b212ef608c525107bf7ac5c6bf12fd268b17ce8ea0c654` |
| 7 | `20260819010825` | `tutorial_redemptions` | 1,019 | `80a8b9b7c491a3afa269830cd441f8119f939ea1aa16e514bb4e52ff67695078` |
| 8 | `20260819010835` | `onboarding_events` | 810 | `922a3aa9b08e07f0136d96b33d64718f75554c33110914cad843d36772381c5d` |

## Applied forward migrations

The earlier eight-versus-nine state is superseded. Authorized production checkpoints applied both reviewed forward migrations, and the fresh `2026-08-20T22:52Z` read-only refresh returned exactly ten paired versions plus an empty linked dry run.

### `20260820210852_disable_unused_pg_graphql.sql`

`supabase migration new disable_unused_pg_graphql` created `20260820210852_disable_unused_pg_graphql.sql`. Its complete body is:

```sql
drop extension if exists pg_graphql;
```

The file SHA-256 is `096E40E05B747EB141D1EECA8324C6BA5A7A0300AD728B943671B6ECD1E02D89`. It is idempotent and intentionally omits `CASCADE`. A fresh local reset before the migration reproduced exactly one inventory-v2 difference, `extra in local: extensions graphql.pg_graphql`; the post-migration reset and fresh local capture compared equal to the committed production-v2 inventory.

The authorized apply exited `0`. Post-apply evidence showed nine paired versions, an empty linked dry run, five installed extensions with no `pg_graphql`, and exact production/local inventory-v2 parity.

### `20260820220303_harden_client_role_grants.sql`

The independently reviewed migration contains only the four scoped current/default table/sequence revocations. Its SHA-256 is `E85FA2BA48C722B6B6E53CF83442AF6F6671E5853634C7396907459409972EED`.

The authorized linked dry run named only this migration with empty seed and role lists; the apply exited `0`. Post-apply evidence proved:

- zero forbidden `anon`/`authenticated` grants on current application tables and sequences;
- zero forbidden client grants in `postgres` public-schema table/sequence defaults;
- exact preservation of intended table CRUD, column ACL, function/schema, and `service_role` grants;
- exactly 154 semantic grant removals: 128 current-table, 12 current-sequence, and 14 `postgres` default grants;
- zero non-grant inventory drift.

The reserved `supabase_admin` creator remains outside the migration role's authority and still has 8 table-default plus 6 sequence-default rows for the two client roles. Connected SQL runs as non-superuser `postgres`, which has neither `USAGE` nor `SET` authorization on `supabase_admin`. Independent review accepts this as an Informational platform-owned conditional residual, not a pending migration or blocker: the reserved role cannot authenticate through the Data API, current forbidden objects and customer-owned `postgres` defaults are zero, and documented customer remediation is `postgres`-only. Reopen if platform automation actually creates a public table/sequence as `supabase_admin` or an official customer remediation path emerges.

### Current linked state

At approximately `2026-08-20T22:52Z`, `supabase migration list --linked` returned exactly ten paired local/remote versions through `20260820220303`. `supabase db push --dry-run --linked --skip-vault --output json` exited `0` and reported the remote database up to date. No apply occurred during that refresh.

## Historical pre-reconciliation local-to-production timestamp map (superseded)

The table below records the pre-Phase-0 repository state. Those filenames and mismatched versions were replaced during reconciliation; they are retained only to explain why the clean-room lineage work was necessary. They are not current operator guidance.

| Current local version | Production version | Migration name | Local normalized SHA-256 | Exact match |
| --- | --- | --- | --- | --- |
| `20260706093000` | `20260707062213` | `processed_stripe_events` | `d7c53aa46615b8bd106e80ed21e25bf1ab3202d309bf75d4129a7c92cba67929` | Yes |
| `20260723120000` | `20260724124907` | `prelaunch_security_hardening` | `e8491ca27e8f476084c642d2dd104f22a1c6d50b22322bac4f6a1283ae455985` | No |
| `20260724130000` | `20260724134848` | `profiles_insert_lockdown` | `66a829d7c9d817f4de21205236f61717bede6b35d7efdd007c89309d4780c8db` | No |
| `20260724140000` | `20260724163923` | `service_role_table_grant_lockdown` | `2527768d7347428470884517beefeebf146939ea8eff76cf95b9677ec0d0efd8` | No |
| `20260724150000` | `20260724215224` | `purchased_credits_bucket` | `5ccc59a7e6667165a8b212ef608c525107bf7ac5c6bf12fd268b17ce8ea0c654` | Yes |
| `20260818120000` | `20260819010825` | `tutorial_redemptions` | `02265005ec34810df2e5076f7211991fe972315be11c4fab3dc7c7be9acf1e02` | No |
| `20260818121000` | `20260819010835` | `onboarding_events` | `81c85be05d392bfff3b0cefbf6852d50c56bcdb7480ce893144a0264787ad0a8` | No |

Historically, the prelaunch, profiles-insert, tutorial-redemptions, and onboarding-events differences were comments/formatting only. The service-role grant file had a material DDL difference. Phase 0 resolved these differences by preserving the exact production bodies under their production versions and isolating later hardening in forward migrations.

At the time of this historical capture there was no local file for production version `20260707062202`. The current composite clean-room file now occupies that exact version.

## Exact production SQL: `20260707062202_protect_privileged_profile_columns_v1`

The following is the single statement stored in production migration history, preserved verbatim:

```sql
-- Blocks end-user roles from modifying privileged billing/identity columns on
-- their own profile row. Service-role and postgres callers pass through.
-- v1 scope deliberately EXCLUDES credits_balance / credits_reset_at: the app
-- still writes those through user-session clients until sprint Task 3 lands
-- (Task 4 then extends this function to cover them).
CREATE OR REPLACE FUNCTION public.protect_privileged_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF NEW.role                      IS DISTINCT FROM OLD.role
       OR NEW.subscription_tier      IS DISTINCT FROM OLD.subscription_tier
       OR NEW.stripe_customer_id     IS DISTINCT FROM OLD.stripe_customer_id
       OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
    THEN
      RAISE EXCEPTION 'Modifying role, tier, or billing identifiers is not permitted.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_privileged_profile_columns ON public.profiles;
CREATE TRIGGER protect_privileged_profile_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_privileged_profile_columns();
```

This historical statement assumes `public.profiles` already exists. It is evidence, not by itself a clean-room baseline.
