-- ============================================================
-- Append-only ledger of consumed onboarding free runs.
--
-- Why: hasUsedTutorialBypass counted rows in `generations` to decide whether a
-- user had already spent a per-feature freebie. Users hold own-row DELETE on
-- that table and the generations detail page exposes a Delete button, so the
-- "one free run per feature, ever" ceiling reset from ordinary UI. Combined
-- with tutorial_progress being client-writable via the preferences allowlist,
-- the giveaway was effectively unbounded.
--
-- This table is the boundary instead: service-role write only, no client
-- grants, RLS enabled with no permissive policy, and UNIQUE(user_id, feature)
-- so a redemption cannot be double-counted or replayed.
--
-- We deliberately do NOT revoke client DELETE on `generations` — deleting your
-- own generations is a real feature and stays.
-- ============================================================

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

-- No policy, by design: with RLS on and nothing permissive, client roles can
-- neither read nor write. service_role bypasses RLS.
REVOKE ALL ON public.tutorial_redemptions FROM PUBLIC, anon, authenticated;
GRANT  SELECT, INSERT ON public.tutorial_redemptions TO service_role;
GRANT  USAGE, SELECT ON SEQUENCE public.tutorial_redemptions_id_seq TO service_role;

-- Backfill from history so existing testers do not get their freebies back when
-- the source of truth changes. DISTINCT ON already collapses a user having
-- several tutorial rows per feature (e.g. from resetting the old counter) down
-- to one; ON CONFLICT DO NOTHING is for re-running this INSERT against a
-- table that already holds rows (e.g. a retried/re-applied migration).
INSERT INTO public.tutorial_redemptions (user_id, feature, redeemed_at)
SELECT DISTINCT ON (user_id, feature) user_id, feature, created_at
  FROM public.generations
 WHERE input_data->>'tutorialMode' = 'true'
 ORDER BY user_id, feature, created_at
ON CONFLICT (user_id, feature) DO NOTHING;
