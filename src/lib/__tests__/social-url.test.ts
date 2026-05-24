import { describe, expect, it } from 'vitest'
import { isSocialPlatformUrl, looksLikeUrl, validateEvidencePostsForPlatform } from '@/lib/social-url'

describe('isSocialPlatformUrl', () => {
  it('accepts canonical and mobile hostnames for the selected platform', () => {
    expect(isSocialPlatformUrl('instagram', 'https://www.instagram.com/p/C123/')).toBe(true)
    expect(isSocialPlatformUrl('instagram', 'https://m.instagram.com/reel/C123/')).toBe(true)
    expect(isSocialPlatformUrl('tiktok', 'https://www.tiktok.com/@creator/video/123')).toBe(true)
    expect(isSocialPlatformUrl('youtube', 'https://youtu.be/abc123')).toBe(true)
    expect(isSocialPlatformUrl('x', 'https://twitter.com/user/status/123')).toBe(true)
  })

  it('rejects links from a different selected platform', () => {
    expect(isSocialPlatformUrl('instagram', 'https://www.tiktok.com/@creator/video/123')).toBe(false)
    expect(isSocialPlatformUrl('youtube', 'https://www.instagram.com/p/C123/')).toBe(false)
  })

  it('rejects lookalike hosts and non-http urls', () => {
    expect(isSocialPlatformUrl('instagram', 'https://instagram.com.evil.test/p/C123/')).toBe(false)
    expect(isSocialPlatformUrl('linkedin', 'javascript:alert(1)')).toBe(false)
    expect(isSocialPlatformUrl('facebook', 'not a url')).toBe(false)
  })
})

describe('validateEvidencePostsForPlatform', () => {
  it('allows manual evidence without a url', () => {
    expect(validateEvidencePostsForPlatform('instagram', [
      { caption: 'A strong post' },
    ])).toEqual([])
  })

  it('requires every provided evidence url to match the selected platform', () => {
    expect(validateEvidencePostsForPlatform('instagram', [
      { caption: 'A strong post', sourceUrl: 'https://instagram.com/p/C123/' },
      { caption: 'Wrong platform', sourceUrl: 'https://tiktok.com/@creator/video/123' },
    ])).toEqual(['Post #2 URL must be an Instagram link.'])
  })
})

describe('looksLikeUrl', () => {
  it('only treats actual urls as urls, not social handles', () => {
    expect(looksLikeUrl('https://instagram.com/post')).toBe(true)
    expect(looksLikeUrl('www.instagram.com/post')).toBe(true)
    expect(looksLikeUrl('@creator')).toBe(false)
  })
})
