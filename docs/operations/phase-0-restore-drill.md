# Phase 0 isolated restore drill

**Status:** `REQUIRES AUTHORIZATION` - designed but not executed.
**Source:** Supabase project `sikabeqzypvllimyostg` (`postcrisp`, `us-east-2`).
**Safety rule:** Never restore over production. The only permitted target is one newly created, disposable, isolated project after all access, preflight, cost, and authorization gates pass.

## Access checkpoint before authorization

General eligibility is `VERIFIED`: the organization is paid and the source has completed physical backups. Actual source eligibility and the operator-visible **Restore to a New Project** action are `BLOCKED BY ACCESS`; neither is exposed by the available read-only CLI/API surfaces, and the authenticated Dashboard action has not been observed.

An authenticated Supabase Dashboard operator must first perform a read-only inspection. Record only:

- whether the selected completed physical backup exposes **Restore to a New Project**;
- selected backup timestamp/status;
- proposed region and compute size;
- disk type, provisioned size, IOPS, and throughput;
- hourly/monthly add-ons, one-time charges, and the displayed estimate.

Stop before confirmation. Seeing the action does not authorize creating the target.

## Source preflight and outbound abort gate

Run the committed metadata-only query twice: once before requesting authorization and again immediately before clone confirmation.

```text
supabase db query --linked --file scripts/phase0/restore-source-preflight.sql --output-format json
```

The query returns enabled outbound-relevant extension names; `pg_cron` catalog/job/active-job counts when installed; `pg_net` request-queue presence/count when installed; total/enabled/disabled subscription counts; total/active/inactive/logical/physical replication-slot counts; conservative non-platform/unclassified counts; foreign-wrapper/server/user-mapping counts; metadata-only function identities that reference outbound facilities; and Vault schema/relation/count. It never returns subscription connection information, slot names, job commands, URLs, Vault payloads, foreign options, secrets, or application rows.

