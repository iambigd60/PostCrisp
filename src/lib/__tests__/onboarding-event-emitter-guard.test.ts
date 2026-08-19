import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * A source-level guard, in the style of the tutorial feature-key guard.
 *
 * Centralising the emitter only helps while it stays centralised. The moment
 * someone hand-rolls another `fetch('/api/onboarding/event')` they get back the
 * untyped name (no compile-time check against the union) and the silent
 * `.catch(() => {})` — the two defects this work removed. A unit test on the
 * helper cannot notice that; only reading the tree can.
 */

const EVENT_PATH = '/api/onboarding/event'
const ROOTS = ['src/app', 'src/components']
const ALLOWED = ['src/lib/onboarding-client.ts']

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue
      out.push(...sourceFiles(full))
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

describe('onboarding event emission is centralised', () => {
  it('has exactly one module that talks to the event route', () => {
    const offenders = ROOTS.flatMap(sourceFiles)
      .filter((file) => readFileSync(file, 'utf8').includes(EVENT_PATH))
      .map((file) => file.replace(/\\/g, '/'))
      .filter((file) => !ALLOWED.includes(file))

    expect(offenders).toEqual([])
  })

  it('the allowed emitter really does target that route — so this guard cannot pass by the path simply having moved', () => {
    const helper = readFileSync('src/lib/onboarding-client.ts', 'utf8')

    expect(helper).toContain(EVENT_PATH)
  })
})
