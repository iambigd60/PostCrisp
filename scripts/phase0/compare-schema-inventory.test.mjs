import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const comparatorPath = fileURLToPath(new URL('./compare-schema-inventory.mjs', import.meta.url));
const inventorySqlPath = fileURLToPath(new URL('./schema-inventory.sql', import.meta.url));

async function runComparator(production, local) {
  const directory = await mkdtemp(join(tmpdir(), 'postcrisp-schema-parity-'));
  const productionPath = join(directory, 'production.json');
  const localPath = join(directory, 'local.json');

  try {
    await Promise.all([
      writeFile(productionPath, `${JSON.stringify(production, null, 2)}\n`),
      writeFile(localPath, `${JSON.stringify(local, null, 2)}\n`),
    ]);

    return spawnSync(
      process.execPath,
      [comparatorPath, productionPath, localPath],
      { encoding: 'utf8' },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function captureLocalInventory() {
  const supabaseArguments = [
    'db', 'query', '--local', '--file', inventorySqlPath, '--output-format', 'json',
  ];
  const [command, commandArguments] = process.platform === 'win32'
    ? [
        process.env.ComSpec,
        ['/d', '/s', '/c', `supabase db query --local --file ${inventorySqlPath} --output-format json`],
      ]
    : ['supabase', supabaseArguments];
  const result = spawnSync(command, commandArguments, { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout).rows[0].inventory;
}

test('accepts reordered objects and ignored capture metadata as equal', async () => {
  // Catches treating catalog row order, owners, OIDs, or capture times as drift.
  const production = {
    captured_at: '2026-08-20T10:00:00Z',
    tables: [
      { schema: 'public', name: 'profiles', rls_enabled: true, oid: 101 },
      { schema: 'public', name: 'feedback', rls_enabled: true, owner: 'postgres' },
    ],
    functions: [
      {
        schema: 'public',
        name: 'handle_updated_at',
        identity_arguments: '',
        definition: 'BEGIN RETURN NEW; END',
        owner: 'postgres',
      },
    ],
  };
  const local = {
    functions: [
      {
        definition: 'BEGIN RETURN NEW; END',
        identity_arguments: '',
        name: 'handle_updated_at',
        schema: 'public',
        owner: 'supabase_admin',
      },
    ],
    tables: [
      { owner: 'supabase_admin', rls_enabled: true, name: 'feedback', schema: 'public' },
      { oid: 9876, rls_enabled: true, name: 'profiles', schema: 'public' },
    ],
    captured_at: '2026-08-20T10:05:00Z',
  };

  const result = await runComparator(production, local);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stdout, 'Schema inventories match.\n');
  assert.equal(result.stderr, '');
});

test('reports a missing object with its section and stable identity', async () => {
  // Catches silently accepting a production object that migrations fail to rebuild.
  const production = {
    tables: [
      { schema: 'public', name: 'feedback', rls_enabled: true },
      { schema: 'public', name: 'profiles', rls_enabled: true },
    ],
  };
  const local = {
    tables: [{ schema: 'public', name: 'profiles', rls_enabled: true }],
  };

  const result = await runComparator(production, local);

  assert.equal(result.status, 1);
  assert.equal(
    result.stdout,
    [
      'Schema inventories differ:',
      '- missing in local: tables public.feedback',
      '',
    ].join('\n'),
  );
  assert.equal(result.stderr, '');
});

test('reports the exact changed definition for the same object identity', async () => {
  // Catches reporting a modified security-relevant object as a vague mismatch.
  const production = {
    functions: [
      {
        schema: 'public',
        name: 'calculate_credit_cost',
        identity_arguments: 'integer',
        definition: 'RETURN requested_credits;',
        security_definer: false,
      },
    ],
  };
  const local = {
    functions: [
      {
        schema: 'public',
        name: 'calculate_credit_cost',
        identity_arguments: 'integer',
        definition: 'RETURN requested_credits + 1;',
        security_definer: false,
      },
    ],
  };

  const result = await runComparator(production, local);

  assert.equal(result.status, 1);
  assert.equal(
    result.stdout,
    [
      'Schema inventories differ:',
      '- changed in local: functions public.calculate_credit_cost(integer).definition',
      '  production: "RETURN requested_credits;"',
      '  local: "RETURN requested_credits + 1;"',
      '',
    ].join('\n'),
  );
  assert.equal(result.stderr, '');
});

test('reports an extra local security object', async () => {
  // Catches accepting a local-only policy that is absent from production.
  const production = { policies: [] };
  const local = {
    policies: [
      {
        schema: 'public',
        table: 'feedback',
        name: 'clients_insert',
        command: 'INSERT',
        roles: ['authenticated'],
      },
    ],
  };

  const result = await runComparator(production, local);

  assert.equal(result.status, 1);
  assert.equal(
    result.stdout,
    [
      'Schema inventories differ:',
      '- extra in local: policies public.feedback.clients_insert',
      '',
    ].join('\n'),
  );
  assert.equal(result.stderr, '');
});

test('identifies a missing column grant without dumping the whole object', async () => {
  // Catches unreadable or unstable grant differences that hide the affected privilege.
  const production = {
    grants: [
      {
        object_type: 'TABLE COLUMN',
        schema: 'public',
        object: 'feedback',
        column: 'message',
        grantee: 'authenticated',
        privilege: 'INSERT',
        grantable: false,
      },
    ],
  };
  const local = { grants: [] };

  const result = await runComparator(production, local);

  assert.equal(result.status, 1);
  assert.equal(
    result.stdout,
    [
      'Schema inventories differ:',
      '- missing in local: grants TABLE COLUMN public.feedback.message -> authenticated INSERT',
      '',
    ].join('\n'),
  );
  assert.equal(result.stderr, '');
});

test('omits null function arguments from non-function grant identities', async () => {
  // Catches leaking JSON null placeholders into readable table-grant paths.
  const production = {
    grants: [
      {
        object_type: 'TABLE',
        schema: 'public',
        object: 'feedback',
        column: null,
        identity_arguments: null,
        grantee: 'authenticated',
        privilege: 'SELECT',
        grantable: false,
      },
    ],
  };
  const local = { grants: [] };

  const result = await runComparator(production, local);

  assert.equal(result.status, 1);
  assert.equal(
    result.stdout,
    [
      'Schema inventories differ:',
      '- missing in local: grants TABLE public.feedback -> authenticated SELECT',
      '',
    ].join('\n'),
  );
  assert.equal(result.stderr, '');
});

test('reports duplicate identity multiplicity instead of collapsing entries', async () => {
  // Catches Map-based comparison hiding one of two grants with the same stable identity.
  const grant = {
    object_type: 'TABLE',
    schema: 'public',
    object: 'feedback',
    column: null,
    identity_arguments: null,
    grantee: 'authenticated',
    privilege: 'SELECT',
    grantable: false,
  };
  const production = { grants: [grant, grant] };
  const local = { grants: [grant] };

  const result = await runComparator(production, local);

  assert.equal(result.status, 1);
  assert.equal(
    result.stdout,
    [
      'Schema inventories differ:',
      '- missing in local: grants TABLE public.feedback -> authenticated SELECT (occurrence 2)',
      '  production: {"column":null,"grantable":false,"grantee":"authenticated",' +
        '"identity_arguments":null,"object":"feedback","object_type":"TABLE",' +
        '"privilege":"SELECT","schema":"public"}',
      '',
    ].join('\n'),
  );
  assert.equal(result.stderr, '');
});

test('preserves default-grant creator to ACL-set correlation', async () => {
  // Aggregate privileges and fingerprint counts match; only creator assignment differs.
  const defaultGrant = (privilege, creatorAclFingerprint) => ({
    object_type: 'DEFAULT TABLE',
    schema: 'public',
    object: 'future objects',
    column: null,
    identity_arguments: null,
    grantee: 'authenticated',
    privilege,
    grantable: false,
    creator_acl_fingerprint: creatorAclFingerprint,
  });
  const production = {
    grants: [
      defaultGrant('SELECT', 'creator-set-a'),
      defaultGrant('DELETE', 'creator-set-a'),
      defaultGrant('INSERT', 'creator-set-b'),
    ],
  };
  const local = {
    grants: [
      defaultGrant('SELECT', 'creator-set-a'),
      defaultGrant('DELETE', 'creator-set-b'),
      defaultGrant('INSERT', 'creator-set-a'),
    ],
  };

  const result = await runComparator(production, local);

  assert.equal(result.status, 1);
  assert.equal(
    result.stdout,
    [
      'Schema inventories differ:',
      '- missing in local: grants DEFAULT TABLE public.future objects creator creator-set-a -> authenticated DELETE',
      '- extra in local: grants DEFAULT TABLE public.future objects creator creator-set-a -> authenticated INSERT',
      '- extra in local: grants DEFAULT TABLE public.future objects creator creator-set-b -> authenticated DELETE',
      '- missing in local: grants DEFAULT TABLE public.future objects creator creator-set-b -> authenticated INSERT',
      '',
    ].join('\n'),
  );
  assert.equal(result.stderr, '');
});

test('inventory includes the auth trigger that invokes the public signup function', () => {
  const inventory = captureLocalInventory();
  assert.equal(inventory.triggers.length, 6);
  const trigger = inventory.triggers.find((candidate) =>
    candidate.schema === 'auth' &&
    candidate.table === 'users' &&
    candidate.name === 'on_auth_user_created');

  assert.deepEqual(trigger, {
    schema: 'auth',
    table: 'users',
    name: 'on_auth_user_created',
    enabled: 'O',
    function_schema: 'public',
    function_name: 'handle_new_user',
    function_identity_arguments: '',
    definition: 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users ' +
      'FOR EACH ROW EXECUTE FUNCTION handle_new_user()',
  });
});

test('inventory records deterministic sequence OWNED BY metadata', () => {
  const inventory = captureLocalInventory();
  const ownership = Object.fromEntries(inventory.sequences.map((sequence) => [
    sequence.name,
    {
      schema: sequence.owned_by_schema,
      table: sequence.owned_by_table,
      column: sequence.owned_by_column,
    },
  ]));

  assert.deepEqual(ownership, {
    onboarding_events_id_seq: {
      schema: 'public',
      table: 'onboarding_events',
      column: 'id',
    },
    tutorial_redemptions_id_seq: {
      schema: 'public',
      table: 'tutorial_redemptions',
      column: 'id',
    },
  });
});

test('inventory correlates default grants by normalized creator ACL-set fingerprint', () => {
  const inventory = captureLocalInventory();
  const defaultGrants = inventory.grants.filter((grant) =>
    grant.object_type.startsWith('DEFAULT '));

  assert.ok(defaultGrants.length > 0);
  assert.equal(
    defaultGrants.every((grant) => /^[0-9a-f]{32}$/.test(grant.creator_acl_fingerprint)),
    true,
  );
  assert.equal(new Set(defaultGrants.map((grant) => grant.creator_acl_fingerprint)).size, 2);
  assert.equal(defaultGrants.some((grant) => 'creator' in grant || 'owner' in grant), false);
  assert.equal(defaultGrants.some((grant) => 'source_count' in grant), false);
});
