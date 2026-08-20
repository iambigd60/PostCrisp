-- Read-only, catalog-only inventory of the public schema.
-- Emits one JSON object and intentionally excludes rows, secrets, OIDs,
-- owners/grantors, timestamps, sequence state, and other environment identities.
WITH tables AS (
  SELECT
    n.nspname AS schema,
    c.relname AS name,
    c.relkind = 'p' AS partitioned,
    c.relpersistence AS persistence,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced,
    c.relreplident AS replica_identity
  FROM pg_catalog.pg_class AS c
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
),
columns AS (
  SELECT
    n.nspname AS schema,
    c.relname AS table,
    a.attname AS name,
    a.attnum AS ordinal_position,
    pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
    a.attnotnull AS not_null,
    pg_catalog.pg_get_expr(d.adbin, d.adrelid, false) AS default,
    a.attidentity AS identity,
    a.attgenerated AS generated,
    CASE
      WHEN a.attcollation = t.typcollation THEN NULL
      ELSE quote_ident(cn.nspname) || '.' || quote_ident(coll.collname)
    END AS collation
  FROM pg_catalog.pg_attribute AS a
  JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  JOIN pg_catalog.pg_type AS t ON t.oid = a.atttypid
  LEFT JOIN pg_catalog.pg_attrdef AS d
    ON d.adrelid = a.attrelid
   AND d.adnum = a.attnum
  LEFT JOIN pg_catalog.pg_collation AS coll ON coll.oid = a.attcollation
  LEFT JOIN pg_catalog.pg_namespace AS cn ON cn.oid = coll.collnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND a.attnum > 0
    AND NOT a.attisdropped
),
constraints AS (
  SELECT
    n.nspname AS schema,
    c.relname AS table,
    con.conname AS name,
    con.contype AS type,
    pg_catalog.pg_get_constraintdef(con.oid, false) AS definition,
    con.condeferrable AS deferrable,
    con.condeferred AS initially_deferred,
    con.convalidated AS validated,
    con.connoinherit AS no_inherit
  FROM pg_catalog.pg_constraint AS con
  JOIN pg_catalog.pg_class AS c ON c.oid = con.conrelid
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
),
sequences AS (
  SELECT
    n.nspname AS schema,
    c.relname AS name,
    pg_catalog.format_type(s.seqtypid, NULL) AS data_type,
    s.seqstart AS start_value,
    s.seqincrement AS increment_by,
    s.seqmin AS min_value,
    s.seqmax AS max_value,
    s.seqcache AS cache_size,
    s.seqcycle AS cycle
  FROM pg_catalog.pg_sequence AS s
  JOIN pg_catalog.pg_class AS c ON c.oid = s.seqrelid
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
),
indexes AS (
  SELECT
    n.nspname AS schema,
    t.relname AS table,
    i.relname AS name,
    pg_catalog.pg_get_indexdef(x.indexrelid, 0, false) AS definition,
    x.indisunique AS unique,
    x.indisprimary AS primary,
    x.indisexclusion AS exclusion,
    x.indimmediate AS immediate,
    x.indisclustered AS clustered,
    x.indisreplident AS replica_identity,
    x.indisvalid AS valid,
    x.indisready AS ready
  FROM pg_catalog.pg_index AS x
  JOIN pg_catalog.pg_class AS i ON i.oid = x.indexrelid
  JOIN pg_catalog.pg_class AS t ON t.oid = x.indrelid
  JOIN pg_catalog.pg_namespace AS n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relkind IN ('r', 'p')
),
policies AS (
  SELECT
    n.nspname AS schema,
    c.relname AS table,
    p.polname AS name,
    p.polpermissive AS permissive,
    CASE p.polcmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      WHEN '*' THEN 'ALL'
    END AS command,
    ARRAY(
      SELECT CASE role_oid WHEN 0 THEN 'public' ELSE pg_catalog.pg_get_userbyid(role_oid) END
      FROM unnest(p.polroles) AS role_oid
      ORDER BY 1
    ) AS roles,
    pg_catalog.pg_get_expr(p.polqual, p.polrelid, false) AS using,
    pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid, false) AS with_check
  FROM pg_catalog.pg_policy AS p
  JOIN pg_catalog.pg_class AS c ON c.oid = p.polrelid
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
),
functions AS (
  SELECT
    n.nspname AS schema,
    p.proname AS name,
    pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments,
    p.prokind AS kind,
    pg_catalog.pg_get_function_result(p.oid) AS result_type,
    l.lanname AS language,
    p.provolatile AS volatility,
    p.proparallel AS parallel,
    p.prosecdef AS security_definer,
    p.proleakproof AS leakproof,
    p.proisstrict AS strict,
    ARRAY(SELECT setting FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS setting ORDER BY 1) AS config,
    pg_catalog.pg_get_functiondef(p.oid) AS definition
  FROM pg_catalog.pg_proc AS p
  JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
  JOIN pg_catalog.pg_language AS l ON l.oid = p.prolang
  WHERE n.nspname = 'public'
    AND p.prokind IN ('f', 'p')
),
triggers AS (
  SELECT
    n.nspname AS schema,
    c.relname AS table,
    t.tgname AS name,
    t.tgenabled AS enabled,
    pg_catalog.pg_get_triggerdef(t.oid, false) AS definition
  FROM pg_catalog.pg_trigger AS t
  JOIN pg_catalog.pg_class AS c ON c.oid = t.tgrelid
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND NOT t.tgisinternal
),
schema_grants AS (
  SELECT
    'SCHEMA'::text AS object_type,
    n.nspname AS schema,
    n.nspname AS object,
    NULL::text AS column,
    NULL::text AS identity_arguments,
    CASE acl.grantee WHEN 0 THEN 'public' ELSE pg_catalog.pg_get_userbyid(acl.grantee) END AS grantee,
    acl.privilege_type AS privilege,
    acl.is_grantable AS grantable,
    NULL::bigint AS source_count
  FROM pg_catalog.pg_namespace AS n
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(n.nspacl, pg_catalog.acldefault('n'::"char", n.nspowner))
  ) AS acl
  WHERE n.nspname = 'public'
    AND acl.grantee <> n.nspowner
),
relation_grants AS (
  SELECT
    CASE c.relkind WHEN 'S' THEN 'SEQUENCE' ELSE 'TABLE' END AS object_type,
    n.nspname AS schema,
    c.relname AS object,
    NULL::text AS column,
    NULL::text AS identity_arguments,
    CASE acl.grantee WHEN 0 THEN 'public' ELSE pg_catalog.pg_get_userbyid(acl.grantee) END AS grantee,
    acl.privilege_type AS privilege,
    acl.is_grantable AS grantable,
    NULL::bigint AS source_count
  FROM pg_catalog.pg_class AS c
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(c.relacl, pg_catalog.acldefault(
      (CASE c.relkind WHEN 'S' THEN 'S' ELSE 'r' END)::"char",
      c.relowner
    ))
  ) AS acl
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p', 'S')
    AND acl.grantee <> c.relowner
),
column_grants AS (
  SELECT
    'TABLE COLUMN'::text AS object_type,
    n.nspname AS schema,
    c.relname AS object,
    a.attname AS column,
    NULL::text AS identity_arguments,
    CASE acl.grantee WHEN 0 THEN 'public' ELSE pg_catalog.pg_get_userbyid(acl.grantee) END AS grantee,
    acl.privilege_type AS privilege,
    acl.is_grantable AS grantable,
    NULL::bigint AS source_count
  FROM pg_catalog.pg_attribute AS a
  JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(a.attacl) AS acl
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND a.attacl IS NOT NULL
    AND acl.grantee <> c.relowner
),
function_grants AS (
  SELECT
    CASE p.prokind WHEN 'p' THEN 'PROCEDURE' ELSE 'FUNCTION' END AS object_type,
    n.nspname AS schema,
    p.proname AS object,
    NULL::text AS column,
    pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments,
    CASE acl.grantee WHEN 0 THEN 'public' ELSE pg_catalog.pg_get_userbyid(acl.grantee) END AS grantee,
    acl.privilege_type AS privilege,
    acl.is_grantable AS grantable,
    NULL::bigint AS source_count
  FROM pg_catalog.pg_proc AS p
  JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(p.proacl, pg_catalog.acldefault('f'::"char", p.proowner))
  ) AS acl
  WHERE n.nspname = 'public'
    AND p.prokind IN ('f', 'p')
    AND acl.grantee <> p.proowner
),
default_grant_rows AS (
  SELECT
    CASE d.defaclobjtype
      WHEN 'r' THEN 'DEFAULT TABLE'
      WHEN 'S' THEN 'DEFAULT SEQUENCE'
      WHEN 'f' THEN 'DEFAULT FUNCTION'
      WHEN 'T' THEN 'DEFAULT TYPE'
      WHEN 'n' THEN 'DEFAULT SCHEMA'
      ELSE 'DEFAULT ' || d.defaclobjtype::text
    END AS object_type,
    n.nspname AS schema,
    'future objects'::text AS object,
    NULL::text AS column,
    NULL::text AS identity_arguments,
    CASE acl.grantee WHEN 0 THEN 'public' ELSE pg_catalog.pg_get_userbyid(acl.grantee) END AS grantee,
    acl.privilege_type AS privilege,
    acl.is_grantable AS grantable
  FROM pg_catalog.pg_default_acl AS d
  JOIN pg_catalog.pg_namespace AS n ON n.oid = d.defaclnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) AS acl
  WHERE n.nspname = 'public'
    AND acl.grantee <> d.defaclrole
),
default_grants AS (
  SELECT
    object_type,
    schema,
    object,
    "column",
    identity_arguments,
    grantee,
    privilege,
    grantable,
    count(*) AS source_count
  FROM default_grant_rows
  GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
),
grants AS (
  SELECT * FROM schema_grants
  UNION ALL
  SELECT * FROM relation_grants
  UNION ALL
  SELECT * FROM column_grants
  UNION ALL
  SELECT * FROM function_grants
  UNION ALL
  SELECT * FROM default_grants
)
SELECT jsonb_build_object(
  'tables', COALESCE((
    SELECT jsonb_agg(to_jsonb(t) ORDER BY t.schema, t.name) FROM tables AS t
  ), '[]'::jsonb),
  'columns', COALESCE((
    SELECT jsonb_agg(to_jsonb(c) ORDER BY c.schema, c.table, c.ordinal_position) FROM columns AS c
  ), '[]'::jsonb),
  'constraints', COALESCE((
    SELECT jsonb_agg(to_jsonb(c) ORDER BY c.schema, c.table, c.name) FROM constraints AS c
  ), '[]'::jsonb),
  'sequences', COALESCE((
    SELECT jsonb_agg(to_jsonb(s) ORDER BY s.schema, s.name) FROM sequences AS s
  ), '[]'::jsonb),
  'indexes', COALESCE((
    SELECT jsonb_agg(to_jsonb(i) ORDER BY i.schema, i.table, i.name) FROM indexes AS i
  ), '[]'::jsonb),
  'policies', COALESCE((
    SELECT jsonb_agg(to_jsonb(p) ORDER BY p.schema, p.table, p.name) FROM policies AS p
  ), '[]'::jsonb),
  'functions', COALESCE((
    SELECT jsonb_agg(to_jsonb(f) ORDER BY f.schema, f.name, f.identity_arguments) FROM functions AS f
  ), '[]'::jsonb),
  'triggers', COALESCE((
    SELECT jsonb_agg(to_jsonb(t) ORDER BY t.schema, t.table, t.name) FROM triggers AS t
  ), '[]'::jsonb),
  'grants', COALESCE((
    SELECT jsonb_agg(to_jsonb(g) ORDER BY g.object_type, g.schema, g.object, g.column,
      g.identity_arguments, g.grantee, g.privilege)
    FROM grants AS g
  ), '[]'::jsonb)
) AS inventory;
