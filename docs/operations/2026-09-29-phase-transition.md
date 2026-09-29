# Owner decision: Phase 0 to Phase 1

**Decision:** On 2026-09-29 Dennis directed PostCrisp to close Phase 0 and proceed to Phase 1. This is an owner-directed sequencing decision. The Phase 0 technical exit criteria did **not** all pass; the unresolved items below remain open work and must not be reported as verified recovery or provider controls.

**Phase 1 meaning:** billing and runtime-control fixes named in the 2026-08-20 Phase 0 containment spec. Older documents also use “Phase 1” for onboarding, Voice Trainer, and admin features that were already shipped; those are separate historical workstreams.

## What was verified before the transition

- Production migration history records 13 versions through `20260929182158`. The AI routing policy is applied; a read-only `authenticated` role probe sees all 72 configured overrides and `anon` sees none. PR #14 and CI passed.
- Supabase has completed physical backups. At the 2026-09-29 20:51 UTC Dashboard check, the newest backup was `2026-09-29T10:52:23Z`, before the 18:21 UTC AI routing policy migration.
- The Vercel `postcrisp` project displayed two enabled 429 firewall rules and Production variable names for both `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`. Dennis chose to retain both provider integrations.
- The connected Supabase organization listed eight existing projects and no active temporary restore project at the 20:51 UTC check. No restore was initiated by this task.

## Open work carried into Phase 1

1. **Recovery:** Dennis deferred the paid isolated restore drill. Backup availability is verified; restoring a production backup into an isolated project, checking recovered schema/data, deleting the target, and reconciling its charge were not verified. Resume only on a later specific instruction and the runbook's current-backup, cost, and safety checks.
2. **Database reproducibility:** The complete 13-migration chain has not been freshly reset and compared locally since PR #14; Docker was unavailable on this Mac. Historical ten- and twelve-migration parity evidence remains valid only for its dated checkpoint.
3. **Provider runtime controls:** Both API integrations remain. The masked Vercel keys are not linked to specific provider accounts. The OpenAI Personal Organization inspected in Edge showed zero credits and zero listed keys; this does not establish the status of the production key. There were no `generation_ai_calls` ledger rows after the AI routing migration at the 20:51 UTC read-only check. Effective routing, model access, spend limits, and rate limits need current, secrets-free evidence.
4. **Deployment settings:** Vercel labeled the service-role and two provider variables as Config values that look like secrets. Expected Stripe variable names were absent from the last Production inventory. Firewall rule configuration was verified, but actual rate-limit enforcement was not.
5. **Authentication and review:** The Before User Created Auth hook and real signup smoke checks remain open in `PICKUP.md`. The independent exit review specified by the Phase 0 plan was not performed against the final evidence.

## Phase 1 first work item

The [billing/runtime inventory](2026-09-29-phase-1-billing-runtime-inventory.md) starts Phase 1. It maps the current Stripe routes to the live Vercel variable names and identifies the missing Production billing configuration without revealing values or creating charges. Next, make missing configuration fail clearly and safely before enabling paid checkout, and keep provider spending and rate-limit evidence separate from mere key presence. No paid transaction or production billing activation is implied by the phase transition.

The owner decision permits Phase 1 work to start. Each future production mutation still needs its own normal review and deployment checks, and this record does not authorize a paid restore.
