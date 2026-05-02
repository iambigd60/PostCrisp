import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { crispGenerate } from './crisp-engine'
import { parseLooseJson } from './safe-json'

// ─── Types ───────────────────────────────────────────────────────────────

export interface VoiceSample {
  id: string              // nanoid/uuid — used for deletion
  content: string         // the raw text the user pasted
  label: string | null    // e.g. "Instagram caption", "newsletter intro"
  platform: string | null // "instagram" | "tiktok" | "youtube" | "linkedin" | "newsletter" | null
  added_at: string        // ISO timestamp
}

export interface VoiceTraits {
  tone: string                    // e.g. "casual, confident, warm — occasionally self-deprecating"
  sentence_rhythm: string         // e.g. "mostly short + punchy, varies mid-paragraph"
  vocabulary_level: string        // e.g. "accessible — conversational with occasional industry terms"
  signature_phrases: string[]     // catchphrases, distinctive word choices
  openers: string[]               // typical ways they start content
  closers: string[]               // typical ways they end content (CTAs, sign-offs)
  emoji_style: string             // e.g. "sparing — 0-2 per post, usually at the end"
  punctuation_style: string       // e.g. "Oxford comma, em-dashes for emphasis, minimal exclamation"
  energy: string                  // e.g. "medium-high; avoids hype-speak"
  avoid: string[]                 // patterns the user specifically avoids
  notes: string                   // free-form observations
}

export interface VoiceProfile {
  user_id: string
  samples: VoiceSample[]
  traits: VoiceTraits | null
  last_analyzed_at: string | null
  created_at: string
  updated_at: string
}

// Minimum number of samples before analysis produces a useful profile.
// Below this, we still accept samples but decline to run the analysis.
export const MIN_SAMPLES_FOR_ANALYSIS = 3

// ─── Read / write helpers ─────────────────────────────────────────────────

