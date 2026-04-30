import { NextResponse } from 'next/server'
import { checkAuthAndUsage, incrementUsage } from '@/lib/auth-usage'
import { crispGenerate } from '@/lib/crisp-engine'
import { parseLooseJson } from '@/lib/safe-json'
import { consumeCredits } from '@/lib/credits'

// Vercel function timeout. Default 60s on Pro plan; AI calls (especially
// Opus on long outputs) regularly hit 30-60s with variance to ~90s. 120s
// gives headroom while bounding the worst case.
export const maxDuration = 120

export interface PlatformTip {
  title: string
  explanation: string
  difficulty: 'Easy' | 'Medium' | 'Advanced'
  impact: 'Low' | 'Medium' | 'High'
  category: 'algorithm' | 'best-practices' | 'growth' | 'mistakes' | 'underused-features'
}

export async function POST(request: Request) {
  const auth = await checkAuthAndUsage('platform-tips', { request })
  if (!auth.ok) return auth.response

  const body = await request.json()
  const { platform, niche } = body

  if (!platform) {
    return NextResponse.json({ error: 'Platform is required.' }, { status: 400 })
  }

  const prompt = `You are a platform-specific growth strategist.

Generate 2026-current tips for ${platform}${niche ? ` in the ${niche} niche` : ''}.

Return ONLY valid JSON:
{
  "tips": [
    {
      "title": "Short tip headline (6-10 words)",
      "explanation": "1-2 sentence explanation with specific tactics, not generic advice",
      "difficulty": "Easy",
      "impact": "High",
      "category": "algorithm"
    }
  ]
}

Rules:
- Generate 12 tips total, distributed across these categories:
  - 3 "algorithm" (recent ${platform} algorithm insights)
  - 3 "best-practices" (format, length, style)
  - 3 "growth" (proven tactics for growing on ${platform})
  - 2 "mistakes" (what to avoid)
  - 1 "underused-features" (a ${platform} feature most creators miss)
- difficulty: Easy / Medium / Advanced
- impact: Low / Medium / High
- Every tip must be ${platform}-specific — generic advice not allowed`

  try {
    const { text, totalTokens } = await crispGenerate({
      task: 'platform-tips',
      tier: auth.tier,
      prompt,
      maxTokens: 3000,
    })

    const parsed = parseLooseJson<{ tips: PlatformTip[] }>(text)
    const tips = parsed.tips ?? []

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'platform_tips',
      platform,
      input_data: { niche },
      output_data: { tips },
      tokens_used: totalTokens,
    })

    await consumeCredits(auth.supabase, auth.userId, auth.creditCost, 'platform-tips')

    return NextResponse.json({ tips })
  } catch (error) {
    console.error('Platform tips error:', error)
    return NextResponse.json({ error: 'Failed to load tips. Please try again.' }, { status: 500 })
  }
}
