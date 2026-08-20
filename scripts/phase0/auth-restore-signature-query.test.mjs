import assert from 'node:assert/strict'
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
