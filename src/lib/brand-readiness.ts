/**
 * Brand Readiness Score (BRS) — IDEA-10 lite.
 *
 * Deterministic 0-100 score across 5 dimensions, computed from the same
 * stats the dashboard already loads. No AI call, no credit cost — this is
 * a free trustworthy "platform health" signal that creators see every time
 * they open the dashboard.
 *
 * The "lite" label is intentional. v1 is rule-based: same inputs always
 * produce the same score. Once we have usage data showing testers want
 * narrative reasoning, we can layer Claude-generated explanations on top
 * (priced as a HEAVY task) without changing the underlying score formula.
 */

export interface BrsInputs {
  /** Number of channels the user has added in `channels` table. */
  channelCount: number
  /** Whether voice_profiles row exists for this user. */
  voiceProfileExists: boolean
  /** Sample count on the voice profile (uses MIN_SAMPLES_FOR_ANALYSIS=3 thresh). */
  voiceSamples: number
  /** Whether voice traits have been extracted (analyze run successfully). */
  voiceAnalyzed: boolean
  /** Distinct feature keys this user has used at least once (size of featuresUsed Set). */
  uniqueFeaturesUsed: number
  /** Items saved to the library (saved_content count). */
  savedCount: number
  /** Generations in the past 7 days. */
  weekGenerations: number
}

export type BrsGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface BrsDimension {
  key: 'channels' | 'voice' | 'variety' | 'library' | 'activity'
  label: string
  score: number
  max: number
  status: 'unset' | 'developing' | 'strong'
  /** Short one-line reason a creator can read in <2s. */
  reason: string
  /** Where to go to improve this dimension. */
  href: string
}

export interface BrsAction {
  priority: 'high' | 'medium'
  label: string
  href: string
  expectedPoints: number
}

export interface BrsResult {
  score: number
  grade: BrsGrade
  dimensions: BrsDimension[]
  actions: BrsAction[]
}

// ─── Per-dimension scoring ─────────────────────────────────────────────────
// Each helper returns { score, status, reason } so the card can render a
// readable explanation for why a dimension is at its current level.

function scoreChannels(count: number): { score: number; status: BrsDimension['status']; reason: string } {
  if (count === 0) return { score: 0, status: 'unset', reason: 'No channels yet — add the platforms you post on.' }
  if (count === 1) return { score: 5, status: 'developing', reason: '1 channel added. Add more so every tool speaks to the right platform.' }
  if (count === 2) return { score: 10, status: 'developing', reason: '2 channels added. Cross-platform creators benefit from 3+.' }
  if (count === 3) return { score: 15, status: 'strong', reason: '3 channels — solid coverage.' }
  return { score: 20, status: 'strong', reason: `${count} channels added — full coverage.` }
}

function scoreVoice(input: BrsInputs): { score: number; status: BrsDimension['status']; reason: string } {
  if (!input.voiceProfileExists) {
    return { score: 0, status: 'unset', reason: 'Voice not trained yet. PostCrisp generates generic AI without it.' }
  }
  let score = 0
  if (input.voiceSamples >= 3) score += 10
  if (input.voiceAnalyzed) score += 10
  if (score === 0) return { score, status: 'developing', reason: 'Voice profile started. Add 3+ captions to unlock training.' }
  if (score === 10) return { score, status: 'developing', reason: 'Samples added but not analyzed yet — click Analyze to activate.' }
  return { score: 20, status: 'strong', reason: 'Voice trained. Every generation now matches your style.' }
}

function scoreVariety(unique: number): { score: number; status: BrsDimension['status']; reason: string } {
  if (unique === 0) return { score: 0, status: 'unset', reason: 'No tools used yet — try Captions or Viral Ideas to start.' }
  if (unique === 1) return { score: 5, status: 'developing', reason: '1 tool tried. Mix Create, Optimize, and Grow tools for breadth.' }
  if (unique === 2) return { score: 10, status: 'developing', reason: '2 tools tried. A few more unlocks compound value.' }
  if (unique <= 4) return { score: 15, status: 'developing', reason: `${unique} tools tried. Push past 5 to feel the platform's range.` }
  if (unique <= 7) return { score: 20, status: 'strong', reason: `${unique} tools used — strong breadth.` }
  return { score: 25, status: 'strong', reason: `${unique} tools used — power-user variety.` }
}

