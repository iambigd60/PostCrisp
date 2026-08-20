CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  event_id   TEXT PRIMARY KEY,
  type       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;
-- No policies: only the service-role client (which bypasses RLS) ever touches this.
