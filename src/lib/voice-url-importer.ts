import 'server-only'
import { YoutubeTranscript } from 'youtube-transcript'

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

/**
 * Detect a supported platform from a URL. Returns `null` for unsupported
 * platforms (Instagram, TikTok, X, etc.) so the caller can give a
 * coming-soon message instead of a generic error.
 */
export function detectPlatform(url: string): ImportPlatform | 'unsupported' | null {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase().replace(/^www\./, '')

    if (host === 'youtube.com' || host === 'youtu.be' || host === 'm.youtube.com' || host.endsWith('.youtube.com')) {
      return 'youtube'
    }

    // Known-but-not-yet-supported platforms (for coming-soon messaging)
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

    // youtu.be/<id>
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0]
      return id || null
    }

    // youtube.com/watch?v=<id>
    const v = u.searchParams.get('v')
    if (v) return v

    // youtube.com/shorts/<id>, youtube.com/embed/<id>, youtube.com/live/<id>
    const parts = u.pathname.split('/').filter(Boolean)
    const idx = parts.findIndex((p) => p === 'shorts' || p === 'embed' || p === 'live')
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1]

    return null
  } catch {
    return null
  }
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

  let segments: { text: string }[]
  try {
    // Default to English; YouTube auto-translates when possible.
    segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' })
  } catch {
    // Retry without locale hint — some videos only have native-language tracks.
    try {
      segments = await YoutubeTranscript.fetchTranscript(videoId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const looksLikeNoCaptions = /transcript|captions|disabled/i.test(msg)
      return {
        ok: false,
        error: looksLikeNoCaptions
          ? "This video doesn't have captions available. Try a different video or paste the transcript manually."
          : `Couldn't fetch the transcript: ${msg}`,
        platform: 'youtube',
        suggestion: 'Some videos have captions disabled. Try one where the "Show transcript" button works on youtube.com.',
      }
    }
  }

  if (!Array.isArray(segments) || segments.length === 0) {
    return {
      ok: false,
      error: 'The transcript came back empty.',
      platform: 'youtube',
    }
  }

  // Flatten segments into a single paragraph. Decode HTML entities
  // (YouTube returns stuff like &amp;#39; for apostrophes).
  const content = segments
    .map((s) => decodeHtmlEntities(s.text))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  const warnings: string[] = []
  if (content.length < 200) {
    warnings.push('The transcript is quite short — longer samples give a more accurate voice profile.')
  }

  return {
    ok: true,
    sample: {
      content,
      platform: 'youtube',
      label: `YouTube: ${videoId}`,
      source_url: url,
      warnings,
    },
  }
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
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
