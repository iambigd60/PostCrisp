'use client'

import { CategoryHub } from '@/components/CategoryHub'
import { OPTIMIZE_TOOLS } from '@/lib/tools-meta'

export default function OptimizeHubPage() {
  return (
    <CategoryHub
      title="Optimize"
      description="Tools for tightening what you already have — better posting times, sharper bios, honest channel audits, ranked YouTube metadata, and click-prediction critiques on your thumbnails."
      tools={OPTIMIZE_TOOLS}
    />
  )
}
