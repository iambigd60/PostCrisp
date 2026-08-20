# Migration ordering requirement

> **Status:** Satisfied in production on 2026-08-19 and reconciled by Phase 0 on 2026-08-20. All ten versions through `20260820220303` pair with remote history, and the current linked `--skip-vault` dry run is empty. Do not manually reapply or repair them. Use [the Phase 0 database reconciliation runbook](../../docs/operations/phase-0-database-reconciliation.md) for current operator guidance.

`20260820210852_disable_unused_pg_graphql.sql` and `20260820220303_harden_client_role_grants.sql` are reviewed forward migrations already applied to production. Roll forward for later corrections: never edit paired history, broadly regrant the historical client/default privileges, or add `CASCADE` to the extension removal. Derive the smallest required exact grant tuple or extension change, add a new migration, and repeat the parity/probe gates documented in the [production migration-history evidence](../../docs/operations/evidence/phase-0/2026-08-20-production-migration-history.md).

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
