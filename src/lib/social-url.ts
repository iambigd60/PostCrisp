import type { PlatformId } from '@/lib/constants'

type EvidencePostLike = {
  caption?: string
  sourceUrl?: string
}

const PLATFORM_HOSTS: Record<PlatformId, string[]> = {
  instagram: ['instagram.com'],
  tiktok: ['tiktok.com', 'vm.tiktok.com'],
  youtube: ['youtube.com', 'youtu.be'],
  x: ['x.com', 'twitter.com'],
  facebook: ['facebook.com', 'fb.com', 'fb.watch'],
  threads: ['threads.net'],
  linkedin: ['linkedin.com'],
}

const PLATFORM_LABELS: Record<PlatformId, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  x: 'X',
  facebook: 'Facebook',
  threads: 'Threads',
  linkedin: 'LinkedIn',
}

function hostnameMatches(hostname: string, allowedHost: string) {
  return hostname === allowedHost || hostname.endsWith(`.${allowedHost}`)
}

export function isSocialPlatformUrl(platform: PlatformId, value: string) {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '')
    return PLATFORM_HOSTS[platform].some((allowedHost) => hostnameMatches(hostname, allowedHost))
  } catch {
    return false
  }
}

export function isKnownSocialPlatform(value: string | null | undefined): value is PlatformId {
  return typeof value === 'string' && value in PLATFORM_HOSTS
}

export function socialPlatformLabel(platform: PlatformId) {
  return PLATFORM_LABELS[platform]
}

export function looksLikeUrl(value: string) {
  const trimmed = value.trim()
  return /^https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed)
}

export function validateEvidencePostsForPlatform(platform: PlatformId, posts: EvidencePostLike[]) {
  const label = socialPlatformLabel(platform)
  return posts.flatMap((post, index) => {
    const sourceUrl = post.sourceUrl?.trim()
    if (!sourceUrl) return []
    return isSocialPlatformUrl(platform, sourceUrl) ? [] : [`Post #${index + 1} URL must be an ${label} link.`]
  })
}
