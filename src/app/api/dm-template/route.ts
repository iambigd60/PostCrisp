import { NextResponse } from 'next/server'
import { checkAuthAndUsage, incrementUsage } from '@/lib/auth-usage'
import { crispGenerate } from '@/lib/crisp-engine'
import { parseLooseJson } from '@/lib/safe-json'
import { consumeCredits } from '@/lib/credits'

export interface DMTemplate {
  subject?: string
  body: string
}

export async function POST(request: Request) {
  const auth = await checkAuthAndUsage('dm-template', { request })
  if (!auth.ok) return auth.response

  const body = await request.json()
  const { category, recipient, yourNiche, specificDetails, customPrompt } = body

  if (!category && !customPrompt) {
    return NextResponse.json({ error: 'Pick a category or write a custom prompt.' }, { status: 400 })
  }

  const prompt = `You are an outreach specialist for creators.

${customPrompt
  ? `Write a custom DM for this scenario:\n${customPrompt}`
  : `Write a DM for the "${category}" scenario.`}

Context:
- Your niche: ${yourNiche || 'general creator'}
- Recipient: ${recipient || 'not specified'}
- Specific details: ${specificDetails || 'none provided'}

Return ONLY valid JSON:
{
  "subject": "Optional subject line for when it goes to DM inbox or email",
  "body": "DM body text with \\n for line breaks. Natural, professional-but-warm, specific, not generic."
}

Rules:
- Personalize with whatever details are provided
- Keep short enough to read without scrolling: 80-150 words for DMs
- Include a clear CTA / next step
- Never "Hey, love your content!" or similar cliches — be specific`

  try {
    const { text, totalTokens } = await crispGenerate({
      task: 'dm-template',
      tier: auth.tier,
      prompt,
      maxTokens: 1500,
    })

    const parsed = parseLooseJson<DMTemplate>(text)

    await incrementUsage(auth.supabase, auth.userId, auth.dailyUsed)

    await auth.supabase.from('generations').insert({
      user_id: auth.userId,
      feature: 'dm_template',
      platform: null,
      input_data: { category, recipient, yourNiche, specificDetails, customPrompt },
      output_data: parsed,
      tokens_used: totalTokens,
    })

    await consumeCredits(auth.supabase, auth.userId, auth.creditCost, 'dm-template')

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('DM template error:', error)
    return NextResponse.json({ error: 'Failed to generate DM. Please try again.' }, { status: 500 })
  }
}
