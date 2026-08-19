'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { emitOnboardingEvent } from '@/lib/onboarding-client'
import type { AskResult } from './AskStage'

/**
 * Stage 2: the creator pack.
 *
 * Design constraints, each earned by a defect in an earlier revision:
 *
 *  - REHYDRATE BEFORE GENERATING. Free runs are one-per-feature for the life of
 *    the account. A resumed session that re-fired all three calls would get
 *    three 409s and a dead screen. /api/onboarding/pack returns whatever the
 *    routes already persisted to generations.output_data; we generate only the
 *    gaps. The gate is the awaited `existing` local, never React state — a
 *    state-based gate would read 'loading' through a stale closure and
 *    re-fire everything anyway.
 *  - The rehydration body is normalised defensively (Array.isArray / typeof
 *    guards), the same way the three generation responses already are below.
 *    An unguarded cast would let a malformed 200 throw a TypeError outside
 *    any catch — the exact dead-screen class this component exists to kill.
 *  - Three artifacts in PARALLEL, each rendered the moment it lands. The old
 *    flow ran four tools serially with two 30-60s waits.
 *  - Per-artifact failure. One endpoint erroring must not cost the other two.
 *    If ALL THREE fail, a "Try again" control re-runs rehydrate-then-fill-
 *    the-gaps rather than stranding the user on a permanently disabled button.
 *  - The idea renders IN FULL — hook, outline, best time. That is a filming
 *    brief, already paid for by the same 3 credits, and it is what replaces
 *    Channel Analysis as the session's strategic artifact.
 *  - No paywall. Nothing here renders LockedSection.
 *
 * Endpoint contracts verified against source (see the plan's contract table):
 * captions POST needs topic+platform+tone and returns { captions: string[] }
 * (and now 502s + refunds on an empty array, matching hashtags' contract);
 * hashtags is a GET whose tutorial flag is a QUERY param and which returns
 * OBJECTS; viral-ideas returns { ideas: ViralIdea[] } and clamps count to >= 5.
 */

export interface HashtagItem {
  tag: string
  score: number
  posts: string
  category: string
}

export interface PackIdea {
  title: string
  hook: string
  outline: string[]
  hashtags: string[]
  bestTime: string
  whyViral?: string
}

export interface CreatorPack {
  captions: string[]
  hashtags: HashtagItem[]
  idea: PackIdea | null
}

type ArtifactState = 'idle' | 'loading' | 'done' | 'failed'

