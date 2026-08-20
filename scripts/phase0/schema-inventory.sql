-- Read-only, catalog-only inventory of the public application schema and
-- installed extension state.
-- Emits one JSON object and intentionally excludes rows, secrets, OIDs,
-- owners/grantors, timestamps, sequence state, and other environment identities.
WITH application_schemas AS (
  SELECT
    n.nspname AS name,
    EXISTS (
      SELECT 1
      FROM pg_catalog.pg_depend AS d
      WHERE d.classid = 'pg_catalog.pg_namespace'::pg_catalog.regclass
        AND d.objid = n.oid
        AND d.objsubid = 0
        AND d.refclassid = 'pg_catalog.pg_extension'::pg_catalog.regclass
        AND d.deptype = 'e'
    ) AS extension_owned
  FROM pg_catalog.pg_namespace AS n
  WHERE n.nspname = 'public'
),
extensions AS (
  SELECT
    e.extname AS name,
    e.extversion AS version,
    n.nspname AS schema,
    e.extrelocatable AS relocatable
  FROM pg_catalog.pg_extension AS e
  JOIN pg_catalog.pg_namespace AS n ON n.oid = e.extnamespace
),
tables AS (
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
    AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
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
    s.seqcycle AS cycle,
    owned.schema AS owned_by_schema,
    owned.table AS owned_by_table,
    owned.column AS owned_by_column
  FROM pg_catalog.pg_sequence AS s
  JOIN pg_catalog.pg_class AS c ON c.oid = s.seqrelid
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  LEFT JOIN LATERAL (
    SELECT
      tn.nspname AS schema,
      tc.relname AS table,
      a.attname AS column
    FROM pg_catalog.pg_depend AS d
    JOIN pg_catalog.pg_class AS tc ON tc.oid = d.refobjid
    JOIN pg_catalog.pg_namespace AS tn ON tn.oid = tc.relnamespace
    JOIN pg_catalog.pg_attribute AS a
      ON a.attrelid = tc.oid
     AND a.attnum = d.refobjsubid
    WHERE d.classid = 'pg_catalog.pg_class'::pg_catalog.regclass
      AND d.objid = c.oid
      AND d.objsubid = 0
      AND d.refclassid = 'pg_catalog.pg_class'::pg_catalog.regclass
      AND d.deptype IN ('a', 'i')
    ORDER BY d.deptype
    LIMIT 1
  ) AS owned ON true
  WHERE n.nspname = 'public'
),
views AS (
  SELECT
    n.nspname AS schema,
    c.relname AS name,
    CASE c.relkind WHEN 'm' THEN 'materialized_view' ELSE 'view' END AS kind,
    c.relpersistence AS persistence,
    CASE WHEN c.relkind = 'm' THEN c.relispopulated ELSE NULL END AS populated,
    ARRAY(
      SELECT option
      FROM unnest(COALESCE(c.reloptions, ARRAY[]::text[])) AS option
      ORDER BY option
    ) AS options,
    pg_catalog.pg_get_viewdef(c.oid, false) AS definition
  FROM pg_catalog.pg_class AS c
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('v', 'm')
),
foreign_tables AS (
  SELECT
    n.nspname AS schema,
    c.relname AS name,
    fs.srvname AS server,
    fdw.fdwname AS wrapper,
    COALESCE(pg_catalog.array_length(ft.ftoptions, 1), 0) > 0 AS table_options_present,
    EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS a
      WHERE a.attrelid = c.oid
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND COALESCE(pg_catalog.array_length(a.attfdwoptions, 1), 0) > 0
    ) AS column_options_present
  FROM pg_catalog.pg_foreign_table AS ft
  JOIN pg_catalog.pg_class AS c ON c.oid = ft.ftrelid
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  JOIN pg_catalog.pg_foreign_server AS fs ON fs.oid = ft.ftserver
  JOIN pg_catalog.pg_foreign_data_wrapper AS fdw ON fdw.oid = fs.srvfdw
  WHERE n.nspname = 'public'
),
types AS (
  SELECT
    n.nspname AS schema,
    t.typname AS name,
    CASE t.typtype
      WHEN 'b' THEN 'base'
      WHEN 'c' THEN 'composite'
      WHEN 'd' THEN 'domain'
      WHEN 'e' THEN 'enum'
      WHEN 'm' THEN 'multirange'
      WHEN 'r' THEN 'range'
      ELSE t.typtype::text
    END AS kind,
    t.typcategory AS category,
    t.typispreferred AS preferred,
    t.typcollation <> 0 AS collatable,
    t.typdelim AS delimiter,
    CASE WHEN t.typtype = 'd'
      THEN pg_catalog.format_type(t.typbasetype, t.typtypmod)
    END AS base_type,
    CASE WHEN t.typtype = 'd' THEN t.typnotnull END AS domain_not_null,
    CASE WHEN t.typtype = 'd' THEN t.typdefault END AS domain_default,
    COALESCE((
      SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder)
      FROM pg_catalog.pg_enum AS e
      WHERE e.enumtypid = t.oid
    ), '[]'::jsonb) AS enum_labels,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', a.attname,
          'ordinal_position', a.attnum,
          'data_type', pg_catalog.format_type(a.atttypid, a.atttypmod),
          'collation', CASE WHEN a.attcollation <> 0
            THEN pg_catalog.format('%I.%I', cn.nspname, coll.collname)
          END
        )
        ORDER BY a.attnum
      )
      FROM pg_catalog.pg_attribute AS a
      LEFT JOIN pg_catalog.pg_collation AS coll ON coll.oid = a.attcollation
      LEFT JOIN pg_catalog.pg_namespace AS cn ON cn.oid = coll.collnamespace
      WHERE t.typtype = 'c'
        AND a.attrelid = t.typrelid
        AND a.attnum > 0
        AND NOT a.attisdropped
    ), '[]'::jsonb) AS composite_attributes,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', con.conname,
          'definition', pg_catalog.pg_get_constraintdef(con.oid, false)
        )
        ORDER BY con.conname
      )
      FROM pg_catalog.pg_constraint AS con
      WHERE con.contypid = t.oid
    ), '[]'::jsonb) AS domain_constraints,
    CASE WHEN r.rngtypid IS NOT NULL
      THEN pg_catalog.format_type(r.rngsubtype, NULL)
    END AS range_subtype,
    CASE WHEN r.rngtypid IS NOT NULL AND r.rngcollation <> 0
      THEN pg_catalog.format('%I.%I', rcn.nspname, rc.collname)
    END AS range_collation,
    CASE WHEN r.rngtypid IS NOT NULL
      THEN pg_catalog.format('%I.%I', ocn.nspname, oc.opcname)
    END AS range_subtype_opclass,
    CASE WHEN r.rngcanonical <> 0
      THEN pg_catalog.format(
        '%I.%I(%s)',
        canonical_n.nspname,
        canonical_p.proname,
        pg_catalog.pg_get_function_identity_arguments(canonical_p.oid)
      )
    END AS range_canonical_function,
    CASE WHEN r.rngsubdiff <> 0
      THEN pg_catalog.format(
        '%I.%I(%s)',
        subdiff_n.nspname,
        subdiff_p.proname,
        pg_catalog.pg_get_function_identity_arguments(subdiff_p.oid)
      )
    END AS range_subtype_diff_function,
    CASE WHEN r.rngtypid IS NOT NULL
      THEN pg_catalog.format_type(r.rngmultitypid, NULL)
    END AS range_multirange_type,
    CASE WHEN t.typtype = 'b' THEN t.typlen END AS base_internal_length,
    CASE WHEN t.typtype = 'b' THEN t.typbyval END AS base_passed_by_value,
    CASE WHEN t.typtype = 'b' THEN t.typalign END AS base_alignment,
    CASE WHEN t.typtype = 'b' THEN t.typstorage END AS base_storage,
    CASE WHEN t.typtype = 'b'
      THEN pg_catalog.format(
        '%I.%I(%s)',
        input_n.nspname,
        input_p.proname,
        pg_catalog.pg_get_function_identity_arguments(input_p.oid)
      )
    END AS base_input_function,
    CASE WHEN t.typtype = 'b'
      THEN pg_catalog.format(
        '%I.%I(%s)',
        output_n.nspname,
        output_p.proname,
        pg_catalog.pg_get_function_identity_arguments(output_p.oid)
      )
    END AS base_output_function,
    extension.extname AS extension
  FROM pg_catalog.pg_type AS t
  JOIN pg_catalog.pg_namespace AS n ON n.oid = t.typnamespace
  LEFT JOIN pg_catalog.pg_class AS c ON c.oid = t.typrelid
  LEFT JOIN pg_catalog.pg_range AS r ON r.rngtypid = t.oid OR r.rngmultitypid = t.oid
  LEFT JOIN pg_catalog.pg_collation AS rc ON rc.oid = r.rngcollation
  LEFT JOIN pg_catalog.pg_namespace AS rcn ON rcn.oid = rc.collnamespace
  LEFT JOIN pg_catalog.pg_opclass AS oc ON oc.oid = r.rngsubopc
  LEFT JOIN pg_catalog.pg_namespace AS ocn ON ocn.oid = oc.opcnamespace
  LEFT JOIN pg_catalog.pg_proc AS canonical_p ON canonical_p.oid = r.rngcanonical
  LEFT JOIN pg_catalog.pg_namespace AS canonical_n ON canonical_n.oid = canonical_p.pronamespace
  LEFT JOIN pg_catalog.pg_proc AS subdiff_p ON subdiff_p.oid = r.rngsubdiff
  LEFT JOIN pg_catalog.pg_namespace AS subdiff_n ON subdiff_n.oid = subdiff_p.pronamespace
  LEFT JOIN pg_catalog.pg_proc AS input_p ON input_p.oid = t.typinput
  LEFT JOIN pg_catalog.pg_namespace AS input_n ON input_n.oid = input_p.pronamespace
  LEFT JOIN pg_catalog.pg_proc AS output_p ON output_p.oid = t.typoutput
  LEFT JOIN pg_catalog.pg_namespace AS output_n ON output_n.oid = output_p.pronamespace
  LEFT JOIN LATERAL (
    SELECT e.extname
    FROM pg_catalog.pg_depend AS d
    JOIN pg_catalog.pg_extension AS e ON e.oid = d.refobjid
    WHERE d.classid = 'pg_catalog.pg_type'::pg_catalog.regclass
      AND d.objid = t.oid
      AND d.objsubid = 0
      AND d.refclassid = 'pg_catalog.pg_extension'::pg_catalog.regclass
      AND d.deptype = 'e'
    LIMIT 1
  ) AS extension ON true
  WHERE n.nspname = 'public'
    AND t.typisdefined
    AND (
      t.typtype IN ('d', 'e', 'r', 'm')
      OR (t.typtype = 'c' AND c.relkind = 'c')
      OR (t.typtype = 'b' AND t.typelem = 0)
    )
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
    AND t.relkind IN ('r', 'p', 'm')
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
    fn.nspname AS function_schema,
    f.proname AS function_name,
    pg_catalog.pg_get_function_identity_arguments(f.oid) AS function_identity_arguments,
    pg_catalog.pg_get_triggerdef(t.oid, false) AS definition
  FROM pg_catalog.pg_trigger AS t
  JOIN pg_catalog.pg_class AS c ON c.oid = t.tgrelid
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  JOIN pg_catalog.pg_proc AS f ON f.oid = t.tgfoid
  JOIN pg_catalog.pg_namespace AS fn ON fn.oid = f.pronamespace
  WHERE NOT t.tgisinternal
    AND (n.nspname = 'public' OR fn.nspname = 'public')
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
    NULL::text AS creator_acl_fingerprint
  FROM pg_catalog.pg_namespace AS n
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(n.nspacl, pg_catalog.acldefault('n'::"char", n.nspowner))
  ) AS acl
  WHERE n.nspname = 'public'
    AND acl.grantee <> n.nspowner
),
relation_grants AS (
  SELECT
    CASE c.relkind
      WHEN 'S' THEN 'SEQUENCE'
      WHEN 'v' THEN 'VIEW'
      WHEN 'm' THEN 'MATERIALIZED VIEW'
      WHEN 'f' THEN 'FOREIGN TABLE'
      ELSE 'TABLE'
    END AS object_type,
    n.nspname AS schema,
    c.relname AS object,
    NULL::text AS column,
    NULL::text AS identity_arguments,
    CASE acl.grantee WHEN 0 THEN 'public' ELSE pg_catalog.pg_get_userbyid(acl.grantee) END AS grantee,
    acl.privilege_type AS privilege,
    acl.is_grantable AS grantable,
    NULL::text AS creator_acl_fingerprint
  FROM pg_catalog.pg_class AS c
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(c.relacl, pg_catalog.acldefault(
      (CASE c.relkind WHEN 'S' THEN 'S' ELSE 'r' END)::"char",
      c.relowner
    ))
  ) AS acl
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
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
    NULL::text AS creator_acl_fingerprint
  FROM pg_catalog.pg_attribute AS a
  JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(a.attacl) AS acl
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
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
    NULL::text AS creator_acl_fingerprint
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
    d.defaclrole AS creator_id,
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
default_creator_fingerprints AS (
  SELECT
    creator_id,
    pg_catalog.md5(pg_catalog.string_agg(
      pg_catalog.concat_ws(
        '|', object_type, schema, object, "column", identity_arguments,
        grantee, privilege, grantable::text
      ),
      E'\n' ORDER BY object_type, schema, object, "column", identity_arguments,
        grantee, privilege, grantable
    )) AS creator_acl_fingerprint
  FROM default_grant_rows
  GROUP BY creator_id
),
default_grants AS (
  SELECT
    r.object_type,
    r.schema,
    r.object,
    r."column",
    r.identity_arguments,
    r.grantee,
    r.privilege,
    r.grantable,
    f.creator_acl_fingerprint
  FROM default_grant_rows AS r
  JOIN default_creator_fingerprints AS f USING (creator_id)
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
  'inventory_contract_version', 3,
  'application_schemas', COALESCE((
    SELECT jsonb_agg(to_jsonb(s) ORDER BY s.name) FROM application_schemas AS s
  ), '[]'::jsonb),
  'extensions', COALESCE((
    SELECT jsonb_agg(to_jsonb(e) ORDER BY e.name) FROM extensions AS e
  ), '[]'::jsonb),
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
  'views', COALESCE((
    SELECT jsonb_agg(to_jsonb(v) ORDER BY v.schema, v.name) FROM views AS v
  ), '[]'::jsonb),
  'foreign_tables', COALESCE((
    SELECT jsonb_agg(to_jsonb(f) ORDER BY f.schema, f.name) FROM foreign_tables AS f
  ), '[]'::jsonb),
  'types', COALESCE((
    SELECT jsonb_agg(to_jsonb(t) ORDER BY t.schema, t.name) FROM types AS t
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
      g.identity_arguments, g.grantee, g.privilege, g.creator_acl_fingerprint)
    FROM grants AS g
  ), '[]'::jsonb)
) AS inventory;
