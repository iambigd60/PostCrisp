import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const queryPath = fileURLToPath(new URL('./auth-restore-signature.sql', import.meta.url))

function executableSql() {
  return readFileSync(queryPath, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '')
    .trim()
}

function runPg17(container, sql) {
  const result = spawnSync(
    'docker',
    ['exec', '-i', container, 'psql', '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres'],
    { encoding: 'utf8', input: sql, windowsHide: true },
  )
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

test('is one prepared-statement-compatible read-only query', () => {
  const sql = executableSql()
  const semicolons = sql.match(/;/g) ?? []

  assert.match(sql, /^with\b/i)
  assert.equal(semicolons.length, 1)
  assert.match(sql, /;$/)
  assert.doesNotMatch(sql, /\b(begin|commit|rollback|set|set_config)\b/i)
  assert.doesNotMatch(sql, /\b(insert|update|delete|merge|create|alter|drop|truncate|grant|revoke|call|do)\b/i)
})

test('retains the bounded identity-free signature contract', () => {
  const sql = executableSql()

  assert.match(sql, /as auth_restore_signature\s*;$/i)
  assert.match(sql, /'bounded_user_count_cap',\s*100001/i)
  assert.match(sql, /'bounded_user_count_capped'/i)
  assert.doesNotMatch(sql, /\b(email|phone|password|token|identity)\b/i)
})

test('fingerprints every required Auth and global-role security surface', () => {
  // Catches PASS_BOUNDED omitting security-bearing definitions or role state.
  const sql = executableSql()

  assert.match(sql, /pg_get_viewdef/i)
  assert.match(sql, /pg_catalog\.aclexplode\(a\.attacl\)/i)
  assert.match(sql, /pg_catalog\.pg_enum/i)
  assert.match(sql, /t\.tgenabled/i)
  assert.match(sql, /pg_catalog\.pg_auth_members/i)
  assert.match(sql, /pg_catalog\.pg_db_role_setting/i)
  assert.match(sql, /'global_role_item_count'/i)
  assert.match(sql, /'global_role_signature_md5'/i)
})

test('names both PostgreSQL 17 membership options in the canonical fingerprint', () => {
  // Catches either security-bearing membership option being omitted from the signature.
  const sql = executableSql()
  const membershipItem = sql.match(/select format\(\s*('membership\|[\s\S]*?)\)\s*from pg_catalog\.pg_auth_members/i)?.[1] ?? ''

  assert.match(membershipItem, /\|inherit_option=%s/, 'membership fingerprint omits inherit_option')
  assert.match(membershipItem, /\|set_option=%s/, 'membership fingerprint omits set_option')
  assert.match(membershipItem, /m\.inherit_option/, 'inherit_option has no canonical boolean value')
  assert.match(membershipItem, /m\.set_option/, 'set_option has no canonical boolean value')
})

test('changing either PostgreSQL 17 membership option changes the global-role fingerprint', {
  skip: !process.env.PHASE0_PG17_CONTAINER,
}, () => {
  // Exercises the real PostgreSQL 17 catalogs and the complete production query.
  const container = process.env.PHASE0_PG17_CONTAINER
  runPg17(container, `
    drop role if exists phase0_membership_member;
    drop role if exists phase0_membership_parent;
    create role phase0_membership_parent;
    create role phase0_membership_member;
    grant phase0_membership_parent to phase0_membership_member
      with inherit false, set true;
  `)

  const capture = () => JSON.parse(runPg17(container, readFileSync(queryPath, 'utf8')))
  const baseline = capture()

  runPg17(container, `
    grant phase0_membership_parent to phase0_membership_member
      with inherit true, set true;
  `)
  const inheritChanged = capture()

  runPg17(container, `
    grant phase0_membership_parent to phase0_membership_member
      with inherit false, set false;
  `)
  const setChanged = capture()

  assert.equal(inheritChanged.global_role_item_count, baseline.global_role_item_count)
  assert.notEqual(inheritChanged.global_role_signature_md5, baseline.global_role_signature_md5)
  assert.equal(setChanged.global_role_item_count, baseline.global_role_item_count)
  assert.notEqual(setChanged.global_role_signature_md5, baseline.global_role_signature_md5)
})
