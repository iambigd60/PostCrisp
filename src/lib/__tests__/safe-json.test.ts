import { describe, it, expect } from 'vitest'
import { parseLooseJson } from '@/lib/safe-json'

describe('parseLooseJson — happy path', () => {
  it('parses plain JSON', () => {
    expect(parseLooseJson('{"a":1,"b":"x"}')).toEqual({ a: 1, b: 'x' })
  })

  it('parses nested objects + arrays', () => {
    const result = parseLooseJson<{ items: { name: string }[] }>(
      '{"items":[{"name":"alpha"},{"name":"beta"}]}'
    )
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toEqual({ name: 'alpha' })
  })
})

describe('parseLooseJson — LLM-quirk tolerance', () => {
  it('strips markdown ```json fences', () => {
    const raw = '```json\n{"score": 8}\n```'
    expect(parseLooseJson<{ score: number }>(raw).score).toBe(8)
  })

  it('strips bare ``` fences without language tag', () => {
    const raw = '```\n{"ok": true}\n```'
    expect(parseLooseJson<{ ok: boolean }>(raw).ok).toBe(true)
  })

  it('removes trailing commas before } and ]', () => {
    const raw = '{"items": [1, 2, 3,], "done": true,}'
    expect(parseLooseJson<{ items: number[]; done: boolean }>(raw)).toEqual({
      items: [1, 2, 3],
      done: true,
    })
  })

  it('strips // line comments', () => {
    const raw = '{ "a": 1, // an inline comment\n "b": 2 }'
    expect(parseLooseJson<{ a: number; b: number }>(raw)).toEqual({ a: 1, b: 2 })
  })

  it('escapes raw newlines inside string literals', () => {
    // Models occasionally emit a real newline inside a JSON string instead of \n
    const raw = '{"caption": "first line\nsecond line"}'
    expect(parseLooseJson<{ caption: string }>(raw).caption).toBe('first line\nsecond line')
  })
})

describe('parseLooseJson — brace-balanced extraction (the new behavior)', () => {
  it('discards preamble prose before the JSON object', () => {
    const raw = `Here is the analysis you asked for:

{"score": 9, "summary": "looks great"}`
    expect(parseLooseJson<{ score: number; summary: string }>(raw)).toEqual({
      score: 9,
      summary: 'looks great',
    })
  })

  it('discards trailing prose after the JSON object', () => {
    const raw = `{"verdict": "ship it"}

I hope this helps! Let me know if you need anything else.`
    expect(parseLooseJson<{ verdict: string }>(raw).verdict).toBe('ship it')
  })

  it('survives trailing prose containing literal "}"', () => {
    // The old greedy regex would extend its match through the stray `}` in
    // the trailing prose and JSON.parse would throw. The new brace-balanced
    // walker stops at the first balanced object and ignores the rest.
    const raw = `{"ok": true}

For complex objects, wrap them in {} braces. Hope that helps!`
    expect(parseLooseJson<{ ok: boolean }>(raw)).toEqual({ ok: true })
  })

  it('handles preamble + trailing prose around fenced JSON', () => {
    const raw = `Sure! Here's the analysis:

\`\`\`json
{"clickPrediction": {"score": 7, "reasoning": "solid hook"}}
\`\`\`

Want me to elaborate on any of these dimensions?`
    const result = parseLooseJson<{ clickPrediction: { score: number; reasoning: string } }>(raw)
    expect(result.clickPrediction.score).toBe(7)
    expect(result.clickPrediction.reasoning).toBe('solid hook')
  })

  it('does not misinterpret "}" inside a string literal as the closing brace', () => {
    // String-aware brace counter: the `}` inside the value string must NOT
    // close the object. If it did, parsing the truncated slice would throw.
    const raw = '{"template": "Hi {name}, your code is {code}.", "version": 2}'
    expect(parseLooseJson<{ template: string; version: number }>(raw)).toEqual({
      template: 'Hi {name}, your code is {code}.',
      version: 2,
    })
  })
})

describe('parseLooseJson — failure modes', () => {
  it('throws when there is no JSON object at all', () => {
    expect(() => parseLooseJson('I refuse to help with that.')).toThrow()
  })

  it('throws on truncated JSON (used as a deliberate signal in calling routes)', () => {
    // viral-ideas + thumbnail-analyzer rely on the throw to catch truncation
    // and trigger their recovery path / 502 error response.
    const truncated = '{"trends": [{"name": "thing", "stage": "Sho'
    expect(() => parseLooseJson(truncated)).toThrow()
  })
})
