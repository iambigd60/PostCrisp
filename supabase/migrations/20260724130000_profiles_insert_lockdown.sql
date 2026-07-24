-- ============================================================
-- Close the INSERT side of CRITICAL-1 (privileged profile columns)
--
-- The pre-launch hardening migration locked down UPDATE on public.profiles
-- (column-level grants + a BEFORE UPDATE trigger) but left INSERT untouched:
-- anon and authenticated still hold column-level INSERT on role /
-- subscription_tier / credits_balance / credits_reset_at / stripe_* / email /
-- daily_generations_*, and the protect trigger fired on UPDATE only.
--
-- Today a client INSERT is blocked solely because `profiles` has NO INSERT
-- policy (RLS fail-closed). The moment any INSERT policy is added — the common
-- "let users create their own profile row" Supabase pattern — a user could
-- INSERT their own row with role='admin' and arbitrary credits. This closes
-- that latent hole.
--
-- Profiles are created exclusively by the SECURITY DEFINER handle_new_user()
-- trigger, which runs as the table owner and bypasses column grants, so client
-- roles never need INSERT. DB-only. Idempotent — safe to run more than once.
-- ============================================================

REVOKE INSERT ON public.profiles FROM anon, authenticated;

-- Extend the defense-in-depth trigger to INSERT as well. On INSERT there is no
-- OLD row, so a client-role INSERT may only create a row carrying the safe
-- column defaults; setting any privileged value is rejected. Trusted roles
-- (service_role, the definer owner used by handle_new_user(), migrations) are
-- unconstrained, so signup and server writes are unaffected.
CREATE OR REPLACE FUNCTION public.protect_privileged_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Only the client roles are constrained. Anything else (service_role, the
  -- table owner used by SECURITY DEFINER functions, migrations) is trusted.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role                       IS DISTINCT FROM 'user'
       OR NEW.subscription_tier       IS DISTINCT FROM 'free'
       OR NEW.credits_balance         IS DISTINCT FROM 10
       OR NEW.stripe_customer_id      IS NOT NULL
       OR NEW.stripe_subscription_id  IS NOT NULL
       OR NEW.daily_generations_used  IS DISTINCT FROM 0
    THEN
      RAISE EXCEPTION 'Inserting privileged profile columns (role/tier/stripe/credits/quota) is not allowed';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE path (unchanged from the pre-launch hardening migration)
  IF NEW.role                       IS DISTINCT FROM OLD.role
     OR NEW.subscription_tier       IS DISTINCT FROM OLD.subscription_tier
     OR NEW.stripe_customer_id      IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_subscription_id  IS DISTINCT FROM OLD.stripe_subscription_id
     OR NEW.email                   IS DISTINCT FROM OLD.email
     OR NEW.credits_balance         IS DISTINCT FROM OLD.credits_balance
     OR NEW.credits_reset_at        IS DISTINCT FROM OLD.credits_reset_at
     OR NEW.daily_generations_used  IS DISTINCT FROM OLD.daily_generations_used
     OR NEW.daily_generations_reset_at IS DISTINCT FROM OLD.daily_generations_reset_at
  THEN
    RAISE EXCEPTION 'Updating privileged profile columns (role/tier/stripe/email/credits/quota) is not allowed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_privileged_profile_columns ON public.profiles;
CREATE TRIGGER protect_privileged_profile_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_privileged_profile_columns();
