import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  AUTH_SIGNATURE_TIMEOUT_MS,
  buildSupabaseInvocation,
  normalizeCliOutput,
  runBoundedInvocation,
  terminateProcessTree,
} from './capture-auth-restore-signature.mjs'

const timeoutFixture = fileURLToPath(
  new URL('./fixtures/timeout-process-tree.mjs', import.meta.url),
)

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if (error.code === 'ESRCH') return false
    throw error
  }
}

function emergencyCleanup(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0 || !isProcessAlive(pid)) return
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
      shell: false,
      stdio: 'ignore',
      windowsHide: true,
    })
    return
  }
  process.kill(pid, 'SIGKILL')
}

test('builds a credential-free linked invocation with a fixed timeout', () => {
  const invocation = buildSupabaseInvocation('--linked', 'query.sql', 'win32', 'cmd.exe')

  assert.equal(AUTH_SIGNATURE_TIMEOUT_MS, 45_000)
  assert.equal(invocation.command, 'cmd.exe')
  assert.deepEqual(invocation.args, [
    '/d',
    '/s',
    '/c',
    'npx.cmd',
    '--yes',
    'supabase@2.115.0',
    'db',
    'query',
    '--linked',
    '--file',
    'query.sql',
    '--output-format',
    'json',
  ])
  assert.equal(invocation.timeoutMs, 45_000)
  assert.equal(invocation.options.shell, false)
  assert.equal(invocation.options.windowsHide, true)
})

test('builds the same bounded invocation for a local clone stand-in', () => {
  const invocation = buildSupabaseInvocation('--local', 'query.sql', 'linux')

  assert.equal(invocation.command, 'npx')
  assert.equal(invocation.args[4], '--local')
  assert.equal(invocation.timeoutMs, 45_000)
  assert.equal(invocation.options.detached, true)
})

test('builds a bounded credential-free clone invocation from a validated project ref', () => {
  const invocation = buildSupabaseInvocation(
    '--project-ref',
    'query.sql',
    'linux',
    undefined,
    'abcdefghijklmnopqrst',
  )

  assert.deepEqual(invocation.args.slice(4, 6), [
    '--project-ref',
    'abcdefghijklmnopqrst',
  ])
  assert.equal(invocation.timeoutMs, 45_000)
  assert.throws(
    () => buildSupabaseInvocation('--project-ref', 'query.sql', 'linux', undefined, 'bad;ref'),
    /20 lowercase letters/,
  )
})

test('normalizes CLI JSON to one comparator-ready signature object', () => {
  const normalized = normalizeCliOutput(JSON.stringify([{
    auth_restore_signature: {
      captured_at: '2026-08-20T19:00:00Z',
      auth_schema_present: true,
      auth_users_relation_present: true,
      metadata_item_count: 1,
      metadata_signature_md5: '00000000000000000000000000000000',
      bounded_user_count: 0,
      bounded_user_count_cap: 100001,
      bounded_user_count_capped: false,
    },
  }]))

  assert.deepEqual(JSON.parse(normalized), {
    auth_restore_signature: {
      captured_at: '2026-08-20T19:00:00Z',
      auth_schema_present: true,
      auth_users_relation_present: true,
      metadata_item_count: 1,
      metadata_signature_md5: '00000000000000000000000000000000',
      bounded_user_count: 0,
      bounded_user_count_cap: 100001,
      bounded_user_count_capped: false,
    },
  })
})

test('rejects transaction-status lines or a missing signature object', () => {
  assert.throws(
    () => normalizeCliOutput('BEGIN\n[{"auth_restore_signature":{}}]\nCOMMIT'),
    /valid JSON/,
  )
  assert.throws(() => normalizeCliOutput('[]'), /auth_restore_signature object/)
})

test('uses an exact bounded taskkill tree request on Windows', async () => {
  const calls = []
  const terminated = await terminateProcessTree(
    { pid: 4242, exitCode: 1, signalCode: null },
    {
      platform: 'win32',
      killGraceMs: 321,
      spawnSyncImpl: (...args) => {
        calls.push(args)
        return { status: 0 }
      },
    },
  )

  assert.equal(terminated, true)
  assert.deepEqual(calls, [[
    'taskkill.exe',
    ['/PID', '4242', '/T', '/F'],
    {
      shell: false,
      stdio: 'ignore',
      timeout: 321,
      windowsHide: true,
    },
  ]])
})

test('does not attempt process-tree termination for an unsafe PID', async () => {
  let invoked = false
  const terminated = await terminateProcessTree(
    { pid: -1, exitCode: null, signalCode: null },
    {
      platform: 'win32',
      spawnSyncImpl: () => {
        invoked = true
      },
    },
  )

  assert.equal(terminated, false)
  assert.equal(invoked, false)
})

test('kills only the detached POSIX process group for a valid child PID', async () => {
  const calls = []
  const terminated = await terminateProcessTree(
    { pid: 4242, exitCode: null, signalCode: 'SIGKILL' },
    {
      platform: 'linux',
      killImpl: (...args) => {
        calls.push(args)
      },
    },
  )

  assert.equal(terminated, true)
  assert.deepEqual(calls, [[-4242, 'SIGKILL']])
})

test('timeout rejects promptly, suppresses partial output, and terminates the descendant tree', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phase0-auth-timeout-'))
  const pidFile = join(directory, 'descendant.pid')
  const timeoutMs = 250
  const killGraceMs = 750
  let descendantPid

  const invocation = {
    command: process.execPath,
    args: [timeoutFixture, pidFile],
    options: {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
      detached: process.platform !== 'win32',
    },
  }

  const startedAt = performance.now()
  try {
    await assert.rejects(
      runBoundedInvocation(invocation, { timeoutMs, killGraceMs }),
      error => {
        assert.match(error.message, /exceeded 250 ms/)
        assert.match(error.message, /process tree termination confirmed/)
        assert.doesNotMatch(error.message, /auth_restore_signature|descendant-partial|DO_NOT_LEAK/)
        assert.equal(Object.hasOwn(error, 'stdout'), false)
        return true
      },
    )

    const elapsedMs = performance.now() - startedAt
    assert.ok(elapsedMs >= timeoutMs, `elapsed ${elapsedMs} ms was shorter than timeout`)
    assert.ok(
      elapsedMs < timeoutMs + killGraceMs + 300,
      `elapsed ${elapsedMs} ms exceeded the timeout plus independent kill grace`,
    )

    descendantPid = Number(readFileSync(pidFile, 'utf8'))
    assert.equal(Number.isSafeInteger(descendantPid), true)
    assert.equal(
      isProcessAlive(descendantPid),
      false,
      'descendant must exit before the bounded invocation rejects',
    )
  } finally {
    emergencyCleanup(descendantPid)
    rmSync(directory, { recursive: true, force: true })
  }
})
