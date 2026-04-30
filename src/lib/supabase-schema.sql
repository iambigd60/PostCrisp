-- ============================================================
-- PostCrisp Database Schema
-- Run this in the Supabase SQL editor
-- ============================================================

-- profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id                         UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email                      TEXT NOT NULL,
  full_name                  TEXT,
  avatar_url                 TEXT,
  role                       TEXT NOT NULL DEFAULT 'user'
                               CHECK (role IN ('user', 'admin')),
  subscription_tier          TEXT NOT NULL DEFAULT 'free'
                               CHECK (subscription_tier IN ('free', 'creator', 'elite')),
  stripe_customer_id         TEXT UNIQUE,
  stripe_subscription_id     TEXT UNIQUE,
  preferences                JSONB NOT NULL DEFAULT '{}'::jsonb,
  daily_generations_used     INTEGER NOT NULL DEFAULT 0,
  daily_generations_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  credits_balance            INTEGER NOT NULL DEFAULT 10,  -- starter default
  credits_reset_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- credit_transactions — audit log of every credit grant / consume / purchase / refund / adjust
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('grant', 'consume', 'purchase', 'refund', 'adjust', 'reset')),
  amount      INTEGER NOT NULL,  -- positive for grants/purchases/refunds, negative for consumes
  balance_after INTEGER NOT NULL,
  reason      TEXT,  -- e.g., "captions (captions)", "monthly reset", "admin grant", "purchase: 500 pack"
  task        TEXT,  -- CrispTask id when consume, null otherwise
  generation_id UUID REFERENCES public.generations(id) ON DELETE SET NULL,
  actor_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,  -- admin or user who triggered it
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credit_transactions_user_id_idx ON public.credit_transactions (user_id, created_at DESC);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own credit transactions"
  ON public.credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all credit transactions"
  ON public.credit_transactions FOR SELECT
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- No INSERT policy — writes go through server-side code with service role

