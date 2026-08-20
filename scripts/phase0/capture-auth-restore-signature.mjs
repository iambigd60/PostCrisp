#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export const AUTH_SIGNATURE_TIMEOUT_MS = 45_000

const queryPath = fileURLToPath(new URL('./auth-restore-signature.sql', import.meta.url))

export function buildSupabaseInvocation(
  target,
  sqlPath = queryPath,
  platform = process.platform,
  windowsCommand = process.env.ComSpec || 'cmd.exe',
  projectRef,
) {
  if (target !== '--linked' && target !== '--local' && target !== '--project-ref') {
    throw new Error('target must be --linked, --local, or --project-ref')
  }
  if (target === '--project-ref' && !/^[a-z]{20}$/.test(projectRef ?? '')) {
    throw new Error('project ref must contain exactly 20 lowercase letters')
  }

  const targetArgs = target === '--project-ref' ? [target, projectRef] : [target]
  const npxArgs = [
    '--yes',
    'supabase@2.115.0',
    'db',
    'query',
    ...targetArgs,
    '--file',
    sqlPath,
    '--output-format',
    'json',
  ]

  return {
    command: platform === 'win32' ? windowsCommand : 'npx',
    args: platform === 'win32'
      ? ['/d', '/s', '/c', 'npx.cmd', ...npxArgs]
      : npxArgs,
    options: {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      timeout: AUTH_SIGNATURE_TIMEOUT_MS,
      windowsHide: true,
    },
  }
}

export function normalizeCliOutput(stdout) {
  let parsed
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new Error('Supabase CLI stdout must be valid JSON without status lines')
  }

  const signature =
    parsed?.rows?.[0]?.auth_restore_signature ??
    parsed?.[0]?.auth_restore_signature ??
    parsed?.auth_restore_signature

  if (signature === null || typeof signature !== 'object' || Array.isArray(signature)) {
    throw new Error('Supabase CLI JSON must contain one auth_restore_signature object')
  }

  return JSON.stringify({ auth_restore_signature: signature })
}

async function capture(target, projectRef) {
  const invocation = buildSupabaseInvocation(
    target,
    queryPath,
    process.platform,
    process.env.ComSpec || 'cmd.exe',
    projectRef,
  )
  const child = spawn(invocation.command, invocation.args, invocation.options)
  let stdout = ''

  child.stdout.setEncoding('utf8')
  child.stdout.on('data', chunk => {
    stdout += chunk
  })
  child.stderr.resume()

  const { code, signal } = await new Promise((resolveClose, reject) => {
    child.once('error', reject)
    child.once('close', (closeCode, closeSignal) => {
      resolveClose({ code: closeCode, signal: closeSignal })
    })
  })

  if (signal !== null) {
    throw new Error(`Supabase CLI query exceeded ${AUTH_SIGNATURE_TIMEOUT_MS} ms and was cancelled`)
  }
  if (code !== 0) {
    throw new Error(`Supabase CLI query failed with exit code ${code}`)
  }

  return normalizeCliOutput(stdout)
}

function usage() {
  console.error(
    'Usage: node scripts/phase0/capture-auth-restore-signature.mjs ' +
    '(--linked|--local|--project-ref <clone-ref>)',
  )
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  const [target, projectRef, ...extra] = process.argv.slice(2)
  const simpleTarget = (target === '--linked' || target === '--local') && projectRef === undefined
  const projectTarget = target === '--project-ref' && projectRef !== undefined
  if (extra.length > 0 || (!simpleTarget && !projectTarget)) {
    usage()
    process.exit(1)
  }

  try {
    process.stdout.write(`${await capture(target, projectRef)}\n`)
  } catch (error) {
    console.error(`Auth restore signature capture failed: ${error.message}`)
    process.exit(1)
  }
}
