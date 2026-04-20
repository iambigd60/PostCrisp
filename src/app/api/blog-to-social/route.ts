import { NextResponse } from 'next/server'
import { checkAuthAndUsage, incrementUsage } from '@/lib/auth-usage'
import { crispGenerate } from '@/lib/crisp-engine'
import { parseLooseJson } from '@/lib/safe-json'
import { consumeCredits } from '@/lib/credits'

export interface BlogSocialPost {
  platform: string
  type: 'quote' | 'stat' | 'tip' | 'takeaway' | 'story'
  sourceSection: string
  content: string
  hashtags?: string[]
}

export async function POST(request: Request) {
  const auth = await checkAuthAndUsage('blog-to-social')
  if (!auth.ok) return auth.response

  const body = await request.json()
  const { blog, count, targetPlatforms, focus } = body

  if (!blog?.trim()) {
    return NextResponse.json({ error: 'Blog content is required.' }, { status: 400 })
  }

  const safeCount = Math.min(Math.max(Number(count) || 5, 3), 10)
  const platforms: string[] = Array.isArray(targetPlatforms) && targetPlatforms.length > 0
    ? targetPlatforms
    : ['Instagram', 'X', 'LinkedIn']
  const focusList: string[] = Array.isArray(focus) && focus.length > 0
    ? focus
    : ['Key Takeaways', 'Quotes', 'Statistics', 'Tips']

  const prompt = `You are a content extractor. Pull ${safeCount} standalone social posts from this blog.

Blog content:
"""
${blog.slice(0, 12000)}
"""

Focus on these moments: ${focusList.join(', ')}
Target platforms: ${platforms.join(', ')}

Each extracted post must work WITHOUT blog context — the reader should get value from the post alone. Distribute across the target platforms.

Return ONLY valid JSON:
{
  "posts": [
    {
      "platform": "Instagram",
      "type": "quote",
      "sourceSection": "Brief mention of which blog section this came from",
      "content": "The standalone social post",
      "hashtags": ["#tag1", "#tag2"]
    }
  ]
}

Rules:
- "type" must be one of: quote, stat, tip, takeaway, story
- Each post respects the target platform's voice and length
- hashtags 3-8 for IG/TikTok, 1-3 for X/LinkedIn, optional elsewhere
- sourceSection helps the user remember where it came from`

  try {
    const { text, totalTokens } = await crispGenerate({
      task: 'blog-to-social',
      tier: auth.tier,
      system: 'You extract standalone social posts from long-form content. Output only valid JSON.',
      prompt,
      maxTokens: 3500,
    })

    const parsed = parseLooseJson<{ posts: BlogSocialPost[] }>(text)
    const posts = parsed.posts ?? []

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'blog_to_social',
      platform: platforms[0] ?? null,
      input_data: { count: safeCount, targetPlatforms: platforms, focus: focusList, sourceLength: blog.length },
      output_data: { posts },
      tokens_used: totalTokens,
    })

    await consumeCredits(auth.supabase, auth.userId, auth.creditCost, 'blog-to-social')

    return NextResponse.json({ posts })
  } catch (error) {
    console.error('Blog-to-social error:', error)
    return NextResponse.json({ error: 'Failed to extract posts. Please try again.' }, { status: 500 })
  }
}
