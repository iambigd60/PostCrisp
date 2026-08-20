-- Local integration probe for the Phase 0 client-role grant boundary.
-- The single DO statement is atomic: a failed assertion rolls back the
-- controlled probe objects, while success removes them explicitly.
DO $probe$
DECLARE
  forbidden_current_tables integer;
  forbidden_current_sequences integer;
  forbidden_postgres_default_tables integer;
  forbidden_postgres_default_sequences integer;
  forbidden_future_tables integer;
  forbidden_future_sequences integer;
BEGIN
  CREATE TABLE public.phase0_probe_postgres_grant_table (id bigint);
  CREATE SEQUENCE public.phase0_probe_postgres_grant_sequence;

  SELECT count(*)
  INTO forbidden_current_tables
  FROM pg_catalog.pg_class AS c
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(c.relacl, pg_catalog.acldefault('r'::"char", c.relowner))
  ) AS acl
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND c.relname <> 'phase0_probe_postgres_grant_table'
    AND acl.grantee IN (
      'anon'::pg_catalog.regrole,
      'authenticated'::pg_catalog.regrole
    )
    AND acl.privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN');

  SELECT count(*)
  INTO forbidden_current_sequences
  FROM pg_catalog.pg_class AS c
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(c.relacl, pg_catalog.acldefault('S'::"char", c.relowner))
  ) AS acl
  WHERE n.nspname = 'public'
    AND c.relkind = 'S'
    AND c.relname <> 'phase0_probe_postgres_grant_sequence'
    AND acl.grantee IN (
      'anon'::pg_catalog.regrole,
      'authenticated'::pg_catalog.regrole
    )
    AND acl.privilege_type IN ('USAGE', 'SELECT', 'UPDATE');

  SELECT count(*) FILTER (WHERE d.defaclobjtype = 'r'),
         count(*) FILTER (WHERE d.defaclobjtype = 'S')
  INTO forbidden_postgres_default_tables,
       forbidden_postgres_default_sequences
  FROM pg_catalog.pg_default_acl AS d
  JOIN pg_catalog.pg_namespace AS n ON n.oid = d.defaclnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) AS acl
  WHERE d.defaclrole = 'postgres'::pg_catalog.regrole
    AND n.nspname = 'public'
    AND acl.grantee IN (
      'anon'::pg_catalog.regrole,
      'authenticated'::pg_catalog.regrole
    )
    AND (
      (d.defaclobjtype = 'r'
        AND acl.privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'))
      OR
      (d.defaclobjtype = 'S'
        AND acl.privilege_type IN ('USAGE', 'SELECT', 'UPDATE'))
    );

  SELECT count(*) FILTER (WHERE c.relkind IN ('r', 'p')),
         count(*) FILTER (WHERE c.relkind = 'S')
  INTO forbidden_future_tables,
       forbidden_future_sequences
  FROM pg_catalog.pg_class AS c
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(
      c.relacl,
      pg_catalog.acldefault(
        CASE WHEN c.relkind = 'S' THEN 'S' ELSE 'r' END::"char",
        c.relowner
      )
    )
  ) AS acl
  WHERE c.oid IN (
      'public.phase0_probe_postgres_grant_table'::pg_catalog.regclass,
      'public.phase0_probe_postgres_grant_sequence'::pg_catalog.regclass
    )
    AND acl.grantee IN (
      'anon'::pg_catalog.regrole,
      'authenticated'::pg_catalog.regrole
    )
    AND (
      (c.relkind IN ('r', 'p')
        AND acl.privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'))
      OR
      (c.relkind = 'S'
        AND acl.privilege_type IN ('USAGE', 'SELECT', 'UPDATE'))
    );

  IF forbidden_current_tables <> 0
     OR forbidden_current_sequences <> 0
     OR forbidden_postgres_default_tables <> 0
     OR forbidden_postgres_default_sequences <> 0
     OR forbidden_future_tables <> 0
     OR forbidden_future_sequences <> 0
  THEN
    RAISE EXCEPTION
      'forbidden client grants remain: current tables=%, current sequences=%, postgres default tables=%, postgres default sequences=%, postgres future tables=%, postgres future sequences=%',
      forbidden_current_tables,
      forbidden_current_sequences,
      forbidden_postgres_default_tables,
      forbidden_postgres_default_sequences,
      forbidden_future_tables,
      forbidden_future_sequences;
  END IF;

  -- Existing Data API table CRUD remains at the captured production tuples.
  IF EXISTS (
    WITH expected(grantee, schema_name, relation_name, privilege) AS (
      SELECT roles.grantee, 'public', grants.relation_name, grants.privilege
      FROM (VALUES ('anon'), ('authenticated')) AS roles(grantee)
      CROSS JOIN (VALUES
        ('admin_actions', 'SELECT'),
        ('ai_config_overrides', 'DELETE'),
        ('ai_config_overrides', 'INSERT'),
        ('ai_config_overrides', 'SELECT'),
        ('ai_config_overrides', 'UPDATE'),
        ('channels', 'DELETE'),
        ('channels', 'INSERT'),
        ('channels', 'SELECT'),
        ('channels', 'UPDATE'),
        ('creator_profiles', 'DELETE'),
        ('creator_profiles', 'INSERT'),
        ('creator_profiles', 'SELECT'),
        ('creator_profiles', 'UPDATE'),
        ('credit_transactions', 'SELECT'),
        ('feature_access', 'DELETE'),
        ('feature_access', 'INSERT'),
        ('feature_access', 'SELECT'),
        ('feature_access', 'UPDATE'),
        ('feedback', 'SELECT'),
        ('generation_ai_calls', 'SELECT'),
        ('generations', 'DELETE'),
        ('generations', 'INSERT'),
        ('generations', 'SELECT'),
        ('generations', 'UPDATE'),
        ('invite_codes', 'SELECT'),
        ('platform_settings', 'SELECT'),
        ('profiles', 'DELETE'),
        ('profiles', 'SELECT'),
        ('saved_content', 'DELETE'),
        ('saved_content', 'INSERT'),
        ('saved_content', 'SELECT'),
        ('saved_content', 'UPDATE'),
        ('usage_stats', 'DELETE'),
        ('usage_stats', 'INSERT'),
        ('usage_stats', 'SELECT'),
        ('usage_stats', 'UPDATE'),
        ('voice_profiles', 'DELETE'),
        ('voice_profiles', 'INSERT'),
        ('voice_profiles', 'SELECT'),
        ('voice_profiles', 'UPDATE')
      ) AS grants(relation_name, privilege)
    ), actual AS (
      SELECT
        pg_catalog.pg_get_userbyid(acl.grantee)::text AS grantee,
        n.nspname::text AS schema_name,
        c.relname::text AS relation_name,
        acl.privilege_type::text AS privilege
      FROM pg_catalog.pg_class AS c
      JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(c.relacl, pg_catalog.acldefault('r'::"char", c.relowner))
      ) AS acl
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p')
        AND c.relname <> 'phase0_probe_postgres_grant_table'
        AND acl.grantee IN (
          'anon'::pg_catalog.regrole,
          'authenticated'::pg_catalog.regrole
        )
        AND acl.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
    ), differences AS (
      (SELECT * FROM expected EXCEPT ALL SELECT * FROM actual)
      UNION ALL
      (SELECT * FROM actual EXCEPT ALL SELECT * FROM expected)
    )
    SELECT 1 FROM differences
  ) THEN
    RAISE EXCEPTION 'captured client table CRUD tuples changed';
  END IF;

  -- Column-level client writes, routine execution, and schema access remain.
  IF EXISTS (
    WITH expected(grantee, schema_name, relation_name, column_name, privilege) AS (
      VALUES
        ('authenticated', 'public', 'feedback', 'category', 'INSERT'),
        ('authenticated', 'public', 'feedback', 'message', 'INSERT'),
        ('authenticated', 'public', 'feedback', 'url', 'INSERT'),
        ('authenticated', 'public', 'feedback', 'user_agent', 'INSERT'),
        ('authenticated', 'public', 'feedback', 'user_id', 'INSERT'),
        ('authenticated', 'public', 'profiles', 'avatar_url', 'UPDATE'),
        ('authenticated', 'public', 'profiles', 'foundation_cta_dismissed_at', 'UPDATE'),
        ('authenticated', 'public', 'profiles', 'full_name', 'UPDATE'),
        ('authenticated', 'public', 'profiles', 'preferences', 'UPDATE'),
        ('authenticated', 'public', 'profiles', 'use_foundation_in_generations', 'UPDATE')
    ), actual AS (
      SELECT
        pg_catalog.pg_get_userbyid(acl.grantee)::text AS grantee,
        n.nspname::text AS schema_name,
        c.relname::text AS relation_name,
        a.attname::text AS column_name,
        acl.privilege_type::text AS privilege
      FROM pg_catalog.pg_attribute AS a
      JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
      JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
      CROSS JOIN LATERAL pg_catalog.aclexplode(a.attacl) AS acl
      WHERE n.nspname = 'public'
        AND acl.grantee IN (
          'anon'::pg_catalog.regrole,
          'authenticated'::pg_catalog.regrole
        )
        AND acl.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
    ), differences AS (
      (SELECT * FROM expected EXCEPT ALL SELECT * FROM actual)
      UNION ALL
      (SELECT * FROM actual EXCEPT ALL SELECT * FROM expected)
    )
    SELECT 1 FROM differences
  ) THEN
    RAISE EXCEPTION 'captured client column grant tuples changed';
  END IF;

  IF EXISTS (
    WITH expected(grantee, schema_name, function_name, identity_arguments, privilege) AS (
      VALUES
        ('anon', 'public', 'handle_updated_at', '', 'EXECUTE'),
        ('anon', 'public', 'protect_privileged_profile_columns', '', 'EXECUTE'),
        ('authenticated', 'public', 'handle_updated_at', '', 'EXECUTE'),
        ('authenticated', 'public', 'protect_privileged_profile_columns', '', 'EXECUTE'),
        ('service_role', 'public', 'consume_user_credits', 'p_user_id uuid, p_amount integer', 'EXECUTE'),
        ('service_role', 'public', 'handle_new_user', '', 'EXECUTE'),
        ('service_role', 'public', 'handle_updated_at', '', 'EXECUTE'),
        ('service_role', 'public', 'protect_privileged_profile_columns', '', 'EXECUTE')
    ), actual AS (
      SELECT
        pg_catalog.pg_get_userbyid(acl.grantee)::text AS grantee,
        n.nspname::text AS schema_name,
        p.proname::text AS function_name,
        pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments,
        acl.privilege_type::text AS privilege
      FROM pg_catalog.pg_proc AS p
      JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(p.proacl, pg_catalog.acldefault('f'::"char", p.proowner))
      ) AS acl
      WHERE n.nspname = 'public'
        AND acl.grantee IN (
          'anon'::pg_catalog.regrole,
          'authenticated'::pg_catalog.regrole,
          'service_role'::pg_catalog.regrole
        )
        AND acl.privilege_type = 'EXECUTE'
    ), differences AS (
      (SELECT * FROM expected EXCEPT ALL SELECT * FROM actual)
      UNION ALL
      (SELECT * FROM actual EXCEPT ALL SELECT * FROM expected)
    )
    SELECT 1 FROM differences
  ) THEN
    RAISE EXCEPTION 'captured public function grant tuples changed';
  END IF;

  IF EXISTS (
    SELECT role_name
    FROM (VALUES ('anon'), ('authenticated'), ('service_role')) AS roles(role_name)
    WHERE NOT pg_catalog.has_schema_privilege(role_name, 'public', 'USAGE')
  ) THEN
    RAISE EXCEPTION 'required public schema access changed';
  END IF;

  -- service_role keeps its full current and future relation access.
  IF EXISTS (
    SELECT c.oid, required.privilege
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    CROSS JOIN (VALUES
      ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
      ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')
    ) AS required(privilege)
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND NOT pg_catalog.has_table_privilege('service_role', c.oid, required.privilege)
  ) THEN
    RAISE EXCEPTION 'required service_role table privilege changed';
  END IF;

  IF EXISTS (
    SELECT c.oid, required.privilege
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    CROSS JOIN (VALUES ('USAGE'), ('SELECT'), ('UPDATE')) AS required(privilege)
    WHERE n.nspname = 'public'
      AND c.relkind = 'S'
      AND NOT pg_catalog.has_sequence_privilege('service_role', c.oid, required.privilege)
  ) THEN
    RAISE EXCEPTION 'required service_role sequence privilege changed';
  END IF;

  -- The postgres defaults still expose future tables for intended CRUD, but
  -- neither client role receives sequence privileges. service_role retains all.
  IF EXISTS (
    SELECT role_name, required.privilege
    FROM (VALUES ('anon'), ('authenticated')) AS roles(role_name)
    CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS required(privilege)
    WHERE NOT pg_catalog.has_table_privilege(
      role_name,
      'public.phase0_probe_postgres_grant_table',
      required.privilege
    )
  ) THEN
    RAISE EXCEPTION 'intended postgres future-table client CRUD changed';
  END IF;

  DROP SEQUENCE public.phase0_probe_postgres_grant_sequence;
  DROP TABLE public.phase0_probe_postgres_grant_table;
END
$probe$;