function scoreLibrary(saved: number): { score: number; status: BrsDimension['status']; reason: string } {
  if (saved === 0) return { score: 0, status: 'unset', reason: 'Nothing saved yet. Hit Save on a generation you like.' }
  if (saved <= 5) return { score: 5, status: 'developing', reason: `${saved} saved. Build a library you can re-use.` }
  if (saved <= 15) return { score: 10, status: 'developing', reason: `${saved} saved — habit forming.` }
  return { score: 15, status: 'strong', reason: `${saved} saved — full library habit.` }
}

function scoreActivity(weekGens: number): { score: number; status: BrsDimension['status']; reason: string } {
  if (weekGens === 0) return { score: 0, status: 'unset', reason: 'No generations this week. Pick a tool from the sidebar.' }
  if (weekGens <= 5) return { score: 5, status: 'developing', reason: `${weekGens} generations this week — light activity.` }
  if (weekGens <= 15) return { score: 10, status: 'developing', reason: `${weekGens} generations this week — getting consistent.` }
  if (weekGens <= 30) return { score: 15, status: 'strong', reason: `${weekGens} generations this week — strong tempo.` }
  return { score: 20, status: 'strong', reason: `${weekGens} generations this week — daily-driver energy.` }
}

// ─── Letter grade from total score ────────────────────────────────────────

export function gradeFor(score: number): BrsGrade {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

// ─── Action picker — surface the 3 highest-leverage moves ─────────────────
// Sort by points-to-gain, then surface up to 3. Never recommends a dimension
// already at its max (no "add more channels" when they have 4+).

function nextActionFor(dim: BrsDimension): BrsAction | null {
  const remaining = dim.max - dim.score
  if (remaining <= 0) return null

  // Pick the right next-action label per dimension. Each maps to a single
  // concrete next move so the user doesn't have to decide what to do next.
  const labelMap: Record<BrsDimension['key'], string> = {
    channels: 'Add a channel',
    voice:    dim.score === 0 ? 'Train your voice' : dim.score < 20 ? 'Finish voice training' : '',
    variety:  'Try a tool you haven\'t used',
    library:  'Save a generation to your library',
    activity: 'Generate something this week',
  }
  const label = labelMap[dim.key]
  if (!label) return null

  return {
    priority: dim.status === 'unset' ? 'high' : 'medium',
    label,
    href: dim.href,
    expectedPoints: remaining,
  }
}

// ─── Public entry point ───────────────────────────────────────────────────

export function computeBrandReadiness(input: BrsInputs): BrsResult {
  const channels = scoreChannels(input.channelCount)
  const voice    = scoreVoice(input)
  const variety  = scoreVariety(input.uniqueFeaturesUsed)
  const library  = scoreLibrary(input.savedCount)
  const activity = scoreActivity(input.weekGenerations)

  const dimensions: BrsDimension[] = [
    { key: 'channels', label: 'Channel coverage', max: 20, score: channels.score, status: channels.status, reason: channels.reason, href: '/dashboard/settings' },
    { key: 'voice',    label: 'Voice training',   max: 20, score: voice.score,    status: voice.status,    reason: voice.reason,    href: '/dashboard/voice' },
    { key: 'variety',  label: 'Tool variety',     max: 25, score: variety.score,  status: variety.status,  reason: variety.reason,  href: '/dashboard' },
    { key: 'library',  label: 'Saved library',    max: 15, score: library.score,  status: library.status,  reason: library.reason,  href: '/dashboard/saved' },
    { key: 'activity', label: 'Recent activity',  max: 20, score: activity.score, status: activity.status, reason: activity.reason, href: '/dashboard' },
  ]

  const total = dimensions.reduce((sum, d) => sum + d.score, 0)
  const grade = gradeFor(total)

  // Pick the top 3 actions, sorted by expected-point gain (highest first).
  const candidates = dimensions
    .map(nextActionFor)
    .filter((a): a is BrsAction => a !== null)
    .sort((a, b) => b.expectedPoints - a.expectedPoints)
    .slice(0, 3)

  return { score: total, grade, dimensions, actions: candidates }
}
