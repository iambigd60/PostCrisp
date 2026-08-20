import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const queryPath = fileURLToPath(new URL('./restore-source-preflight.sql', import.meta.url))

function executableSql() {
  return readFileSync(queryPath, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '')
    .trim()
}

test('is one prepared-statement-compatible read-only preflight query', () => {
  // Catches transaction/session commands that Supabase's prepared query path rejects.
  const sql = executableSql()
  const semicolons = sql.match(/;/g) ?? []
  const sqlCommands = sql.replace(/'(?:''|[^'])*'/g, "''")

  assert.match(sql, /^with\b/i)
  assert.equal(semicolons.length, 1)
  assert.match(sql, /;$/)
  assert.doesNotMatch(sqlCommands, /\b(begin|commit|rollback|set|set_config)\b/i)
  assert.doesNotMatch(sqlCommands, /\b(insert|update|delete|merge|create|alter|drop|truncate|grant|revoke|call|do)\b/i)
})

test('retains the reviewed metadata-only output contract', () => {
  // Catches exposing commands, connection details, Vault payloads, or row values.
  const sql = executableSql()

  assert.match(sql, /as restore_source_preflight\s*;$/i)
  assert.doesNotMatch(sql, /\b(jobname|command|conninfo|slot_name|decrypted_secret)\b/i)
})
