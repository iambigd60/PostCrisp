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

  -- Existing Data API table CRUD remains at the captured production counts.
  IF EXISTS (
    WITH expected(grantee, privilege, expected_count) AS (
      VALUES
        ('anon', 'SELECT', 15),
        ('anon', 'INSERT', 8),
        ('anon', 'UPDATE', 8),
        ('anon', 'DELETE', 9),
        ('authenticated', 'SELECT', 15),
        ('authenticated', 'INSERT', 8),
        ('authenticated', 'UPDATE', 8),
        ('authenticated', 'DELETE', 9)
    ), actual AS (
      SELECT
        pg_catalog.pg_get_userbyid(acl.grantee) AS grantee,
        acl.privilege_type AS privilege,
        count(*)::integer AS actual_count
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
      GROUP BY acl.grantee, acl.privilege_type
    )
    SELECT 1
    FROM expected AS e
    FULL JOIN actual AS a USING (grantee, privilege)
    WHERE e.expected_count IS DISTINCT FROM a.actual_count
  ) THEN
    RAISE EXCEPTION 'captured client table CRUD grants changed';
  END IF;

  -- Column-level client writes, routine execution, and schema access remain.
  IF (
    SELECT count(*)
    FROM pg_catalog.pg_attribute AS a
    JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(a.attacl) AS acl
    WHERE n.nspname = 'public'
      AND acl.grantee = 'authenticated'::pg_catalog.regrole
      AND acl.privilege_type IN ('INSERT', 'UPDATE')
  ) <> 10 THEN
    RAISE EXCEPTION 'captured authenticated column grants changed';
  END IF;

  IF EXISTS (
    WITH expected(grantee, expected_count) AS (
      VALUES ('anon', 2), ('authenticated', 2), ('service_role', 4)
    ), actual AS (
      SELECT
        pg_catalog.pg_get_userbyid(acl.grantee) AS grantee,
        count(*)::integer AS actual_count
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
      GROUP BY acl.grantee
    )
    SELECT 1
    FROM expected AS e
    FULL JOIN actual AS a USING (grantee)
    WHERE e.expected_count IS DISTINCT FROM a.actual_count
  ) THEN
    RAISE EXCEPTION 'captured public function grants changed';
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
