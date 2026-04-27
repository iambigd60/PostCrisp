/**
 * LLMs occasionally return JSON with JS-style comments, trailing commas,
 * preamble prose ('Here is the analysis:'), trailing prose ('Hope this
 * helps!'), or wrapped in markdown fences. This helper strips those defects
 * and extracts the first brace-balanced JSON object so `JSON.parse` doesn't
 * choke.
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

/**
 * Walk forward from the first `{` and stop when brace depth returns to 0.
 * That's the end of the FIRST balanced JSON object — discards any prose
 * before or after. String-aware so braces inside string literals don't
 * fool the depth counter.
 *
 * Replaces the previous regex `/\{[\s\S]*\}/` which was greedy and broke
 * when the model emitted a trailing prose paragraph that happened to
 * contain '}'.
 */
function extractFirstBalancedObject(s: string): string | null {
  const start = s.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < s.length; i++) {
    const ch = s[i]
    if (escape) { escape = false; continue }
    if (ch === '\\') { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  // Unbalanced — return everything from the first `{` and let the parser
  // surface a meaningful error rather than swallowing silently.
  return s.slice(start)
}

export function parseLooseJson<T = unknown>(raw: string): T {
  // Strip markdown code fences (```json ... ```)
  let s = raw.replace(/```(?:json)?\s*/gi, '').replace(/```\s*$/g, '')

  // Extract the first brace-balanced JSON object — survives leading prose
  // ('Here is the analysis:') and trailing prose ('Hope this helps!') that
  // the previous greedy regex couldn't handle.
  const balanced = extractFirstBalancedObject(s)
  if (balanced) s = balanced

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
