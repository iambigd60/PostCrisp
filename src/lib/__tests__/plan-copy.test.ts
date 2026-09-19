import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PLANS } from '../stripe'
import { TIER_ALLOWANCE } from '../crisp-engine-config'

/**
 * Paid plans are metered: 500 credits a month on Creator, 2,000 on Elite.
 * The August launch-readiness review flagged the "Unlimited" wording as
 * false advertising. This keeps the plan copy tied to the real allowance and
 * keeps the word from creeping back into any user-facing string.
 */

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue
      walk(p, out)
    } else if (/\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

describe('plan copy', () => {
  it('states the real allowance on every plan', () => {
    const text = (tier: keyof typeof PLANS) => PLANS[tier].features.join(' ')
    expect(text('starter')).toContain(`${TIER_ALLOWANCE.starter.credits} credits a day`)
    expect(text('creator')).toContain(`${TIER_ALLOWANCE.creator.credits.toLocaleString('en-US')} credits a month`)
    expect(text('elite')).toContain(`${TIER_ALLOWANCE.elite.credits.toLocaleString('en-US')} credits a month`)
  })

  it('never promises unlimited generations or access', () => {
    const banned = /unlimited (ai )?(generations|access|plan)|no limits/i
    const offenders = walk(resolve(process.cwd(), 'src')).filter((f) => banned.test(readFileSync(f, 'utf8')))
    expect(offenders.map((f) => f.replace(process.cwd() + '/', ''))).toEqual([])
  })
})
