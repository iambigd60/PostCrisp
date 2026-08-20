-- Close the INSERT side of CRITICAL-1 (privileged profile columns).
-- REVOKE INSERT from client roles + extend the protect trigger to INSERT.
-- Profiles are created only by the SECURITY DEFINER handle_new_user() trigger.

REVOKE INSERT ON public.profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.protect_privileged_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
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

  IF NEW.role                        IS DISTINCT FROM OLD.role
     OR NEW.subscription_tier        IS DISTINCT FROM OLD.subscription_tier
     OR NEW.stripe_customer_id       IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_subscription_id   IS DISTINCT FROM OLD.stripe_subscription_id
     OR NEW.email                    IS DISTINCT FROM OLD.email
     OR NEW.credits_balance          IS DISTINCT FROM OLD.credits_balance
     OR NEW.credits_reset_at         IS DISTINCT FROM OLD.credits_reset_at
     OR NEW.daily_generations_used   IS DISTINCT FROM OLD.daily_generations_used
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
