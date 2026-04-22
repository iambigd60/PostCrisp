'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { apiFetch, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { ChannelsSection } from '@/components/ChannelsSection'
import type { Channel } from '@/lib/channels'

type Step = 'welcome' | 'channels' | 'features'

interface ImpactFeature {
  id: string
  icon: string
  title: string
  oneLine: string
  eta: string
  tryHref: string
  tryLabel: string
  // Per-channel niche hint for the prefill. We pass via query string so the
  // destination tool can auto-populate form inputs (only captions supports
  // this today — others land on the tool unprefilled).
  supportsPrefill?: boolean
}

const IMPACT_FEATURES: ImpactFeature[] = [
  {
    id: 'captions',
    icon: '✍️',
    title: 'Captions',
    oneLine: 'Turn a topic + platform into on-brand captions in seconds.',
    eta: '~30 seconds to first output',
    tryHref: '/dashboard/generate',
    tryLabel: 'Try Captions',
    supportsPrefill: true,
  },
  {
    id: 'viral-ideas',
    icon: '🚀',
    title: 'Viral Ideas',
    oneLine: 'End the blank-page problem. Get 10 specific, on-niche content ideas.',
    eta: '~60 seconds',
    tryHref: '/dashboard/viral-ideas',
    tryLabel: 'Try Viral Ideas',
  },
  {
    id: 'hashtags',
    icon: '🏷️',
    title: 'Hashtags',
    oneLine: 'Mix popular + niche tags for reach without looking generic.',
    eta: '~20 seconds',
    tryHref: '/dashboard/hashtags',
    tryLabel: 'Try Hashtags',
  },
  {
    id: 'best-times',
    icon: '⏰',
    title: 'Best Posting Times',
    oneLine: 'A heatmap of when your audience is actually online + engaged.',
    eta: '~45 seconds',
    tryHref: '/dashboard/best-times',
    tryLabel: 'Try Best Times',
  },
  {
    id: 'bio',
    icon: '🧬',
    title: 'Bio Optimizer',
    oneLine: 'Rewrite your profile bio for clicks, follows, or conversions.',
    eta: '~30 seconds',
    tryHref: '/dashboard/bio-optimizer',
    tryLabel: 'Try Bio Optimizer',
  },
  {
    id: 'repurpose',
    icon: '♻️',
    title: 'Repurpose',
    oneLine: 'One long-form post becomes five platform-ready versions.',
    eta: 'bring existing content',
    tryHref: '/dashboard/repurpose',
    tryLabel: 'Try Repurpose',
  },
]

