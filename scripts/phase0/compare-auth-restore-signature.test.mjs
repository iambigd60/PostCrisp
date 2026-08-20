import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./compare-auth-restore-signature.mjs', import.meta.url))
const query = fileURLToPath(new URL('./auth-restore-signature.sql', import.meta.url))

function signature(overrides = {}) {
  return {
    captured_at: '2026-08-20T18:00:00.000Z',
    auth_schema_present: true,
    auth_users_relation_present: true,
    metadata_item_count: 10,
    metadata_signature_md5: '00000000000000000000000000000000',
    bounded_user_count: 5,
    bounded_user_count_cap: 100001,
    bounded_user_count_capped: false,
    ...overrides,
  }
}

function fixture(dir, name, value) {
  const path = join(dir, name)
  writeFileSync(path, JSON.stringify({ rows: [{ auth_restore_signature: value }] }))
  return path
}

function args(paths) {
  return [
    script,
    '--query',
    query,
    '--backup-timestamp',
    '2026-08-20T10:56:15.704Z',
    ...paths,
  ]
}

function runComparison({
  sourceBeforeAuthorization = signature({ captured_at: '2026-08-20T18:00:00.000Z' }),
  sourceBeforeClone = signature({ captured_at: '2026-08-20T18:01:00.000Z' }),
  clone = signature({ captured_at: '2026-08-20T18:02:00.000Z' }),
  backupTimestamp = '2026-08-20T10:56:15.704Z',
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'phase0-auth-'))
  const paths = [
    fixture(dir, 'source-before-authorization.json', sourceBeforeAuthorization),
    fixture(dir, 'source-before-clone.json', sourceBeforeClone),
    fixture(dir, 'clone.json', clone),
  ]
  const command = args(paths)
  command[command.indexOf('--backup-timestamp') + 1] = backupTimestamp
  return spawnSync(process.execPath, command, { encoding: 'utf8' })
}

function assertInvalid(result, expectedMessage) {
  assert.equal(result.status, 1)
  assert.match(result.stderr, new RegExp(expectedMessage))
}

test('passes stable, uncapped metadata and aggregate evidence', () => {
  const result = runComparison()
  assert.equal(result.status, 0)
  const output = JSON.parse(result.stdout)
  assert.equal(output.result, 'PASS_BOUNDED')
  assert.equal(output.checks.metadata_signature_stable, true)
  assert.match(output.query_sha256, /^[0-9a-f]{64}$/)
  assert.equal('bounded_user_count' in output, false)
})

test('is indeterminate when the bounded aggregate changes', () => {
  const result = runComparison({ clone: signature({
    captured_at: '2026-08-20T18:02:00.000Z',
    bounded_user_count: 4,
  }) })
  assert.equal(result.status, 2)
  assert.equal(JSON.parse(result.stdout).result, 'INDETERMINATE')
})

test('fails on auth metadata drift', () => {
  const result = runComparison({ clone: signature({
    captured_at: '2026-08-20T18:02:00.000Z',
    metadata_signature_md5: '11111111111111111111111111111111',
  }) })
  assert.equal(result.status, 1)
  assert.equal(JSON.parse(result.stdout).result, 'FAIL')
})

test('rejects boolean fields encoded as strings, including "false"', () => {
  const result = runComparison({ sourceBeforeAuthorization: signature({
    captured_at: '2026-08-20T18:00:00.000Z',
    auth_schema_present: 'false',
  }) })
  assertInvalid(result, 'auth_schema_present must be a boolean')
})

test('rejects null boolean fields', () => {
  const result = runComparison({ sourceBeforeAuthorization: signature({
    captured_at: '2026-08-20T18:00:00.000Z',
    auth_users_relation_present: null,
  }) })
  assertInvalid(result, 'auth_users_relation_present must be a boolean')
})

test('rejects null metadata counts', () => {
  const result = runComparison({ sourceBeforeAuthorization: signature({
    captured_at: '2026-08-20T18:00:00.000Z',
    metadata_item_count: null,
  }) })
  assertInvalid(result, 'metadata_item_count must be a nonnegative integer')
})

test('rejects metadata counts with the wrong type', () => {
  const result = runComparison({ sourceBeforeAuthorization: signature({
    captured_at: '2026-08-20T18:00:00.000Z',
    metadata_item_count: '562',
  }) })
  assertInvalid(result, 'metadata_item_count must be a nonnegative integer')
})

test('rejects negative and fractional metadata counts', () => {
  assertInvalid(runComparison({ sourceBeforeAuthorization: signature({
    captured_at: '2026-08-20T18:00:00.000Z',
    metadata_item_count: -1,
  }) }), 'metadata_item_count must be a nonnegative integer')
  assertInvalid(runComparison({ sourceBeforeAuthorization: signature({
    captured_at: '2026-08-20T18:00:00.000Z',
    metadata_item_count: 1.5,
  }) }), 'metadata_item_count must be a nonnegative integer')
})

test('rejects null and malformed metadata signature hashes', () => {
  assertInvalid(runComparison({ sourceBeforeAuthorization: signature({
    captured_at: '2026-08-20T18:00:00.000Z',
    metadata_signature_md5: null,
  }) }), 'metadata_signature_md5 must be 32 hexadecimal characters')
  assertInvalid(runComparison({ sourceBeforeAuthorization: signature({
    captured_at: '2026-08-20T18:00:00.000Z',
    metadata_signature_md5: 'not-an-md5',
  }) }), 'metadata_signature_md5 must be 32 hexadecimal characters')
})

