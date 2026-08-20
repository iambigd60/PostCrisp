import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const launcherPath = fileURLToPath(
  new URL('./capture-restore-source-preflight.mjs', import.meta.url),
)
const launcher = await import(pathToFileURL(launcherPath).href)

function preflight(overrides = {}) {
  return {
    captured_at: '2026-08-20T20:00:00Z',
    relevant_enabled_extensions: [],
    cron: { catalog_present: false, job_count: null, active_job_count: null },
    pg_net: { request_queue_present: false, queued_request_count: null },
    subscriptions: {
      total_count: 0,
      enabled_count: 0,
      disabled_count: 0,
      non_platform_or_unclassified_count: 0,
    },
    replication_slots: {
      total_count: 0,
      active_count: 0,
      inactive_count: 0,
      logical_count: 0,
      physical_count: 0,
      non_platform_or_unclassified_count: 0,
    },
    vault: { schema_present: true, secrets_relation_present: true, secret_count: 0 },
    foreign_access: { server_count: 0, user_mapping_count: 0, wrapper_names: [] },
    outbound_reference_function_count: 0,
    outbound_reference_functions: [],
    ...overrides,
  }
}

test('fails closed on an unsupported target without echoing it', () => {
  // Catches accepting arbitrary connection targets or reflecting connection material.
  const result = spawnSync(
    process.execPath,
    [launcherPath, 'postgresql://DO_NOT_ECHO'],
    { encoding: 'utf8' },
  )

  assert.equal(result.status, 1)
  assert.match(result.stderr, /^Usage: node scripts\/phase0\/capture-restore-source-preflight\.mjs/m)
  assert.doesNotMatch(result.stderr, /postgresql|DO_NOT_ECHO/)
  assert.equal(result.stdout, '')
})

test('can be imported without executing the launcher', () => {
  // Catches test/library imports triggering a process exit or external query.
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', `import(${JSON.stringify(pathToFileURL(launcherPath).href)})`],
    { encoding: 'utf8' },
  )

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, '')
})

test('builds bounded credential-free invocations for only reviewed target forms', () => {
  // Catches unpinned CLI use, missing deadlines, or arbitrary target acceptance.
  assert.equal(typeof launcher.buildSupabaseInvocation, 'function')

  const linked = launcher.buildSupabaseInvocation('--linked', 'query.sql', 'win32', 'cmd.exe')
  assert.deepEqual(linked.args, [
    '/d', '/s', '/c', 'npx.cmd', '--yes', 'supabase@2.115.0', 'db', 'query',
    '--linked', '--file', 'query.sql', '--output-format', 'json',
  ])
  assert.equal(linked.options.shell, false)
  assert.equal(linked.options.windowsHide, true)
  assert.equal(linked.timeoutMs, 45_000)

  const clone = launcher.buildSupabaseInvocation(
    '--project-ref',
    'query.sql',
    'linux',
    undefined,
    'abcdefghijklmnopqrst',
  )
  assert.deepEqual(clone.args.slice(4, 6), ['--project-ref', 'abcdefghijklmnopqrst'])
  assert.throws(
    () => launcher.buildSupabaseInvocation(
      '--project-ref', 'query.sql', 'linux', undefined, 'postgresql://arbitrary',
    ),
    /20 lowercase letters/,
  )
})

test('normalizes only the exact reviewed metadata shape', () => {
  // Catches returning CLI wrappers or unreviewed nested fields.
  assert.equal(typeof launcher.normalizeCliOutput, 'function')
  const normalized = launcher.normalizeCliOutput(JSON.stringify({
    rows: [{ restore_source_preflight: preflight() }],
  }))

  assert.deepEqual(JSON.parse(normalized), { restore_source_preflight: preflight() })
})

test('rejects partial, missing, or extra secret-bearing output without echoing it', () => {
  // Catches partial/error output being mistaken for a safe preflight capture.
  assert.equal(typeof launcher.normalizeCliOutput, 'function')
  assert.throws(
    () => launcher.normalizeCliOutput('status\n{"restore_source_preflight":{}}'),
    /valid JSON without status lines/,
  )
  assert.throws(
    () => launcher.normalizeCliOutput('{}'),
    /reviewed metadata shape/,
  )
  assert.throws(
    () => launcher.normalizeCliOutput(JSON.stringify({
      restore_source_preflight: preflight({ command: 'DO_NOT_LEAK' }),
    })),
    error => {
      assert.match(error.message, /reviewed metadata shape/)
      assert.doesNotMatch(error.message, /command|DO_NOT_LEAK/)
      return true
    },
  )
})
