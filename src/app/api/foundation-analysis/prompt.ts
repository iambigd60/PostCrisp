export interface FoundationInput {
  platform: 'instagram' | 'tiktok' | 'youtube' | 'x' | 'facebook' | 'threads' | 'linkedin'
  niche: string
  followerCount?: string
  postingCadence?: string
  contentPillars: string[]                                              // 1-3
  targetAudience: { description: string; sophistication: 'beginner' | 'intermediate' | 'advanced' }
  growthGoal: 'followers' | 'engagement' | 'monetization' | 'authority' | 'community'
  monetizationStage: 'none' | 'brand-deals' | 'digital-products' | 'services' | 'multi-stream'
  formatStrengths: string[]
  currentChallenges?: string
  analyzeHandle?: string
  samplePosts: Array<{ caption: string; metric?: string; whyItWorked?: string; sourceUrl?: string }>
}

export function buildFoundationPrompt(input: FoundationInput): string {
  const pillars = input.contentPillars.filter((p) => p?.trim()).join(', ')
  const formats = input.formatStrengths.join(', ')
  const samples = input.samplePosts
    .filter((p) => p.caption?.trim())
    .map((p, i) => {
      const metric = p.metric ? ` (Metric: ${p.metric})` : ''
      const source = p.sourceUrl ? `\n  Source URL: ${p.sourceUrl}` : ''
      const theory = p.whyItWorked ? `\n  Creator's theory: ${p.whyItWorked}` : ''
      return `Sample post #${i + 1}${metric}:${source}\n  "${p.caption}"${theory}`
    })
    .join('\n\n')

  return `You are an expert creator strategist running a foundational, evidence-grounded audit of the user's ${input.platform} channel. You have access to their declared profile AND sample posts they have flagged as their best-performing. Your job is to (a) audit the channel, (b) extract patterns from their evidence, and (c) emit a structured Creator Profile that downstream tools will consume.

Creator profile (declared):
- Platform: ${input.platform}
- Handle / URL: ${input.analyzeHandle || 'not provided'}
- Niche: ${input.niche}
- Follower count: ${input.followerCount || 'not specified'}
- Posting cadence: ${input.postingCadence || 'not specified'}
- Content pillars: ${pillars}
- Target audience: ${input.targetAudience.description} (sophistication: ${input.targetAudience.sophistication})
- Primary growth goal: ${input.growthGoal}
- Monetization stage: ${input.monetizationStage}
- Format strengths (self-reported): ${formats || 'not specified'}
- Current challenges: ${input.currentChallenges || 'none specified'}

Evidence — best-performing posts the creator has flagged:
${samples}

Analyze the channel as if you were a hired strategist. Be specific. Reference 2026 ${input.platform} algorithm dynamics. Read the sample posts carefully — their wins reveal what the audience rewards. Prefer concrete recommendations over platitudes.

Return ONLY valid JSON in the following exact shape:
{
  "overallAssessment": "2-3 sentence honest read",
  "strengths": ["", "", ""],
  "gaps": ["", "", "", ""],
  "contentMix": { "observation": "", "recommendation": "" },
  "postingConsistency": { "observation": "", "recommendation": "" },
  "audienceEngagement": { "observation": "", "recommendation": "" },
  "missedOpportunities": ["", "", ""],
  "quickWins": [
    {"title": "", "action": "", "impact": "High"},
    {"title": "", "action": "", "impact": "High"},
    {"title": "", "action": "", "impact": "Medium"}
  ],
  "longTermMoves": [
    {"title": "", "action": "", "timeframe": "30 days"},
    {"title": "", "action": "", "timeframe": "60-90 days"},
    {"title": "", "action": "", "timeframe": "90+ days"}
  ],
  "topPostPatterns": ["pattern observed across their wins #1", "#2", "#3"],
  "recommendedFormatLean": "single bold recommendation for which format/style to lean into",
  "repeatableHookStructures": [
    {"pattern": "structure name", "example": "concrete example using their voice"},
    {"pattern": "", "example": ""}
  ],
  "creatorProfile": {
    "contentPillars": ["", "", ""],
    "voiceSignature": { "adjectives": ["", "", ""], "examplePhrasing": "1-line example of how they sound" },
    "audiencePersona": { "description": "", "sophistication": "${input.targetAudience.sophistication}" },
    "growthStage": "pre-traction | early-traction | scaling | established (pick one)",
    "monetizationPosition": { "stage": "${input.monetizationStage}", "primaryStreams": ["", ""] },
    "formatStrengths": ["", ""],
    "differentiators": ["what sets them apart in their niche", "", ""],
    "topBlockers": ["top blocker", "", ""]
  }
}

Rules:
- strengths: 3 items, gaps: 4 items, missedOpportunities: 3 items
- quickWins: 3 items, longTermMoves: 3 items
- topPostPatterns: 3 items, repeatableHookStructures: 2 items
- creatorProfile.contentPillars: 3 items derived from declared pillars + evidence
- creatorProfile.voiceSignature.adjectives: 3 items
- creatorProfile.differentiators: 3 items
- creatorProfile.topBlockers: 3 items
- Every recommendation must reference ${input.platform}-specific mechanics or ${input.niche}-specific dynamics
- Never use generic "post consistently" / "engage with your audience" advice — be specific about what/when/how
- Anchor evidence-layer findings in the actual sample posts above, not generic patterns`
}
