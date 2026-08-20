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

const ISO_WITH_TIMEZONE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/
const REVIEWED_USER_COUNT_CAP = 100001

function parseIsoTimestamp(value, label) {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be an ISO-8601 timestamp with timezone`)
  }
  const match = ISO_WITH_TIMEZONE.exec(value)
  if (!match) throw new Error(`${label} must be an ISO-8601 timestamp with timezone`)

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction = '', zone] = match
  const [year, month, day, hour, minute, second] =
    [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number)
  const localMilliseconds = Date.UTC(year, month - 1, day, hour, minute, second)
  const local = new Date(localMilliseconds)
  const calendarValid =
    year >= 1000 &&
    local.getUTCFullYear() === year &&
    local.getUTCMonth() === month - 1 &&
    local.getUTCDate() === day &&
    local.getUTCHours() === hour &&
    local.getUTCMinutes() === minute &&
    local.getUTCSeconds() === second
  if (!calendarValid) throw new Error(`${label} must be an ISO-8601 timestamp with timezone`)

  let offsetMinutes = 0
  if (zone !== 'Z') {
    const offsetHours = Number(zone.slice(1, 3))
    const offsetMinutePart = Number(zone.slice(4, 6))
    if (offsetHours > 23 || offsetMinutePart > 59) {
      throw new Error(`${label} must be an ISO-8601 timestamp with timezone`)
    }
    offsetMinutes = (offsetHours * 60 + offsetMinutePart) * (zone[0] === '+' ? 1 : -1)
  }

  const fractionNanoseconds = BigInt((fraction || '0').padEnd(9, '0'))
  return BigInt(localMilliseconds) * 1_000_000n
    - BigInt(offsetMinutes) * 60_000_000_000n
    + fractionNanoseconds
}

function requireBoolean(value, label) {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean`)
}

function requireNonnegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative integer`)
  }
}

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }
}

function readSignature(path, label) {
  const parsed = JSON.parse(readFileSync(path, 'utf8'))
  const value =
    parsed?.rows?.[0]?.auth_restore_signature ??
    parsed?.[0]?.auth_restore_signature ??
    parsed?.auth_restore_signature ??
    parsed

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must contain an auth_restore_signature object`)
  }

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
    if (!Object.hasOwn(value, key)) throw new Error(`${label}: missing ${key}`)
  }

  const capturedTime = parseIsoTimestamp(value.captured_at, `${label}.captured_at`)
  requireBoolean(value.auth_schema_present, `${label}.auth_schema_present`)
  requireBoolean(value.auth_users_relation_present, `${label}.auth_users_relation_present`)
  requirePositiveInteger(value.metadata_item_count, `${label}.metadata_item_count`)
  if (typeof value.metadata_signature_md5 !== 'string' ||
      !/^[0-9a-f]{32}$/i.test(value.metadata_signature_md5)) {
    throw new Error(`${label}.metadata_signature_md5 must be 32 hexadecimal characters`)
  }
  requireNonnegativeInteger(value.bounded_user_count, `${label}.bounded_user_count`)
  if (!Number.isSafeInteger(value.bounded_user_count_cap) || value.bounded_user_count_cap <= 0) {
    throw new Error(`${label}.bounded_user_count_cap must be a positive integer`)
  }
  requireBoolean(value.bounded_user_count_capped, `${label}.bounded_user_count_capped`)
  if (value.bounded_user_count > value.bounded_user_count_cap) {
    throw new Error(`${label}.bounded_user_count must not exceed bounded_user_count_cap`)
  }
  const expectedCapped = value.bounded_user_count === value.bounded_user_count_cap
  if (value.bounded_user_count_capped !== expectedCapped) {
    throw new Error(
      `${label}.bounded_user_count_capped must equal ` +
      '(bounded_user_count === bounded_user_count_cap)',
    )
  }

  return {
    ...value,
    metadata_signature_md5: value.metadata_signature_md5.toLowerCase(),
    capturedTime,
  }
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
  const backupTime = parseIsoTimestamp(backupTimestamp, 'backup timestamp')

  const queryBytes = readFileSync(args[queryFlag + 1])
  const querySha256 = createHash('sha256').update(queryBytes).digest('hex')
  const sourceBeforeAuthorization = readSignature(positional[0], 'source-before-authorization')
  const sourceBeforeClone = readSignature(positional[1], 'source-before-clone')
  const clone = readSignature(positional[2], 'clone')
  const captures = [sourceBeforeAuthorization, sourceBeforeClone, clone]
  const captureLabels = ['source-before-authorization', 'source-before-clone', 'clone']
  const captureCaps = captures.map(value => value.bounded_user_count_cap)

  if (!captureCaps.every(cap => cap === captureCaps[0])) {
    throw new Error('all capture bounded_user_count_cap values must match')
  }
  captures.forEach((value, index) => {
    if (value.bounded_user_count_cap !== REVIEWED_USER_COUNT_CAP) {
      throw new Error(
        `${captureLabels[index]}.bounded_user_count_cap must equal reviewed query cap ` +
        REVIEWED_USER_COUNT_CAP,
      )
    }
  })

  const chronologyValid =
    backupTime <= sourceBeforeAuthorization.capturedTime &&
    sourceBeforeAuthorization.capturedTime <= sourceBeforeClone.capturedTime &&
    sourceBeforeClone.capturedTime <= clone.capturedTime
  if (!chronologyValid) {
    throw new Error(
      'chronology must satisfy backup <= source-before-authorization <= source-before-clone <= clone',
    )
  }
  const schemaPresent = captures.every(
    value => value.auth_schema_present && value.auth_users_relation_present,
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
  if (!schemaPresent || !metadataStable) {
    result = 'FAIL'
    exitCode = 1
  } else if (!aggregateUncapped || !aggregateStable) {
    result = 'INDETERMINATE'
    exitCode = 2
  }

  console.log(JSON.stringify({
    result,
    query_sha256: querySha256,
    selected_backup_timestamp: new Date(Date.parse(backupTimestamp)).toISOString(),
    capture_timestamps: captures.map(value => value.captured_at),
    metadata_signature_md5: sourceBeforeAuthorization.metadata_signature_md5,
    checks: {
      auth_schema_and_users_relation_present: schemaPresent,
      backup_and_capture_chronology_valid: chronologyValid,
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
