-- Clients keep UPDATE on profiles.preferences (column grant from
-- 20260724124907), and the alpha-agreement gate treats preferences.alpha_nda
-- as the acceptance record, so a signed-in user could forge acceptance with a
-- direct Supabase update. Extend protect_privileged_profile_columns so the
-- anon/authenticated roles cannot create, change, or remove
-- preferences.alpha_nda. Every other preferences key stays client-writable.
--
-- /api/user/alpha-acceptance writes the record with the service role, which
-- this trigger passes through. /api/user/preferences merges onto the stored
-- value, so it leaves alpha_nda untouched and is unaffected.
--
-- Deploy order: the application change that moved alpha-acceptance to the
-- service role must be live BEFORE this is applied. Applied first, every
-- acceptance would be rejected.
--
-- Body is the 20260724215224 definition plus the two alpha_nda clauses. The
-- existing trigger keeps pointing at this function, so it is not recreated.
-- `->` is used instead of the `?` key-exists operator so the statement is
-- safe to run through tooling that treats `?` as a bind placeholder.

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
       OR NEW.purchased_credits       IS DISTINCT FROM 0
       OR NEW.stripe_customer_id      IS NOT NULL
       OR NEW.stripe_subscription_id  IS NOT NULL
       OR NEW.daily_generations_used  IS DISTINCT FROM 0
       OR (NEW.preferences -> 'alpha_nda') IS NOT NULL
    THEN
      RAISE EXCEPTION 'Inserting privileged profile columns (role/tier/stripe/credits/quota/alpha_nda) is not allowed';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.role                        IS DISTINCT FROM OLD.role
     OR NEW.subscription_tier        IS DISTINCT FROM OLD.subscription_tier
     OR NEW.stripe_customer_id       IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_subscription_id   IS DISTINCT FROM OLD.stripe_subscription_id
     OR NEW.email                    IS DISTINCT FROM OLD.email
     OR NEW.credits_balance          IS DISTINCT FROM OLD.credits_balance
     OR NEW.purchased_credits        IS DISTINCT FROM OLD.purchased_credits
     OR NEW.credits_reset_at         IS DISTINCT FROM OLD.credits_reset_at
     OR NEW.daily_generations_used   IS DISTINCT FROM OLD.daily_generations_used
     OR NEW.daily_generations_reset_at IS DISTINCT FROM OLD.daily_generations_reset_at
     OR (NEW.preferences -> 'alpha_nda') IS DISTINCT FROM (OLD.preferences -> 'alpha_nda')
  THEN
    RAISE EXCEPTION 'Updating privileged profile columns (role/tier/stripe/email/credits/quota/alpha_nda) is not allowed';
  END IF;

  RETURN NEW;
END;
$$;
