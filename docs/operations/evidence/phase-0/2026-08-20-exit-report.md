# Phase 0 exit report

**Gate result:** **BLOCKED — do not start Phase 1.**
**Recorded:** 2026-08-20 (America/Los_Angeles)
**Repository verification range:** `c449867..40d9b28`
**Branch:** `codex/phase-0-containment`

This refresh replaces the prior Auth-signature CLI-invocation blocker after Task 4 (`40d9b28`) made the query launcher executable and bounded its process-tree timeout. The linked read-only launcher and all focused Auth tests now pass. Phase 0 remains blocked because clean-room verification could not refresh without a local Docker engine and because the required live-control, restore, and independent-council gates remain unresolved.

## Safety boundary

Production remained read-only. No restore or paid resource was created; no Auth, firewall, provider, production schema, or migration-history setting was changed; no non-dry-run database push, repair, linked reset, browser launch, push, merge, or Phase 1 work occurred.

## Fresh repository evidence

All timestamps below are UTC on 2026-08-20. Commands were run from `C:\Projects\postcrisp-phase-0-containment` after `git status --short --branch` showed only `## codex/phase-0-containment`.

| Start | Command | Exit | Result |
| --- | --- | ---: | --- |
| `20:06:54.2150569Z` | `supabase db reset --local` | 1 | Could not connect to Docker Desktop's `dockerDesktopLinuxEngine` named pipe. No reset occurred. |
| `20:06:55.7692429Z` | `supabase migration list --linked` | 0 | Returned all eight exact local/remote version pairs from `20260707062202` through `20260819010835`. |
| `20:06:59.1992746Z` | `supabase db push --dry-run --linked` | 0 | `upToDate: true`; no migrations, seeds, or roles pending. Production was not changed. |
| `20:07:02.4397928Z` | `node --test scripts/phase0/compare-schema-inventory.test.mjs` | 1 | Eight non-database tests passed; three database-backed inventory tests could not connect to the unavailable local database. |
| `20:07:06.6114047Z` | `node scripts/phase0/compare-schema-inventory.mjs docs/operations/evidence/phase-0/2026-08-20-production-schema-inventory.json docs/operations/evidence/phase-0/2026-08-20-local-schema-inventory.json` | 0 | Committed inventories match. This is not a replacement for a fresh post-reset local capture. |
| `20:07:06.6815383Z` | `node --test scripts/phase0/auth-restore-signature-query.test.mjs` | 0 | 2 tests passed; the SQL is one prepared-statement-compatible read-only query. |
| `20:07:06.8084989Z` | `node --test scripts/phase0/capture-auth-restore-signature.test.mjs` | 0 | 9 tests passed, including prompt timeout, partial-output suppression, and Windows process-tree termination. |
| `20:07:07.5978779Z` | `node --test scripts/phase0/compare-auth-restore-signature.test.mjs` | 0 | 23 comparator tests passed. |
| `20:07:10.1044291Z` | `node scripts/phase0/capture-auth-restore-signature.mjs --local` | 1 | Local Supabase CLI query could not connect because the Docker engine is unavailable; no capture was retained. |
| `20:07:12.5559861Z` | `node scripts/phase0/capture-auth-restore-signature.mjs --linked` | 0 | The credential-free launcher completed one linked read-only signature query and emitted only its required JSON contract. Raw output was not persisted in evidence. |
| `20:07:17.0759518Z` | `npm test -- --run` | 0 | 26 files and 240 tests passed. |
| `20:07:19.4628055Z` | `npm run typecheck` | 0 | TypeScript completed without errors. |
| `20:07:38.0705340Z` | `npm run lint` | 0 | Completed with the same four baseline application warnings listed below, plus Next.js/Sentry deprecation notices. |
| `20:07:41.4719730Z` | `git diff --check c449867..HEAD` | 0 | No whole-branch whitespace errors. |
| `20:07:41.6345021Z` | `git diff --find-renames --full-index --output=.superpowers/sdd/2026-08-20-phase-0-containment/task-5-review-c449867..40d9b28.diff c449867..HEAD` | 0 | Generated the ignored 1,128,423-byte whole-branch review package; SHA-256 `BE22748705438731CAAFC161763EC9C40839C8551222AD3E9AC4C48AE8B0178A`. |
| `20:07:41.7313556Z` | `git status --short --branch` | 0 | Clean tracked worktree: `## codex/phase-0-containment`. |

The four baseline lint warnings are distinct from a clean lint result:

- `src/app/admin/ai-config/page.tsx:81`: missing `load` dependency.
- `src/app/admin/credit-adjustments/page.tsx:49`: missing `load` dependency.
- `src/app/admin/feature-access/page.tsx:44`: missing `load` dependency.
- `src/components/ui/FeatureGate.tsx:113`: `@next/next/no-img-element`.

The prior multi-command prepared-statement failure is resolved: Task 4 changed the Auth signature to one read-only query, and the fresh query, capture, comparator, and linked-launcher evidence above passed. The unavailable local Docker engine prevents a fresh reset, local launcher execution, and the three database-backed inventory tests; it must be restored before clean-room verification can be refreshed.

## Live-control gate

The resolved Auth invocation does not satisfy the live-control exit gate:

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

- Immediately before this Task 5 refresh, the controller ran `three-aimigos doctor`; it exited 1 with `Action required`, `Configuration: unavailable`, required Anthropic/OpenAI healthy, and optional xAI authentication required.
- Per the Three AImigos preflight contract, no `status`, `start`, `init`, `configure`, or repeat `doctor` command was run by this task. No council was dispatched and no Auditor response or verdict exists.

This is an independent-review blocker, not an adverse or favorable review verdict. Phase 0 cannot complete until an eligible independent exit review covers the approved spec, plan, evidence, SQL, scripts, and complete branch diff and returns with no unresolved blocker.

## Exit decision

Phase 0 remains **BLOCKED**. Do not push, merge, change `main`, or begin Phase 1. Restore the local Docker engine and rerun clean-room evidence; then satisfy the exact access/authorization checkpoints above, complete the isolated restore drill and cleanup evidence, and obtain the required independent exit review.
