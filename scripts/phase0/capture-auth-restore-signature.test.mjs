import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AUTH_SIGNATURE_TIMEOUT_MS,
  buildSupabaseInvocation,
  normalizeCliOutput,
} from './capture-auth-restore-signature.mjs'

test('builds a credential-free linked invocation with a fixed timeout', () => {
  const invocation = buildSupabaseInvocation('--linked', 'query.sql', 'win32', 'cmd.exe')

  assert.equal(AUTH_SIGNATURE_TIMEOUT_MS, 45_000)
  assert.equal(invocation.command, 'cmd.exe')
  assert.deepEqual(invocation.args, [
    '/d',
    '/s',
    '/c',
    'npx.cmd',
    '--yes',
    'supabase@2.115.0',
    'db',
    'query',
    '--linked',
    '--file',
    'query.sql',
    '--output-format',
    'json',
  ])
  assert.equal(invocation.options.timeout, 45_000)
  assert.equal(invocation.options.shell, false)
  assert.equal(invocation.options.windowsHide, true)
})

test('builds the same bounded invocation for a local clone stand-in', () => {
  const invocation = buildSupabaseInvocation('--local', 'query.sql', 'linux')

  assert.equal(invocation.command, 'npx')
  assert.equal(invocation.args[4], '--local')
  assert.equal(invocation.options.timeout, 45_000)
})

test('builds a bounded credential-free clone invocation from a validated project ref', () => {
  const invocation = buildSupabaseInvocation(
    '--project-ref',
    'query.sql',
    'linux',
    undefined,
    'abcdefghijklmnopqrst',
  )

  assert.deepEqual(invocation.args.slice(4, 6), [
    '--project-ref',
    'abcdefghijklmnopqrst',
  ])
  assert.equal(invocation.options.timeout, 45_000)
  assert.throws(
    () => buildSupabaseInvocation('--project-ref', 'query.sql', 'linux', undefined, 'bad;ref'),
    /20 lowercase letters/,
  )
})

test('normalizes CLI JSON to one comparator-ready signature object', () => {
  const normalized = normalizeCliOutput(JSON.stringify([{
    auth_restore_signature: {
      captured_at: '2026-08-20T19:00:00Z',
      auth_schema_present: true,
      auth_users_relation_present: true,
      metadata_item_count: 1,
      metadata_signature_md5: '00000000000000000000000000000000',
      bounded_user_count: 0,
      bounded_user_count_cap: 100001,
      bounded_user_count_capped: false,
    },
  }]))

  assert.deepEqual(JSON.parse(normalized), {
    auth_restore_signature: {
      captured_at: '2026-08-20T19:00:00Z',
      auth_schema_present: true,
      auth_users_relation_present: true,
      metadata_item_count: 1,
      metadata_signature_md5: '00000000000000000000000000000000',
      bounded_user_count: 0,
      bounded_user_count_cap: 100001,
      bounded_user_count_capped: false,
    },
  })
})

test('rejects transaction-status lines or a missing signature object', () => {
  assert.throws(
    () => normalizeCliOutput('BEGIN\n[{"auth_restore_signature":{}}]\nCOMMIT'),
    /valid JSON/,
  )
  assert.throws(() => normalizeCliOutput('[]'), /auth_restore_signature object/)
})
