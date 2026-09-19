import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * Contrast guard (interface audit F04/F05). Session A of the audit plan
 * replaced 532 sub-standard grey text sites and 337 invisible card edges.
 * Nothing in lint or typecheck would notice them creeping back, so this
 * scans the source instead.
 *
 * Measured against surface-secondary #181E24:
 *   text-zinc-500 #71717A → 3.44:1 (fails AA 4.5:1)   use text-crisp (5.40:1)
 *   text-zinc-600 #52525B → 2.15:1 (fails)            use text-crisp
 *   border-brand-500/10   → 1.15:1 (invisible)        use border-edge (3.2:1)
 */

const BANNED: { pattern: RegExp; useInstead: string }[] = [
  { pattern: /\btext-zinc-500\b/, useInstead: 'text-crisp' },
  { pattern: /\btext-zinc-600\b/, useInstead: 'text-crisp' },
  { pattern: /(?<![\w:-])border-brand-500\/(?:5|10|15)(?!\d)/, useInstead: 'border-edge' },
  { pattern: /\bdivide-brand-500\/(?:5|10)(?!\d)/, useInstead: 'divide-edge' },
]

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue
      walk(p, out)
    } else if (/\.(tsx?|css)$/.test(name)) {
      out.push(p)
    }
  }
  return out
}

describe('design tokens', () => {
  const files = walk(resolve(process.cwd(), 'src'))

  it('scans a realistic number of source files', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  for (const { pattern, useInstead } of BANNED) {
    it(`never uses ${pattern.source} (use ${useInstead})`, () => {
      const offenders = files.filter((f) => pattern.test(readFileSync(f, 'utf8')))
      expect(offenders.map((f) => f.replace(process.cwd() + '/', ''))).toEqual([])
    })
  }

  it('does not fetch fonts through a render-blocking @import', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8')
    expect(css).not.toMatch(/@import\s+url\(['"]?https:\/\/fonts\.googleapis\.com/)
  })

  it('reduced-motion covers every animation, not a named few', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8')
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(block).toMatch(/\*,\s*\*::before,\s*\*::after/)
    expect(block).toMatch(/animation-duration:\s*0\.01ms\s*!important/)
  })

  it('declares the current brand colour to the browser and the installed app', () => {
    const layout = readFileSync(resolve(process.cwd(), 'src/app/layout.tsx'), 'utf8')
    const manifest = readFileSync(resolve(process.cwd(), 'src/app/manifest.ts'), 'utf8')
    expect(layout).toMatch(/themeColor:\s*"#4A9EE0"/)
    expect(manifest).toMatch(/theme_color:\s*"#4A9EE0"/)
    expect(layout + manifest).not.toMatch(/#8b5cf6/i)
  })
})
