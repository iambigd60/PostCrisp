import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Source-level guard against tutorial feature-key drift.
 *
 * Why this reads files instead of calling code:
 *
 * The onboarding free-run cap is enforced by matching a string in three places
 * per route, and nothing in the type system connects them — every one is a bare
 * `string` argument or object literal:
 *
 *   1. `resolveTutorialCharge('<key>', …)`      → what hasUsedTutorialBypass
 *                                                 reads from tutorial_redemptions
 *   2. `recordTutorialRedemption(userId, '<key>')` → what it writes there
 *   3. `feature: '<key>'` in the generations insert → what the pack rehydration
 *                                                 endpoint filters on
 *
 * If (1) and (2) ever disagree — the obvious way being a hyphen/underscore slip,
 * since the hyphenated forms are real `CrispTask` values used elsewhere in the
 * same files — the ledger is written under one key and read under another. The
 * per-feature cap silently becomes infinite, and no unit test, typecheck or lint
 * run would notice, because every individual call still receives a valid string.
 *
 * The previous guard tried to cover this by looping over a local list of keys
 * and passing the *same loop variable* to both the ledger fixture and the
 * resolver. That holds for any string, so it proved only that the resolver is
 * agnostic to which key it is given — which was never in doubt. It could not
 * fail when the routes drifted, because it never read the routes.
 *
 * This one reads them. It fails the day a key changes in one place and not the
 * others, which is the only failure mode worth guarding here.
 */

const ROUTES = [
  { path: 'src/app/api/generate/route.ts', key: 'captions' },
  { path: 'src/app/api/hashtags/route.ts', key: 'hashtags' },
  { path: 'src/app/api/viral-ideas/route.ts', key: 'viral_ideas' },
  { path: 'src/app/api/channel-analysis/route.ts', key: 'channel_analysis' },
] as const

/** Every key the four routes are allowed to use. */
const ALL_KEYS = ROUTES.map((r) => r.key)

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8')
}

/** First argument of the route's single `resolveTutorialCharge(` call. */
function bypassLookupKey(source: string): string | null {
  const m = source.match(/resolveTutorialCharge\(\s*'([^']+)'/)
  return m ? m[1] : null
}

/** Every second argument passed to `recordTutorialRedemption(`. */
function redemptionWriteKeys(source: string): string[] {
  return [...source.matchAll(/recordTutorialRedemption\(\s*[^,]+,\s*'([^']+)'\s*\)/g)].map((m) => m[1])
}

/** Every `feature: '…'` object-literal value in the file. */
function featureLiterals(source: string): string[] {
  return [...source.matchAll(/\bfeature:\s*'([^']+)'/g)].map((m) => m[1])
}

describe('tutorial feature keys — cross-file agreement', () => {
  it.each(ROUTES)('$path reads the ledger under the $key key', ({ path, key }) => {
    const found = bypassLookupKey(readSource(path))
    // A null here means the call shape changed and this guard has gone blind —
    // that is a failure, not a skip.
    expect(found, `no resolveTutorialCharge('…') literal found in ${path}`).not.toBeNull()
    expect(found).toBe(key)
  })

  it.each(ROUTES)('$path writes the ledger under the same key it reads', ({ path, key }) => {
    const source = readSource(path)
    const writes = redemptionWriteKeys(source)

    expect(writes.length, `no recordTutorialRedemption call found in ${path}`).toBeGreaterThan(0)
    // This is the assertion that actually matters: read key === write key.
    // If these diverge the freebie becomes infinitely repeatable.
    for (const write of writes) {
      expect(write).toBe(bypassLookupKey(source))
      expect(write).toBe(key)
    }
  })

  it.each(ROUTES)('$path stamps generations rows with the same key', ({ path, key }) => {
    const literals = featureLiterals(readSource(path))
    expect(literals.length, `no feature: '…' literal found in ${path}`).toBeGreaterThan(0)
    // Includes the generations insert and the AI-cost ledger row; both must agree,
    // because the pack rehydration endpoint filters generations on this value.
    for (const literal of literals) {
      expect(literal).toBe(key)
    }
  })

  it('uses underscored keys everywhere, never the hyphenated CrispTask forms', () => {
    // The hyphenated variants are legitimate CrispTask values passed to
    // checkAuthAndUsage in these same files. They must never reach the ledger.
    for (const { path } of ROUTES) {
      const source = readSource(path)
      expect(bypassLookupKey(source)).not.toMatch(/-/)
      for (const write of redemptionWriteKeys(source)) expect(write).not.toMatch(/-/)
    }
  })

  it('the pack rehydration endpoint filters on keys the routes actually write', () => {
    const source = readSource('src/app/api/onboarding/pack/route.ts')
    const m = source.match(/\.in\(\s*'feature',\s*\[([^\]]+)\]/)
    expect(m, 'no .in(\'feature\', [...]) filter found in pack/route.ts').not.toBeNull()

    const filtered = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1])
    expect(filtered.length).toBeGreaterThan(0)
    for (const key of filtered) {
      expect(ALL_KEYS).toContain(key)
    }
  })

  it('free-runs counts the same features the pack endpoint rehydrates', () => {
    const freeRuns = readSource('src/app/api/onboarding/free-runs/route.ts')
    const pack = readSource('src/app/api/onboarding/pack/route.ts')

    const packMatch = pack.match(/\.in\(\s*'feature',\s*\[([^\]]+)\]/)
    const freeRunsMatch = freeRuns.match(/PACK_FEATURES\s*=\s*\[([^\]]+)\]/)
    expect(packMatch).not.toBeNull()
    expect(freeRunsMatch, 'no PACK_FEATURES array found in free-runs/route.ts').not.toBeNull()

    const packKeys = [...packMatch![1].matchAll(/'([^']+)'/g)].map((x) => x[1])
    const freeRunKeys = [...freeRunsMatch![1].matchAll(/'([^']+)'/g)].map((x) => x[1])

    // A mismatch means the card's "N free runs left" counts a different set than
    // the session can actually rehydrate.
    expect([...freeRunKeys].sort()).toEqual([...packKeys].sort())
  })
})
