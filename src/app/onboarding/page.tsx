'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { apiFetch, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { ChannelsSection } from '@/components/ChannelsSection'
import {
  ChannelAnalysisStep,
  CaptionsStep,
  HashtagsStep,
  ViralIdeasStep,
  SaveStep,
  initialTutorialContext,
  type TutorialContext,
} from '@/components/onboarding/TutorialSteps'
import type { Channel } from '@/lib/channels'

type Step = 'welcome' | 'channels' | 'analyze' | 'captions' | 'hashtags' | 'viral' | 'save'

const STEPS: Step[] = ['welcome', 'channels', 'analyze', 'captions', 'hashtags', 'viral', 'save']
const STEP_LABELS: Record<Step, string> = {
  welcome: 'Welcome',
  channels: 'Channels',
  analyze: 'Analyze',
  captions: 'Captions',
  hashtags: 'Hashtags',
  viral: 'Ideas',
  save: 'Done',
}

function StepIndicator({ current }: { current: Step }) {
  const currentIdx = STEPS.indexOf(current)
  return (
    <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
      {STEPS.map((s, i) => {
        const active = s === current
        const done = i < currentIdx
        return (
          <div key={s} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <div
              className={`flex items-center gap-1 px-2 sm:px-3 py-1 rounded-full text-2xs sm:text-xs font-semibold border transition-all ${
                done
                  ? 'bg-brand-500/15 text-brand-300 border-brand-500/30'
                  : active
                    ? 'bg-brand-500/10 text-brand-200 border-brand-500/40 shadow-glow'
                    : 'bg-surface-secondary text-zinc-500 border-brand-500/5'
              }`}
            >
              <span>{done ? '✓' : i + 1}</span>
              <span className="hidden md:inline">{STEP_LABELS[s]}</span>
            </div>
            {i < STEPS.length - 1 && <div className="w-2 sm:w-4 h-px bg-brand-500/20" />}
          </div>
        )
      })}
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const [step, setStep] = useState<Step>('welcome')
  const [userFirstName, setUserFirstName] = useState<string>('there')
  const [channels, setChannels] = useState<Channel[]>([])
  const [tutorialCtx, setTutorialCtx] = useState<TutorialContext>(initialTutorialContext)
  const [finishing, setFinishing] = useState(false)

  // Shape of tutorial_progress as we now persist it. Older records may be
  // missing fields below — we treat anything absent as 'no carry-over' and
  // hydrate from defaults.
  type SavedTutorialProgress = {
    step?: Step
    completed?: boolean
    analysis_id?: string | null
    caption_topic?: string | null
    niche?: string | null
    selected_channel_id?: string | null
    has_saved_item?: boolean
    // Legacy field name preserved for back-compat with records written before
    // this change. Read it as a fallback for caption_topic.
    saved_caption_topic?: string | null
  }

  // Load profile name + channels on mount, then resume tutorial from the
  // last persisted step + ctx so a refresh mid-flow doesn't lose state.
  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      const [profileRes, channelsRes] = await Promise.all([
        supabase.from('profiles').select('full_name, preferences').eq('id', user.id).maybeSingle(),
        supabase
          .from('channels')
          .select('id, user_id, platform, handle, label, url, sort_order, created_at, updated_at')
          .eq('user_id', user.id)
          .order('sort_order'),
      ])

      // Gate replay: once the tutorial is completed, send them to the dashboard.
      // The server-side bypass guard would still deny free credits anyway, so
      // re-running the wizard would just charge them — bad UX, send home instead.
      const prefs = (profileRes.data?.preferences ?? {}) as { tutorial_progress?: SavedTutorialProgress }
      const tp = prefs.tutorial_progress
      if (tp?.completed) {
        router.replace('/dashboard')
        return
      }

      const name = profileRes.data?.full_name?.split(' ')[0]?.trim()
      if (name) setUserFirstName(name)

      const channelList = (channelsRes.data ?? []) as Channel[]
      setChannels(channelList)

      // Hydrate ctx + step from saved progress so a refresh resumes where we left off.
      if (tp) {
        const carriedTopic = tp.caption_topic ?? tp.saved_caption_topic ?? ''
        const carriedChannel = tp.selected_channel_id
          ? channelList.find((c) => c.id === tp.selected_channel_id) ?? null
          : null
        setTutorialCtx((prev) => ({
          ...prev,
          analysisId: tp.analysis_id ?? null,
          niche: tp.niche ?? '',
          captionTopic: carriedTopic,
          selectedChannel: carriedChannel,
          hasSavedItem: !!tp.has_saved_item,
        }))
        if (tp.step && STEPS.includes(tp.step)) {
          setStep(tp.step)
        }
      }
    })()
  }, [router])

  // Persist tutorial progress as user moves through steps. Now writes the
  // full ctx so a mid-flow refresh can recover niche / caption topic / etc.
  const saveProgress = async (nextStep: Step, completed: boolean, ctx: TutorialContext = tutorialCtx) => {
    try {
      await apiFetch('/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          tutorial_progress: {
            step: nextStep,
            completed,
            analysis_id: ctx.analysisId,
            caption_topic: ctx.captionTopic || null,
            niche: ctx.niche || null,
            selected_channel_id: ctx.selectedChannel?.id ?? null,
            has_saved_item: !!ctx.hasSavedItem,
          },
        }),
      })
    } catch {
      // Non-fatal — tutorial state isn't worth blocking on a save failure.
    }
  }

  const goToStep = (next: Step) => {
    setStep(next)
    // Pass a snapshot of the ctx at transition time so the persisted record
    // captures whatever the previous step set on its way out (niche, captionTopic, etc.)
    saveProgress(next, false, tutorialCtx)
  }

  const finish = async (skipped = false) => {
    setFinishing(true)
    try {
      await apiFetch('/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          onboarded_at: new Date().toISOString(),
          tutorial_progress: {
            step: 'save',
            completed: true,
            analysis_id: tutorialCtx.analysisId,
            caption_topic: tutorialCtx.captionTopic || null,
            niche: tutorialCtx.niche || null,
            selected_channel_id: tutorialCtx.selectedChannel?.id ?? null,
            has_saved_item: !!tutorialCtx.hasSavedItem,
          },
        }),
      })
    } catch (err) {
      if (!skipped && err instanceof ApiError) addToast(err.message, 'error')
    } finally {
      router.replace('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-brand-500/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-sm shadow-glow">
            ⚡
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
            PostCrisp
          </span>
        </div>
        <StepIndicator current={step} />
        <button
          onClick={() => finish(true)}
          disabled={finishing}
          className="text-xs sm:text-sm text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
        >
          Skip all
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-3xl">
          {/* STEP 1 — Welcome */}
          {step === 'welcome' && (
            <div className="text-center space-y-6">
              <div className="inline-block w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow flex items-center justify-center text-3xl">
                ✨
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-zinc-100">Welcome, {userFirstName}.</h1>
                <p className="text-zinc-400 mt-4 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
                  We&apos;re going to walk you through the 5 most useful tools in your first 5 minutes — starting
                  with a real audit of one of your channels. By the end you&apos;ll have content saved, a strategy
                  preview, and a feel for what PostCrisp does for you.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto pt-2">
                <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 text-left">
                  <div className="text-2xs font-bold uppercase tracking-wider text-brand-300 mb-1">First</div>
                  <div className="text-sm text-zinc-200 font-semibold">Add your channels</div>
                  <p className="text-xs text-zinc-500 mt-1">So every tool speaks to the right platform.</p>
                </div>
                <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 text-left">
                  <div className="text-2xs font-bold uppercase tracking-wider text-brand-300 mb-1">Then</div>
                  <div className="text-sm text-zinc-200 font-semibold">Analyze a channel</div>
                  <p className="text-xs text-zinc-500 mt-1">On us — your starter credits stay intact.</p>
                </div>
                <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 text-left">
                  <div className="text-2xs font-bold uppercase tracking-wider text-brand-300 mb-1">Finally</div>
                  <div className="text-sm text-zinc-200 font-semibold">Ship a caption</div>
                  <p className="text-xs text-zinc-500 mt-1">Generated, saved to your library, ready to use.</p>
                </div>
              </div>
              <div className="pt-4">
                <Button onClick={() => goToStep('channels')} size="lg">
                  Let&apos;s go →
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2 — Channels */}
          {step === 'channels' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Add your channels</h1>
                <p className="text-zinc-400 mt-2 text-base leading-relaxed">
                  List the social accounts you create content for. We need at least one to run the analysis next.
                  <span className="text-zinc-500"> You can add more in Settings later.</span>
                </p>
              </div>
              <div className="rounded-xl border border-brand-500/20 bg-surface-secondary p-5">
                <ChannelsSection compact onChange={setChannels} />
              </div>
              <div className="flex justify-between items-center pt-2">
                <button onClick={() => goToStep('welcome')} className="text-sm text-zinc-500 hover:text-zinc-300">
                  ← Back
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500">
                    {channels.length === 0 ? 'Add at least one to continue.' : `${channels.length} channel${channels.length === 1 ? '' : 's'}`}
                  </span>
                  <Button onClick={() => goToStep('analyze')} size="lg" disabled={channels.length === 0}>
                    Continue →
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 — Channel Analysis */}
          {step === 'analyze' && (
            <ChannelAnalysisStep
              channels={channels}
              ctx={tutorialCtx}
              setCtx={setTutorialCtx}
              onNext={() => goToStep('captions')}
              onSkip={() => goToStep('captions')}
            />
          )}

          {/* STEP 4 — Captions */}
          {step === 'captions' && (
            <CaptionsStep
              channels={channels}
              ctx={tutorialCtx}
              setCtx={setTutorialCtx}
              onNext={() => goToStep('hashtags')}
              onSkip={() => goToStep('hashtags')}
            />
          )}

          {/* STEP 5 — Hashtags */}
          {step === 'hashtags' && (
            <HashtagsStep
              channels={channels}
              ctx={tutorialCtx}
              setCtx={setTutorialCtx}
              onNext={() => goToStep('viral')}
              onSkip={() => goToStep('viral')}
            />
          )}

          {/* STEP 6 — Viral Ideas */}
          {step === 'viral' && (
            <ViralIdeasStep
              channels={channels}
              ctx={tutorialCtx}
              setCtx={setTutorialCtx}
              onNext={() => goToStep('save')}
              onSkip={() => goToStep('save')}
            />
          )}

          {/* STEP 7 — Save / wrap-up */}
          {step === 'save' && (
            <SaveStep
              channels={channels}
              ctx={tutorialCtx}
              setCtx={setTutorialCtx}
              onNext={() => finish(false)}
              onSkip={() => finish(true)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
