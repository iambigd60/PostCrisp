'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { apiFetch, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import {
  ALPHA_AGREEMENT_TITLE,
  ALPHA_AGREEMENT_SECTIONS,
  ALPHA_AGREEMENT_VERSION,
  ALPHA_AGREEMENT_EFFECTIVE_DATE,
} from '@/lib/alpha-agreement'

// Outer wrapper adds the Suspense boundary Next.js 14 requires around any
// client component that reads useSearchParams — otherwise the static-export
// pass during `next build` throws a prerender error.
export default function AcceptTermsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-primary" />}>
      <AcceptTermsPageInner />
    </Suspense>
  )
}

function AcceptTermsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { addToast } = useToast()
  const [profileEmail, setProfileEmail] = useState('')
  const [profileName, setProfileName] = useState('')
  const [typedName, setTypedName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      setProfileEmail(user.email ?? '')
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.full_name) setProfileName(profile.full_name)
    })()
  }, [router])

  const canSubmit = agreed && typedName.trim().length >= 2 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      // Server-only endpoint — captures accepted_at, version, and user_agent
      // server-side so the legal audit trail can't be forged from the client.
      await apiFetch('/api/user/alpha-acceptance', {
        method: 'POST',
        body: JSON.stringify({
          full_name: typedName.trim(),
          agreed: true,
        }),
      })
      addToast('Thanks — agreement accepted. Welcome in.', 'success')
      const next = searchParams?.get('next') || '/dashboard'
      router.replace(next)
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Failed to save acceptance', 'error')
      setSubmitting(false)
    }
  }

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
        <span className="text-xs text-zinc-500">Signed in as {profileEmail}</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-3xl space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-block w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow flex items-center justify-center text-2xl">
              📜
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">{ALPHA_AGREEMENT_TITLE}</h1>
            <p className="text-sm text-zinc-500">
              PostCrisp is in pre-release beta. Before you get access, please read and accept this
              agreement. It keeps what we&apos;re building private while we ship.
            </p>
            <div className="text-2xs text-zinc-600">
              Version {ALPHA_AGREEMENT_VERSION} · Effective {ALPHA_AGREEMENT_EFFECTIVE_DATE} · Crusher Brands, LLC
            </div>
          </div>

          {/* Agreement body — scrollable */}
          <div className="rounded-xl border border-brand-500/20 bg-surface-secondary max-h-[450px] overflow-y-auto p-5 sm:p-6 space-y-5">
            <p className="text-sm text-zinc-400 leading-relaxed">
              This Agreement is made between <strong className="text-zinc-200">Crusher Brands, LLC</strong> (&ldquo;Company&rdquo;)
              and you, the beta tester. It is effective on the date you sign below.
            </p>
            {ALPHA_AGREEMENT_SECTIONS.map((section) => (
              <section key={section.heading} className="space-y-2">
                <h2 className="text-sm font-bold text-brand-300">{section.heading}</h2>
                {section.paragraphs.map((p, i) => (
                  <p key={i} className="text-sm text-zinc-300 leading-relaxed">{p}</p>
                ))}
                {section.bullets && (
                  <ul className="list-disc pl-5 space-y-1.5 text-sm text-zinc-300 leading-relaxed">
                    {section.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          {/* Signature block */}
          <div className="rounded-xl border border-brand-500/20 bg-surface-secondary p-5 sm:p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Your full legal name (typed signature)
              </label>
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder={profileName || 'e.g. Alex Kim'}
                maxLength={200}
                className="w-full rounded-lg bg-surface-primary border border-brand-500/20 text-zinc-100 placeholder:text-zinc-600 px-4 py-3 text-base focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50 font-mono"
                autoComplete="name"
              />
              <p className="text-2xs text-zinc-600 mt-1.5">
                Typing your name here has the same legal effect as signing a paper contract, under the U.S. ESIGN Act.
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded border-brand-500/30 bg-surface-primary text-brand-500 accent-brand-500 focus:ring-brand-500 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-sm text-zinc-200 leading-relaxed select-none group-hover:text-zinc-100 transition-colors">
                I have read and agree to the {ALPHA_AGREEMENT_TITLE} above. I understand PostCrisp is a pre-release
                product of <strong>Crusher Brands, LLC</strong> and I&apos;ll keep its features, bugs, and roadmap
                confidential per the terms above.
              </span>
            </label>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="text-xs text-zinc-500">
              Declining? Close this tab. No account is created without acceptance.
            </p>
            <Button onClick={handleSubmit} disabled={!canSubmit} loading={submitting} size="lg">
              Accept and continue →
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
