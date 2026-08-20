-- ============================================================
-- Separate non-expiring "purchased credits" so the allowance reset no longer
-- wipes credits a customer paid for (credit packs).
--
-- Model: `credits_balance` stays the single spendable total shown to users.
-- `purchased_credits` tracks how many of those credits are non-expiring. The
-- allowance reset now refills to (allowance + purchased_credits) instead of
-- clobbering to the flat allowance, and consume spends the allowance portion
-- first.
--
-- NOTE: contains a data backfill that reclassifies existing balances — review
-- before applying to production.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS purchased_credits INTEGER NOT NULL DEFAULT 0;

-- Backfill: treat any current balance ABOVE the tier allowance as purchased, so
-- an existing pack-holder doesn't lose it at the next reset. This is a best
-- effort — for a user who has already spent part of this cycle's allowance it
-- slightly under-counts purchased (we can't reconstruct historical spend), but
-- it never over-grants. Only touches rows still at the default 0.
UPDATE public.profiles
   SET purchased_credits = GREATEST(0, credits_balance - (CASE subscription_tier
         WHEN 'creator' THEN 500
         WHEN 'elite'   THEN 2000
         ELSE 10
       END))
 WHERE purchased_credits = 0;

-- Consume: spend the cycling allowance first; only draw down purchased_credits
-- when the balance drops below it. Same signature/grants as before.
CREATE OR REPLACE FUNCTION public.consume_user_credits(
  p_user_id uuid,
  p_amount  integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'consume_user_credits: p_amount must be a positive integer (got %)', p_amount;
  END IF;

  -- Both SET expressions read the row's pre-update values, so purchased_credits
  -- clamps against the NEW balance (credits_balance - p_amount) correctly.
  UPDATE public.profiles
     SET credits_balance   = credits_balance - p_amount,
         purchased_credits = LEAST(purchased_credits, credits_balance - p_amount)
   WHERE id = p_user_id
     AND credits_balance >= p_amount
  RETURNING credits_balance INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;

REVOKE ALL     ON FUNCTION public.consume_user_credits(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_user_credits(uuid, integer) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.consume_user_credits(uuid, integer) TO service_role;

-- Guard purchased_credits like the other privileged columns (clients must not
-- write it). Extends protect_privileged_profile_columns (INSERT + UPDATE).
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
     OR NEW.purchased_credits        IS DISTINCT FROM OLD.purchased_credits
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
