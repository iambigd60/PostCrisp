#!/usr/bin/env node

import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildSupabaseInvocation as buildBoundedSupabaseInvocation,
  runBoundedInvocation,
} from './capture-auth-restore-signature.mjs'

const queryPath = fileURLToPath(new URL('./restore-source-preflight.sql', import.meta.url))

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

function exactObject(value, expectedKeys) {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === expectedKeys.length &&
    expectedKeys.every(key => Object.hasOwn(value, key))
}

function nonnegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0
}

function reviewedPreflightShape(value) {
  if (!exactObject(value, [
    'captured_at',
    'relevant_enabled_extensions',
    'cron',
    'pg_net',
    'subscriptions',
    'replication_slots',
    'vault',
    'foreign_access',
    'outbound_reference_function_count',
    'outbound_reference_functions',
  ])) return false

  if (typeof value.captured_at !== 'string' ||
      !Array.isArray(value.relevant_enabled_extensions) ||
      !value.relevant_enabled_extensions.every(item => typeof item === 'string') ||
      !nonnegativeInteger(value.outbound_reference_function_count) ||
      !Array.isArray(value.outbound_reference_functions) ||
      !value.outbound_reference_functions.every(item => typeof item === 'string')) return false

  if (!exactObject(value.cron, ['catalog_present', 'job_count', 'active_job_count']) ||
      typeof value.cron.catalog_present !== 'boolean' ||
      !(value.cron.job_count === null || nonnegativeInteger(value.cron.job_count)) ||
      !(value.cron.active_job_count === null || nonnegativeInteger(value.cron.active_job_count))) {
    return false
  }

  if (!exactObject(value.pg_net, ['request_queue_present', 'queued_request_count']) ||
      typeof value.pg_net.request_queue_present !== 'boolean' ||
      !(value.pg_net.queued_request_count === null ||
        nonnegativeInteger(value.pg_net.queued_request_count))) return false

  for (const [object, keys] of [
    [value.subscriptions, [
      'total_count', 'enabled_count', 'disabled_count', 'non_platform_or_unclassified_count',
    ]],
    [value.replication_slots, [
      'total_count', 'active_count', 'inactive_count', 'logical_count', 'physical_count',
      'non_platform_or_unclassified_count',
    ]],
  ]) {
    if (!exactObject(object, keys) || !keys.every(key => nonnegativeInteger(object[key]))) {
      return false
    }
  }

  if (!exactObject(value.vault, [
    'schema_present', 'secrets_relation_present', 'secret_count',
  ]) ||
      typeof value.vault.schema_present !== 'boolean' ||
      typeof value.vault.secrets_relation_present !== 'boolean' ||
      !(value.vault.secret_count === null || nonnegativeInteger(value.vault.secret_count))) {
    return false
  }

  return exactObject(value.foreign_access, [
    'server_count', 'user_mapping_count', 'wrapper_names',
  ]) &&
    nonnegativeInteger(value.foreign_access.server_count) &&
    nonnegativeInteger(value.foreign_access.user_mapping_count) &&
    Array.isArray(value.foreign_access.wrapper_names) &&
    value.foreign_access.wrapper_names.every(item => typeof item === 'string')
}

export function normalizeCliOutput(stdout) {
  let parsed
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new Error('Supabase CLI stdout must be valid JSON without status lines')
  }

  const preflight =
    parsed?.rows?.[0]?.restore_source_preflight ??
    parsed?.[0]?.restore_source_preflight ??
    parsed?.restore_source_preflight

  if (!reviewedPreflightShape(preflight)) {
    throw new Error('Supabase CLI JSON must contain the reviewed metadata shape')
  }

  return JSON.stringify({ restore_source_preflight: preflight })
}

function usage() {
  console.error(
    'Usage: node scripts/phase0/capture-restore-source-preflight.mjs ' +
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
    console.error(`Restore source preflight capture failed: ${error.message}`)
    process.exit(1)
  }
}
