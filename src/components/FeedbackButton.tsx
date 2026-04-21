'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { apiFetch, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

type Category = 'bug' | 'feature' | 'general'

const CATEGORY_META: Record<Category, { label: string; icon: string }> = {
  bug:     { label: 'Bug',     icon: '🐛' },
  feature: { label: 'Idea',    icon: '💡' },
  general: { label: 'General', icon: '💬' },
}

export function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [category, setCategory] = useState<Category>('bug')
  const [submitting, setSubmitting] = useState(false)
  const pathname = usePathname()
  const { addToast } = useToast()

  const close = () => {
    setOpen(false)
    setMessage('')
    setCategory('bug')
  }

  const submit = async () => {
    if (!message.trim()) {
      addToast('Please write a message first.', 'error')
      return
    }
    setSubmitting(true)
    try {
      await apiFetch('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({
          message: message.trim(),
          category,
          url: pathname,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        }),
      })
      addToast('Thanks — feedback received.', 'success')
      close()
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Failed to send feedback', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Floating action button — always visible in the app */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-900/40 px-4 py-3 text-sm font-semibold transition-all hover:scale-105"
        aria-label="Send feedback"
      >
        <span className="text-lg leading-none">💬</span>
        <span className="hidden sm:inline">Feedback</span>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={close}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-surface-secondary border border-brand-500/20 shadow-glow p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-zinc-100">Send feedback</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Help us make PostCrisp better. Every message reaches the team.
                </p>
              </div>
              <button
                onClick={close}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-surface-hover transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Category pills */}
            <div className="flex gap-2 mb-4">
              {(Object.keys(CATEGORY_META) as Category[]).map((c) => {
                const meta = CATEGORY_META[c]
                const active = category === c
                return (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-brand-500/15 border border-brand-500/30 text-brand-200'
                        : 'bg-surface-tertiary border border-brand-500/5 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span>{meta.icon}</span>
                    <span>{meta.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Message */}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                category === 'bug'
                  ? "What broke? The more detail the better — what you clicked, what happened, what you expected."
                  : category === 'feature'
                    ? "What would make PostCrisp better for you?"
                    : "What's on your mind?"
              }
              rows={6}
              maxLength={5000}
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40 resize-none"
              autoFocus
            />
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-2xs text-zinc-600">
                We capture the page you&apos;re on + your browser automatically — no need to include them.
              </p>
              <span className="text-2xs text-zinc-600 tabular-nums">{message.length}/5000</span>
            </div>

            <div className="flex gap-2 mt-5 justify-end">
              <button
                onClick={close}
                disabled={submitting}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting || !message.trim()}
                className="px-5 py-2 text-sm font-semibold bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {submitting ? 'Sending…' : 'Send feedback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