-- admin_actions — audit log of every admin-initiated change against a user
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_user_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  action          TEXT NOT NULL,  -- 'tier_change' | 'role_change' | 'disable' | 'enable' | 'impersonate' | 'note'
  from_value      TEXT,
  to_value        TEXT,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_actions_target_user_idx
  ON public.admin_actions (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_actions_actor_idx
  ON public.admin_actions (actor_id, created_at DESC);

ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read admin_actions"
  ON public.admin_actions FOR SELECT
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- No INSERT/UPDATE policy — all writes happen server-side via service role or admin API routes

-- platform_settings — key/value store for global platform config (access control, flags, etc.)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read platform_settings"
  ON public.platform_settings FOR SELECT
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Seed the access_control row with open defaults (only if not already present)
INSERT INTO public.platform_settings (key, value)
  VALUES ('access_control', '{"signup_mode":"open","invite_code":null,"login_enabled":true}'::jsonb)
  ON CONFLICT (key) DO NOTHING;

-- No INSERT/UPDATE RLS — writes go through service role from admin API routes

-- invite_codes — single-use signup codes for invite-only mode. Each row
-- is one unique code; atomic UPDATE on used_at IS NULL prevents two
-- testers from racing on the same code.
CREATE TABLE IF NOT EXISTS public.invite_codes (
  code        TEXT PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes       TEXT,
  used_at     TIMESTAMPTZ,
  used_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS invite_codes_used_at_idx ON public.invite_codes (used_at);
CREATE INDEX IF NOT EXISTS invite_codes_created_at_idx ON public.invite_codes (created_at DESC);

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read invite_codes"
  ON public.invite_codes FOR SELECT
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- No INSERT/UPDATE/DELETE RLS — all writes go through service role from
-- admin API routes (generation) or the signup action (atomic claim).

-- channels — a creator's social accounts. Feeds the dashboard, the tool
-- picker, and the library's organization. One row per account per user.
CREATE TABLE IF NOT EXISTS public.channels (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  platform    TEXT NOT NULL,        -- 'instagram' | 'tiktok' | 'youtube' | 'x' | 'linkedin' | 'threads' | 'facebook' | 'newsletter' | 'blog' | 'other'
  handle      TEXT NOT NULL,        -- e.g. '@alex.main' or 'Alex Kim'
  label       TEXT,                 -- optional nickname: 'Main account', 'BTS clips', 'Finance newsletter'
  url         TEXT,                 -- canonical URL to the profile
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS channels_user_id_idx ON public.channels (user_id, sort_order, created_at);

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own channels"
  ON public.channels FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own channels"
  ON public.channels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own channels"
  ON public.channels FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own channels"
  ON public.channels FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER channels_updated_at
  BEFORE UPDATE ON public.channels
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- saved_content gets an optional channel_id so users can bucket library
-- entries by brand channel. Nullable to stay backwards-compatible with
-- existing rows and with saves made before a channel is selected.
ALTER TABLE public.saved_content
  ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS saved_content_channel_id_idx ON public.saved_content (channel_id);

-- feedback — in-app tester/user feedback submissions
CREATE TABLE IF NOT EXISTS public.feedback (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  message      TEXT NOT NULL,
  category     TEXT CHECK (category IN ('bug', 'feature', 'general')),
  url          TEXT,
  user_agent   TEXT,
  status       TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved')),
  admin_notes  TEXT,
  resolved_at  TIMESTAMPTZ,
  resolved_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feedback_status_idx ON public.feedback (status, created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_user_id_idx ON public.feedback (user_id, created_at DESC);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users insert own feedback"
  ON public.feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own feedback (so the app can confirm submission)
CREATE POLICY "Users read own feedback"
  ON public.feedback FOR SELECT
  USING (auth.uid() = user_id);

-- Admins read/update everything via service role; no admin RLS needed here
-- since admin routes use auth.supabaseAdmin (service role bypasses RLS).

-- voice_profiles — per-user voice profile built from content samples.
-- One row per user. `samples` is an append-only jsonb array of content
-- snippets the user pasted in. `traits` is the JSON result of Claude's
-- analysis of those samples (tone, vocabulary, signature phrases, etc.)
-- and gets fed into content-generation features' system prompts so
-- output sounds like the user rather than generic AI.
CREATE TABLE IF NOT EXISTS public.voice_profiles (
  user_id          UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  samples          JSONB NOT NULL DEFAULT '[]'::jsonb,
  traits           JSONB,
  last_analyzed_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.voice_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own voice profile"
  ON public.voice_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own voice profile"
  ON public.voice_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own voice profile"
  ON public.voice_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own voice profile"
  ON public.voice_profiles FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER voice_profiles_updated_at
  BEFORE UPDATE ON public.voice_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- feature_access — admin-editable runtime config for per-feature tier gating
-- When a row exists for a feature, it overrides the code defaults in
-- `src/lib/feature-access.ts`. Engine falls back to code defaults if missing.
CREATE TABLE IF NOT EXISTS public.feature_access (
  feature    TEXT PRIMARY KEY,
  min_tier   TEXT NOT NULL CHECK (min_tier IN ('starter', 'creator', 'elite')),
  enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.feature_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read feature_access"
  ON public.feature_access FOR SELECT
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins write feature_access"
  ON public.feature_access FOR ALL
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- ai_config_overrides — admin-editable runtime config for PostCrisp Engine task routing
-- Scoped per (task, tier) so each subscription tier can route to a different
-- provider/model. Engine falls back to code defaults if a row is missing.
CREATE TABLE IF NOT EXISTS public.ai_config_overrides (
  task       TEXT NOT NULL,
  tier       TEXT NOT NULL CHECK (tier IN ('starter', 'creator', 'elite')),
  provider   TEXT NOT NULL,
  model      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (task, tier)
);

ALTER TABLE public.ai_config_overrides ENABLE ROW LEVEL SECURITY;

-- Only admins can read or write config overrides
CREATE POLICY "Admins read ai_config_overrides"
  ON public.ai_config_overrides FOR SELECT
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins write ai_config_overrides"
  ON public.ai_config_overrides FOR ALL
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- generations
CREATE TABLE IF NOT EXISTS public.generations (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  feature     TEXT NOT NULL,
  platform    TEXT,
  input_data  JSONB,
  output_data JSONB,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  is_saved    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- saved_content
CREATE TABLE IF NOT EXISTS public.saved_content (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  generation_id UUID REFERENCES public.generations(id) ON DELETE SET NULL,
  type          TEXT NOT NULL DEFAULT 'caption',
  content       TEXT NOT NULL DEFAULT '',
  platform      TEXT,
  topic         TEXT,
  label         TEXT,
  folder        TEXT NOT NULL DEFAULT 'default',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- usage_stats
CREATE TABLE IF NOT EXISTS public.usage_stats (
  id      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date    DATE NOT NULL DEFAULT CURRENT_DATE,
  feature TEXT NOT NULL,
  count   INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, date, feature)
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS generations_user_id_idx ON public.generations (user_id);
CREATE INDEX IF NOT EXISTS generations_created_at_idx ON public.generations (created_at DESC);
CREATE INDEX IF NOT EXISTS saved_content_user_id_idx ON public.saved_content (user_id);
CREATE INDEX IF NOT EXISTS usage_stats_user_id_date_idx ON public.usage_stats (user_id, date);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_stats  ENABLE ROW LEVEL SECURITY;

-- profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- generations policies
CREATE POLICY "Users can view own generations"
  ON public.generations FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read every user's generation rows so the admin user-detail
-- view can show 'Recent generations' and the per-row detail page works
-- without RLS-filtering the row away. Same pattern as credit_transactions
-- and admin_actions admin-read policies. SELECT only — admins do not get
-- INSERT/UPDATE/DELETE on other users' generations through this path;
-- the detail page also hides Save and Delete buttons when the viewer is
-- not the row's owner.
CREATE POLICY "Admins can view all generations"
  ON public.generations FOR SELECT
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Users can insert own generations"
  ON public.generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generations"
  ON public.generations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own generations"
  ON public.generations FOR DELETE
  USING (auth.uid() = user_id);

-- saved_content policies
CREATE POLICY "Users can view own saved content"
  ON public.saved_content FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved content"
  ON public.saved_content FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved content"
  ON public.saved_content FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved content"
  ON public.saved_content FOR DELETE
  USING (auth.uid() = user_id);

-- usage_stats policies
CREATE POLICY "Users can view own usage stats"
  ON public.usage_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage stats"
  ON public.usage_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage stats"
  ON public.usage_stats FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================
-- Auto-create profile on signup trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Auto-update updated_at on profiles
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- creator_profiles — single row per user; upserted by Foundation Analysis runs.
-- Read by downstream tools (Captions, Viral Ideas, Bio Optimizer in Phase 2)
-- as a "Creator Context" prompt block.
CREATE TABLE IF NOT EXISTS public.creator_profiles (
  user_id               UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  content_pillars       JSONB NOT NULL,                    -- string[]
  voice_signature       JSONB NOT NULL,                    -- { adjectives: string[], examplePhrasing: string }
  audience_persona      JSONB NOT NULL,                    -- { description: string, sophistication: 'beginner'|'intermediate'|'advanced' }
  growth_stage          TEXT NOT NULL CHECK (growth_stage IN ('pre-traction', 'early-traction', 'scaling', 'established')),
  monetization_position JSONB NOT NULL,                    -- { stage: string, primaryStreams: string[] }
  format_strengths      JSONB NOT NULL,                    -- string[]
  differentiators       JSONB NOT NULL,                    -- string[]
  top_blockers          JSONB NOT NULL,                    -- string[]
  source_analysis_id    UUID REFERENCES public.generations(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creator_profiles_updated_at_idx ON public.creator_profiles(updated_at DESC);

-- Foundation Analysis integration on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS use_foundation_in_generations BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS foundation_cta_dismissed_at TIMESTAMPTZ;

-- Drop Team tier from subscription_tier CHECK (no Team subscribers exist).
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;
ALTER TABLE public.profiles
  ADD  CONSTRAINT profiles_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'creator', 'elite'));

-- creator_profiles RLS — matches the pattern used by every other user-scoped table.
-- Without this, client-side reads (Task 10 dashboard CTA, Task 11 Settings) silently
-- return zero rows because Supabase requires explicit policies on RLS-enabled rows.
ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own creator profile"
  ON public.creator_profiles FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own creator profile"
  ON public.creator_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own creator profile"
  ON public.creator_profiles FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users delete own creator profile"
  ON public.creator_profiles FOR DELETE
  USING (auth.uid() = user_id);
CREATE POLICY "Admins read all creator profiles"
  ON public.creator_profiles FOR SELECT
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Mirror the updated_at trigger pattern used on profiles, channels, voice_profiles
-- so the upsert path doesn't have to manually set updated_at and the index
-- on (updated_at DESC) is actually meaningful.
CREATE OR REPLACE TRIGGER creator_profiles_updated_at
  BEFORE UPDATE ON public.creator_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Drop Team tier from feature_access.min_tier CHECK to mirror profiles.subscription_tier.
-- Pre-flight: any in-flight 'team' row gets remapped to 'creator' (matching the runtime
-- defensive fallback in tierFromDbValue) before the CHECK rejects it.
UPDATE public.feature_access SET min_tier = 'creator' WHERE min_tier = 'team';
ALTER TABLE public.feature_access
  DROP CONSTRAINT IF EXISTS feature_access_min_tier_check;
ALTER TABLE public.feature_access
  ADD  CONSTRAINT feature_access_min_tier_check
  CHECK (min_tier IN ('starter', 'creator', 'elite'));
