#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { REVIEWED_APPLICATION_RELATIONS } from './capture-application-restore-aggregates.mjs'

const REVIEWED_ROW_COUNT_CAP = 100001
const ISO_WITH_TIMEZONE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/

function usage() {
  console.error(
    'Usage: node scripts/phase0/compare-application-restore-aggregates.mjs ' +
      '--query <sql-file> --backup-timestamp <ISO-8601> ' +
      '<source-before-authorization.json> <source-before-clone.json> <clone.json>',
  )
}

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

function readCapture(path, label) {
  const parsed = JSON.parse(readFileSync(path, 'utf8'))
  const value =
    parsed?.rows?.[0]?.application_restore_aggregates ??
    parsed?.[0]?.application_restore_aggregates ??
    parsed?.application_restore_aggregates ??
    parsed

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must contain an application_restore_aggregates object`)
  }
  const expectedKeys = ['bounded_row_count_cap', 'captured_at', 'counts']
  const keys = Object.keys(value).sort()
  if (keys.length !== expectedKeys.length ||
      !keys.every((key, index) => key === expectedKeys[index])) {
    throw new Error(`${label} must contain exactly the reviewed aggregate fields`)
  }
  if (value.bounded_row_count_cap !== REVIEWED_ROW_COUNT_CAP) {
    throw new Error(
      `${label}.bounded_row_count_cap must equal reviewed query cap ${REVIEWED_ROW_COUNT_CAP}`,
    )
  }
  if (value.counts === null || typeof value.counts !== 'object' || Array.isArray(value.counts)) {
    throw new Error(`${label}.counts must contain exactly the reviewed relations`)
  }
  const countKeys = Object.keys(value.counts).sort()
  if (countKeys.length !== REVIEWED_APPLICATION_RELATIONS.length ||
      !countKeys.every((key, index) => key === REVIEWED_APPLICATION_RELATIONS[index])) {
    throw new Error(`${label}.counts must contain exactly the reviewed relations`)
  }
  for (const relation of REVIEWED_APPLICATION_RELATIONS) {
    const count = value.counts[relation]
    if (!Number.isSafeInteger(count) || count < 0 || count > REVIEWED_ROW_COUNT_CAP) {
      throw new Error(
        `${label}.counts.${relation} must be an integer between 0 and ${REVIEWED_ROW_COUNT_CAP}`,
      )
    }
  }

  return {
    ...value,
    capturedTime: parseIsoTimestamp(value.captured_at, `${label}.captured_at`),
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
  const querySha256 = createHash('sha256').update(readFileSync(args[queryFlag + 1])).digest('hex')
  const captures = [
    readCapture(positional[0], 'source-before-authorization'),
    readCapture(positional[1], 'source-before-clone'),
    readCapture(positional[2], 'clone'),
  ]

  const chronologyValid =
    backupTime <= captures[0].capturedTime &&
    captures[0].capturedTime <= captures[1].capturedTime &&
    captures[1].capturedTime <= captures[2].capturedTime
  if (!chronologyValid) {
    throw new Error(
      'chronology must satisfy backup <= source-before-authorization <= source-before-clone <= clone',
    )
  }

  const aggregatesUncapped = captures.every(capture =>
    REVIEWED_APPLICATION_RELATIONS.every(
      relation => capture.counts[relation] < REVIEWED_ROW_COUNT_CAP,
    ),
  )
  const aggregatesStable = captures.every(capture =>
    REVIEWED_APPLICATION_RELATIONS.every(
      relation => capture.counts[relation] === captures[0].counts[relation],
    ),
  )
  const pass = aggregatesUncapped && aggregatesStable

  console.log(JSON.stringify({
    result: pass ? 'PASS_BOUNDED' : 'INDETERMINATE',
    query_sha256: querySha256,
    selected_backup_timestamp: new Date(Date.parse(backupTimestamp)).toISOString(),
    capture_timestamps: captures.map(capture => capture.captured_at),
    relations: REVIEWED_APPLICATION_RELATIONS,
    checks: {
      backup_and_capture_chronology_valid: chronologyValid,
      bounded_aggregates_uncapped: aggregatesUncapped,
      bounded_aggregates_stable: aggregatesStable,
    },
    limitation:
      'Aggregate equality cannot prove row identity or completeness; offsetting creates and deletions can produce the same count.',
  }, null, 2))
  process.exit(pass ? 0 : 2)
} catch (error) {
  console.error(`Application restore aggregate comparison failed: ${error.message}`)
  process.exit(1)
}
