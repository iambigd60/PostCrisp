-- Archive resolved feedback without deleting its content or resolution record.
-- The admin API uses the existing service-role path; client grants and RLS
-- policies remain unchanged.
ALTER TABLE public.feedback
  DROP CONSTRAINT feedback_status_check,
  ADD CONSTRAINT feedback_status_check
    CHECK (status IN ('new', 'in_progress', 'resolved', 'archived'));
