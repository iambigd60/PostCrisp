import 'server-only'
import { Innertube } from 'youtubei.js'

// ─── Types ───────────────────────────────────────────────────────────────

export interface ImportedSample {
  content: string
  platform: string | null
  label: string | null
  source_url: string
  warnings: string[]
}

export type ImportPlatform = 'youtube'

export interface ImportResult {
  ok: true
  sample: ImportedSample
}

export interface ImportFailure {
  ok: false
  error: string
  platform?: string
  suggestion?: string
}

// ─── Platform detection ──────────────────────────────────────────────────

export function detectPlatform(url: string): ImportPlatform | 'unsupported' | null {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase().replace(/^www\./, '')

    if (host === 'youtube.com' || host === 'youtu.be' || host === 'm.youtube.com' || host.endsWith('.youtube.com')) {
      return 'youtube'
    }

    const knownSocial = [
      'instagram.com',
      'tiktok.com', 'vm.tiktok.com',
      'twitter.com', 'x.com',
      'linkedin.com',
      'threads.net',
      'facebook.com', 'fb.com',
    ]
    if (knownSocial.some((h) => host === h || host.endsWith(`.${h}`))) {
      return 'unsupported'
    }

    return null
  } catch {
    return null
  }
}

// ─── YouTube ─────────────────────────────────────────────────────────────

function extractYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase().replace(/^www\./, '')

    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0]
      return id || null
    }

    const v = u.searchParams.get('v')
    if (v) return v

    const parts = u.pathname.split('/').filter(Boolean)
    const idx = parts.findIndex((p) => p === 'shorts' || p === 'embed' || p === 'live')
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1]

    return null
  } catch {
    return null
  }
}

// Cached Innertube client — it does a one-time cold bootstrap against YouTube
// to fetch session keys, so we reuse the instance across requests.
let _innertube: Innertube | null = null
async function getInnertube(): Promise<Innertube> {
  if (_innertube) return _innertube
  _innertube = await Innertube.create()
  return _innertube
}

async function importYouTube(url: string): Promise<ImportResult | ImportFailure> {
  const videoId = extractYouTubeVideoId(url)
  if (!videoId) {
    return {
      ok: false,
      error: "Couldn't extract a video ID from that YouTube URL. Make sure it's a standard watch/shorts/embed link.",
      platform: 'youtube',
    }
  }

  try {
    const yt = await getInnertube()
    const info = await yt.getInfo(videoId)
    const transcriptData = await info.getTranscript()

    // youtubei.js shape: transcriptData.transcript.content.body.initial_segments[].snippet.text
    // Guard aggressively because this is an unofficial API shape.
    const segments = transcriptData?.transcript?.content?.body?.initial_segments ?? []
    if (!Array.isArray(segments) || segments.length === 0) {
      return {
        ok: false,
        error: "This video doesn't have a transcript available. YouTube only generates captions for some videos — try one where the 'Show transcript' button works at youtube.com.",
        platform: 'youtube',
      }
    }

    const content = segments
      .map((s: { snippet?: { text?: string } }) => s.snippet?.text ?? '')
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (!content) {
      return {
        ok: false,
        error: 'The transcript came back empty.',
        platform: 'youtube',
      }
    }

    const warnings: string[] = []
    if (content.length < 200) {
      warnings.push('The transcript is quite short — longer samples give a more accurate voice profile.')
    }

    const title = info?.basic_info?.title ?? `YouTube: ${videoId}`

    return {
      ok: true,
      sample: {
        content,
        platform: 'youtube',
        label: title.slice(0, 100),
        source_url: url,
        warnings,
      },
    }
  } catch (err) {
    // Log the real error server-side so we can diagnose via Vercel logs,
    // but return a user-friendly message that's honest about what we know.
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[voice-url-importer] YouTube fetch failed for ${videoId}:`, message)

    // Classify by the underlying message, not a broad regex.
    const lower = message.toLowerCase()
    let userMessage: string
    if (lower.includes('not found') || lower.includes('transcript is disabled') || lower.includes('transcripts are disabled')) {
      userMessage = "This video doesn't have a transcript available. Try one where the 'Show transcript' button works at youtube.com."
    } else if (lower.includes('private') || lower.includes('unavailable')) {
      userMessage = 'This video is private or unavailable.'
    } else if (lower.includes('age')) {
      userMessage = "Age-restricted videos can't be fetched — try a different one."
    } else {
      userMessage = `Transcript fetch failed: ${message.slice(0, 200)}`
    }

    return {
      ok: false,
      error: userMessage,
      platform: 'youtube',
    }
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────

export async function importFromUrl(url: string): Promise<ImportResult | ImportFailure> {
  const cleaned = url.trim()
  if (!cleaned) {
    return { ok: false, error: 'URL is required.' }
  }

  const platform = detectPlatform(cleaned)

  if (platform === 'youtube') return importYouTube(cleaned)

  if (platform === 'unsupported') {
    return {
      ok: false,
      error: "That platform isn't supported yet. For now, paste the content manually.",
      suggestion: 'Instagram, TikTok, X/Twitter, LinkedIn, Threads, and Facebook URL imports are coming soon, along with audio/video voice analysis.',
    }
  }

  return {
    ok: false,
    error: "We don't recognize that URL. Paste a YouTube video link, or add the content manually.",
  }
}
