import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const moduleUrl = new URL('./capture-application-restore-aggregates.mjs', import.meta.url)
const capturePath = fileURLToPath(moduleUrl)

async function loadCaptureModule() {
  try {
    return await import(moduleUrl)
  } catch (error) {
    assert.fail(`application aggregate capture module must load: ${error.message}`)
  }
}

const reviewedAggregates = {
  captured_at: '2026-08-20T23:30:00Z',
  bounded_row_count_cap: 100001,
  counts: {
    ai_config_overrides: 0,
    credit_transactions: 0,
    generations: 0,
    processed_stripe_events: 0,
    profiles: 0,
  },
}

test('normalizes only the exact reviewed application aggregate shape', async () => {
  // Catches raw CLI fields or an invented relation escaping the values-free contract.
  const { normalizeCliOutput } = await loadCaptureModule()
  const normalized = normalizeCliOutput(JSON.stringify({
    rows: [{
      application_restore_aggregates: {
        ...reviewedAggregates,
        email: 'DO_NOT_LEAK@example.invalid',
        token: 'DO_NOT_LEAK_TOKEN',
      },
    }],
  }))

  assert.deepEqual(JSON.parse(normalized), {
    application_restore_aggregates: reviewedAggregates,
  })
  assert.doesNotMatch(normalized, /DO_NOT_LEAK|email|token/)

  assert.throws(
    () => normalizeCliOutput(JSON.stringify({
      application_restore_aggregates: {
        ...reviewedAggregates,
        counts: { ...reviewedAggregates.counts, purchased_credits: 0 },
      },
    })),
    /reviewed application aggregate shape/,
  )
})

test('runs the committed query through the bounded local launcher', () => {
  // Catches an invalid SQL relation, unsupported multi-statement query, or launcher drift.
  const result = spawnSync(process.execPath, [capturePath, '--local'], { encoding: 'utf8' })

  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`)
  const aggregates = JSON.parse(result.stdout).application_restore_aggregates
  assert.deepEqual(Object.keys(aggregates.counts), [
    'ai_config_overrides',
    'credit_transactions',
    'generations',
    'processed_stripe_events',
    'profiles',
  ])
  assert.equal(aggregates.bounded_row_count_cap, 100001)
  assert.equal(
    Object.values(aggregates.counts).every(count => Number.isSafeInteger(count) && count >= 0),
    true,
  )
})