export async function loadVoiceProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<VoiceProfile | null> {
  const { data, error } = await supabase
    .from('voice_profiles')
    .select('user_id, samples, traits, last_analyzed_at, created_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null
  return data as VoiceProfile
}

export async function ensureVoiceProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<VoiceProfile> {
  const existing = await loadVoiceProfile(supabase, userId)
  if (existing) return existing

  const { data, error } = await supabase
    .from('voice_profiles')
    .insert({ user_id: userId, samples: [], traits: null })
    .select('user_id, samples, traits, last_analyzed_at, created_at, updated_at')
    .single()

  if (error) throw new Error(`Failed to create voice profile: ${error.message}`)
  return data as VoiceProfile
}

// ─── Analysis ─────────────────────────────────────────────────────────────

const ANALYSIS_PROMPT = (samples: VoiceSample[]) => `You are a writing-style analyst. A creator has provided ${samples.length} sample${samples.length === 1 ? '' : 's'} of their existing content so you can extract their distinctive voice. Your analysis will be used as a style guide when generating future content in their voice.

Below is each sample. Pay attention to HOW they write, not WHAT they write about. Focus on patterns that repeat across samples.

${samples.map((s, i) => `── Sample ${i + 1}${s.label ? ` (${s.label})` : ''}${s.platform ? ` on ${s.platform}` : ''} ──\n${s.content.trim()}`).join('\n\n')}

Return ONLY a valid JSON object matching this exact shape — no markdown fences, no commentary:

{
  "tone": "1-2 sentence description of their overall tone (e.g. 'casual and confident, lightly self-deprecating, never preachy')",
  "sentence_rhythm": "1 sentence on sentence length patterns (e.g. 'short punchy openers, longer middle paragraphs')",
  "vocabulary_level": "1 sentence on word choice (e.g. 'conversational, occasional technical terms explained simply')",
  "signature_phrases": ["distinctive phrase 1", "distinctive phrase 2", "..."],
  "openers": ["typical opening pattern 1", "typical opening pattern 2"],
  "closers": ["typical closing / CTA pattern 1", "typical closing pattern 2"],
  "emoji_style": "1 sentence on emoji usage (e.g. 'sparing, 0-2 per post, usually at the end')",
  "punctuation_style": "1 sentence on punctuation preferences",
  "energy": "1 sentence on overall energy level",
  "avoid": ["patterns they avoid — e.g. 'never uses \\"game-changer\\"', 'never asks rhetorical questions'"],
  "notes": "Any other observations that would help a ghostwriter imitate them — 2-3 sentences max."
}

Rules:
- Arrays: 3-6 items each, concrete examples drawn from the samples
- If signature_phrases, openers, closers, or avoid have nothing distinctive, return an empty array []
- Base EVERYTHING on the samples provided. Do not invent traits. If a sample is too short to support a claim, say "unclear from samples" rather than guess.
- Keep each string field under 200 characters.`

export async function analyzeVoiceProfile(
  samples: VoiceSample[],
  tier: 'starter' | 'creator' | 'elite'
): Promise<VoiceTraits> {
  if (samples.length < MIN_SAMPLES_FOR_ANALYSIS) {
    throw new Error(
      `Need at least ${MIN_SAMPLES_FOR_ANALYSIS} samples to analyze voice. Currently ${samples.length}.`
    )
  }

  const prompt = ANALYSIS_PROMPT(samples)

  const { text } = await crispGenerate({
    task: 'bio-optimizer',  // reuse an existing task config for routing; this isn't a user-facing task
    tier,
    prompt,
    maxTokens: 2000,
  })

  const parsed = parseLooseJson<VoiceTraits>(text)
  if (!parsed) {
    throw new Error('Failed to parse voice analysis response.')
  }

  // Sanity-check the shape — fill in missing fields so downstream code
  // doesn't crash on malformed model output.
  const traits: VoiceTraits = {
    tone: parsed.tone ?? 'unclear from samples',
    sentence_rhythm: parsed.sentence_rhythm ?? 'unclear from samples',
    vocabulary_level: parsed.vocabulary_level ?? 'unclear from samples',
    signature_phrases: Array.isArray(parsed.signature_phrases) ? parsed.signature_phrases : [],
    openers: Array.isArray(parsed.openers) ? parsed.openers : [],
    closers: Array.isArray(parsed.closers) ? parsed.closers : [],
    emoji_style: parsed.emoji_style ?? 'unclear from samples',
    punctuation_style: parsed.punctuation_style ?? 'unclear from samples',
    energy: parsed.energy ?? 'unclear from samples',
    avoid: Array.isArray(parsed.avoid) ? parsed.avoid : [],
    notes: parsed.notes ?? '',
  }

  return traits
}

// ─── System-prompt injection helper ──────────────────────────────────────
// Called by feature routes (captions, script, repurpose, etc.) to weave the
// user's voice profile into the system prompt. Returns an empty string when
// no profile exists — features degrade gracefully to generic behavior.

export function formatVoiceForPrompt(traits: VoiceTraits | null): string {
  if (!traits) return ''

  const parts: string[] = [
    `\n\n--- USER VOICE PROFILE ---`,
    `Match this creator's voice closely. Do NOT invent a new voice; mirror the patterns below.`,
    `Tone: ${traits.tone}`,
    `Sentence rhythm: ${traits.sentence_rhythm}`,
    `Vocabulary: ${traits.vocabulary_level}`,
    `Energy: ${traits.energy}`,
    `Emoji style: ${traits.emoji_style}`,
    `Punctuation: ${traits.punctuation_style}`,
  ]

  if (traits.signature_phrases.length > 0) {
    parts.push(`Signature phrases to use naturally: ${traits.signature_phrases.join(' · ')}`)
  }
  if (traits.openers.length > 0) {
    parts.push(`Typical openers: ${traits.openers.join(' · ')}`)
  }
  if (traits.closers.length > 0) {
    parts.push(`Typical closers: ${traits.closers.join(' · ')}`)
  }
  if (traits.avoid.length > 0) {
    parts.push(`AVOID these patterns (this creator doesn't use them): ${traits.avoid.join(' · ')}`)
  }
  if (traits.notes) {
    parts.push(`Additional notes: ${traits.notes}`)
  }

  parts.push(`--- END VOICE PROFILE ---\n`)
  return parts.join('\n')
}

// Convenience for routes: load the profile + return the prompt snippet in one call.
export async function loadVoicePromptSnippet(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const profile = await loadVoiceProfile(supabase, userId)
  return formatVoiceForPrompt(profile?.traits ?? null)
}
