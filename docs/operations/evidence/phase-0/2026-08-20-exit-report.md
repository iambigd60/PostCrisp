# Phase 0 exit report

**Gate result:** **BLOCKED — do not start Phase 1.**
**Recorded:** 2026-08-20 (America/Los_Angeles)
**Repository verification range:** `c449867..e101996`
**Branch:** `codex/phase-0-containment`

The repository migration lineage, clean-room reconstruction, and captured `public` schema remain reproducible. That repository evidence does not satisfy the Phase 0 exit gate: live recovery and platform controls remain unresolved, the isolated restore drill has not run, and the required independent council review could not start.

## Safety boundary

Production remained read-only. No restore or paid resource was created; no Auth, firewall, provider, production schema, or migration-history setting was changed; no non-dry-run database push, repair, linked reset, browser launch, push, merge, or Phase 1 work occurred.

## Fresh repository evidence

All timestamps below are UTC on 2026-08-20. Commands were run from `C:\Projects\postcrisp-phase-0-containment` after `git status --short --branch` showed only `## codex/phase-0-containment`.

| Start | Command | Exit | Result |
| --- | --- | ---: | --- |
| `18:56:02.0824318Z` | `supabase db reset --local` | 0 | Recreated the local database and applied all eight production-version migrations in order. |
| `18:56:38.6796287Z` | `supabase migration list --linked` | 0 | Returned eight exact local/remote version pairs from `20260707062202` through `20260819010835`. |
| `18:56:46.2193371Z` | `supabase db push --dry-run --linked` | 0 | `upToDate: true`; no migrations, seeds, or roles pending. Production was not changed. |
| `18:56:55.2910304Z` | `node .superpowers/sdd/2026-08-20-phase-0-containment/verify-exact-migrations.mjs` | 0 | The seven literal production migrations hash-matched the statement artifact; the composite migration ended with the exact production v1 body. |
| `18:57:02.2724724Z` | `powershell -NoProfile -File .superpowers/sdd/2026-08-20-phase-0-containment/capture-schema-inventory.ps1 -Scope linked -OutputPath .superpowers/sdd/2026-08-20-phase-0-containment/task-5-production-review.json` | 0 | Captured a fresh read-only production catalog inventory into the ignored review workspace. |
| `18:57:10.8164685Z` | `powershell -NoProfile -File .superpowers/sdd/2026-08-20-phase-0-containment/capture-schema-inventory.ps1 -Scope local -OutputPath .superpowers/sdd/2026-08-20-phase-0-containment/task-5-local-review.json` | 0 | Captured the post-reset local catalog inventory into the ignored review workspace. |
| `18:57:16.9331329Z` | `node scripts/phase0/compare-schema-inventory.mjs .superpowers/sdd/2026-08-20-phase-0-containment/task-5-production-review.json .superpowers/sdd/2026-08-20-phase-0-containment/task-5-local-review.json` | 0 | `Schema inventories match.` |
| `18:57:22.7470333Z` | `node scripts/phase0/compare-schema-inventory.mjs docs/operations/evidence/phase-0/2026-08-20-production-schema-inventory.json docs/operations/evidence/phase-0/2026-08-20-local-schema-inventory.json` | 0 | Committed inventories still match. |
| `18:57:30.0530800Z` | `Get-FileHash -Algorithm SHA256` over both fresh and both committed inventory files | 0 | All four files had SHA-256 `138C91B56E1D7E21101BC232F09C071459C4E52603FF6147F15A09F2221C6D8B`. |
| `18:57:36.9138523Z` | `node --test scripts/phase0/compare-schema-inventory.test.mjs` | 0 | 11 tests passed; 0 failed. |
| `18:57:46.4221094Z` | `node --test scripts/phase0/compare-auth-restore-signature.test.mjs` | 0 | 23 tests passed; 0 failed. |
| `18:57:53.0453668Z` | `supabase db query --local --file scripts/phase0/probe-default-grants.sql --output-format json` | 0 | The atomic default-grant integration probe completed with `DO`. |
| `18:57:59.1265874Z` | `Get-FileHash scripts/phase0/auth-restore-signature.sql -Algorithm SHA256` | 0 | Hash remained `76DCD5229E671396F5C822CCF0DA839BE83FF9183785DE682A64FCF5DD649CCE`. |
| `18:58:04.1450650Z` | `supabase db query --local --file scripts/phase0/auth-restore-signature.sql --output-format json` | 1 | CLI rejected the multi-command file: `cannot insert multiple commands into a prepared statement`. This exact documented invocation is not executable with Supabase CLI `2.115.0`. |
| `18:58:25.4955139Z` | `Get-Content -Raw scripts/phase0/auth-restore-signature.sql \| docker exec -i supabase_db_postcrisp psql --username postgres --dbname postgres --set ON_ERROR_STOP=1 --no-psqlrc --tuples-only --no-align` | 0 | The same SQL completed locally in a read-only transaction and returned the expected structural signature. This proves the SQL executes, but it does not make the documented CLI command pass. |
| `18:58:31.0771371Z` | `npm test -- --run` | 0 | 26 files and 240 tests passed. npm also emitted the pre-existing `Unknown cli config "--run"` warning. |
| `18:58:37.9513697Z` | `npm run typecheck` | 0 | TypeScript completed without errors. |
| `18:58:44.3812244Z` | `npm run lint` | 0 | Completed with the same four baseline application warnings listed below, plus Next.js/Sentry deprecation notices. |
| `18:58:57.0347013Z` | `git diff --check c449867..HEAD` | 0 | No whole-branch whitespace errors. |
| `18:58:57.0447028Z` | `git status --short --branch` | 0 | Clean tracked worktree: `## codex/phase-0-containment`. |
| `18:59:07.7257450Z` | `git diff --find-renames --full-index --output=.superpowers/sdd/2026-08-20-phase-0-containment/task-5-review-c449867..e101996.diff c449867..e101996` | 0 | Generated the ignored 1,098,269-byte whole-branch review package; SHA-256 `E8E86268DDFC29338C62FA36F04B7CB66FF8E6D0D3D0C360732435A0CB3F4A33`. |

