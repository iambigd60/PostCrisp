CREATE TABLE IF NOT EXISTS public.onboarding_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS onboarding_events_user_created_idx
  ON public.onboarding_events (user_id, created_at);
CREATE INDEX IF NOT EXISTS onboarding_events_name_created_idx
  ON public.onboarding_events (name, created_at);

ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.onboarding_events FROM PUBLIC, anon, authenticated;
GRANT  SELECT, INSERT ON public.onboarding_events TO service_role;
GRANT  USAGE, SELECT ON SEQUENCE public.onboarding_events_id_seq TO service_role;
