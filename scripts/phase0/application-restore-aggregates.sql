-- Phase 0 application restore aggregates.
-- One prepared-statement-compatible, read-only command. Returns only bounded
-- counts for reviewed application relations; no row values or identities.
WITH aggregate_counts AS (
  SELECT
    (SELECT count(*)::integer
      FROM (SELECT 1 FROM public.profiles LIMIT 100001) AS bounded) AS profiles,
    (SELECT count(*)::integer
      FROM (SELECT 1 FROM public.generations LIMIT 100001) AS bounded) AS generations,
    (SELECT count(*)::integer
      FROM (SELECT 1 FROM public.credit_transactions LIMIT 100001) AS bounded)
      AS credit_transactions,
    (SELECT count(*)::integer
      FROM (SELECT 1 FROM public.processed_stripe_events LIMIT 100001) AS bounded)
      AS processed_stripe_events,
    (SELECT count(*)::integer
      FROM (SELECT 1 FROM public.ai_config_overrides LIMIT 100001) AS bounded)
      AS ai_config_overrides
)
SELECT jsonb_build_object(
  'captured_at', statement_timestamp(),
  'bounded_row_count_cap', 100001,
  'counts', jsonb_build_object(
    'ai_config_overrides', ai_config_overrides,
    'credit_transactions', credit_transactions,
    'generations', generations,
    'processed_stripe_events', processed_stripe_events,
    'profiles', profiles
  )
) AS application_restore_aggregates
FROM aggregate_counts;
