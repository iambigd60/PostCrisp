'use client'

import { CategoryHub } from '@/components/CategoryHub'
import { GROW_TOOLS } from '@/lib/tools-meta'

export default function GrowHubPage() {
  return (
    <CategoryHub
      title="Grow"
      description="Tools for reach and discovery — viral idea generation tailored to your niche, what's trending right now, sounds for short-form, and partner matchmaking."
      tools={GROW_TOOLS}
    />
  )
}
