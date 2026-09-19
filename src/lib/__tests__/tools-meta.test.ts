import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { ALL_TOOLS, creditCostForTool, SPEND_CONFIRM_THRESHOLD } from '../tools-meta'
import { CREDITS_PER_TASK, type CrispTask } from '../crisp-engine-config'

/**
 * Guards the one thing the interface audit (F01/F03) found broken: the tool
 * registry, the price table, and the pages had no working link between them,
 * so no page could show a price and two pages hard-coded one.
 *
 * - every tool's `task` is a priced task, and `creditCost` equals the price
 *   table (so a price change lands on every card and button automatically);
 * - every priced task is offered by a tool — a price with no tool (the old
 *   `media-kit-bio`) is dead config that will mislead the next reader;
 * - tool keys are the snake_case form of their task, which is what the
 *   `generations.feature` column stores;
 * - no dashboard page carries a hard-coded "N credits" label any more.
 */

const root = process.cwd()

describe('tools-meta ↔ CREDITS_PER_TASK', () => {
  it('derives every creditCost from the canonical price table', () => {
    for (const tool of ALL_TOOLS) {
      expect(CREDITS_PER_TASK[tool.task], `${tool.key} → ${tool.task}`).toBeTypeOf('number')
      expect(tool.creditCost).toBe(CREDITS_PER_TASK[tool.task])
      expect(creditCostForTool(tool.key)).toBe(tool.creditCost)
    }
  })

  it('prices no task that has no tool', () => {
    const offered = new Set(ALL_TOOLS.map((t) => t.task))
    const orphans = (Object.keys(CREDITS_PER_TASK) as CrispTask[]).filter((t) => !offered.has(t))
    expect(orphans).toEqual([])
  })

  it('keys are the snake_case form of the task', () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.key).toBe(tool.task.replace(/-/g, '_'))
    }
  })

  it('has unique keys and hrefs that resolve to real pages', () => {
    const keys = ALL_TOOLS.map((t) => t.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const tool of ALL_TOOLS) {
      const page = resolve(root, 'src/app', `.${tool.href}`, 'page.tsx')
      expect(existsSync(page), `${tool.key} → ${tool.href}`).toBe(true)
    }
  })

  it('flags the expensive tools for a confirmation step', () => {
    const expensive = ALL_TOOLS.filter((t) => t.creditCost >= SPEND_CONFIRM_THRESHOLD).map((t) => t.key).sort()
    expect(expensive).toEqual(
      ['brand_pitch', 'channel_analysis', 'competitor_analysis', 'foundation_analysis', 'rate_calculator'],
    )
  })
})

describe('single registry (audit F03)', () => {
  it('sidebar has no hand-written tool links', () => {
    const src = readFileSync(resolve(root, 'src/components/layout/Sidebar.tsx'), 'utf8')
    for (const tool of ALL_TOOLS) {
      // Voice Trainer is a deliberate top-level item; every other tool link must come from tools-meta.
      expect(src.includes(`"${tool.href}"`), `${tool.href} hard-coded in Sidebar`).toBe(false)
    }
  })

  it('dashboard reads tool identity from the registry, not a private table', () => {
    const src = readFileSync(resolve(root, 'src/app/dashboard/page.tsx'), 'utf8')
    expect(src).not.toMatch(/FEATURE_META/)
    expect(src).toMatch(/toolByKey/)
  })

  it('every tool states how long it takes', () => {
    for (const tool of ALL_TOOLS) expect(tool.duration, tool.key).toMatch(/\d+s$/)
  })
})

describe('dismiss and confirm pattern (audit F17)', () => {
  it('user-facing code never uses window.confirm or a full reload', () => {
    const files = [
      'src/app/dashboard/page.tsx',
      'src/components/GettingStartedCard.tsx',
      'src/components/NextToolsCard.tsx',
      'src/components/ChannelsSection.tsx',
      'src/app/dashboard/voice/page.tsx',
    ]
    for (const rel of files) {
      const src = readFileSync(resolve(root, rel), 'utf8')
      expect(src, rel).not.toMatch(/window\.confirm/)
      expect(src, rel).not.toMatch(/location\.reload/)
    }
  })
})

describe('dashboard pages', () => {
  const dir = resolve(root, 'src/app/dashboard')
  const pages = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'billing' && d.name !== 'generations')
    .map((d) => resolve(dir, d.name, 'page.tsx'))
    .filter((p) => existsSync(p))

  it('never hard-code a credit price in a button', () => {
    for (const page of pages) {
      const src = readFileSync(page, 'utf8')
      expect(src, page).not.toMatch(/·\s*\d+\s+credits?/)
    }
  })
})
