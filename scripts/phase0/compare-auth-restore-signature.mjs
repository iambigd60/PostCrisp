#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

function usage() {
  console.error(
    'Usage: node scripts/phase0/compare-auth-restore-signature.mjs ' +
      '--query <sql-file> --backup-timestamp <ISO-8601> ' +
      '<source-before-authorization.json> <source-before-clone.json> <clone.json>',
  )
}

function readSignature(path) {
  const parsed = JSON.parse(readFileSync(path, 'utf8'))
  const value =
    parsed?.rows?.[0]?.auth_restore_signature ??
    parsed?.[0]?.auth_restore_signature ??
    parsed?.auth_restore_signature ??
    parsed

  const required = [
    'captured_at',
    'auth_schema_present',
    'auth_users_relation_present',
    'metadata_item_count',
    'metadata_signature_md5',
    'bounded_user_count',
    'bounded_user_count_cap',
    'bounded_user_count_capped',
  ]
  for (const key of required) {
    if (!(key in value)) throw new Error(`${path}: missing ${key}`)
  }
  if (!Number.isFinite(Date.parse(value.captured_at))) {
    throw new Error(`${path}: captured_at is not ISO-8601`)
  }
  return value
}

const args = process.argv.slice(2)
const queryFlag = args.indexOf('--query')
const backupFlag = args.indexOf('--backup-timestamp')
if (queryFlag < 0 || backupFlag < 0 || !args[queryFlag + 1] || !args[backupFlag + 1]) {
  usage()
  process.exit(64)
}

const positional = args.filter((_, index) =>
  index !== queryFlag &&
  index !== queryFlag + 1 &&
  index !== backupFlag &&
  index !== backupFlag + 1,
)
if (positional.length !== 3) {
  usage()
  process.exit(64)
}

try {
  const backupTimestamp = args[backupFlag + 1]
  const backupTime = Date.parse(backupTimestamp)
  if (!Number.isFinite(backupTime)) throw new Error('backup timestamp is not ISO-8601')

  const queryBytes = readFileSync(args[queryFlag + 1])
  const querySha256 = createHash('sha256').update(queryBytes).digest('hex')
  const sourceBeforeAuthorization = readSignature(positional[0])
  const sourceBeforeClone = readSignature(positional[1])
  const clone = readSignature(positional[2])
  const captures = [sourceBeforeAuthorization, sourceBeforeClone, clone]

  const schemaPresent = captures.every(
    value => value.auth_schema_present && value.auth_users_relation_present,
  )
  const backupPrecedesCaptures = captures.every(
    value => backupTime <= Date.parse(value.captured_at),
  )
  const metadataStable = captures.every(
    value =>
      value.metadata_item_count === sourceBeforeAuthorization.metadata_item_count &&
      value.metadata_signature_md5 === sourceBeforeAuthorization.metadata_signature_md5,
  )
  const aggregateUncapped = captures.every(value => !value.bounded_user_count_capped)
  const aggregateStable = captures.every(
    value => value.bounded_user_count === sourceBeforeAuthorization.bounded_user_count,
  )

  let result = 'PASS_BOUNDED'
  let exitCode = 0
  if (!schemaPresent || !backupPrecedesCaptures || !metadataStable) {
    result = 'FAIL'
    exitCode = 1
  } else if (!aggregateUncapped || !aggregateStable) {
    result = 'INDETERMINATE'
    exitCode = 2
  }

  console.log(JSON.stringify({
    result,
    query_sha256: querySha256,
    selected_backup_timestamp: new Date(backupTime).toISOString(),
    capture_timestamps: captures.map(value => value.captured_at),
    metadata_signature_md5: sourceBeforeAuthorization.metadata_signature_md5,
    checks: {
      auth_schema_and_users_relation_present: schemaPresent,
      selected_backup_precedes_captures: backupPrecedesCaptures,
      metadata_signature_stable: metadataStable,
      bounded_aggregate_uncapped: aggregateUncapped,
      bounded_aggregate_stable: aggregateStable,
    },
    limitation:
      'Aggregate equality cannot prove row identity or completeness; offsetting creates and deletions can produce the same count.',
  }, null, 2))
  process.exit(exitCode)
} catch (error) {
  console.error(`Auth restore comparison failed: ${error.message}`)
  process.exit(1)
}
