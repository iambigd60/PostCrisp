# Migration ordering requirement

> **Status:** Satisfied in production on 2026-08-19 and reconciled by Phase 0 on 2026-08-20. The versions below already pair with remote history; do not manually reapply or repair them. Use [the Phase 0 database reconciliation runbook](../../docs/operations/phase-0-database-reconciliation.md) for current operator guidance.

`20260820210852_disable_unused_pg_graphql.sql` is intentionally local-only pending explicit production authorization. Do not run `db push` from this branch until the dry-run/apply checkpoint in the [production migration-history evidence](../../docs/operations/evidence/phase-0/2026-08-20-production-migration-history.md) is authorized and reviewed.

`20260819010825_tutorial_redemptions.sql` and `20260819010835_onboarding_events.sql`
had to be applied to production **before** the `feat/first-session-redesign`
application code shipped. Application code and migrations used different
pipelines, so the deployment sequence required an explicit operator check.

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

## Historical required order (satisfied)

1. Production applied `20260819010825_tutorial_redemptions.sql`.
2. Production applied `20260819010835_onboarding_events.sql`.
3. The `feat/first-session-redesign` application code deployed afterwards.
