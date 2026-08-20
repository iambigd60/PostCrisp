-- Defense-in-depth: revoke default client write grants on service-role-only
-- tables (each already RLS-denies client writes), and column-restrict feedback
-- inserts. feature_access / ai_config_overrides excluded (admin FOR ALL policy).
REVOKE INSERT, UPDATE, DELETE ON public.credit_transactions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.admin_actions       FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.platform_settings   FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.invite_codes        FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.generation_ai_calls FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.processed_stripe_events FROM anon, authenticated;

REVOKE INSERT ON public.feedback FROM anon, authenticated;
GRANT  INSERT (user_id, message, category, url, user_agent) ON public.feedback TO authenticated;
