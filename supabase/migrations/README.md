# Migration ordering requirement

`20260818120000_tutorial_redemptions.sql` and `20260818121000_onboarding_events.sql`
must both be applied to production **before** the `feat/first-session-redesign`
application code ships. Application code and migrations can be deployed by
different pipelines on different schedules — nothing enforces this ordering
automatically, so it has to be honoured by whoever sequences the release.

## What breaks if the app ships first

- `hasUsedTutorialBypass` queries `tutorial_redemptions`. If the table doesn't
  exist yet, that query errors, and the bypass check fails closed.
- Every `tutorialMode: true` generation request (`/api/generate`, plus the
  hashtags / viral-ideas / channel-analysis routes) then 409s.
- All three Pack-stage artifacts fail to generate, and retrying fails the same
  way, because the table is still missing.
- Net effect: the first session — Ask → Pack → Own — delivers nothing to
  100% of new users until `tutorial_redemptions` exists.
- `onboarding_events` failing to exist is lower-severity (event inserts are
  best-effort and non-fatal) but silently blinds the funnel metrics this
  release exists to produce.

## Required order

1. Apply `20260818120000_tutorial_redemptions.sql`
2. Apply `20260818121000_onboarding_events.sql`
3. Only then deploy the `feat/first-session-redesign` application code
