'use client'

import { useEffect, useState } from 'react'
import { apiFetch, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { CHANNEL_PLATFORMS, PLATFORM_META, type Channel, type ChannelPlatform } from '@/lib/channels'

interface ChannelsSectionProps {
  /** Compact mode reduces padding + hides the descriptive help text. Useful inside a settings card. */
  compact?: boolean
  /** Fires whenever the channel list changes, so the parent can refresh dependent data. */
  onChange?: (channels: Channel[]) => void
}

export function ChannelsSection({ compact = false, onChange }: ChannelsSectionProps) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [platform, setPlatform] = useState<ChannelPlatform>('instagram')
  const [handle, setHandle] = useState('')
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const { addToast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const res = await apiFetch<{ channels: Channel[] }>('/api/channels')
      setChannels(res.channels)
      onChange?.(res.channels)
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Failed to load channels', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    setPlatform('instagram')
    setHandle('')
    setLabel('')
    setUrl('')
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (c: Channel) => {
    setEditingId(c.id)
    setPlatform(c.platform)
    setHandle(c.handle)
    setLabel(c.label ?? '')
    setUrl(c.url ?? '')
    setShowForm(true)
  }

  const save = async () => {
    if (!handle.trim()) {
      addToast('Handle is required', 'error')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await apiFetch(`/api/channels/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({ platform, handle: handle.trim(), label: label.trim() || null, url: url.trim() || null }),
        })
        addToast('Channel updated', 'success')
      } else {
        await apiFetch('/api/channels', {
          method: 'POST',
          body: JSON.stringify({ platform, handle: handle.trim(), label: label.trim() || null, url: url.trim() || null }),
        })
        addToast('Channel added', 'success')
      }
      resetForm()
      await load()
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string, handle: string) => {
    if (!window.confirm(`Remove ${handle}?`)) return
    try {
      await apiFetch(`/api/channels/${id}`, { method: 'DELETE' })
      addToast('Channel removed', 'success')
      await load()
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Remove failed', 'error')
    }
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <p className="text-sm text-zinc-500">
          List every account you create content for. PostCrisp uses these to organize your library,
          preselect the right platform in tools, and personalize your dashboard.
        </p>
      )}

      {loading && <div className="h-20 rounded-lg bg-surface-tertiary/50 animate-pulse" />}

      {!loading && channels.length === 0 && !showForm && (
        <div className="rounded-lg border border-dashed border-brand-500/20 bg-surface-tertiary/30 p-6 text-center">
          <p className="text-sm text-zinc-400 mb-3">No channels added yet.</p>
          <Button size="sm" onClick={() => setShowForm(true)}>
            + Add your first channel
          </Button>
        </div>
      )}

      {!loading && channels.length > 0 && (
        <div className="space-y-2">
          {channels.map((c) => {
            const meta = PLATFORM_META[c.platform]
            return (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-brand-500/10 bg-surface-tertiary/40 p-3 hover:border-brand-500/20 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${meta.chip.split(' ').slice(0, 2).join(' ')}`}>
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-zinc-200 truncate">{c.handle}</span>
                      <span className={`text-2xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${meta.chip}`}>
                        {meta.label}
                      </span>
                    </div>
                    {c.label && <div className="text-xs text-zinc-500 truncate">{c.label}</div>}
                    {c.url && (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-2xs text-zinc-600 hover:text-brand-300 truncate block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.url}
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => startEdit(c)}
                    className="text-xs text-zinc-500 hover:text-brand-300 px-2 py-1"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(c.id, c.handle)}
                    className="text-xs text-zinc-500 hover:text-red-400 px-2 py-1"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <div className="rounded-lg border border-brand-500/30 bg-brand-500/5 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as ChannelPlatform)}
                className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-brand-500/40"
              >
                {CHANNEL_PLATFORMS.map((p) => (
                  <option key={p} value={p}>{PLATFORM_META[p].icon} {PLATFORM_META[p].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">
                Handle <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@alex.main"
                maxLength={120}
                className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-3 py-2 text-sm focus:outline-none focus:border-brand-500/40"
                autoFocus
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Label (optional)</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Main account, BTS clips…"
                maxLength={80}
                className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-3 py-2 text-sm focus:outline-none focus:border-brand-500/40"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Profile URL (optional)</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                maxLength={500}
                className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-3 py-2 text-sm focus:outline-none focus:border-brand-500/40 font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={resetForm} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} loading={saving}>
              {editingId ? 'Save changes' : 'Add channel'}
            </Button>
          </div>
        </div>
      )}

      {!showForm && channels.length > 0 && (
        <div>
          <Button size="sm" variant="secondary" onClick={() => setShowForm(true)}>
            + Add another channel
          </Button>
        </div>
      )}
    </div>
  )
}
