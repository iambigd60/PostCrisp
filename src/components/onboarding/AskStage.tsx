'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { PLATFORMS, TONES } from '@/lib/constants'

/**
 * Stage 1: one screen.
 *
 * The old wizard asked for channels first and hard-blocked on
 * `disabled={channels.length === 0}`. Captions do not need a connected channel,
 * so the handle here is optional context, never a gate.
 *
 * Tone is required because /api/generate rejects a request without it
 * (generate/route.ts:69). It defaults to 'casual' so the user can move on
 * without deciding.
 */

export interface AskResult {
  niche: string
  platform: string
  tone: string
  handle: string | null
}

export function AskStage({
  initialNiche = '',
  initialPlatform = 'instagram',
  initialTone = 'casual',
  onContinue,
  onLater,
}: {
  initialNiche?: string
  initialPlatform?: string
  initialTone?: string
  onContinue: (result: AskResult) => void
  onLater: () => void
}) {
  const [niche, setNiche] = useState(initialNiche)
  const [platform, setPlatform] = useState(initialPlatform)
  const [tone, setTone] = useState(initialTone)
  const [handle, setHandle] = useState('')

  const canContinue = niche.trim().length > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-zinc-100">
          What do you make content about?
        </h1>
        <p className="text-zinc-400 mt-3 text-base leading-relaxed max-w-xl">
          One line is enough. We&apos;ll turn it into captions, hashtags and something to film this
          week — about thirty seconds from now, on us.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="niche" className="block text-sm font-semibold text-zinc-300 mb-1.5">
            Your niche
          </label>
          <input
            id="niche"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="e.g. food creators in Las Vegas, AI tooling for solopreneurs"
            className="w-full rounded-xl border border-brand-500/20 bg-surface-secondary px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-brand-500/50"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="platform" className="block text-sm font-semibold text-zinc-300 mb-1.5">
              Where you post most
            </label>
            <select
              id="platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full rounded-xl border border-brand-500/20 bg-surface-secondary px-4 py-3 text-zinc-100 focus:outline-none focus:border-brand-500/50"
            >
              {PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="tone" className="block text-sm font-semibold text-zinc-300 mb-1.5">
              How it should sound
            </label>
            <select
              id="tone"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full rounded-xl border border-brand-500/20 bg-surface-secondary px-4 py-3 text-zinc-100 focus:outline-none focus:border-brand-500/50"
            >
              {TONES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="handle" className="block text-sm font-semibold text-zinc-300 mb-1.5">
            Your handle <span className="font-normal text-zinc-500">— optional</span>
          </label>
          <input
            id="handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@yourhandle"
            className="w-full rounded-xl border border-brand-500/20 bg-surface-secondary px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-brand-500/50"
          />
          <p className="text-xs text-zinc-500 mt-1.5">
            Skip it — you can connect channels later and everything still works.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button onClick={onLater} className="text-sm text-zinc-500 hover:text-zinc-300">
          Finish later
        </button>
        <Button
          onClick={() =>
            onContinue({ niche: niche.trim(), platform, tone, handle: handle.trim() || null })
          }
          size="lg"
          disabled={!canContinue}
        >
          Make my first pack →
        </Button>
      </div>
    </div>
  )
}
