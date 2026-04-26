'use client'

import { CategoryHub } from '@/components/CategoryHub'
import { CREATE_TOOLS } from '@/lib/tools-meta'

export default function CreateHubPage() {
  return (
    <CategoryHub
      title="Create"
      description="Tools for authoring social content. Pick one based on what you need to ship — captions for a single post, scripts for a video, repurpose to stretch one piece across platforms."
      tools={CREATE_TOOLS}
    />
  )
}
