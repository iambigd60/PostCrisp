'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { apiFetch } from '@/lib/api'
import { emitOnboardingEvent } from '@/lib/onboarding-client'
import type { CreatorPack } from './PackStage'
import type { AskResult } from './AskStage'

/**
 * Stage 3: the user takes ownership.
 *
 * The old wizard made saving its own ceremonial step. Here the pack saves in one
 * click, and the personalisation offers come AFTER value has landed — offers,
 * never gates.
 *
 * Note hashtags are objects; serialise by `.tag`. Rev.1 joined the objects
 * directly and produced "[object Object]".
 */

export function OwnStage({
  ask,
  pack,
  onFinish,
}: {
  ask: AskResult
  pack: CreatorPack
  onFinish: (saved: boolean) => void
}) {
  const { addToast } = useToast()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const savePack = async () => {
    setSaving(true)
    try {
      const sections: string[] = []
      if (pack.captions.length) sections.push(`Captions:\n${pack.captions.join('\n\n')}`)
      if (pack.hashtags.length) sections.push(`Hashtags:\n${pack.hashtags.map((h) => h.tag).join(' ')}`)
      if (pack.idea) {
        const outline = pack.idea.outline?.length
          ? `\nOutline:\n${pack.idea.outline.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
          : ''
        const when = pack.idea.bestTime ? `\nBest time: ${pack.idea.bestTime}` : ''
        sections.push(`Idea to film:\n${pack.idea.title}\nHook: ${pack.idea.hook}${outline}${when}`)
      }

      await apiFetch('/api/saved', {
        method: 'POST',
        body: JSON.stringify({
          type: 'first-session-pack',
          content: sections.join('\n\n---\n\n'),
          platform: ask.platform,
          topic: ask.niche,
        }),
      })
      setSaved(true)
      addToast('Saved to your library.', 'success')
      emitOnboardingEvent('artifact_saved', { type: 'first-session-pack' })
    } catch {
      addToast('Could not save just yet — your pack is still on screen.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Keep it.</h1>
        <p className="text-zinc-400 mt-2 leading-relaxed max-w-xl">
          Save the pack to your library and it&apos;s yours — captions, hashtags and the idea, in
          one place you can come back to.
        </p>
      </div>

      <Button onClick={savePack} loading={saving} disabled={saved} size="lg">
        {saved ? 'Saved ✓' : 'Save to my library'}
      </Button>

      <div className="pt-4 space-y-3">
        <div className="text-2xs font-bold uppercase tracking-wider text-zinc-500">
          Want the next one to sound more like you?
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/dashboard/voice"
            className="rounded-xl border border-brand-500/15 bg-surface-secondary p-4 hover:border-brand-500/40 transition-colors"
          >
            <div className="text-sm font-semibold text-zinc-200">🎙️ Train your voice</div>
            <p className="text-xs text-zinc-500 mt-1">
              Paste 2-3 captions you&apos;ve written. Every generation after that matches your style.
            </p>
          </Link>
          <Link
            href="/dashboard/settings"
            className="rounded-xl border border-brand-500/15 bg-surface-secondary p-4 hover:border-brand-500/40 transition-colors"
          >
            <div className="text-sm font-semibold text-zinc-200">🧭 Add your channels</div>
            <p className="text-xs text-zinc-500 mt-1">
              Tune everything to the platforms you actually post on.
            </p>
          </Link>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={() => onFinish(saved)} size="lg">
          Go to my dashboard →
        </Button>
      </div>
    </div>
  )
}
