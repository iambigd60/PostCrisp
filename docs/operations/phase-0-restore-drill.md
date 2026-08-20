# Phase 0 isolated restore drill

**Status:** `REQUIRES AUTHORIZATION` — designed but not executed.
**Source:** Supabase project `sikabeqzypvllimyostg` (`postcrisp`, `us-east-2`).
**Safety rule:** Never restore over production. The only permitted target is a newly created, disposable, non-production project.

## Authorization checkpoint

Stop before clicking **Restore** or invoking any create/restore API. The user must explicitly authorize all of the following in one checkpoint:

- create one temporary restore-to-new-project target in the current Supabase organization;
- copy production database data, database roles, Auth records, and the encryption root key into that isolated target;
- incur no more than **USD 10 total incremental spend for the drill** and no more than **USD 10/month recurring**;
- perform validation and target-only quarantine changes; and
- delete the target after validation, no later than four hours after it becomes healthy.

The authenticated cost preflight on 2026-08-20 returned USD 10 monthly for a new project. Supabase's [restore-to-new-project documentation](https://supabase.com/docs/guides/platform/clone-project) says a clone mirrors source compute and disk attributes and displays the final cost before confirmation. If that confirmation shows more than either ceiling, stop and request a new authorization. Do not rationalize or silently raise the ceiling.

## Roles and timing

| Role | Responsibility |
| --- | --- |
| Drill operator | Run the approved restore, preserve the read-only production boundary, execute validation, and avoid recording data values. |
| Validation reviewer | Check schema-comparison and aggregate-pass results independently before the drill is called passed. |
| Cleanup owner | The PostCrisp production owner who authorized the drill; confirm deletion of the disposable project and billing cessation. |

Expected elapsed time is 60–90 minutes after authorization: up to 45 minutes for creation/restore, 30 minutes for validation, and 15 minutes for cleanup and evidence. Supabase notes that actual restore duration depends on database size. The target has a hard four-hour lifetime; reaching that limit forces cleanup even if validation is incomplete.

## Preconditions

1. Re-run the read-only backup inventory:

   ```text
   supabase backups list --project-ref sikabeqzypvllimyostg --output json
   ```

   Require at least one `COMPLETED` physical backup and record only its timestamp and status. Do not record backup contents or credentials.
2. Confirm the selected source is the newest completed backup and that its age is acceptable to the reviewer. PITR is currently disabled, so there is no arbitrary recovery-time selection.
3. Confirm the authorization above is written and still within its cost and four-hour limits.
4. Prepare an encrypted, disposable operator workspace outside the repository for transient aggregate results and connection material. Nothing from that workspace may be committed.
5. Confirm the target name is unmistakably non-production, has no production domain, has no Vercel connection, and will not receive production provider, Stripe, email, webhook, or service credentials.
6. Read the current [Database Backups](https://supabase.com/docs/guides/platform/backups) and [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project) pages immediately before the drill because eligibility and behavior can change.

## Restore procedure

1. In the source project's **Database > Backups > Restore to a New Project** surface, select the newest completed backup.
2. At the final confirmation, verify the target region, compute, disk, and displayed cost. Abort if the target is production, the source is wrong, or either cost ceiling would be exceeded.
3. Create the isolated target. Record only the target project reference, selected backup timestamp, restore start time, displayed cost, and resulting health status in the transient workspace.
4. Wait for the target to report healthy. Do not redirect traffic, attach a domain, connect Vercel, deploy Edge Functions, configure production Auth, or add production secrets.
5. Before exercising application behavior, inspect target-only scheduled jobs and extensions capable of external operations, including `pg_cron`, `pg_net`, and wrappers. Disable any outbound job or integration in the target. Supabase explicitly warns that such extensions are copied and can perform external operations. Record only the action and result, not job payloads or secret values.

## Validation

### 1. Structural metadata

Run the committed catalog-only query `scripts/phase0/schema-inventory.sql` against the restored target. Save only its returned `inventory` object in the transient workspace. Compare it with `docs/operations/evidence/phase-0/2026-08-20-production-schema-inventory.json`:

```text
node scripts/phase0/compare-schema-inventory.mjs <committed-production-inventory> <transient-restored-inventory>
```

Pass requires exit 0 and `Schema inventories match.` The query excludes table rows, sequence values, secrets, OIDs, owners, and raw connection information. A difference is a failed drill until explained and independently reviewed; do not edit evidence or migrations to hide it.

### 2. Bounded aggregate sanity checks

Run the following read-only pattern separately on production and the restored target during a low-write window. It caps each scan result at 100,001 rows and returns no row values:

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

rollback;
```

Keep the numeric results only in the encrypted transient workspace. Commit only pass/fail and the query hash. Because production can receive writes after the selected backup, exact equality is required only when the reviewer confirms the source was quiescent. Otherwise:

- append-only target counts must not exceed the contemporaneous production count;
- differences must be compatible with the backup timestamp and known post-backup activity;
- a zero target count where the source count before the backup was nonzero fails;
- a capped result of 100,001 is recorded as `>=100001`, not treated as an exact count; and
- any unexplained reversal, timeout, missing relation, or error fails the drill.

Do not query or record emails, user identifiers, prompts, generated content, tokens, secrets, payment fields, API keys, or individual rows. Do not commit aggregate values.

### 3. Restore-scope checks

Record pass/fail only for these documented boundaries:

- public schema, grants, functions, triggers, indexes, and Auth schema metadata are present;
- Storage objects are not assumed restored merely because Storage metadata exists;
- Edge Functions, Auth settings/API keys, Realtime settings, and read replicas are not assumed copied;
- the target has no production domain, Vercel deployment, webhook destination, or provider credential; and
- no test sends email, calls an AI provider, processes Stripe activity, or writes to production.

## Pass criteria

The drill passes only when all of the following are true:

1. The restore completed in the isolated target without touching production.
2. The structural inventory comparator passed exactly.
3. Every bounded aggregate check passed under the rules above.
4. Restore-scope checks passed and no external side effect occurred.
5. The reviewer signed off on the evidence.
6. The cleanup owner deleted the target and confirmed that recurring cost stopped.

A successful restore without cleanup is not a pass. A designed but unexecuted drill is `REQUIRES AUTHORIZATION`, not verified.

## Failure, rollback, and cleanup

The drill has no production rollback step because production is never changed. On any failure:

1. Stop queries and application tests.
2. Disable target access or pause the target if necessary to contain unexpected outbound behavior.
3. Preserve only secrets-free timestamps, status codes, and structural error summaries.
4. Delete the disposable target through the authorized Supabase control surface.
5. Remove transient connection material and aggregate files from the encrypted operator workspace.
6. Confirm the project no longer appears active and that recurring billing has stopped.
7. Record the drill as failed or incomplete with the exact retry checkpoint.

If deletion itself fails, the cleanup owner opens a Supabase support case immediately and treats the USD 10/month ceiling and four-hour lifetime as an incident threshold. No second target may be created until the first is gone.
