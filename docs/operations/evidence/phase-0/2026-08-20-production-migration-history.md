# Production migration-history evidence

**Captured:** 2026-08-20
**Project:** `sikabeqzypvllimyostg` (`postcrisp`, `us-east-2`)
**Method:** authenticated read-only migration listing plus a read-only query of `supabase_migrations.schema_migrations`. No application rows were queried or recorded.

## Recorded production versions

| Order | Production version | Production name |
| ---: | --- | --- |
| 1 | `20260707062202` | `protect_privileged_profile_columns_v1` |
| 2 | `20260707062213` | `processed_stripe_events` |
| 3 | `20260724124907` | `prelaunch_security_hardening` |
| 4 | `20260724134848` | `profiles_insert_lockdown` |
| 5 | `20260724163923` | `service_role_table_grant_lockdown` |
| 6 | `20260724215224` | `purchased_credits_bucket` |
| 7 | `20260819010825` | `tutorial_redemptions` |
| 8 | `20260819010835` | `onboarding_events` |

## Local-to-production timestamp map

The seven SQL-bearing local files map to production by migration name, but their version timestamps do not match production history. This record establishes the timestamp mapping; Task 3's schema-parity work remains responsible for detecting any material representation difference.

| Current local version | Production version | Migration name |
| --- | --- | --- |
| `20260706093000` | `20260707062213` | `processed_stripe_events` |
| `20260723120000` | `20260724124907` | `prelaunch_security_hardening` |
| `20260724130000` | `20260724134848` | `profiles_insert_lockdown` |
| `20260724140000` | `20260724163923` | `service_role_table_grant_lockdown` |
| `20260724150000` | `20260724215224` | `purchased_credits_bucket` |
| `20260818120000` | `20260819010825` | `tutorial_redemptions` |
| `20260818121000` | `20260819010835` | `onboarding_events` |

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
