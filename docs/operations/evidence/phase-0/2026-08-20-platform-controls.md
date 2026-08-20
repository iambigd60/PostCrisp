# Phase 0 platform-control evidence

**Status:** **BLOCKED on restore, platform-access, and council gates — do not merge or start Phase 1.**

**Observed:** 2026-08-20; current database/Auth checkpoint through 2026-08-20T22:52Z

**Current-task boundary:** repository documentation and tracked evidence refresh only. No restore, paid resource, external setting change, migration apply, firewall/provider mutation, push, merge, or branch switch occurred.

Earlier separately authorized checkpoints applied the `pg_graphql` and grant-hardening migrations and enabled HIBP leaked-password protection. Those actions are recorded as completed evidence, not actions taken during this documentation task.

## Current control record

| Control | Classification | Current evidence and consequence |
| --- | --- | --- |
| Production migration history | `VERIFIED` | Fresh linked listing at approximately `2026-08-20T22:52Z` returned exactly ten paired local/remote versions through `20260820220303`. The linked `--skip-vault` dry run exited `0`, reported the remote database up to date, and performed no apply. |
| `pg_graphql` removal | `VERIFIED` | The CLI-generated migration is applied and paired. Production/local inventories contain five extensions and no `pg_graphql`. |
| Client-role grant hardening | `VERIFIED` | The reviewed migration is applied. It removed exactly 154 grant rows (128 current table, 12 current sequence, 14 `postgres` defaults) with no non-grant drift. Current forbidden client grants are 0 tables / 0 sequences, and forbidden `postgres` defaults are 0 table / 0 sequence. |
| Reserved `supabase_admin` default ACLs | `INFORMATIONAL / ACCEPTED CONDITIONAL RESIDUAL` | Exactly 8 table-default and 6 sequence-default rows remain. Independent review accepts this as platform-owned and non-blocking: official guidance identifies the role as internal upgrade/automation infrastructure, it cannot authenticate through the Data API, current forbidden objects and customer-owned `postgres` defaults are zero, and connected non-superuser `postgres` has neither `USAGE` nor `SET` on it. Reopen if platform automation creates a public table/sequence as `supabase_admin` or official customer remediation emerges. |
| Supabase leaked-password protection | `VERIFIED` | HIBP leaked-password protection is enabled. The fresh security advisor reports exactly three `INFO` `rls_enabled_no_policy` items and no `WARN` or `ERROR`; the leaked-password warning is absent. |
| Source restore preflight | `VERIFIED` | At `2026-08-20T22:52:11.037108Z`, the metadata-only linked preflight passed: no cron catalog/jobs, no `pg_net` queue, 0 foreign servers/mappings, 0 subscriptions, 0 replication slots including unclassified, and vault present with 0 secrets. Only metadata helper `extensions.grant_pg_net_access()` remains while `pg_net` is absent. |
| Auth restore signature | `VERIFIED` | At `2026-08-20T22:52:15.711197Z`, the linked capture exited `0` with the reviewed exact 10-key shape, Auth schema/users relation present, uncapped aggregate, and PostgreSQL 17 membership options represented. No raw identity was retained. |
| Backups and general restore eligibility | `VERIFIED` | The authenticated inventory reported completed physical backups, Pro-plan eligibility, `walg_enabled: true`, and PITR disabled. Physical backups are restorable but not directly downloadable. General eligibility does not prove that the selected backup exposes the clone action. |
| Restore cost model | `VERIFIED BOUNDED ESTIMATE` | Official read-only Management API evidence identifies only `compute_instance` `ci_micro` (Micro) at USD 0.01344/hour; disk is gp3 8 GB, 3000 IOPS, 125 MiB/s. The reviewed five-billable-hour model plus 0.1 GB egress at USD 0.09/GB totals USD 0.0762, below the USD 8 threshold. This is not clone-specific Dashboard confirmation. |
| Operator-visible restore action and clone-specific cost | `BLOCKED BY ACCESS` | No authenticated Dashboard/browser surface was available to verify the selected backup's **Restore to a New Project** action or final clone-specific configuration/cost. The restore tool itself requires explicit organization confirmation before exposing final cost or creating a resource. |
| Isolated restore drill | `NOT EXECUTED / REQUIRES AUTHORIZATION` | No target was created. Even with the safe preflight and bounded estimate, execution requires Dashboard/browser access, clone-specific cost confirmation, and explicit organization/user authorization accepting production-sensitive handling and residual cost. Validation, deletion, and settled billing evidence remain undone. |
| Vercel firewall and production environment-name inventory | `BLOCKED BY ACCESS` | The authenticated connector reconfirmed the project/deployment but still exposes neither firewall state nor production environment-variable names. Active rules, mitigations, drafts, and secrets-free runtime linkage remain unverified. |
| Anthropic/OpenAI provider spend and rate limits | `BLOCKED BY ACCESS` | Current account/workspace spend caps, enforcement modes, allowed models, and effective RPM/TPM limits require provider Billing/Admin read-only surfaces that were unavailable. Runtime keys were not inspected or reused. |
| Three AImigos independent council | `BLOCKED / NO VERDICT` | With beta.16, Grok 4.6 produced malformed responses twice and Grok 4.3 failed access. Gemini 3.5 access was verified, but `doctor` remains `Unknown` because the installed adapter's `detect()` always returns unknown auth state. No valid council/Auditor verdict exists. |

