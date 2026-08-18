'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { apiFetch } from '@/lib/api'
import { AskStage, type AskResult } from '@/components/onboarding/AskStage'
import { PackStage, type CreatorPack } from '@/components/onboarding/PackStage'
import { OwnStage } from '@/components/onboarding/OwnStage'
import {
  snoozeUntil,
  hasFinishedFirstSession,
  type FirstSessionProgress,
  type FirstSessionStage,
} from '@/lib/first-session-state'

/**
 * The first session: Ask → Pack → Own.
 *
 * State lives in preferences.tutorial_progress because isInActiveTutorial, the
 * sidebar link and the dashboard all read `completed` from it — only the stage
 * vocabulary and the snooze field are new.
 *
 * Resume: the Ask answers are persisted, so a returning user re-enters at Ask
 * with their niche/platform/tone pre-filled and continues into Pack, which
 * rehydrates already-generated artifacts rather than regenerating them.
 */

const STAGE_LABELS: Record<FirstSessionStage, string> = {
  ask: 'About you',
  pack: 'Your pack',
  own: 'Keep it',
}

export default function OnboardingPage() {
  const router = useRouter()
  // `stage` always starts at 'ask' on mount — it is deliberately NOT restored
  // from `tp.stage` in the load effect below, only `saved` (the persisted
  // niche/platform/tone) is. That is why the `ask` / `own` render guards
  // further down (`stage === 'pack' && ask`, `stage === 'own' && ask && pack`)
  // are currently unreachable dead code: `ask`/`pack` state and `stage` are
  // only ever advanced together, inside handleAskDone/handlePackDone. If a
  // future change starts restoring `stage` from persisted progress WITHOUT
  // also restoring `ask`/`pack`, those guards would start doing real work —
  // silently rendering a blank content pane instead of resuming at the right
  // stage. Keep `stage` and `ask`/`pack` restoration in lockstep.
  const [stage, setStage] = useState<FirstSessionStage>('ask')
  const [ask, setAsk] = useState<AskResult | null>(null)
  const [pack, setPack] = useState<CreatorPack | null>(null)
  const [ready, setReady] = useState(false)
  const [saved, setSaved] = useState<FirstSessionProgress>({})

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .maybeSingle()

      const prefs = (profile?.preferences ?? {}) as {
        tutorial_progress?: FirstSessionProgress
        onboarded_at?: string | null
      }
      const tp = prefs.tutorial_progress

      // Finished — the new session, or the old wizard. Do not replay it.
      // Shared predicate with chooseDestination — see hasFinishedFirstSession.
      if (hasFinishedFirstSession(!!tp?.completed, prefs.onboarded_at)) {
        router.replace('/dashboard')
        return
      }

      if (tp) setSaved(tp)
      setReady(true)
    })()
  }, [router])

  const persist = async (progress: FirstSessionProgress, alsoOnboardedAt = false) => {
    try {
      await apiFetch('/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify(
          alsoOnboardedAt
            ? { onboarded_at: new Date().toISOString(), tutorial_progress: progress }
            : { tutorial_progress: progress },
        ),
      })
    } catch {
      // Non-fatal: never block a first session on a preferences write.
    }
  }

  const logEvent = (name: string, detail: Record<string, unknown> = {}) => {
    void fetch('/api/onboarding/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, detail }),
    }).catch(() => {})
  }

  const handleLater = async () => {
    await persist({ ...saved, stage, completed: false, snoozed_until: snoozeUntil(new Date()) })
    logEvent('first_session_snoozed', { stage })
    router.replace('/dashboard')
  }

  const handleAskDone = async (result: AskResult) => {
    setAsk(result)
    setStage('pack')
    await persist({
      ...saved,
      stage: 'pack',
      completed: false,
      niche: result.niche,
      platform: result.platform,
      tone: result.tone,
    })
    logEvent('stage_viewed', { stage: 'pack' })
  }

  const handlePackDone = async (result: CreatorPack) => {
    setPack(result)
    setStage('own')
    await persist({ ...saved, stage: 'own', completed: false })
    logEvent('stage_viewed', { stage: 'own' })
  }

  const handleFinish = async (didSave: boolean) => {
    await persist(
      { ...saved, stage: 'own', completed: true, snoozed_until: null, pack_saved: didSave },
      true,
    )
    logEvent('first_session_completed', { pack_saved: didSave })
    router.replace('/dashboard')
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500">Loading…</div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-brand-500/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-sm shadow-glow">
            ⚡
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
            PostCrisp
          </span>
        </div>
        <nav aria-label="Progress">
          <ol className="flex items-center gap-2">
            {(['ask', 'pack', 'own'] as FirstSessionStage[]).map((s) => (
              <li
                key={s}
                aria-current={s === stage ? 'step' : undefined}
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  s === stage
                    ? 'bg-brand-500/10 text-brand-200 border-brand-500/40'
                    : 'text-zinc-600 border-brand-500/5'
                }`}
              >
                {STAGE_LABELS[s]}
              </li>
            ))}
          </ol>
        </nav>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-3xl">
          {stage === 'ask' && (
            <AskStage
              initialNiche={saved.niche ?? ''}
              initialPlatform={saved.platform ?? 'instagram'}
              initialTone={saved.tone ?? 'casual'}
              onContinue={handleAskDone}
              onLater={handleLater}
            />
          )}
          {/* `&& ask` / `&& ask && pack` — see the note by the `stage` useState above. */}
          {stage === 'pack' && ask && (
            <PackStage ask={ask} onDone={handlePackDone} onLater={handleLater} />
          )}
          {stage === 'own' && ask && pack && (
            <OwnStage ask={ask} pack={pack} onFinish={handleFinish} />
          )}
        </div>
      </div>
    </div>
  )
}