function StepIndicator({ current }: { current: Step }) {
  const steps: Step[] = ['welcome', 'channels', 'features']
  const labels: Record<Step, string> = { welcome: 'Welcome', channels: 'Channels', features: 'Try it' }
  const currentIdx = steps.indexOf(current)

  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => {
        const active = s === current
        const done = i < currentIdx
        return (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                done
                  ? 'bg-brand-500/15 text-brand-300 border-brand-500/30'
                  : active
                    ? 'bg-brand-500/10 text-brand-200 border-brand-500/40 shadow-glow'
                    : 'bg-surface-secondary text-zinc-500 border-brand-500/5'
              }`}
            >
              <span>{done ? '✓' : i + 1}</span>
              <span className="hidden sm:inline">{labels[s]}</span>
            </div>
            {i < steps.length - 1 && <div className="w-4 h-px bg-brand-500/20" />}
          </div>
        )
      })}
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('welcome')
  const [userFirstName, setUserFirstName] = useState<string>('there')
  const [channels, setChannels] = useState<Channel[]>([])
  const [saving, setSaving] = useState(false)
  const { addToast } = useToast()

  // Fetch first name on mount. If user is already onboarded (dev/manual access),
  // we don't redirect — we let them re-experience the wizard on demand.
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
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()
      const name = profile?.full_name?.split(' ')[0]?.trim()
      if (name) setUserFirstName(name)
    })()
  }, [router])

  const finish = async (skip = false) => {
    setSaving(true)
    try {
      await apiFetch('/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify({ onboarded_at: new Date().toISOString() }),
      })
      router.replace('/dashboard')
    } catch (err) {
      // Still send them to the dashboard — don't hold them hostage on a save error.
      if (!skip && err instanceof ApiError) addToast(err.message, 'error')
      router.replace('/dashboard')
    } finally {
      setSaving(false)
    }
  }

  const skipEverything = () => finish(true)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-brand-500/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-sm shadow-glow">
            ⚡
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
            PostCrisp
          </span>
        </div>
        <StepIndicator current={step} />
        <button onClick={skipEverything} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          Skip for now
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 py-8 sm:py-16">
        <div className="w-full max-w-3xl">
          {step === 'welcome' && (
            <div className="text-center space-y-6">
              <div className="inline-block w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow flex items-center justify-center text-3xl">
                ✨
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-zinc-100">Welcome to PostCrisp, {userFirstName}.</h1>
                <p className="text-zinc-400 mt-4 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
                  You&apos;re about to go from staring at a blank caption box to shipping better content faster,
                  on every platform you post to. Two minutes to set up, then you&apos;re writing.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto pt-2">
                <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 text-left">
                  <div className="text-2xs font-bold uppercase tracking-wider text-brand-300 mb-1">Step 1</div>
                  <div className="text-sm text-zinc-200 font-semibold">Add your channels</div>
                  <p className="text-xs text-zinc-500 mt-1">So every tool speaks to the right platform + audience.</p>
                </div>
                <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 text-left">
                  <div className="text-2xs font-bold uppercase tracking-wider text-brand-300 mb-1">Step 2</div>
                  <div className="text-sm text-zinc-200 font-semibold">Pick a first feature</div>
                  <p className="text-xs text-zinc-500 mt-1">Six features that deliver value within 30 seconds.</p>
                </div>
                <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 text-left">
                  <div className="text-2xs font-bold uppercase tracking-wider text-brand-300 mb-1">Step 3</div>
                  <div className="text-sm text-zinc-200 font-semibold">Ship content</div>
                  <p className="text-xs text-zinc-500 mt-1">Your first output shows up in your library automatically.</p>
                </div>
              </div>
              <div className="pt-4">
                <Button onClick={() => setStep('channels')} size="lg">
                  Let&apos;s go →
                </Button>
              </div>
            </div>
          )}

          {step === 'channels' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Add your channels</h1>
                <p className="text-zinc-400 mt-2 text-base leading-relaxed">
                  List the social accounts you create content for. PostCrisp uses these to preselect the right
                  platform in every tool, organize your library by brand, and personalize your dashboard.
                  <span className="text-zinc-500"> You can add more later in Settings.</span>
                </p>
              </div>
              <div className="rounded-xl border border-brand-500/20 bg-surface-secondary p-5">
                <ChannelsSection compact onChange={setChannels} />
              </div>
              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={() => setStep('welcome')}
                  className="text-sm text-zinc-500 hover:text-zinc-300"
                >
                  ← Back
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500">
                    {channels.length === 0 ? "You can skip this and add them later." : `${channels.length} channel${channels.length === 1 ? '' : 's'} added`}
                  </span>
                  <Button onClick={() => setStep('features')} size="lg">
                    Continue →
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 'features' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Pick a first feature to try</h1>
                <p className="text-zinc-400 mt-2 text-base leading-relaxed">
                  These six tools deliver value within a minute. Pick one to try first — the rest stay in the
                  sidebar. You can&apos;t break anything.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {IMPACT_FEATURES.map((f) => {
                  // Pick a niche hint from the first channel's handle, if any, to prefill
                  // when the destination tool supports it.
                  const nicheHint = channels[0]?.label ?? channels[0]?.handle ?? ''
                  const platform = channels[0]?.platform ?? ''
                  const prefillQuery = f.supportsPrefill && (nicheHint || platform)
                    ? `?topic=${encodeURIComponent(nicheHint || 'your niche')}${platform ? `&platform=${encodeURIComponent(platform)}` : ''}&from=onboarding`
                    : '?from=onboarding'
                  return (
                    <Link
                      key={f.id}
                      href={`${f.tryHref}${prefillQuery}`}
                      onClick={() => {
                        // Mark onboarded before leaving so the user lands on the tool
                        // already-onboarded — won't be bounced back here.
                        apiFetch('/api/user/preferences', {
                          method: 'PUT',
                          body: JSON.stringify({ onboarded_at: new Date().toISOString() }),
                        }).catch(() => { /* non-fatal */ })
                      }}
                      className="group rounded-xl border border-brand-500/15 bg-surface-secondary hover:border-brand-500/40 hover:bg-surface-elevated transition-all p-5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center text-2xl flex-shrink-0">
                          {f.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-base font-bold text-zinc-100 group-hover:text-brand-200 transition-colors">
                              {f.title}
                            </h3>
                            <span className="text-2xs text-zinc-600 whitespace-nowrap">{f.eta}</span>
                          </div>
                          <p className="text-sm text-zinc-400 mt-1 leading-snug">{f.oneLine}</p>
                          <span className="inline-block text-xs text-brand-400 font-medium mt-2 group-hover:text-brand-300">
                            {f.tryLabel} →
                          </span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>

              <div className="rounded-xl border border-brand-500/10 bg-surface-secondary/60 p-4 text-xs text-zinc-500">
                Or browse the full feature list from the sidebar whenever you&apos;re ready — there are 20+ tools
                across Create, Optimize, Grow, and Monetize.
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={() => setStep('channels')}
                  className="text-sm text-zinc-500 hover:text-zinc-300"
                >
                  ← Back
                </button>
                <Button onClick={() => finish()} loading={saving} variant="secondary" size="lg">
                  I&apos;ll explore on my own
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
