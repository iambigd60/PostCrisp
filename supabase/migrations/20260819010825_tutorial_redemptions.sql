CREATE TABLE IF NOT EXISTS public.tutorial_redemptions (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature     TEXT NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tutorial_redemptions_user_feature_key UNIQUE (user_id, feature)
);

CREATE INDEX IF NOT EXISTS tutorial_redemptions_user_idx
  ON public.tutorial_redemptions (user_id);

ALTER TABLE public.tutorial_redemptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tutorial_redemptions FROM PUBLIC, anon, authenticated;
GRANT  SELECT, INSERT ON public.tutorial_redemptions TO service_role;
GRANT  USAGE, SELECT ON SEQUENCE public.tutorial_redemptions_id_seq TO service_role;

INSERT INTO public.tutorial_redemptions (user_id, feature, redeemed_at)
SELECT DISTINCT ON (user_id, feature) user_id, feature, created_at
  FROM public.generations
 WHERE input_data->>'tutorialMode' = 'true'
 ORDER BY user_id, feature, created_at
ON CONFLICT (user_id, feature) DO NOTHING;
