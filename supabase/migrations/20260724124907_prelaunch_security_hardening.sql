-- ============================================================
-- Pre-launch security hardening
-- Addresses audit findings CRITICAL-1, CRITICAL-2, and MEDIUM-6.
--
-- DB-only. Idempotent — safe to run more than once.
-- ============================================================

-- ------------------------------------------------------------
-- CRITICAL-2 + MEDIUM-6: consume_user_credits
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.consume_user_credits(uuid, integer, text, text);

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

  -- Atomic conditional decrement: only succeeds when the balance is
  -- sufficient. Returns NULL (no row updated) when the user is missing or
  -- the balance is too low, matching the caller's "insufficient" contract.
  UPDATE public.profiles
     SET credits_balance = credits_balance - p_amount
   WHERE id = p_user_id
     AND credits_balance >= p_amount
  RETURNING credits_balance INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;

REVOKE ALL     ON FUNCTION public.consume_user_credits(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_user_credits(uuid, integer) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.consume_user_credits(uuid, integer) TO service_role;

-- ------------------------------------------------------------
-- MEDIUM-6: harden the trigger helper functions
-- ------------------------------------------------------------

-- handle_updated_at — pin search_path and schema-qualify now().
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

-- handle_new_user — keep SECURITY DEFINER (it must insert into profiles on
-- signup) but pin search_path and revoke direct client EXECUTE.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- CRITICAL-1: lock down authenticated writes to profiles
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT  UPDATE (full_name, avatar_url, preferences,
               use_foundation_in_generations, foundation_cta_dismissed_at)
  ON public.profiles TO authenticated;

-- protect_privileged_profile_columns — SECURITY INVOKER (default).
CREATE OR REPLACE FUNCTION public.protect_privileged_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

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
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_privileged_profile_columns();
