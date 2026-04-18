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
  subscription_tier          TEXT NOT NULL DEFAULT 'free'
                               CHECK (subscription_tier IN ('free', 'pro', 'business')),
  stripe_customer_id         TEXT UNIQUE,
  stripe_subscription_id     TEXT UNIQUE,
  preferences                JSONB NOT NULL DEFAULT '{}'::jsonb,
  daily_generations_used     INTEGER NOT NULL DEFAULT 0,
  daily_generations_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
