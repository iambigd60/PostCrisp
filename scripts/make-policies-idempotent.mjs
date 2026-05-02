// One-shot migration: prepend DROP POLICY IF EXISTS before every CREATE POLICY
// in supabase-schema.sql so the file is fully re-runnable. Postgres < 17 does
// not support `CREATE POLICY IF NOT EXISTS`, so DROP-then-CREATE is the
// portable idempotent pattern.
import fs from 'node:fs'
import path from 'node:path'

const file = path.resolve('src/lib/supabase-schema.sql')
const original = fs.readFileSync(file, 'utf8')

// Match: CREATE POLICY "name"\n  ON <qualified.table> FOR <op>...
// Capture: name, qualified.table.
const re = /CREATE POLICY "([^"]+)"\n\s+ON\s+(\S+)\s+FOR/g

let count = 0
const patched = original.replace(re, (full, name, table) => {
  count += 1
  return `DROP POLICY IF EXISTS "${name}" ON ${table};\n${full}`
})

// Don't double-apply — if the file already has DROP POLICY IF EXISTS lines
// for everything, skip writing.
if (original.includes('DROP POLICY IF EXISTS')) {
  console.error('File already contains DROP POLICY IF EXISTS lines — refusing to double-patch.')
  process.exit(1)
}

fs.writeFileSync(file, patched, 'utf8')
console.log(`Inserted ${count} DROP POLICY IF EXISTS guards.`)
