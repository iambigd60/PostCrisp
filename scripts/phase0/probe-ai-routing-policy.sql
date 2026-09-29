-- Read-only regression probe for the ai_config_overrides routing policy.
-- Run before and after the migration; all booleans must be true afterwards.
SELECT
  c.relrowsecurity AS rls_enabled,
  has_table_privilege('authenticated', 'public.ai_config_overrides', 'SELECT') AS authenticated_select_granted,
  EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = 'ai_config_overrides'
      AND p.policyname = 'Authenticated read ai_config_overrides'
      AND p.cmd = 'SELECT'
      AND p.roles = ARRAY['authenticated']::name[]
      AND p.qual = 'true'
  ) AS authenticated_read_policy_present,
  EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = 'ai_config_overrides'
      AND p.policyname = 'Admins write ai_config_overrides'
      AND p.cmd = 'ALL'
  ) AS admin_write_policy_preserved,
  NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = 'ai_config_overrides'
      AND p.cmd IN ('SELECT', 'ALL')
      AND 'anon'::name = ANY(p.roles)
  ) AS no_anon_read_policy
FROM pg_class c
WHERE c.oid = 'public.ai_config_overrides'::regclass;
