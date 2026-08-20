-- Phase 0 Auth restore validation.
-- One read-only statement for the Supabase CLI prepared-statement path.
-- Returns only stable auth-schema metadata fingerprints and a bounded aggregate.
-- It never returns identities, rows, column values, passwords, tokens, or secrets.

with metadata_items as (
  select format(
    'schema|%s|owner=%s',
    n.nspname,
    pg_catalog.pg_get_userbyid(n.nspowner)
  ) as item
  from pg_catalog.pg_namespace n
  where n.nspname = 'auth'

  union all

  select format(
    'schema_acl|%s|grantor=%s|grantee=%s|privilege=%s|grantable=%s',
    n.nspname,
    pg_catalog.pg_get_userbyid(acl.grantor),
    case when acl.grantee = 0 then 'public' else pg_catalog.pg_get_userbyid(acl.grantee) end,
    acl.privilege_type,
    acl.is_grantable
  )
  from pg_catalog.pg_namespace n
  cross join lateral pg_catalog.aclexplode(n.nspacl) acl
  where n.nspname = 'auth'

  union all

  select format(
    'relation|%s|%s|%s|%s|%s|owner=%s',
    n.nspname,
    c.relname,
    c.relkind,
    c.relrowsecurity,
    c.relforcerowsecurity,
    pg_catalog.pg_get_userbyid(c.relowner)
  ) as item
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'auth'
    and c.relkind in ('r', 'p', 'v', 'm', 'S')

  union all

  select format(
    'view|%s|%s|%s|definition_md5=%s',
    n.nspname,
    c.relname,
    c.relkind,
    md5(replace(replace(pg_catalog.pg_get_viewdef(c.oid, false), E'\r\n', E'\n'), E'\r', E'\n'))
  )
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'auth'
    and c.relkind in ('v', 'm')

  union all

  select format(
    'relation_acl|%s|%s|grantor=%s|grantee=%s|privilege=%s|grantable=%s',
    n.nspname,
    c.relname,
    pg_catalog.pg_get_userbyid(acl.grantor),
    case when acl.grantee = 0 then 'public' else pg_catalog.pg_get_userbyid(acl.grantee) end,
    acl.privilege_type,
    acl.is_grantable
  )
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  cross join lateral pg_catalog.aclexplode(c.relacl) acl
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
    'column_acl|%s|%s|%s|grantor=%s|grantee=%s|privilege=%s|grantable=%s',
    n.nspname,
    c.relname,
    a.attname,
    pg_catalog.pg_get_userbyid(acl.grantor),
    case when acl.grantee = 0 then 'public' else pg_catalog.pg_get_userbyid(acl.grantee) end,
    acl.privilege_type,
    acl.is_grantable
  )
  from pg_catalog.pg_attribute a
  join pg_catalog.pg_class c on c.oid = a.attrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  cross join lateral pg_catalog.aclexplode(a.attacl) acl
  where n.nspname = 'auth'
    and a.attnum > 0
    and not a.attisdropped
    and a.attacl is not null

  union all

  select format(
    'enum|%s|%s|%s|%s',
    n.nspname,
    typ.typname,
    enum.enumsortorder,
    enum.enumlabel
  )
  from pg_catalog.pg_type typ
  join pg_catalog.pg_namespace n on n.oid = typ.typnamespace
  join pg_catalog.pg_enum enum on enum.enumtypid = typ.oid
  where n.nspname = 'auth'

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
    'trigger|%s|%s|enabled=%s|%s',
    c.relname,
    t.tgname,
    t.tgenabled,
    pg_catalog.pg_get_triggerdef(t.oid, false)
  )
  from pg_catalog.pg_trigger t
  join pg_catalog.pg_class c on c.oid = t.tgrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'auth'
    and not t.tgisinternal

  union all

  select format(
    'policy|%s|%s|%s|%s|roles=%s|%s|%s',
    c.relname,
    pol.polname,
    pol.polcmd,
    pol.polpermissive,
    coalesce(
      (
        select string_agg(
          case when role_oid = 0 then 'public' else pg_catalog.pg_get_userbyid(role_oid) end,
          ','
          order by case when role_oid = 0 then 'public' else pg_catalog.pg_get_userbyid(role_oid) end
        )
        from unnest(pol.polroles) as roles(role_oid)
      ),
      ''
    ),
    coalesce(pg_catalog.pg_get_expr(pol.polqual, pol.polrelid), ''),
    coalesce(pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid), '')
  )
  from pg_catalog.pg_policy pol
  join pg_catalog.pg_class c on c.oid = pol.polrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'auth'

  union all

  select format(
    'function|%s|%s|%s|%s|%s|%s|%s|owner=%s|definition_md5=%s',
    p.proname,
    pg_catalog.pg_get_function_identity_arguments(p.oid),
    pg_catalog.pg_get_function_result(p.oid),
    p.provolatile,
    p.prosecdef,
    p.prokind,
    l.lanname,
    pg_catalog.pg_get_userbyid(p.proowner),
    md5(replace(replace(pg_catalog.pg_get_functiondef(p.oid), E'\r\n', E'\n'), E'\r', E'\n'))
  )
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  join pg_catalog.pg_language l on l.oid = p.prolang
  where n.nspname = 'auth'

  union all

  select format(
    'function_acl|%s|%s|%s|grantor=%s|grantee=%s|privilege=%s|grantable=%s',
    n.nspname,
    p.proname,
    pg_catalog.pg_get_function_identity_arguments(p.oid),
    pg_catalog.pg_get_userbyid(acl.grantor),
    case when acl.grantee = 0 then 'public' else pg_catalog.pg_get_userbyid(acl.grantee) end,
    acl.privilege_type,
    acl.is_grantable
  )
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  cross join lateral pg_catalog.aclexplode(p.proacl) acl
  where n.nspname = 'auth'
),
metadata_signature as (
  select
    count(*)::bigint as item_count,
    md5(coalesce(string_agg(item, E'\n' order by item), '')) as signature_md5
  from metadata_items
),
global_role_items as (
  select format(
    'role|%s|super=%s|inherit=%s|createrole=%s|createdb=%s|login=%s|replication=%s|bypassrls=%s|connlimit=%s|validuntil=%s',
    r.rolname,
    r.rolsuper,
    r.rolinherit,
    r.rolcreaterole,
    r.rolcreatedb,
    r.rolcanlogin,
    r.rolreplication,
    r.rolbypassrls,
    r.rolconnlimit,
    coalesce(r.rolvaliduntil::text, '')
  ) as item
  from pg_catalog.pg_roles r

  union all

  select format(
    'membership|role=%s|member=%s|grantor=%s|admin=%s|inherit_option=%s|set_option=%s',
    pg_catalog.pg_get_userbyid(m.roleid),
    pg_catalog.pg_get_userbyid(m.member),
    pg_catalog.pg_get_userbyid(m.grantor),
    m.admin_option,
    case when m.inherit_option then 'true' else 'false' end,
    case when m.set_option then 'true' else 'false' end
  )
  from pg_catalog.pg_auth_members m

  union all

  select format(
    'setting|database=%s|role=%s|%s',
    case when s.setdatabase = 0 then 'all' else 'current' end,
    case when s.setrole = 0 then 'all' else pg_catalog.pg_get_userbyid(s.setrole) end,
    setting
  )
  from pg_catalog.pg_db_role_setting s
  cross join lateral unnest(s.setconfig) setting
  where s.setdatabase = 0
     or s.setdatabase = (
       select d.oid from pg_catalog.pg_database d where d.datname = current_database()
     )
),
global_role_signature as (
  select
    count(*)::bigint as item_count,
    md5(coalesce(string_agg(item, E'\n' order by item), '')) as signature_md5
  from global_role_items
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
  'global_role_item_count', (select item_count from global_role_signature),
  'global_role_signature_md5', (select signature_md5 from global_role_signature),
  'bounded_user_count', (select bounded_count from bounded_users),
  'bounded_user_count_cap', 100001,
  'bounded_user_count_capped', coalesce((select bounded_count = 100001 from bounded_users), false)
) as auth_restore_signature;