export function PackStage({
  ask,
  onDone,
  onLater,
}: {
  ask: AskResult
  onDone: (pack: CreatorPack) => void
  onLater: () => void
}) {
  const [captions, setCaptions] = useState<string[]>([])
  const [hashtags, setHashtags] = useState<HashtagItem[]>([])
  const [idea, setIdea] = useState<PackIdea | null>(null)

  const [captionsState, setCaptionsState] = useState<ArtifactState>('loading')
  const [hashtagsState, setHashtagsState] = useState<ArtifactState>('loading')
  const [ideaState, setIdeaState] = useState<ArtifactState>('loading')

  const started = useRef(false)

  // Rehydrate, then generate only the gaps. Shared by the mount effect and
  // the "Try again" retry — retry is safe to re-run verbatim because it
  // rehydrates first, so anything that already persisted is picked up
  // rather than regenerated or re-charged.
  async function runPack() {
    // 1. Rehydrate anything already generated, so a resumed session never
    //    re-requests a spent freebie. Every field is guarded the same way
    //    the three generation responses below are guarded — a 200 with an
    //    unexpected shape falls back to "nothing yet" instead of throwing.
    let existing: CreatorPack = { captions: [], hashtags: [], idea: null }
    try {
      const res = await fetch('/api/onboarding/pack')
      if (res.ok) {
        const body = (await res.json()) as Partial<CreatorPack> | null
        const rawCaptions = body?.captions
        const rawHashtags = body?.hashtags
        const rawIdea = body?.idea
        existing = {
          captions: Array.isArray(rawCaptions) ? rawCaptions : [],
          hashtags: Array.isArray(rawHashtags) ? rawHashtags : [],
          idea: rawIdea && typeof rawIdea === 'object' ? rawIdea : null,
        }
      }
    } catch {
      // Treat a rehydration failure as "nothing yet" and generate.
    }

    if (existing.captions.length) {
      setCaptions(existing.captions)
      setCaptionsState('done')
    }
    if (existing.hashtags.length) {
      setHashtags(existing.hashtags)
      setHashtagsState('done')
    }
    if (existing.idea) {
      setIdea(existing.idea)
      setIdeaState('done')
    }

    const needsGeneration = !existing.captions.length || !existing.hashtags.length || !existing.idea

    emitOnboardingEvent(needsGeneration ? 'pack_requested' : 'pack_rehydrated', {
      niche: ask.niche,
      platform: ask.platform,
    })

    // 2. Generate only the gaps, in parallel.
    if (!existing.captions.length) {
      void (async () => {
        try {
          const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              topic: ask.niche,
              platform: ask.platform,
              tone: ask.tone,
              count: 3,
              tutorialMode: true,
            }),
          })
          if (!res.ok) throw new Error(String(res.status))
          const data = (await res.json()) as { captions?: string[] }
          const list = Array.isArray(data.captions) ? data.captions : []
          setCaptions(list)
          setCaptionsState(list.length ? 'done' : 'failed')
          emitOnboardingEvent(list.length ? 'artifact_returned' : 'artifact_failed', { artifact: 'captions' })
        } catch {
          setCaptionsState('failed')
          emitOnboardingEvent('artifact_failed', { artifact: 'captions' })
        }
      })()
    }

    if (!existing.hashtags.length) {
      void (async () => {
        try {
          const params = new URLSearchParams({
            q: ask.niche,
            platform: ask.platform,
            count: '15',
            tutorial: '1',
          })
          const res = await fetch(`/api/hashtags?${params.toString()}`)
          if (!res.ok) throw new Error(String(res.status))
          const data = (await res.json()) as { hashtags?: HashtagItem[] }
          const list = Array.isArray(data.hashtags) ? data.hashtags : []
          setHashtags(list)
          setHashtagsState(list.length ? 'done' : 'failed')
          emitOnboardingEvent(list.length ? 'artifact_returned' : 'artifact_failed', { artifact: 'hashtags' })
        } catch {
          setHashtagsState('failed')
          emitOnboardingEvent('artifact_failed', { artifact: 'hashtags' })
        }
      })()
    }

    if (!existing.idea) {
      void (async () => {
        try {
          // The route clamps count to a minimum of 5; we ask for 5 and show
          // the first in full rather than pretending we asked for one.
          const res = await fetch('/api/viral-ideas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ niche: ask.niche, count: 5, tutorialMode: true }),
          })
          if (!res.ok) throw new Error(String(res.status))
          const data = (await res.json()) as { ideas?: PackIdea[] }
          const first = Array.isArray(data.ideas) && data.ideas.length ? data.ideas[0] : null
          setIdea(first)
          setIdeaState(first ? 'done' : 'failed')
          emitOnboardingEvent(first ? 'artifact_returned' : 'artifact_failed', { artifact: 'idea' })
        } catch {
          setIdeaState('failed')
          emitOnboardingEvent('artifact_failed', { artifact: 'idea' })
        }
      })()
    }
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    void runPack()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const allSettled =
    captionsState !== 'loading' && hashtagsState !== 'loading' && ideaState !== 'loading'
  const anySucceeded =
    captionsState === 'done' || hashtagsState === 'done' || ideaState === 'done'
  const allFailed = allSettled && !anySucceeded

  function handleRetry() {
    // Reset to loading immediately so the retry control disappears and each
    // card shows "Writing…" again while runPack repeats rehydrate-then-fill.
    setCaptionsState('loading')
    setHashtagsState('loading')
    setIdeaState('loading')
    void runPack()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Your first pack</h1>
        <p className="text-zinc-400 mt-2">
          Built from &ldquo;{ask.niche}&rdquo;. On us — your credits are untouched.
        </p>
      </div>

      <ArtifactCard title="3 captions you can post today" state={captionsState}>
        <ul className="space-y-3">
          {captions.map((c, i) => (
            <li
              key={i}
              className="rounded-lg border border-brand-500/10 bg-surface-secondary p-3 text-sm text-zinc-200"
            >
              {c}
            </li>
          ))}
        </ul>
      </ArtifactCard>

      <ArtifactCard title="Hashtags that match" state={hashtagsState}>
        <div className="flex flex-wrap gap-2">
          {hashtags.map((h, i) => (
            <span
              key={`${h.tag}-${i}`}
              title={`${h.category} · ~${h.posts} posts`}
              className="rounded-full bg-brand-500/10 border border-brand-500/20 px-3 py-1 text-xs text-brand-200"
            >
              {h.tag}
            </span>
          ))}
        </div>
      </ArtifactCard>

      <ArtifactCard title="One thing to film this week" state={ideaState}>
        {idea && (
          <div className="space-y-3">
            <div className="text-base font-semibold text-zinc-100">{idea.title}</div>
            {idea.hook && (
              <div>
                <div className="text-2xs font-bold uppercase tracking-wider text-brand-300 mb-1">
                  Your opening hook
                </div>
                <p className="text-sm text-zinc-200">{idea.hook}</p>
              </div>
            )}
            {idea.outline?.length > 0 && (
              <div>
                <div className="text-2xs font-bold uppercase tracking-wider text-brand-300 mb-1">
                  How to structure it
                </div>
                <ol className="list-decimal list-inside space-y-1 text-sm text-zinc-300">
                  {idea.outline.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ol>
              </div>
            )}
            {idea.bestTime && (
              <p className="text-xs text-zinc-500">Best time to post: {idea.bestTime}</p>
            )}
          </div>
        )}
      </ArtifactCard>

      {allFailed && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center space-y-2">
          <p className="text-sm text-zinc-400">
            Nothing came through this time. Try again — anything you already have won&apos;t be
            regenerated or re-charged.
          </p>
          <Button onClick={handleRetry} variant="secondary" size="sm">
            Try again
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button onClick={onLater} className="text-sm text-zinc-500 hover:text-zinc-300">
          Finish later
        </button>
        <Button onClick={() => onDone({ captions, hashtags, idea })} size="lg" disabled={!allSettled || !anySucceeded}>
          Keep this →
        </Button>
      </div>
    </div>
  )
}

/** Renders one artifact's loading / failed / done state. */
function ArtifactCard({
  title,
  state,
  children,
}: {
  title: string
  state: ArtifactState
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-brand-500/15 bg-surface-secondary/50 p-5">
      <h2 className="text-sm font-bold uppercase tracking-wider text-brand-300 mb-3">{title}</h2>
      {state === 'loading' && <p className="text-sm text-zinc-500">Writing…</p>}
      {state === 'failed' && (
        <p className="text-sm text-zinc-500">
          This one didn&apos;t come through. The rest of your pack is fine — you can try this tool
          again any time from the dashboard.
        </p>
      )}
      {state === 'done' && children}
    </section>
  )
}
