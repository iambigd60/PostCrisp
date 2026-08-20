-- Local integration probe. The single DO statement is atomic: any failed
-- assertion rolls back all controlled objects and roles; success drops them.
DO $probe$
BEGIN
  CREATE TABLE public.phase0_probe_postgres_table (id bigint);
  CREATE SEQUENCE public.phase0_probe_postgres_sequence;
  CREATE FUNCTION public.phase0_probe_postgres_function()
    RETURNS integer LANGUAGE sql AS 'SELECT 1';

  CREATE ROLE phase0_probe_no_defaults NOLOGIN;
  GRANT USAGE, CREATE ON SCHEMA public TO phase0_probe_no_defaults;
  GRANT phase0_probe_no_defaults TO postgres;
  EXECUTE 'SET LOCAL ROLE phase0_probe_no_defaults';
  CREATE TABLE public.phase0_probe_no_defaults_table (id bigint);
  RESET ROLE;

  IF EXISTS (
    WITH expected AS (
      SELECT
        CASE d.defaclobjtype WHEN 'r' THEN 'TABLE' WHEN 'S' THEN 'SEQUENCE' WHEN 'f' THEN 'FUNCTION' END AS object_type,
        pg_catalog.pg_get_userbyid(acl.grantee) AS grantee,
        acl.privilege_type AS privilege,
        acl.is_grantable AS grantable
      FROM pg_catalog.pg_default_acl AS d
      JOIN pg_catalog.pg_namespace AS n ON n.oid = d.defaclnamespace
      CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) AS acl
      WHERE d.defaclrole = 'postgres'::pg_catalog.regrole
        AND n.nspname = 'public'
        AND acl.grantee NOT IN (0, d.defaclrole)
    ), actual AS (
      SELECT
        CASE c.relkind WHEN 'S' THEN 'SEQUENCE' ELSE 'TABLE' END AS object_type,
        pg_catalog.pg_get_userbyid(acl.grantee) AS grantee,
        acl.privilege_type AS privilege,
        acl.is_grantable AS grantable
      FROM pg_catalog.pg_class AS c
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(c.relacl, pg_catalog.acldefault(CASE c.relkind WHEN 'S' THEN 'S' ELSE 'r' END::"char", c.relowner))
      ) AS acl
      WHERE c.oid IN (
        'public.phase0_probe_postgres_table'::pg_catalog.regclass,
        'public.phase0_probe_postgres_sequence'::pg_catalog.regclass
      )
        AND acl.grantee NOT IN (0, c.relowner)
      UNION ALL
      SELECT
        'FUNCTION',
        pg_catalog.pg_get_userbyid(acl.grantee),
        acl.privilege_type,
        acl.is_grantable
      FROM pg_catalog.pg_proc AS p
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(p.proacl, pg_catalog.acldefault('f'::"char", p.proowner))
      ) AS acl
      WHERE p.oid = 'public.phase0_probe_postgres_function()'::pg_catalog.regprocedure
        AND acl.grantee NOT IN (0, p.proowner)
    ), differences AS (
      (SELECT * FROM expected EXCEPT ALL SELECT * FROM actual)
      UNION ALL
      (SELECT * FROM actual EXCEPT ALL SELECT * FROM expected)
    )
    SELECT 1 FROM differences
  ) THEN
    RAISE EXCEPTION 'postgres-created probe objects do not match the captured postgres default ACL set';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS c
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(c.relacl, pg_catalog.acldefault('r'::"char", c.relowner))
    ) AS acl
    WHERE c.oid = 'public.phase0_probe_no_defaults_table'::pg_catalog.regclass
      AND acl.grantee IN (
        'anon'::pg_catalog.regrole,
        'authenticated'::pg_catalog.regrole,
        'service_role'::pg_catalog.regrole
      )
  ) THEN
    RAISE EXCEPTION 'creator without captured defaults inherited legacy Data API grants';
  END IF;

  DROP TABLE public.phase0_probe_no_defaults_table;
  REVOKE ALL ON SCHEMA public FROM phase0_probe_no_defaults;
  REVOKE phase0_probe_no_defaults FROM postgres;
  DROP ROLE phase0_probe_no_defaults;
  DROP FUNCTION public.phase0_probe_postgres_function();
  DROP SEQUENCE public.phase0_probe_postgres_sequence;
  DROP TABLE public.phase0_probe_postgres_table;
END
$probe$;
