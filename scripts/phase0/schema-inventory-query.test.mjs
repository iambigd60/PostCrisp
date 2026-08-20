import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const queryPath = fileURLToPath(new URL('./schema-inventory.sql', import.meta.url))

test('emits inventory contract v2 security and schema object classes', () => {
  // Catches a parity capture that silently omits reviewed public object classes.
  const sql = readFileSync(queryPath, 'utf8')

  assert.match(sql, /'inventory_contract_version',\s*2/i)
  for (const section of [
    'application_schemas',
    'extensions',
    'views',
    'foreign_tables',
    'types',
  ]) {
    assert.match(sql, new RegExp(`'${section}'\\s*,`, 'i'))
  }
  assert.match(sql, /pg_get_viewdef/i)
  assert.match(sql, /pg_foreign_table/i)
  assert.match(sql, /pg_enum/i)
  assert.match(sql, /pg_range/i)
  assert.match(sql, /pg_extension/i)
})

test('keeps tables distinct while including new relation classes in columns', () => {
  // Catches views/foreign tables being mislabeled as tables or losing their columns.
  const sql = readFileSync(queryPath, 'utf8')
  const tables = sql.match(/tables AS \(([\s\S]*?)\n\),\ncolumns AS \(/)?.[1] ?? ''
  const columns = sql.match(/columns AS \(([\s\S]*?)\n\),\nconstraints AS \(/)?.[1] ?? ''

  assert.match(tables, /c\.relkind IN \('r', 'p'\)/)
  assert.doesNotMatch(tables, /'v'|'m'|'f'/)
  assert.match(columns, /c\.relkind IN \('r', 'p', 'v', 'm', 'f'\)/)
})
