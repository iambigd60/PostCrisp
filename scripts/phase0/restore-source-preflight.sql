-- Phase 0 restore source preflight.
-- Read-only, metadata-only output. Never returns job commands, Vault payloads,
-- foreign-server options, user-mapping options, or application rows.

begin read only;
set local statement_timeout = '30s';

with relevant_extensions as (
  select e.extname
  from pg_catalog.pg_extension e
  where e.extname ~* '(cron|net|http|wrapper|fdw|vault|dblink|webhook|aws|stripe)'
     or e.extname in ('pg_cron', 'pg_net', 'wrappers', 'http', 'postgres_fdw')
),
cron_counts as (
  select
    pg_catalog.to_regclass('cron.job') is not null as catalog_present,
    case when pg_catalog.to_regclass('cron.job') is not null then
      ((pg_catalog.xpath(
        '//job_count/text()',
        pg_catalog.query_to_xml('select count(*) as job_count from cron.job', false, false, '')
      ))[1]::text)::bigint
    end as job_count,
    case when pg_catalog.to_regclass('cron.job') is not null then
      ((pg_catalog.xpath(
        '//active_job_count/text()',
        pg_catalog.query_to_xml('select count(*) as active_job_count from cron.job where active', false, false, '')
      ))[1]::text)::bigint
    end as active_job_count
),
net_counts as (
  select
    pg_catalog.to_regclass('net.http_request_queue') is not null as request_queue_present,
    case when pg_catalog.to_regclass('net.http_request_queue') is not null then
      ((pg_catalog.xpath(
        '//queued_request_count/text()',
        pg_catalog.query_to_xml(
          'select count(*) as queued_request_count from net.http_request_queue',
          false,
          false,
          ''
        )
      ))[1]::text)::bigint
    end as queued_request_count
),
subscription_counts as (
  select
    count(*)::bigint as total_count,
    count(*) filter (where subenabled)::bigint as enabled_count,
    count(*) filter (where not subenabled)::bigint as disabled_count,
    count(*)::bigint as non_platform_or_unclassified_count
  from pg_catalog.pg_subscription
),
replication_slot_counts as (
  select
    count(*)::bigint as total_count,
    count(*) filter (where active)::bigint as active_count,
    count(*) filter (where not active)::bigint as inactive_count,
    count(*) filter (where slot_type = 'logical')::bigint as logical_count,
    count(*) filter (where slot_type = 'physical')::bigint as physical_count,
    count(*)::bigint as non_platform_or_unclassified_count
  from pg_catalog.pg_replication_slots
),
vault_counts as (
  select
    pg_catalog.to_regnamespace('vault') is not null as schema_present,
    pg_catalog.to_regclass('vault.secrets') is not null as secrets_relation_present,
    case when pg_catalog.to_regclass('vault.secrets') is not null then
      ((pg_catalog.xpath(
        '//secret_count/text()',
        pg_catalog.query_to_xml('select count(*) as secret_count from vault.secrets', false, false, '')
      ))[1]::text)::bigint
    end as secret_count
),
foreign_access as (
  select
    (select count(*)::bigint from pg_catalog.pg_foreign_server) as server_count,
    (select count(*)::bigint from pg_catalog.pg_user_mappings) as user_mapping_count,
    coalesce(
      (
        select jsonb_agg(fdw.fdwname order by fdw.fdwname)
        from pg_catalog.pg_foreign_data_wrapper fdw
        where fdw.fdwname <> 'dummy'
      ),
      '[]'::jsonb
    ) as wrapper_names
),
outbound_function_references as (
  select
    count(*)::bigint as function_count,
    coalesce(
      jsonb_agg(
        format(
          '%I.%I(%s)',
          n.nspname,
          p.proname,
          pg_catalog.pg_get_function_identity_arguments(p.oid)
        )
        order by n.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid)
      ),
      '[]'::jsonb
    ) as function_identities
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname not in ('pg_catalog', 'information_schema')
    and p.prosrc ~* '(net\.(http_|http_)|extensions\.http|http_(get|post|put|delete)|cron\.schedule|dblink|aws_|wrappers)'
)
select jsonb_build_object(
  'captured_at', statement_timestamp(),
  'relevant_enabled_extensions', coalesce(
    (select jsonb_agg(extname order by extname) from relevant_extensions),
    '[]'::jsonb
  ),
  'cron', (select to_jsonb(cron_counts) from cron_counts),
  'pg_net', (select to_jsonb(net_counts) from net_counts),
  'subscriptions', (select to_jsonb(subscription_counts) from subscription_counts),
  'replication_slots', (select to_jsonb(replication_slot_counts) from replication_slot_counts),
  'vault', (select to_jsonb(vault_counts) from vault_counts),
  'foreign_access', (select to_jsonb(foreign_access) from foreign_access),
  'outbound_reference_function_count',
    (select function_count from outbound_function_references),
  'outbound_reference_functions',
    (select function_identities from outbound_function_references)
) as restore_source_preflight;

commit;
