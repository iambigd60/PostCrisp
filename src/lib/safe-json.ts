/**
 * LLMs occasionally return JSON with JS-style comments, trailing commas, or
 * wrapped in markdown fences. This helper strips those defects and extracts
 * the outermost JSON object, so `JSON.parse` doesn't choke.
 *
 * Use this in every API route that parses a model response.
 */
export function parseLooseJson<T = unknown>(raw: string): T {
  // Strip markdown code fences (```json ... ```)
  let s = raw.replace(/```(?:json)?\s*/gi, '').replace(/```\s*$/g, '')

  // Find the outermost JSON object
  const match = s.match(/\{[\s\S]*\}/)
  if (match) s = match[0]

  // Remove // line comments
  s = s.replace(/\/\/.*$/gm, '')
  // Remove /* ... */ block comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, '')
  // Remove trailing commas before } or ]
  s = s.replace(/,(\s*[}\]])/g, '$1')

  return JSON.parse(s) as T
}
