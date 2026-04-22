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

// Cached Innertube instance — bootstrap is expensive, reuse across requests.
let _innertube: Innertube | null = null
async function getInnertube(): Promise<Innertube> {
  if (_innertube) return _innertube
  _innertube = await Innertube.create({ retrieve_player: false })
  return _innertube
}

// Shape of a caption track as exposed by youtubei.js + YouTube's player config.
// We only read the handful of fields we need; others may be present.
interface CaptionTrack {
  base_url?: string
  baseUrl?: string
  language_code?: string
  languageCode?: string
  kind?: string
  name?: { simpleText?: string }
}

// Shape of the JSON3 timedtext response we parse out of YouTube.
interface Json3Transcript {
  events?: Array<{
    segs?: Array<{ utf8?: string }>
  }>
}

function pickCaptionTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (!tracks.length) return null
  // Prefer an English manually-authored track, then English auto-generated,
  // then first available of any language.
  const isEnglish = (t: CaptionTrack) => {
    const lang = t.language_code ?? t.languageCode
    return typeof lang === 'string' && lang.toLowerCase().startsWith('en')
  }
  const manual = tracks.find((t) => isEnglish(t) && t.kind !== 'asr')
  if (manual) return manual
  const autoEn = tracks.find(isEnglish)
  if (autoEn) return autoEn
  return tracks[0]
}

function parseJson3Transcript(data: Json3Transcript): string {
  const events = Array.isArray(data?.events) ? data.events : []
  const pieces: string[] = []
  for (const ev of events) {
    if (!Array.isArray(ev.segs)) continue
    for (const seg of ev.segs) {
      if (typeof seg.utf8 === 'string') pieces.push(seg.utf8)
    }
  }
  return pieces.join('').replace(/\s+/g, ' ').trim()
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

    // youtubei.js exposes caption_tracks on info.captions. The raw shape is
    // an array of { base_url, language_code, kind, name, ... }. We pick a
    // track and fetch its transcript directly from timedtext — much more
    // stable than the /get_transcript Innertube endpoint that returns 400s.
    const capData = (info as { captions?: { caption_tracks?: CaptionTrack[] } })?.captions
    const tracks = capData?.caption_tracks ?? []

    const track = pickCaptionTrack(tracks)
    if (!track) {
      return {
        ok: false,
        error: "This video doesn't have any captions. Try one where the 'Show transcript' button works at youtube.com, or paste the content manually.",
        platform: 'youtube',
      }
    }

    const baseUrl = track.base_url ?? track.baseUrl
    if (!baseUrl) {
      return {
        ok: false,
        error: "YouTube returned caption tracks but no fetch URL. This usually means captions are locked on this video.",
        platform: 'youtube',
      }
    }

    // Fetch the JSON3 timedtext response (cleaner than XML — each segment is
    // an event with utf8 strings).
    const separator = baseUrl.includes('?') ? '&' : '?'
    const ttUrl = `${baseUrl}${separator}fmt=json3`
    const res = await fetch(ttUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PostCrispVoiceTrainer/1.0)' },
    })

    if (!res.ok) {
      return {
        ok: false,
        error: `YouTube rejected the transcript fetch (HTTP ${res.status}). Try a different video or paste manually.`,
        platform: 'youtube',
      }
    }

    const data: Json3Transcript = await res.json()
    const content = parseJson3Transcript(data)

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
    if (track.kind === 'asr') {
      warnings.push('This video only has auto-generated captions, which can include transcription errors. You can still analyze it, but results will be less accurate than a manually-captioned video.')
    }

    const title =
      (info as { basic_info?: { title?: string } })?.basic_info?.title ?? `YouTube: ${videoId}`

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
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[voice-url-importer] YouTube fetch failed for ${videoId}:`, message)

    const lower = message.toLowerCase()
    let userMessage: string
    if (lower.includes('private') || lower.includes('unavailable')) {
      userMessage = 'This video is private or unavailable.'
    } else if (lower.includes('age')) {
      userMessage = "Age-restricted videos can't be fetched — try a different one."
    } else {
      userMessage = `Couldn't fetch that video: ${message.slice(0, 200)}`
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
