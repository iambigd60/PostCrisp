# Production migration-history evidence

**Captured:** 2026-08-20
**Project:** `sikabeqzypvllimyostg` (`postcrisp`, `us-east-2`)
**Method:** authenticated read-only migration listing plus the read-only query below against `supabase_migrations.schema_migrations`. No application rows were queried or recorded.

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

## Recorded production versions and hashes

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

## Pending local migration: unused GraphQL extension

The read-only linked migration list at `2026-08-20T21:12Z` still showed the eight production versions above and local version `20260820210852` with no remote version. A current linked `db push --dry-run` then exited `0` with `upToDate=false`, `dryRun=true`, exactly `20260820210852_disable_unused_pg_graphql.sql`, and empty seed and role lists. No migration was applied; no repair or remote DDL was run.

`supabase migration new disable_unused_pg_graphql` created `20260820210852_disable_unused_pg_graphql.sql`. Its complete body is:

```sql
drop extension if exists pg_graphql;
```

The file SHA-256 is `096E40E05B747EB141D1EECA8324C6BA5A7A0300AD728B943671B6ECD1E02D89`. It is idempotent and intentionally omits `CASCADE`. A fresh local reset before the migration reproduced exactly one inventory-v2 difference, `extra in local: extensions graphql.pg_graphql`; the post-migration reset and fresh local capture compared equal to the committed production-v2 inventory.

The production inventory already has no `pg_graphql`, so the DDL is expected to be a no-op there; production migration history is still a write and remains unauthorized. The required read-only pre-apply dry run is now recorded. At the remaining production checkpoint, an authorized operator must run these commands separately and stop on any unexpected result:

```text
supabase db push --linked
supabase migration list --linked
supabase db push --dry-run --linked
```

Only after explicit authorization may the apply command run. After apply, require all nine versions paired, the post-apply dry run up to date, a fresh read-only production inventory-v2 capture still at five extensions with no `pg_graphql`, and an exact production/local comparator pass. If the branch or linked state changes before authorization, rerun the dry run and require the same one-migration, empty-seed, empty-role plan. Do not combine this checkpoint with the separate client-role grant hardening.

## Local-to-production timestamp map

The seven SQL-bearing local files map to production by migration name, but their version timestamps do not match production history. Normalized hashing proves that only two local bodies match their production statement. Five differ and must not be represented as byte-for-byte historical files.

| Current local version | Production version | Migration name | Local normalized SHA-256 | Exact match |
| --- | --- | --- | --- | --- |
| `20260706093000` | `20260707062213` | `processed_stripe_events` | `d7c53aa46615b8bd106e80ed21e25bf1ab3202d309bf75d4129a7c92cba67929` | Yes |
| `20260723120000` | `20260724124907` | `prelaunch_security_hardening` | `e8491ca27e8f476084c642d2dd104f22a1c6d50b22322bac4f6a1283ae455985` | No |
| `20260724130000` | `20260724134848` | `profiles_insert_lockdown` | `66a829d7c9d817f4de21205236f61717bede6b35d7efdd007c89309d4780c8db` | No |
| `20260724140000` | `20260724163923` | `service_role_table_grant_lockdown` | `2527768d7347428470884517beefeebf146939ea8eff76cf95b9677ec0d0efd8` | No |
| `20260724150000` | `20260724215224` | `purchased_credits_bucket` | `5ccc59a7e6667165a8b212ef608c525107bf7ac5c6bf12fd268b17ce8ea0c654` | Yes |
| `20260818120000` | `20260819010825` | `tutorial_redemptions` | `02265005ec34810df2e5076f7211991fe972315be11c4fab3dc7c7be9acf1e02` | No |
| `20260818121000` | `20260819010835` | `onboarding_events` | `81c85be05d392bfff3b0cefbf6852d50c56bcdb7480ce893144a0264787ad0a8` | No |

The prelaunch, profiles-insert, tutorial-redemptions, and onboarding-events differences are comments/formatting only. The service-role grant file has a material DDL difference: the current local file revokes `INSERT, UPDATE, DELETE` on `public.feedback`, while the exact production statement revokes only `INSERT` there. This is a production-parity risk to preserve and resolve explicitly; it must not be hidden by a timestamp-only rename.

There is no current local file for production version `20260707062202`.

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
