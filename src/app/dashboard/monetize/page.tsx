'use client'

import { CategoryHub } from '@/components/CategoryHub'
import { MONETIZE_TOOLS } from '@/lib/tools-meta'

export default function MonetizeHubPage() {
  return (
    <CategoryHub
      title="Monetize"
      description="Tools for turning audience into income — outreach pitches that don't get ghosted, defensible rate cards when brands ask 'how much?', and competitor reads that sharpen your positioning."
      tools={MONETIZE_TOOLS}
    />
  )
}
