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
