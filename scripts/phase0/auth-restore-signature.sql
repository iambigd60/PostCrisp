-- Phase 0 Auth restore validation.
-- Returns only stable auth-schema metadata fingerprints and a bounded aggregate.
-- It never returns identities, rows, column values, passwords, tokens, or secrets.

begin read only;
set local statement_timeout = '30s';

with metadata_items as (
  select format(
    'relation|%s|%s|%s|%s|%s',
    n.nspname,
    c.relname,
    c.relkind,
    c.relrowsecurity,
    c.relforcerowsecurity
  ) as item
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'auth'
    and c.relkind in ('r', 'p', 'v', 'm', 'S')

  union all

  select format(
    'column|%s|%s|%s|%s|%s|%s',
    c.relname,
    a.attnum,
    a.attname,
    pg_catalog.format_type(a.atttypid, a.atttypmod),
    a.attnotnull,
    coalesce(pg_catalog.pg_get_expr(d.adbin, d.adrelid), '')
  )
  from pg_catalog.pg_attribute a
  join pg_catalog.pg_class c on c.oid = a.attrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  left join pg_catalog.pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where n.nspname = 'auth'
    and a.attnum > 0
    and not a.attisdropped

  union all

  select format(
    'constraint|%s|%s|%s|%s',
    c.relname,
    con.conname,
    con.contype,
    pg_catalog.pg_get_constraintdef(con.oid, false)
  )
  from pg_catalog.pg_constraint con
  join pg_catalog.pg_class c on c.oid = con.conrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'auth'

  union all

  select format('index|%s|%s', c.relname, pg_catalog.pg_get_indexdef(i.indexrelid))
  from pg_catalog.pg_index i
  join pg_catalog.pg_class c on c.oid = i.indrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'auth'

  union all

  select format(
    'trigger|%s|%s|%s',
    c.relname,
    t.tgname,
    pg_catalog.pg_get_triggerdef(t.oid, false)
  )
  from pg_catalog.pg_trigger t
  join pg_catalog.pg_class c on c.oid = t.tgrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'auth'
    and not t.tgisinternal

  union all

  select format(
    'policy|%s|%s|%s|%s|%s|%s',
    c.relname,
    pol.polname,
    pol.polcmd,
    pol.polpermissive,
    coalesce(pg_catalog.pg_get_expr(pol.polqual, pol.polrelid), ''),
    coalesce(pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid), '')
  )
  from pg_catalog.pg_policy pol
  join pg_catalog.pg_class c on c.oid = pol.polrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'auth'

  union all

  select format(
    'function|%s|%s|%s|%s|%s|%s|%s',
    p.proname,
    pg_catalog.pg_get_function_identity_arguments(p.oid),
    pg_catalog.pg_get_function_result(p.oid),
    p.provolatile,
    p.prosecdef,
    p.prokind,
    l.lanname
  )
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  join pg_catalog.pg_language l on l.oid = p.prolang
  where n.nspname = 'auth'
),
metadata_signature as (
  select
    count(*)::bigint as item_count,
    md5(coalesce(string_agg(item, E'\n' order by item), '')) as signature_md5
  from metadata_items
),
bounded_users as (
  select case when pg_catalog.to_regclass('auth.users') is not null then
    ((pg_catalog.xpath(
      '//bounded_count/text()',
      pg_catalog.query_to_xml(
        'select count(*) as bounded_count from (select 1 from auth.users limit 100001) as bounded',
        false,
        false,
        ''
      )
    ))[1]::text)::bigint
  end as bounded_count
)
select jsonb_build_object(
  'captured_at', statement_timestamp(),
  'auth_schema_present', pg_catalog.to_regnamespace('auth') is not null,
  'auth_users_relation_present', pg_catalog.to_regclass('auth.users') is not null,
  'metadata_item_count', (select item_count from metadata_signature),
  'metadata_signature_md5', (select signature_md5 from metadata_signature),
  'bounded_user_count', (select bounded_count from bounded_users),
  'bounded_user_count_cap', 100001,
  'bounded_user_count_capped', coalesce((select bounded_count = 100001 from bounded_users), false)
) as auth_restore_signature;

commit;
