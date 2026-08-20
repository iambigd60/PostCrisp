#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export const AUTH_SIGNATURE_TIMEOUT_MS = 45_000
export const AUTH_SIGNATURE_KILL_GRACE_MS = 2_000

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
      detached: platform !== 'win32',
      windowsHide: true,
    },
    timeoutMs: AUTH_SIGNATURE_TIMEOUT_MS,
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

  const required = [
    'captured_at',
    'auth_schema_present',
    'auth_users_relation_present',
    'metadata_item_count',
    'metadata_signature_md5',
    'global_role_item_count',
    'global_role_signature_md5',
    'bounded_user_count',
    'bounded_user_count_cap',
    'bounded_user_count_capped',
  ]
  if (!required.every(key => Object.hasOwn(signature, key))) {
    throw new Error('Supabase CLI JSON must contain the reviewed auth signature shape')
  }

  const reviewedSignature = Object.fromEntries(required.map(key => [key, signature[key]]))
  return JSON.stringify({ auth_restore_signature: reviewedSignature })
}

function waitForChildExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true)

  return new Promise(resolveExit => {
    const onExit = () => {
      clearTimeout(deadline)
      resolveExit(true)
    }
    const deadline = setTimeout(() => {
      child.removeListener('exit', onExit)
      resolveExit(false)
    }, Math.max(0, timeoutMs))
    child.once('exit', onExit)
  })
}

export async function terminateProcessTree(
  child,
  {
    platform = process.platform,
    killGraceMs = AUTH_SIGNATURE_KILL_GRACE_MS,
    spawnSyncImpl = spawnSync,
    killImpl = process.kill,
  } = {},
) {
  const pid = child?.pid
  if (!Number.isSafeInteger(pid) || pid <= 0) return false

  const deadline = Date.now() + killGraceMs
  if (platform === 'win32') {
    const result = spawnSyncImpl(
      'taskkill.exe',
      ['/PID', String(pid), '/T', '/F'],
      {
        shell: false,
        stdio: 'ignore',
        timeout: killGraceMs,
        windowsHide: true,
      },
    )
    if (result.error || (result.status !== 0 && child.exitCode === null && child.signalCode === null)) {
      return false
    }
  } else {
    try {
      killImpl(-pid, 'SIGKILL')
    } catch (error) {
      if (error.code !== 'ESRCH') return false
    }
  }

  return waitForChildExit(child, Math.max(0, deadline - Date.now()))
}

function discardCapturedStreams(child, onStdout) {
  child.stdout?.removeListener('data', onStdout)
  child.stdout?.destroy()
  child.stderr?.destroy()
}

export function runBoundedInvocation(
  invocation,
  {
    timeoutMs = invocation.timeoutMs ?? AUTH_SIGNATURE_TIMEOUT_MS,
    killGraceMs = AUTH_SIGNATURE_KILL_GRACE_MS,
    platform = process.platform,
    spawnImpl = spawn,
    terminateTreeImpl = terminateProcessTree,
  } = {},
) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('timeoutMs must be a positive integer')
  }
  if (!Number.isSafeInteger(killGraceMs) || killGraceMs <= 0) {
    throw new Error('killGraceMs must be a positive integer')
  }

  return new Promise((resolveRun, rejectRun) => {
    let child
    try {
      child = spawnImpl(invocation.command, invocation.args, invocation.options)
    } catch {
      rejectRun(new Error('Supabase CLI child process could not be started'))
      return
    }

    let stdout = ''
    let settled = false
    const onStdout = chunk => {
      stdout += chunk
    }
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', onStdout)
    child.stderr?.resume()

    const timeoutHandle = setTimeout(async () => {
      if (settled) return
      settled = true
      stdout = ''
      child.removeListener('close', onClose)
      child.removeListener('error', onError)
      child.on('error', () => {})
      discardCapturedStreams(child, onStdout)
      child.unref()

      let terminationConfirmed = false
      try {
        terminationConfirmed = await terminateTreeImpl(child, { platform, killGraceMs })
      } catch {
        terminationConfirmed = false
      }

      const termination = terminationConfirmed
        ? 'process tree termination confirmed'
        : `process tree termination not confirmed within ${killGraceMs} ms`
      rejectRun(new Error(`Supabase CLI query exceeded ${timeoutMs} ms; ${termination}`))
    }, timeoutMs)

    const onError = () => {
      if (settled) return
      settled = true
      clearTimeout(timeoutHandle)
      stdout = ''
      discardCapturedStreams(child, onStdout)
      rejectRun(new Error('Supabase CLI child process failed'))
    }
    const onClose = code => {
      if (settled) return
      settled = true
      clearTimeout(timeoutHandle)
      child.stdout?.removeListener('data', onStdout)
      if (code !== 0) {
        stdout = ''
        rejectRun(new Error(`Supabase CLI query failed with exit code ${code}`))
        return
      }
      resolveRun(stdout)
    }

    child.once('error', onError)
    child.once('close', onClose)
  })
}

async function capture(target, projectRef) {
  const invocation = buildSupabaseInvocation(
    target,
    queryPath,
    process.platform,
    process.env.ComSpec || 'cmd.exe',
    projectRef,
  )
  return normalizeCliOutput(await runBoundedInvocation(invocation))
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
