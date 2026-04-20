import { NextResponse } from 'next/server'

/**
 * Input-size guardrails for features that accept pasted content.
 *
 * Without these, a user could paste a 200k-char novel into Content Repurposer
 * and burn through a month's worth of input tokens in a single call.
 */

export const INPUT_LIMITS = {
  // User-pasted source content for "process this long-form thing" features
  longFormSource:    { maxChars: 12_000, label: 'source content' },
  // Blog / article content
  blogContent:       { maxChars: 15_000, label: 'blog content' },
  // A single incoming comment to reply to
  comment:           { maxChars: 2_000,  label: 'comment' },
  // Custom prompt / scenario description
  customScenario:    { maxChars: 1_500,  label: 'scenario description' },
  // Short free-text niche description
  niche:             { maxChars: 500,    label: 'niche' },
  // General topic / title
  topic:             { maxChars: 1_000,  label: 'topic' },
  // Brand name, audience description, other single-line fields
  shortField:        { maxChars: 500,    label: 'input' },
} as const

type LimitKey = keyof typeof INPUT_LIMITS

/**
 * Validate that `input` is under the size limit for the given kind.
 * Returns null if OK, or a NextResponse 400 error if too long.
 */
export function validateInputSize(input: string | undefined | null, kind: LimitKey): NextResponse | null {
  if (input == null) return null
  const cfg = INPUT_LIMITS[kind]
  if (input.length <= cfg.maxChars) return null
  return NextResponse.json(
    {
      error: `Your ${cfg.label} is too long (${input.length.toLocaleString()} characters). Max is ${cfg.maxChars.toLocaleString()}.`,
      code: 'INPUT_TOO_LONG',
      field: cfg.label,
      limit: cfg.maxChars,
      actual: input.length,
    },
    { status: 400 }
  )
}

/**
 * Validate multiple fields in one call. Returns the first error response or null.
 */
export function validateInputs(pairs: Array<[string | undefined | null, LimitKey]>): NextResponse | null {
  for (const [value, kind] of pairs) {
    const err = validateInputSize(value, kind)
    if (err) return err
  }
  return null
}
