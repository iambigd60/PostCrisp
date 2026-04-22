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

// ─── Caption track shape ─────────────────────────────────────────────────

interface CaptionTrack {
  baseUrl: string
  languageCode?: string
  kind?: string
  name?: { simpleText?: string } | string
}

interface Json3Transcript {
  events?: Array<{ segs?: Array<{ utf8?: string }> }>
}

function pickCaptionTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (!tracks.length) return null
  const isEnglish = (t: CaptionTrack) => typeof t.languageCode === 'string' && t.languageCode.toLowerCase().startsWith('en')
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

// ─── Strategy 1: scrape the watch-page HTML directly ────────────────────
// Most reliable path. No Innertube handshake, no /get_transcript endpoint.
// We fetch the public watch URL (same thing any browser does), extract the
// `ytInitialPlayerResponse` JSON, and read captions from there.

interface ScrapedPlayerResponse {
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[]
    }
  }
  videoDetails?: {
    title?: string
  }
}

async function scrapeWatchPage(
  videoId: string
): Promise<{ tracks: CaptionTrack[]; title: string | null } | { error: string }> {
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
  try {
    const res = await fetch(watchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    if (!res.ok) {
      return { error: `YouTube returned HTTP ${res.status} for the watch page.` }
    }
    const html = await res.text()

    // Locate ytInitialPlayerResponse in the HTML. It's assigned with either
    // `var ytInitialPlayerResponse = {...};` or `ytInitialPlayerResponse = {...};`.
    const marker = 'ytInitialPlayerResponse'
    const start = html.indexOf(marker)
    if (start === -1) return { error: 'Video page did not contain ytInitialPlayerResponse.' }

    // Walk forward to find the opening brace of the JSON.
    const braceStart = html.indexOf('{', start)
    if (braceStart === -1) return { error: 'Could not locate player response JSON.' }

    // Walk a balanced-brace parser respecting string literals + escapes so we
    // extract the complete JSON object even if it spans many lines / includes
    // strings with inner braces.
    let depth = 0
    let inString = false
    let escape = false
    let end = -1
    for (let i = braceStart; i < html.length; i++) {
      const ch = html[i]
      if (escape) { escape = false; continue }
      if (ch === '\\') { escape = true; continue }
      if (ch === '"') { inString = !inString; continue }
      if (inString) continue
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) { end = i; break }
      }
    }
    if (end === -1) return { error: 'Malformed player response in page.' }

    const jsonText = html.slice(braceStart, end + 1)
    let parsed: ScrapedPlayerResponse
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      return { error: 'Player response JSON was not parseable.' }
    }

    const tracks = parsed.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
    const title = parsed.videoDetails?.title ?? null
    return { tracks, title }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { error: `Failed to fetch watch page: ${msg}` }
  }
}

// ─── Strategy 2: youtubei.js fallback ────────────────────────────────────
// Useful if YouTube's HTML structure changes. We try the WEB client first,
// which is most likely to expose the captions tracklist.

let _innertube: Innertube | null = null
async function getInnertube(): Promise<Innertube> {
  if (_innertube) return _innertube
  _innertube = await Innertube.create({ retrieve_player: false })
  return _innertube
}

async function innertubeFallback(
  videoId: string
): Promise<{ tracks: CaptionTrack[]; title: string | null } | { error: string }> {
  try {
    const yt = await getInnertube()
    const info = await yt.getInfo(videoId, { client: 'WEB' })

    // Try the high-level parsed shape first...
    const parsedTracks =
      (info as { captions?: { caption_tracks?: CaptionTrack[] } })?.captions?.caption_tracks ?? []

    // ...then fall back to the raw player_response shape in case the parsed
    // version is empty on this client type.
    type RawPR = { captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } } }
    const rawPR =
      (info as { page?: { 1?: { player_response?: RawPR } } })?.page?.[1]?.player_response ??
      (info as { player_response?: RawPR })?.player_response
    const rawTracks = rawPR?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []

    const tracks = parsedTracks.length > 0 ? parsedTracks : rawTracks
    const title = (info as { basic_info?: { title?: string } })?.basic_info?.title ?? null
    return { tracks, title }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { error: `Innertube fallback failed: ${msg}` }
  }
}