The four baseline lint warnings are distinct from a clean lint result:

- `src/app/admin/ai-config/page.tsx:81`: missing `load` dependency.
- `src/app/admin/credit-adjustments/page.tsx:49`: missing `load` dependency.
- `src/app/admin/feature-access/page.tsx:44`: missing `load` dependency.
- `src/components/ui/FeatureGate.tsx:113`: `@next/next/no-img-element`.

The failed Auth CLI invocation is a repository/runbook blocker for the restore procedure. The direct local `psql` result narrows the defect to invocation compatibility; it is not a substitute for fixing and independently reviewing the committed procedure.

## Live-control gate

Task 4 controls are not all `VERIFIED`, so the exit condition fails even where repository checks passed:

| Control | Exit classification | Required checkpoint |
| --- | --- | --- |
| Completed physical backups and paid-plan eligibility | `VERIFIED` | Recheck immediately before any authorized drill. |
| PITR | `NOT ENABLED` | No PITR recovery window exists. |
| Actual source eligibility and operator-visible **Restore to a New Project** action | `BLOCKED BY ACCESS` | An authenticated Supabase Dashboard operator must inspect the selected backup and final non-sensitive configuration/cost fields, stopping before confirmation. |
| Isolated restore drill | `REQUIRES AUTHORIZATION` | The drill has not run. It requires safe fresh preflights, a five-billable-hour estimate below USD 8, explicit production-sensitive handling authorization, explicit residual-cost acceptance, validation, deletion, and settled billing evidence. |
| Supabase leaked-password protection | `NOT ENABLED` | It remains off. Enabling it requires explicit authorization followed by a fresh security-advisor check. |
| Vercel firewall configuration and production environment-name/runtime linkage | `BLOCKED BY ACCESS` | Provide authenticated read-only Vercel CLI/API access or an already-open authenticated browser session. |
| Anthropic account spend/rate limits and runtime linkage | `BLOCKED BY ACCESS` | Provide Billing/Admin read-only evidence; do not inspect or reuse runtime keys. |
| OpenAI account/project spend/rate limits and runtime linkage | `BLOCKED BY ACCESS` | Provide Owner/Admin read-only evidence; do not inspect or reuse runtime keys. |

## Independent exit review

The required independent review did not run.

- At `2026-08-20T11:55:13.8920555-07:00`, `three-aimigos status` exited 1 with `Action required`, `Configuration: unavailable`, and healthy required Anthropic/OpenAI providers plus healthy optional xAI.
- At `2026-08-20T11:55:27.3510072-07:00`, the mandatory `three-aimigos doctor` exited 1 with the same configuration/provider state.
- Per the Three AImigos preflight contract, no `start`, `init`, or `configure` command was run. No council was dispatched and no Auditor response or verdict exists.

This is an independent-review blocker, not an adverse or favorable review verdict. Phase 0 cannot complete until an eligible independent exit review covers the approved spec, plan, evidence, SQL, scripts, and complete branch diff and returns with no unresolved blocker.

## Exit decision

Phase 0 remains **BLOCKED**. Do not push, merge, change `main`, or begin Phase 1. Resume only at the exact access/authorization checkpoints above, correct and reverify the Auth-signature invocation contract, complete the isolated restore drill and cleanup evidence, and obtain the required independent exit review.
