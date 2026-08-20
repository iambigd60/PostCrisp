import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const comparatorPath = fileURLToPath(
  new URL('./compare-application-restore-aggregates.mjs', import.meta.url),
)

const relationCounts = {
  ai_config_overrides: 1,
  credit_transactions: 2,
  generations: 3,
  processed_stripe_events: 4,
  profiles: 5,
}

function capture(capturedAt, overrides = {}) {
  return {
    application_restore_aggregates: {
      captured_at: capturedAt,
      bounded_row_count_cap: 100001,
      counts: relationCounts,
      ...overrides,
    },
  }
}

function runComparator(captures, backupTimestamp = '2026-08-20T20:00:00Z') {
  const directory = mkdtempSync(join(tmpdir(), 'postcrisp-application-aggregates-'))
  const queryPath = join(directory, 'query.sql')
  const capturePaths = captures.map((_, index) => join(directory, `capture-${index}.json`))

  try {
    writeFileSync(queryPath, 'select 1;\n')
    captures.forEach((value, index) => {
      writeFileSync(capturePaths[index], `${JSON.stringify(value)}\n`)
    })
    return spawnSync(
      process.execPath,
      [
        comparatorPath,
        '--query', queryPath,
        '--backup-timestamp', backupTimestamp,
        ...capturePaths,
      ],
      { encoding: 'utf8' },
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

const stableCaptures = () => [
  capture('2026-08-20T21:00:00Z'),
  capture('2026-08-20T22:00:00Z'),
  capture('2026-08-20T23:00:00Z'),
]

test('passes stable uncapped aggregates with chronology and query-hash evidence', () => {
  // Catches a restore comparator claiming success without the reviewed evidence binding.
  const result = runComparator(stableCaptures())

  assert.equal(result.status, 0, result.stderr || result.stdout)
  const output = JSON.parse(result.stdout)
  assert.equal(output.result, 'PASS_BOUNDED')
  assert.equal(
    output.query_sha256,
    '4a45092ccf992ea92250053a80b931b787924ba61648f420555511b84f10ab6c',
  )
  assert.deepEqual(output.checks, {
    backup_and_capture_chronology_valid: true,
    bounded_aggregates_uncapped: true,
    bounded_aggregates_stable: true,
  })
  assert.equal(Object.hasOwn(output, 'counts'), false)
})

test('is indeterminate when any aggregate changes or reaches the reviewed cap', () => {
  // Catches unequal or capped evidence being upgraded to a restore pass.
  for (const changedCounts of [
    { ...relationCounts, profiles: 6 },
    { ...relationCounts, profiles: 100001 },
  ]) {
    const captures = stableCaptures()
    captures[2] = capture('2026-08-20T23:00:00Z', { counts: changedCounts })
    const result = runComparator(captures)

    assert.equal(result.status, 2, result.stderr || result.stdout)
    assert.equal(JSON.parse(result.stdout).result, 'INDETERMINATE')
  }
})

test('fails malformed relation sets and invalid capture chronology', () => {
  // Catches a nonexistent relation or post-clone source capture bypassing the drill contract.
  const malformed = stableCaptures()
  malformed[0] = capture('2026-08-20T21:00:00Z', {
    counts: { ...relationCounts, purchased_credits: 0 },
  })
  const malformedResult = runComparator(malformed)
  assert.equal(malformedResult.status, 1)
  assert.match(malformedResult.stderr, /counts must contain exactly the reviewed relations/)

  const chronologyResult = runComparator([
    capture('2026-08-20T22:00:00Z'),
    capture('2026-08-20T21:00:00Z'),
    capture('2026-08-20T23:00:00Z'),
  ])
  assert.equal(chronologyResult.status, 1)
  assert.match(chronologyResult.stderr, /chronology must satisfy/)
})