// ─── Main YouTube importer ───────────────────────────────────────────────

async function importYouTube(url: string): Promise<ImportResult | ImportFailure> {
  const videoId = extractYouTubeVideoId(url)
  if (!videoId) {
    return {
      ok: false,
      error: "Couldn't extract a video ID from that YouTube URL. Make sure it's a standard watch/shorts/embed link.",
      platform: 'youtube',
    }
  }

  // Try HTML scrape first — most reliable. If it fails (parsing or HTTP),
  // fall back to Innertube. If both fail, give up with the most specific error.
  const scraped = await scrapeWatchPage(videoId)

  let tracks: CaptionTrack[] = []
  let title: string | null = null
  let lastError: string | null = null

  if ('error' in scraped) {
    lastError = scraped.error
    console.warn(`[voice-url-importer] HTML scrape failed for ${videoId}: ${scraped.error} — trying Innertube fallback`)
    const fb = await innertubeFallback(videoId)
    if ('error' in fb) {
      console.error(`[voice-url-importer] Both strategies failed for ${videoId}. Last errors: ${scraped.error} | ${fb.error}`)
      return {
        ok: false,
        error: `Couldn't fetch that video: ${fb.error}`,
        platform: 'youtube',
      }
    }
    tracks = fb.tracks
    title = fb.title
  } else {
    tracks = scraped.tracks
    title = scraped.title
    if (tracks.length === 0) {
      // Scrape worked but returned no tracks — still try Innertube as a sanity
      // check, since the scrape layout occasionally misses captions that
      // Innertube surfaces.
      console.warn(`[voice-url-importer] HTML scrape returned 0 tracks for ${videoId} — trying Innertube fallback`)
      const fb = await innertubeFallback(videoId)
      if ('error' in fb) {
        lastError = fb.error
      } else if (fb.tracks.length > 0) {
        tracks = fb.tracks
        title = fb.title ?? title
      }
    }
  }

  if (tracks.length === 0) {
    return {
      ok: false,
      error: lastError
        ? `No captions found. ${lastError}`
        : "This video doesn't have any captions. Try one where the 'Show transcript' button works at youtube.com, or paste the content manually.",
      platform: 'youtube',
    }
  }

  const track = pickCaptionTrack(tracks)
  if (!track || !track.baseUrl) {
    return {
      ok: false,
      error: 'Caption track found but no download URL was exposed. This usually means captions are locked on this video.',
      platform: 'youtube',
    }
  }

  // Fetch the timedtext transcript directly in JSON3 format.
  const separator = track.baseUrl.includes('?') ? '&' : '?'
  const ttUrl = `${track.baseUrl}${separator}fmt=json3`
  try {
    const res = await fetch(ttUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    })
    if (!res.ok) {
      return {
        ok: false,
        error: `YouTube rejected the transcript download (HTTP ${res.status}).`,
        platform: 'youtube',
      }
    }
    const data: Json3Transcript = await res.json()
    const content = parseJson3Transcript(data)

    if (!content) {
      return { ok: false, error: 'The transcript came back empty.', platform: 'youtube' }
    }

    const warnings: string[] = []
    if (content.length < 200) {
      warnings.push('The transcript is quite short — longer samples give a more accurate voice profile.')
    }
    if (track.kind === 'asr') {
      warnings.push('This video only has auto-generated captions, which can include transcription errors. Analysis will still run but may be less accurate than a manually-captioned video.')
    }

    return {
      ok: true,
      sample: {
        content,
        platform: 'youtube',
        label: (title ?? `YouTube: ${videoId}`).slice(0, 100),
        source_url: url,
        warnings,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[voice-url-importer] timedtext fetch failed for ${videoId}:`, msg)
    return {
      ok: false,
      error: `Couldn't download the transcript: ${msg.slice(0, 200)}`,
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
