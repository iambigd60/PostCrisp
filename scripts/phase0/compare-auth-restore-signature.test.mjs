import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
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

test('passes stable, uncapped metadata and aggregate evidence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'phase0-auth-'))
  const paths = ['a.json', 'b.json', 'c.json'].map(name => fixture(dir, name, signature()))
  const result = JSON.parse(execFileSync(process.execPath, args(paths), { encoding: 'utf8' }))
  assert.equal(result.result, 'PASS_BOUNDED')
  assert.equal(result.checks.metadata_signature_stable, true)
  assert.equal('bounded_user_count' in result, false)
})

test('is indeterminate when the bounded aggregate changes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'phase0-auth-'))
  const paths = [
    fixture(dir, 'a.json', signature()),
    fixture(dir, 'b.json', signature()),
    fixture(dir, 'c.json', signature({ bounded_user_count: 4 })),
  ]
  const result = spawnSync(process.execPath, args(paths), { encoding: 'utf8' })
  assert.equal(result.status, 2)
  assert.equal(JSON.parse(result.stdout).result, 'INDETERMINATE')
})

test('fails on auth metadata drift', () => {
  const dir = mkdtempSync(join(tmpdir(), 'phase0-auth-'))
  const paths = [
    fixture(dir, 'a.json', signature()),
    fixture(dir, 'b.json', signature()),
    fixture(dir, 'c.json', signature({ metadata_signature_md5: '11111111111111111111111111111111' })),
  ]
  const result = spawnSync(process.execPath, args(paths), { encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.equal(JSON.parse(result.stdout).result, 'FAIL')
})
