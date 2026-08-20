#!/usr/bin/env node

import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildSupabaseInvocation as buildBoundedSupabaseInvocation,
  runBoundedInvocation,
} from './capture-auth-restore-signature.mjs'

const queryPath = fileURLToPath(new URL('./application-restore-aggregates.sql', import.meta.url))

export const REVIEWED_APPLICATION_RELATIONS = [
  'ai_config_overrides',
  'credit_transactions',
  'generations',
  'processed_stripe_events',
  'profiles',
]

export function buildSupabaseInvocation(
  target,
  sqlPath = queryPath,
  platform = process.platform,
  windowsCommand = process.env.ComSpec || 'cmd.exe',
  projectRef,
) {
  return buildBoundedSupabaseInvocation(
    target,
    sqlPath,
    platform,
    windowsCommand,
    projectRef,
  )
}

function nonnegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0
}

function reviewedAggregateShape(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  if (typeof value.captured_at !== 'string' ||
      value.bounded_row_count_cap !== 100001 ||
      value.counts === null ||
      typeof value.counts !== 'object' ||
      Array.isArray(value.counts)) return false

  const keys = Object.keys(value.counts).sort()
  return keys.length === REVIEWED_APPLICATION_RELATIONS.length &&
    keys.every((key, index) => key === REVIEWED_APPLICATION_RELATIONS[index]) &&
    REVIEWED_APPLICATION_RELATIONS.every(
      relation => nonnegativeInteger(value.counts[relation]) &&
        value.counts[relation] <= value.bounded_row_count_cap,
    )
}

export function normalizeCliOutput(stdout) {
  let parsed
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new Error('Supabase CLI stdout must be valid JSON without status lines')
  }

  const aggregates =
    parsed?.rows?.[0]?.application_restore_aggregates ??
    parsed?.[0]?.application_restore_aggregates ??
    parsed?.application_restore_aggregates

  if (!reviewedAggregateShape(aggregates)) {
    throw new Error('Supabase CLI JSON must contain the reviewed application aggregate shape')
  }

  const counts = Object.fromEntries(
    REVIEWED_APPLICATION_RELATIONS.map(relation => [relation, aggregates.counts[relation]]),
  )
  return JSON.stringify({
    application_restore_aggregates: {
      captured_at: aggregates.captured_at,
      bounded_row_count_cap: aggregates.bounded_row_count_cap,
      counts,
    },
  })
}

function usage() {
  console.error(
    'Usage: node scripts/phase0/capture-application-restore-aggregates.mjs ' +
      '(--linked|--local|--project-ref <clone-ref>)',
  )
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  const [target, projectRef, ...extra] = process.argv.slice(2)
  const simpleTarget = (target === '--linked' || target === '--local') && projectRef === undefined
  const projectTarget = target === '--project-ref' && /^[a-z]{20}$/.test(projectRef ?? '')

  if (extra.length > 0 || (!simpleTarget && !projectTarget)) {
    usage()
    process.exit(1)
  }

  try {
    const invocation = buildSupabaseInvocation(
      target,
      queryPath,
      process.platform,
      process.env.ComSpec || 'cmd.exe',
      projectRef,
    )
    const output = normalizeCliOutput(await runBoundedInvocation(invocation))
    process.stdout.write(`${output}\n`)
  } catch (error) {
    console.error(`Application restore aggregate capture failed: ${error.message}`)
    process.exit(1)
  }
}
