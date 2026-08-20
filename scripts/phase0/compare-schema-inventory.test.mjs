import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const comparatorPath = fileURLToPath(new URL('./compare-schema-inventory.mjs', import.meta.url));

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