## Current Supabase advisor detail

The fresh security advisor has exactly three `INFO` findings and no `WARN`/`ERROR`:

1. `rls_enabled_no_policy` — `public.onboarding_events`
2. `rls_enabled_no_policy` — `public.processed_stripe_events`
3. `rls_enabled_no_policy` — `public.tutorial_redemptions`

These tables intentionally deny client CRUD through RLS today. They remain recorded follow-up items; they do not restore the removed broad client privileges.

## Exact remaining checkpoints

1. Obtain authenticated Supabase Dashboard/browser visibility for the selected completed backup, record final non-sensitive clone configuration and cost, and stop before confirmation.
2. Obtain explicit organization/user confirmation required by the restore tool and explicit drill authorization. Then execute the runbook, validate the isolated target, delete it, and retain settled billing/cleanup evidence.
3. Obtain read-only Vercel firewall, production environment-name, and successful secrets-free runtime/provider linkage evidence; do not stage or publish changes.
4. Obtain provider-owner read-only evidence for Anthropic/OpenAI spend and rate limits; do not inspect runtime keys.
5. Obtain a valid independent Three AImigos council/Auditor verdict. Access to one model is not a verdict, and an adapter that always reports unknown does not satisfy doctor readiness.

Until all five gates close, Phase 0 remains fail-closed **BLOCKED**. Do not push, merge, change `main`, or begin Phase 1.

## Historical evidence note

Earlier 2026-08-20 captures correctly recorded HIBP disabled, eight or nine migrations, a local-only pending extension migration, broad client grants, and transient Docker unavailability at those moments. Those are historical intermediate states. They are superseded by the current ten-pair migration result, applied hardening, enabled HIBP, and post-hardening parity evidence above.

## Official references

- Supabase backups and PITR: https://supabase.com/docs/guides/platform/backups
- Supabase restore to new project: https://supabase.com/docs/guides/platform/clone-project
- Supabase cost controls: https://supabase.com/docs/guides/platform/cost-control
- Supabase password security: https://supabase.com/docs/guides/auth/password-security
- Vercel Firewall: https://vercel.com/docs/vercel-firewall
- Anthropic rate and spend limits: https://platform.claude.com/docs/en/api/rate-limits
- OpenAI project controls: https://help.openai.com/en/articles/9186755-managing-your-work-in-the-api-platform-with-projects
