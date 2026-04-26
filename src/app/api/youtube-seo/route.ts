import { NextResponse } from 'next/server'
import { checkAuthAndUsage, incrementUsage } from '@/lib/auth-usage'
import { crispGenerate } from '@/lib/crisp-engine'
import { parseLooseJson } from '@/lib/safe-json'
import { getUserChannels, formatChannelsForPrompt } from '@/lib/user-channels'
import { consumeCredits } from '@/lib/credits'
import { loadVoicePromptSnippet } from '@/lib/voice-profile'

export interface YouTubeSEOResult {
  titles: { text: string; charCount: number; keywordPlacement: string }[]
  description: string
  tags: string[]
  thumbnailText: string[]
  seoScore: number
  improvements: string[]
}

export async function POST(request: Request) {
  const auth = await checkAuthAndUsage('youtube-seo', { request })
  if (!auth.ok) return auth.response

  const body = await request.json()
  const { topic, keywords, category, competitorUrl } = body

  if (!topic?.trim()) {
    return NextResponse.json({ error: 'Topic is required.' }, { status: 400 })
  }

  const channels = await getUserChannels(auth.supabase, auth.userId)
  const channelsBlock = formatChannelsForPrompt(channels)

  const prompt = `You are a YouTube SEO expert. Optimize this video for search and algorithm.

Video topic: "${topic}"
Target keywords: ${keywords || 'infer from topic'}
Category: ${category || 'general'}
${competitorUrl ? `Competitor to outrank: ${competitorUrl}` : ''}
${channelsBlock}

Return ONLY valid JSON:
{
  "titles": [
    { "text": "Title option 1 (max 60 chars for best display)", "charCount": 55, "keywordPlacement": "Primary keyword at position 2" },
    { "text": "Title option 2", "charCount": 58, "keywordPlacement": "Primary keyword at start" },
    { "text": "Title option 3", "charCount": 60, "keywordPlacement": "Curiosity hook + keyword" },
    { "text": "Title option 4", "charCount": 52, "keywordPlacement": "Number + keyword" },
    { "text": "Title option 5", "charCount": 50, "keywordPlacement": "How-to phrasing" }
  ],
  "description": "Full optimized description template: hook paragraph with keyword in first 150 chars, then timestamps placeholder [00:00 - Intro], bullet of what's covered, keywords section, links section, subscribe CTA, hashtags at bottom.",
  "tags": ["15-20 tags ordered by relevance — most important first"],
  "thumbnailText": ["3 short text overlays under 5 words each"],
  "seoScore": 75,
  "improvements": ["3-5 specific, actionable improvements to boost rank"]
}

Rules:
- Titles MUST be accurate char counts and under 60 chars for full visibility
- Description is a READY-TO-USE template, not instructions
- Tags ordered by search volume and specificity
- Thumbnail text is 2-5 words, high contrast, attention-grabbing`

  try {
    const voiceSnippet = await loadVoicePromptSnippet(auth.supabase, auth.userId)
    const { text, totalTokens } = await crispGenerate({
      task: 'youtube-seo',
      tier: auth.tier,
      voiceSnippet,
      prompt,
      maxTokens: 2500,
    })

    const parsed = parseLooseJson<YouTubeSEOResult>(text)

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'youtube_seo',
      platform: 'youtube',
      input_data: { topic, keywords, category, competitorUrl },
      output_data: parsed,
      tokens_used: totalTokens,
    })

    await consumeCredits(auth.supabase, auth.userId, auth.creditCost, 'youtube-seo')

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('YouTube SEO error:', error)
    return NextResponse.json({ error: 'Failed to optimize. Please try again.' }, { status: 500 })
  }
}
