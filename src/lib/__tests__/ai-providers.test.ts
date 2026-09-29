import { describe, expect, it } from 'vitest'
import {
  anthropicModelTuning,
  extractAnthropicText,
  thinksByDefault,
} from '@/lib/providers/anthropic'
import { openaiModelTuning } from '@/lib/providers/openai'

describe('thinksByDefault', () => {
  it('flags the Claude 5-generation models', () => {
    for (const model of ['claude-opus-5-5', 'claude-fable-5-1', 'claude-sonnet-5-5', 'claude-opus-5', 'claude-sonnet-5']) {
      expect(thinksByDefault(model)).toBe(true)
    }
  })

  it('leaves earlier models alone', () => {
    for (const model of ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-opus-50']) {
      expect(thinksByDefault(model)).toBe(false)
    }
  })
})

describe('anthropicModelTuning', () => {
  it('sends the caller budget unchanged for models that do not think', () => {
    expect(anthropicModelTuning('claude-sonnet-4-6', 1500)).toEqual({
      body: { max_tokens: 1500 },
      options: {},
    })
  })

  it('adds thinking headroom, low effort, and refusal fallback for Opus 5.5', () => {
    const { body, options } = anthropicModelTuning('claude-opus-5-5', 1500)
    expect(body.max_tokens).toBeGreaterThan(1500)
    expect(body.output_config).toEqual({ effort: 'low' })
    expect(body.fallbacks).toBe('default')
    expect(options.headers).toEqual({ 'anthropic-beta': 'server-side-fallback-2026-07-01' })
  })

  it('does not request fallback for models that do not support it', () => {
    const { body, options } = anthropicModelTuning('claude-sonnet-5', 1500)
    expect(body.output_config).toEqual({ effort: 'low' })
    expect(body.fallbacks).toBeUndefined()
    expect(options.headers).toBeUndefined()
  })
})

describe('extractAnthropicText', () => {
  it('reads the answer after a leading thinking block', () => {
    expect(extractAnthropicText({
      content: [
        { type: 'thinking', thinking: '', signature: 'sig' },
        { type: 'text', text: '{"ok":' },
        { type: 'text', text: 'true}' },
      ],
      stop_reason: 'end_turn',
    })).toBe('{"ok":true}')
  })

  it('keeps only the text after the last fallback switch point', () => {
    expect(extractAnthropicText({
      content: [
        { type: 'text', text: 'partial from the declining model' },
        { type: 'fallback', from: { model: 'claude-opus-5-5' }, to: { model: 'claude-opus-4-8' } },
        { type: 'text', text: 'answer from the fallback model' },
      ],
      stop_reason: 'end_turn',
    })).toBe('answer from the fallback model')
  })

  it('throws on a refusal so the route refunds credits', () => {
    expect(() => extractAnthropicText({
      content: [],
      stop_reason: 'refusal',
      stop_details: { type: 'refusal', category: 'cyber' },
    })).toThrow(/refusal: cyber/)
  })

  it('throws when thinking used the whole budget and no answer was written', () => {
    expect(() => extractAnthropicText({
      content: [{ type: 'thinking', thinking: '' }],
      stop_reason: 'max_tokens',
    })).toThrow(/max_tokens/)
  })

  it('still returns truncated text on max_tokens so existing parse fallbacks apply', () => {
    expect(extractAnthropicText({
      content: [{ type: 'text', text: '{"partial"' }],
      stop_reason: 'max_tokens',
    })).toBe('{"partial"')
  })
})

describe('openaiModelTuning', () => {
  it('leaves non-reasoning models unchanged', () => {
    expect(openaiModelTuning('gpt-4o-mini', 2500)).toEqual({ max_completion_tokens: 2500 })
  })

  it('adds reasoning headroom and low effort for GPT-6 models', () => {
    for (const model of ['gpt-6-sol', 'gpt-6-astra']) {
      const tuning = openaiModelTuning(model, 2500)
      expect(tuning.max_completion_tokens).toBeGreaterThan(2500)
      expect(tuning.reasoning_effort).toBe('low')
    }
  })

  it('does not match look-alike model names', () => {
    expect(openaiModelTuning('gpt-60', 2500)).toEqual({ max_completion_tokens: 2500 })
  })
})
