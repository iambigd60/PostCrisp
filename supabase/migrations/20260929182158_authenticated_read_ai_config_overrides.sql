-- The engine reads routing overrides with a user-scoped Supabase client.
-- Keep admin writes restricted by the existing admin policy while allowing
-- authenticated users to read the shared task/model configuration.
DROP POLICY IF EXISTS "Authenticated read ai_config_overrides" ON public.ai_config_overrides;
CREATE POLICY "Authenticated read ai_config_overrides"
  ON public.ai_config_overrides FOR SELECT
  TO authenticated
  USING (true);
