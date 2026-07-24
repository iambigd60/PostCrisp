-- ============================================================
-- Defense-in-depth: revoke default client write grants on service-role-only
-- tables, and column-restrict feedback inserts.
--
-- Each table below has RLS enabled with NO permissive write policy for
-- anon/authenticated, so client-role writes are already denied by RLS today —
-- this migration changes nothing functional. It removes the latent table-level
-- grant so that a future accidentally-broad policy can't turn it into a write
-- path (the same class of latent risk fixed for profiles INSERT). All real
-- writes to these tables run as service_role, which bypasses column grants.
--
-- Deliberately EXCLUDED: feature_access and ai_config_overrides — they carry an
-- admin `FOR ALL` RLS policy, so authenticated admins may write them via the
-- user-scoped client; revoking the grant there could break admin config writes.
--
-- DB-only. Idempotent.
-- ============================================================

REVOKE INSERT, UPDATE, DELETE ON public.credit_transactions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.admin_actions       FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.platform_settings   FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.invite_codes        FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.generation_ai_calls FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.processed_stripe_events FROM anon, authenticated;

-- feedback: users legitimately INSERT their own rows (RLS: auth.uid() = user_id),
-- but the table-level grant also let them set admin-workflow columns on insert
-- (status / admin_notes / resolved_at / resolved_by) — e.g. forging a
-- "resolved by admin X" record or hiding a report from the admin queue.
-- Restrict the insertable columns to the user-supplied set; the workflow
-- columns keep their defaults (status defaults to 'new') until a service-role /
-- admin write updates them.
REVOKE INSERT, UPDATE, DELETE ON public.feedback FROM anon, authenticated;
GRANT  INSERT (user_id, message, category, url, user_agent) ON public.feedback TO authenticated;
-- feedback UPDATE/DELETE (resolve, triage) run as service_role via admin routes;
-- there is no client UPDATE/DELETE policy, so this only removes latent grants.