test('rejects null and wrongly typed bounded counts', () => {
  assertInvalid(runComparison({ sourceBeforeAuthorization: signature({
    captured_at: '2026-08-20T18:00:00.000Z',
    bounded_user_count: null,
  }) }), 'bounded_user_count must be a nonnegative integer')
  assertInvalid(runComparison({ sourceBeforeAuthorization: signature({
    captured_at: '2026-08-20T18:00:00.000Z',
    bounded_user_count: '5',
  }) }), 'bounded_user_count must be a nonnegative integer')
})

test('rejects negative, fractional, and over-cap bounded counts', () => {
  assertInvalid(runComparison({ sourceBeforeAuthorization: signature({
    captured_at: '2026-08-20T18:00:00.000Z',
    bounded_user_count: -1,
  }) }), 'bounded_user_count must be a nonnegative integer')
  assertInvalid(runComparison({ sourceBeforeAuthorization: signature({
    captured_at: '2026-08-20T18:00:00.000Z',
    bounded_user_count: 1.5,
  }) }), 'bounded_user_count must be a nonnegative integer')
  assertInvalid(runComparison({ sourceBeforeAuthorization: signature({
    captured_at: '2026-08-20T18:00:00.000Z',
    bounded_user_count: 100002,
  }) }), 'bounded_user_count must not exceed bounded_user_count_cap')
})

test('rejects null, wrongly typed, zero, and fractional caps', () => {
  for (const invalidCap of [null, '100001', 0, 1.5]) {
    assertInvalid(runComparison({ sourceBeforeAuthorization: signature({
      captured_at: '2026-08-20T18:00:00.000Z',
      bounded_user_count_cap: invalidCap,
    }) }), 'bounded_user_count_cap must be a positive integer')
  }
})

test('rejects null and wrongly typed capped flags', () => {
  assertInvalid(runComparison({ sourceBeforeAuthorization: signature({
    captured_at: '2026-08-20T18:00:00.000Z',
    bounded_user_count_capped: null,
  }) }), 'bounded_user_count_capped must be a boolean')
  assertInvalid(runComparison({ sourceBeforeAuthorization: signature({
    captured_at: '2026-08-20T18:00:00.000Z',
    bounded_user_count_capped: 'false',
  }) }), 'bounded_user_count_capped must be a boolean')
})

test('requires capped true exactly when count reaches the cap', () => {
  assertInvalid(runComparison({ sourceBeforeAuthorization: signature({
    captured_at: '2026-08-20T18:00:00.000Z',
    bounded_user_count_capped: true,
  }) }), 'bounded_user_count_capped must equal')
  assertInvalid(runComparison({ sourceBeforeAuthorization: signature({
    captured_at: '2026-08-20T18:00:00.000Z',
    bounded_user_count: 100001,
    bounded_user_count_capped: false,
  }) }), 'bounded_user_count_capped must equal')
})

test('accepts capped true when count exactly reaches the cap', () => {
  const capped = signature({
    bounded_user_count: 100001,
    bounded_user_count_capped: true,
  })
  const result = runComparison({
    sourceBeforeAuthorization: { ...capped, captured_at: '2026-08-20T18:00:00.000Z' },
    sourceBeforeClone: { ...capped, captured_at: '2026-08-20T18:01:00.000Z' },
    clone: { ...capped, captured_at: '2026-08-20T18:02:00.000Z' },
  })
  assert.equal(result.status, 2)
  assert.equal(JSON.parse(result.stdout).result, 'INDETERMINATE')
})

test('rejects null, wrongly typed, invalid, and non-ISO capture timestamps', () => {
  for (const invalidTimestamp of [null, 1724176800000, 'not-a-date', 'August 20, 2026']) {
    assertInvalid(runComparison({ sourceBeforeAuthorization: signature({
      captured_at: invalidTimestamp,
    }) }), 'captured_at must be an ISO-8601 timestamp with timezone')
  }
})

test('rejects invalid and non-ISO backup timestamps', () => {
  assertInvalid(runComparison({ backupTimestamp: 'not-a-date' }),
    'backup timestamp must be an ISO-8601 timestamp with timezone')
  assertInvalid(runComparison({ backupTimestamp: 'August 20, 2026' }),
    'backup timestamp must be an ISO-8601 timestamp with timezone')
})

test('rejects backup after source-before-authorization', () => {
  assertInvalid(runComparison({ backupTimestamp: '2026-08-20T18:00:00.001Z' }),
    'chronology must satisfy backup <= source-before-authorization <= source-before-clone <= clone')
})

test('rejects source-before-authorization after source-before-clone', () => {
  const result = runComparison({
    sourceBeforeAuthorization: signature({ captured_at: '2026-08-20T18:01:00.001Z' }),
    sourceBeforeClone: signature({ captured_at: '2026-08-20T18:01:00.000Z' }),
  })
  assertInvalid(result,
    'chronology must satisfy backup <= source-before-authorization <= source-before-clone <= clone')
})

test('rejects source-before-clone after clone', () => {
  const result = runComparison({
    sourceBeforeClone: signature({ captured_at: '2026-08-20T18:02:00.001Z' }),
    clone: signature({ captured_at: '2026-08-20T18:02:00.000Z' }),
  })
  assertInvalid(result,
    'chronology must satisfy backup <= source-before-authorization <= source-before-clone <= clone')
})
