/**
 * LLMs occasionally return JSON with JS-style comments, trailing commas, or
 * wrapped in markdown fences. This helper strips those defects and extracts
 * the outermost JSON object, so `JSON.parse` doesn't choke.
 *
 * Use this in every API route that parses a model response.
 */

/**
 * Walks the string with a simple state machine that tracks whether we're
 * inside a JSON string literal. Escapes raw control characters (newline, tab,
 * etc.) that appear INSIDE strings — leaves control chars outside strings as
 * normal JSON whitespace.
 */
function escapeControlCharsInStrings(s: string): string {
  let out = ''
  let inString = false
  let escape = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    const code = ch.charCodeAt(0)
    if (escape) {
      out += ch
      escape = false
      continue
    }
    if (ch === '\\') {
      out += ch
      escape = true
      continue
    }
    if (ch === '"') {
      out += ch
      inString = !inString
      continue
    }
    if (inString && code < 0x20) {
      if (ch === '\n') out += '\\n'
      else if (ch === '\r') out += '\\r'
      else if (ch === '\t') out += '\\t'
      else if (ch === '\b') out += '\\b'
      else if (ch === '\f') out += '\\f'
      else out += '\\u' + code.toString(16).padStart(4, '0')
      continue
    }
    out += ch
  }
  return out
}

export function parseLooseJson<T = unknown>(raw: string): T {
  // Strip markdown code fences (```json ... ```)
  let s = raw.replace(/```(?:json)?\s*/gi, '').replace(/```\s*$/g, '')

  // Find the outermost JSON object
  const match = s.match(/\{[\s\S]*\}/)
  if (match) s = match[0]

  // Remove // line comments (but not inside strings — quick heuristic is fine
  // since we'll sanitize control chars after anyway)
  s = s.replace(/\/\/[^\n\r]*/g, '')
  // Remove /* ... */ block comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, '')
  // Remove trailing commas before } or ]
  s = s.replace(/,(\s*[}\]])/g, '$1')
  // Escape raw control characters that appear INSIDE string literals
  s = escapeControlCharsInStrings(s)

  return JSON.parse(s) as T
}