Catalog semantics are taken from the current PostgreSQL references for [`pg_subscription`](https://www.postgresql.org/docs/current/catalog-pg-subscription.html) and [`pg_replication_slots`](https://www.postgresql.org/docs/current/view-pg-replication-slots.html).

The latest read-only production execution at `2026-08-20T18:35:32.507518Z` found:

- no `pg_cron` catalog or jobs;
- no `pg_net` request queue;
- no foreign servers, user mappings, or wrapper names;
- zero subscriptions: zero enabled, disabled, and non-platform/unclassified;
- zero replication slots: zero active, inactive, logical, physical, and non-platform/unclassified;
- `supabase_vault` and `vault.secrets` present with zero secrets;
- one vendor helper identity, `extensions.grant_pg_net_access()`, while `pg_net` itself was absent.

That is point-in-time evidence only. It is not a permanent assumption and must not be copied forward without a fresh execution.

Abort before creating a target if the second execution differs unexpectedly or if any job, queue, foreign server/mapping, wrapper, webhook/network extension, outbound-reference function, or Vault/root-key-dependent integration could create an external side effect before target-only neutralization. Always abort on any enabled subscription. The query deliberately classifies every slot as non-platform/unclassified and uses no slot-name or prefix allowlist. A separate authoritative source-specific evidence record must verify each harmless platform slot; abort while any slot remains unclassified. Because a clone may copy and activate database mechanisms before the operator can connect, "disable it after restore" is not an acceptable pre-clone control. Resume only after Supabase provides a vendor-supported inert-start mechanism or a separately reviewed/authorized source-side neutralization plan. Do not mutate production under this runbook.

Regardless of Vault's current count, current official [clone documentation](https://supabase.com/docs/guides/platform/clone-project) states that the clone copies the encryption root key along with database data and enabled extensions. Treat the target, its Vault/root-key material, connection material, and all database contents as production-sensitive from creation through deletion.

## Cost estimate and authorization checkpoint

USD 10 is a safety objective, not an enforceable provider-side cap. Supabase bills compute by the hour, charges any partial hour as a full hour, and documents that Compute Hours are not covered by its Spend Cap. A four-hour target can therefore touch five billable hourly buckets. Supabase says compute billing stops after deletion, but usage/billing displays can lag. The preliminary generic new-project quote is not clone-specific and must not be used as the drill estimate.

Use the final proposed clone configuration to calculate this conservative estimate, without credits or included quotas:

```text
H = 5 billable hours

gp3 hourly rate =
  compute_rate
  + max(disk_GB - 8, 0) * 0.000171
  + max(IOPS - 3000, 0) * 0.00003288
  + max(throughput_MBps - 125, 0) * 0.00013
  + hourly_addons

io2 hourly rate =
  compute_rate
  + disk_GB * 0.000267
  + IOPS * 0.000163
  + hourly_addons

worst_case_4h_estimate =
  H * hourly_rate
  + 0.1 GB * USD 0.09/GB
  + one_time_charges
```

Current published compute rates in USD/hour are Micro `0.01344`, Small `0.0206`, Medium `0.0822`, Large `0.1517`, XL `0.2877`, 2XL `0.562`, 4XL `1.32`, 8XL `2.562`, 12XL `3.836`, and 16XL `5.12`. For example, five 4XL compute hours alone are `5 * 1.32 = USD 6.60`; five 8XL compute hours alone are `USD 12.81` and must abort.

The estimate must include every line item shown at confirmation. Limit total drill egress to 0.1 GB and price it from the first byte at the current uncached overage rate, adding `USD 0.009` even if plan quota remains. Only catalog/aggregate queries and the bounded recovery checks below are permitted. If any add-on, tax, one-time charge, or mirrored attribute cannot be conservatively quantified, the estimate is not a hard bound.

**Abort threshold:** do not request execution authorization unless `worst_case_4h_estimate < USD 8.00`. The USD 2.00 margin is for estimation error; it does not turn the estimate into a provider-enforced cap.

After the access and source-preflight gates pass, the user must explicitly authorize all of the following in one checkpoint:

- the exact selected physical-backup timestamp;
- creation of one production-sensitive temporary target with the recorded final configuration;
- the calculated five-billable-hour worst-case estimate below USD 8.00;
- residual-risk acceptance that delayed/unlisted usage, taxes, or billing adjustments could make actual incremental cost exceed the estimate or USD 10.00;
- validation and target-only quarantine actions; and
- deletion no later than four wall-clock hours after the target becomes healthy.

Without that explicit residual-risk acceptance, do not create the target.

Official current billing sources: [compute](https://supabase.com/docs/guides/platform/manage-your-usage/compute), [cost controls](https://supabase.com/docs/guides/platform/cost-control), [disk size](https://supabase.com/docs/guides/platform/manage-your-usage/disk-size), [disk IOPS](https://supabase.com/docs/guides/platform/manage-your-usage/disk-iops), [disk throughput](https://supabase.com/docs/guides/platform/manage-your-usage/disk-throughput), and [egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress).

## Roles and timing

| Role | Responsibility |
| --- | --- |
| Drill operator | Run only the authorized restore, maintain the production read-only boundary, execute validation, and avoid recording values. |
| Validation reviewer | Independently check query hashes, comparison results, backup-time caveats, and evidence before a pass. |
| Cleanup owner | The PostCrisp production owner who authorized the drill; delete the target and obtain post-deletion usage/billing evidence. |
| Incident owner | The PostCrisp production owner; coordinate containment, notification, credential rotation/revocation, and compensating action for any external side effect that target deletion cannot undo. |

Expected elapsed time is 60-90 minutes after authorization: up to 45 minutes for creation/restore, 30 minutes for validation, and 15 minutes for cleanup. The target has a hard four-wall-clock-hour lifetime; reaching it forces cleanup even if validation is incomplete.

## Preconditions

1. Re-run `supabase backups list --project-ref sikabeqzypvllimyostg --output json`. Require a `COMPLETED` physical backup and record only timestamp/status. PITR is disabled, so there is no arbitrary recovery-time selection.
2. Complete the Dashboard access checkpoint and final configuration estimate without confirming creation.
3. Run the source preflight before authorization, then run it again immediately before clone confirmation. Both must satisfy the outbound abort gate.
4. Confirm written authorization names the backup/configuration, estimate, residual risk, four-hour lifetime, and production-sensitive handling.
5. Prepare an encrypted disposable workspace outside the repository for transient aggregate files and connection material.
6. Confirm the target name is unmistakably non-production, has no production domain or Vercel connection, and will not receive production provider, Stripe, email, webhook, or service credentials.
7. Re-read [Database Backups](https://supabase.com/docs/guides/platform/backups) and [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project) immediately before execution.

## Restore procedure

1. In **Database > Backups**, choose the exact authorized completed backup and its operator-visible **Restore to a New Project** action.
2. Reconcile the final proposed region/compute/disk/add-ons with the authorized configuration and recompute the estimate. Abort on any difference or at `>= USD 8.00`.
3. Create the isolated target. Record only target reference, selected backup timestamp, restore start, non-sensitive configuration/estimate, and health status in the transient workspace.
4. Wait for healthy status. Do not redirect traffic, attach a domain, connect Vercel, deploy Edge Functions, configure production Auth, or add production secrets.
5. Before application behavior, rerun `restore-source-preflight.sql` on the target. Any unexpected outbound-capable state is a failure and incident; do not inspect commands/payloads.

## Validation

### 1. Structural metadata

Run `scripts/phase0/schema-inventory.sql` against the restored target and compare its returned `inventory` object with the committed production inventory:

```text
node scripts/phase0/compare-schema-inventory.mjs docs/operations/evidence/phase-0/2026-08-20-production-schema-inventory.json <transient-restored-inventory>
```

Pass requires exit 0 and `Schema inventories match.` Any unexplained difference fails the drill.

### 2. Auth metadata and bounded aggregate

The executable query `scripts/phase0/auth-restore-signature.sql` returns only:

- an Auth schema metadata item count and MD5 signature;
- canonical schema/relation/routine ownership and explicit ACL privilege metadata;
- policy definitions with deterministically sorted policy-role metadata;
- routine metadata plus MD5 hashes of definitions normalized only for CRLF/CR line endings;
- presence booleans for the `auth` schema and `auth.users` relation;
- a transient user aggregate capped at 100,001; and
- capture timestamp/cap metadata.

Raw owner/ACL/policy-role names and routine definitions are incorporated only into canonical metadata items and are never emitted; the query returns only the aggregate signature. OIDs are excluded because they are restore-unstable. Global role memberships and settings outside the `auth` schema are also excluded; a drift confined to those external surfaces will not be detected by this Auth signature and must be covered by separate schema/role evidence. It returns no identities, rows, email addresses, phone numbers, passwords, tokens, secrets, or routine bodies. The SQL is one prepared-statement-compatible read-only command with no transaction or session-setting commands. Its SHA-256 at this review is `F9CCD7C12E905BC142FC8250EA0209CB113E04CB85CD57F45518C9BE5E130338`; immediately before use, recompute `Get-FileHash scripts/phase0/auth-restore-signature.sql -Algorithm SHA256` and require the same hash as the reviewed commit.

The comparator requires a positive `metadata_item_count` and the reviewed query's exact `bounded_user_count_cap` of `100001` in every signature capture. All signature-capture caps must also match one another. The four-point ordering result is emitted as `checks.backup_and_capture_chronology_valid`, covering the selected backup timestamp plus source-before-authorization, source-before-clone, and clone captures.

Metadata behavior follows the current PostgreSQL catalog and information-function references for [`pg_policy`](https://www.postgresql.org/docs/current/catalog-pg-policy.html), [`pg_proc`](https://www.postgresql.org/docs/current/catalog-pg-proc.html), and [`pg_get_functiondef`](https://www.postgresql.org/docs/current/functions-info.html).

Execute it against the source before authorization, again immediately before clone, and against the healthy clone. The credential-free launcher uses the authenticated [Supabase CLI query surface](https://supabase.com/docs/reference/cli/supabase-db-query), pins CLI `2.115.0`, and applies Node's documented 45,000 ms child-process [`timeout`](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options). On Windows it follows Node's documented `cmd.exe` launch pattern for `.cmd` shims. It accepts only `--linked`, `--local`, or a 20-lowercase-letter `--project-ref`. On success stdout is exactly one JSON object containing `auth_restore_signature`; CLI status and transaction lines are not included. Store raw outputs only in the encrypted transient workspace:

```text
node scripts/phase0/capture-auth-restore-signature.mjs --linked
node scripts/phase0/capture-auth-restore-signature.mjs --project-ref <clone-ref>
```

For a fresh local clone stand-in, use `node scripts/phase0/capture-auth-restore-signature.mjs --local`. Exit 0 means the single read-only query completed and stdout parsed to the required object. Exit 1 means invalid arguments, timeout/cancellation, CLI failure, non-JSON output, or a missing signature object; do not use a partial capture.

Compare the three transient outputs and bind them to the selected backup timestamp:

```text
node scripts/phase0/compare-auth-restore-signature.mjs \
  --query scripts/phase0/auth-restore-signature.sql \
  --backup-timestamp <selected-backup-ISO-8601> \
  <source-before-authorization.json> \
  <source-before-clone.json> \
  <clone.json>
```

Comparison results:

- `PASS_BOUNDED` / exit 0: Auth schema/users relation present, the complete four-point chronology is valid, metadata item count is positive, metadata signatures match, every signature capture uses the reviewed `100001` cap, counts are uncapped, and all three bounded counts match.
- `FAIL` / exit 1: missing Auth structure, malformed or wrongly typed evidence, invalid hash/count/cap semantics, any violation of `backup <= source-before-authorization <= source-before-clone <= clone`, or metadata-signature mismatch.
- `INDETERMINATE` / exit 2: a count reaches the cap or differs. The drill cannot pass without independently authorized backup-time aggregate evidence or a newer backup/retry.

Only the comparator's secrets-free output may be retained: query hash, selected backup/capture timestamps, metadata signature, equality booleans, status, and limitation. Delete raw aggregates after review.

The selected backup cannot be queried before restore. Users may be created or deleted between its timestamp and either source capture, and offsetting creates/deletions can leave the same count. Therefore even `PASS_BOUNDED` is a bounded sanity result, not proof of Auth row identity or completeness. Do not claim more.

### 3. Bounded application aggregates

Run this read-only, values-free query in the same three-capture sequence. It returns only bounded counts and caps each relation at 100,001 rows:

```sql
begin read only;
set local statement_timeout = '30s';

select 'profiles' as relation, count(*) as bounded_count
from (select 1 from public.profiles limit 100001) as bounded
union all
select 'generations', count(*)
from (select 1 from public.generations limit 100001) as bounded
union all
select 'credit_transactions', count(*)
from (select 1 from public.credit_transactions limit 100001) as bounded
union all
select 'purchased_credits', count(*)
from (select 1 from public.purchased_credits limit 100001) as bounded
union all
select 'processed_stripe_events', count(*)
from (select 1 from public.processed_stripe_events limit 100001) as bounded
union all
select 'ai_config_overrides', count(*)
from (select 1 from public.ai_config_overrides limit 100001) as bounded
order by relation;

commit;
```

Keep numeric results only in the transient workspace. Exact uncapped equality across both source captures and clone is a bounded pass. A capped or different result is `INDETERMINATE`, not proof of data loss, because backup-time creates/deletions cannot be reconstructed from these aggregates; the drill cannot pass until independently authorized backup-time evidence or a newer backup/retry resolves it. Missing relations, timeouts, or query errors fail.

### 4. Application recovery path

Use only the isolated target and a dedicated non-production test identity. Verify login/session creation, one explicitly authorized recovery-link flow, and expected failure for an invalid/expired recovery token. Do not send mail or SMS to production recipients. Preserve only status/timing and structural error summaries.

### 5. Restore scope and isolation

Confirm Storage objects, Edge Functions, production domains, Vercel links, production provider/Stripe/email credentials, and production traffic are absent. Confirm no external side effect occurred.

## Pass criteria

All of the following are required:

1. The authorized physical backup restored into the isolated target.
2. Structural inventory matched.
3. Auth comparison returned `PASS_BOUNDED`, with its stated limitation.
4. Bounded application aggregates passed under their stated limitation.
5. Application recovery and isolation checks passed without an external side effect.
6. The validation reviewer signed off.
7. The cleanup owner deleted the target and obtained settled usage/billing evidence.

A successful restore without cleanup/billing evidence is not a pass. A designed but unexecuted drill remains `REQUIRES AUTHORIZATION`.

## Failure, incident response, rollback, and cleanup

On any failure:

1. Stop queries and application tests.
2. Disable target access or pause the target if needed to contain unexpected behavior.
3. Preserve only secrets-free timestamps, status codes, and structural error summaries.
4. Delete the disposable target through the authorized Supabase control surface.
5. Remove transient connection material and raw aggregate files.
6. Confirm the project is inactive/deleted.
7. Capture the Usage/Billing view immediately after deletion, then again after usage settles (within 24 hours or on the resulting invoice if later). Record only incremental line items/total, deletion time, and cessation of recurring compute.
8. Record the drill failed/incomplete with the exact retry checkpoint.

Production is not changed by the normal drill, so its normal rollback is target deletion. Target deletion cannot undo an email/SMS/webhook/provider call, credential disclosure, or other external side effect. If one occurs, the incident owner must immediately invoke the PostCrisp incident process, identify the affected external system without exposing payloads, revoke/rotate affected credentials under incident authority, notify the system/recipient owner as required, perform the system-specific compensating action, and document impact. Deleting the target remains necessary but is not sufficient rollback.

If deletion fails, the cleanup owner opens a Supabase support case immediately and treats the four-hour lifetime as an incident threshold. No second target may be created until the first is deleted and billing cessation is evidenced.
