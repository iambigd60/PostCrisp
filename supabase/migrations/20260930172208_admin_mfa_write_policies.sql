-- Admin API routes enforce aal2 before constructing a service-role client.
-- Close direct Data API paths too: AAL1 admins must not read cross-user admin
-- data or write runtime configuration. Keep ordinary users' own-row policies
-- and the intentionally shared ai_config_overrides SELECT policy intact.
-- Apply after the /mfa enrollment/challenge UI is deployed.

ALTER POLICY "Admins read all credit transactions" ON public.credit_transactions
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND (SELECT auth.jwt()->>'aal') = 'aal2');
ALTER POLICY "Admins read admin_actions" ON public.admin_actions
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND (SELECT auth.jwt()->>'aal') = 'aal2');
ALTER POLICY "Admins read platform_settings" ON public.platform_settings
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND (SELECT auth.jwt()->>'aal') = 'aal2');
ALTER POLICY "Admins read invite_codes" ON public.invite_codes
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND (SELECT auth.jwt()->>'aal') = 'aal2');
ALTER POLICY "Admins read feature_access" ON public.feature_access
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND (SELECT auth.jwt()->>'aal') = 'aal2');
ALTER POLICY "Admins write feature_access" ON public.feature_access
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND (SELECT auth.jwt()->>'aal') = 'aal2')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND (SELECT auth.jwt()->>'aal') = 'aal2');
ALTER POLICY "Admins write ai_config_overrides" ON public.ai_config_overrides
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND (SELECT auth.jwt()->>'aal') = 'aal2')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND (SELECT auth.jwt()->>'aal') = 'aal2');
ALTER POLICY "Admins can view all generations" ON public.generations
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND (SELECT auth.jwt()->>'aal') = 'aal2');
ALTER POLICY "Admins read all generation_ai_calls" ON public.generation_ai_calls
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND (SELECT auth.jwt()->>'aal') = 'aal2');
ALTER POLICY "Admins read all creator profiles" ON public.creator_profiles
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND (SELECT auth.jwt()->>'aal') = 'aal2');

CREATE POLICY "Require MFA to insert feature_access"
  ON public.feature_access AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2');

CREATE POLICY "Require MFA to update feature_access"
  ON public.feature_access AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2')
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2');

CREATE POLICY "Require MFA to delete feature_access"
  ON public.feature_access AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2');

CREATE POLICY "Require MFA to insert ai_config_overrides"
  ON public.ai_config_overrides AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2');

CREATE POLICY "Require MFA to update ai_config_overrides"
  ON public.ai_config_overrides AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2')
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2');

CREATE POLICY "Require MFA to delete ai_config_overrides"
  ON public.ai_config_overrides AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2');
