-- Enforce the platform signup policy (access_control.signup_mode) at the
-- Supabase Auth boundary. The signup server action checks the policy, but
-- Auth also accepts account creation directly from the public URL + anon key
-- and through Google OAuth, neither of which passes through that action.
--
-- Configured as the Auth "before user created" hook. Auth calls it for email
-- and phone signup, magic-link/OTP signup, anonymous sign-in, and OAuth /
-- ID-token / SAML account creation. It does not fire for admin-API user
-- creation (dashboard "Add user"), so operators can still create accounts by
-- hand in any mode.
--
--   open    → allow
--   invite  → allow only when user_metadata.invite_code (sent by the signup
--             action) is the shared access_control.invite_code, or a
--             single-use code the action reserved in the last 10 minutes
--             (used_at set, used_by not yet attached). A code that was never
--             reserved through the app is refused, so a direct Auth call
--             cannot spend an unused code, and OAuth signups (no code) are
--             refused while invite-only.
--   closed, missing row, unknown mode → reject (fails closed, matching
--             readAccessControl in src/lib/platform-settings.ts)
--
-- SECURITY DEFINER with an empty search_path, like handle_new_user and
-- consume_user_credits: the function only reads, and it keeps
-- supabase_auth_admin off platform_settings / invite_codes and their RLS
-- policies. Only supabase_auth_admin may execute it.
--
-- Rollout: apply after the app change that sends invite_code in signUp
-- metadata is live, then enable the hook in the dashboard
-- (Authentication → Hooks → Before User Created → Postgres,
-- public.hook_enforce_signup_policy). Disabling the hook there is the
-- rollback; the function can stay.

CREATE OR REPLACE FUNCTION public.hook_enforce_signup_policy(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  settings  jsonb;
  submitted text;
BEGIN
  SELECT ps.value INTO settings
  FROM public.platform_settings AS ps
  WHERE ps.key = 'access_control';

  IF settings ->> 'signup_mode' = 'open' THEN
    RETURN '{}'::jsonb;
  END IF;

  IF settings ->> 'signup_mode' = 'invite' THEN
    -- Same normalization as normalizeCode() in src/lib/invite-codes.ts.
    submitted := upper(regexp_replace(
      coalesce(event -> 'user' -> 'user_metadata' ->> 'invite_code', ''),
      '[-[:space:]]', '', 'g'
    ));

    IF submitted <> '' AND (
      submitted = settings ->> 'invite_code'
      OR EXISTS (
        SELECT 1
        FROM public.invite_codes AS ic
        WHERE ic.code = submitted
          AND ic.used_by IS NULL
          AND ic.used_at > pg_catalog.now() - interval '10 minutes'
      )
    ) THEN
      RETURN '{}'::jsonb;
    END IF;

    RETURN jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'An invite code is required to sign up.'
    ));
  END IF;

  RETURN jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Signups are currently closed. Please check back later.'
  ));
END;
$$;

REVOKE ALL     ON FUNCTION public.hook_enforce_signup_policy(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.hook_enforce_signup_policy(jsonb) FROM anon, authenticated, service_role;
GRANT  USAGE   ON SCHEMA public TO supabase_auth_admin;
GRANT  EXECUTE ON FUNCTION public.hook_enforce_signup_policy(jsonb) TO supabase_auth_admin;
