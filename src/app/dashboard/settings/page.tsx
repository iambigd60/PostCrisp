'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { apiFetch, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { PLATFORMS, TONES } from '@/lib/constants'

interface Profile {
  id: string
  email: string
  full_name: string | null
  subscription_tier: string
  preferences: {
    default_platform?: string
    default_tone?: string
    default_audience?: string
    email_notifications?: boolean
    usage_reminders?: boolean
    channels?: Record<string, string>
  } | null
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
        {description && <p className="text-sm text-zinc-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function Initials({ name, email }: { name: string | null; email: string }) {
  const text = name
    ? name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : email.slice(0, 2).toUpperCase()
  return (
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-xl font-bold text-white shadow-glow flex-shrink-0">
      {text}
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer group">
      <span className="text-sm text-zinc-300 group-hover:text-zinc-200 transition-colors">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-brand-600' : 'bg-surface-elevated'}`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </label>
  )
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Profile form
  const [fullName, setFullName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Preferences form
  const [defaultPlatform, setDefaultPlatform] = useState('instagram')
  const [defaultTone, setDefaultTone] = useState('casual')
  const [defaultAudience, setDefaultAudience] = useState('')
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [usageReminders, setUsageReminders] = useState(true)
  const [savingPrefs, setSavingPrefs] = useState(false)

  // Channel URLs
  const [channels, setChannels] = useState({
    instagram: '', tiktok: '', youtube: '', x: '', facebook: '', threads: '', linkedin: '', website: '',
  })
  const [savingChannels, setSavingChannels] = useState(false)

  // Delete account modal
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  const [sendingReset, setSendingReset] = useState(false)
  const [exporting, setExporting] = useState(false)

  const { addToast } = useToast()
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from('profiles')
        .select('id, email, full_name, subscription_tier, preferences')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile(data as Profile)
        setFullName(data.full_name ?? '')
        const prefs = (data as Profile).preferences ?? {}
        setDefaultPlatform(prefs.default_platform ?? 'instagram')
        setDefaultTone(prefs.default_tone ?? 'casual')
        setDefaultAudience(prefs.default_audience ?? '')
        setEmailNotifications(prefs.email_notifications ?? true)
        setUsageReminders(prefs.usage_reminders ?? true)
        const savedChannels = (prefs.channels as Record<string, string> | undefined) ?? {}
        setChannels({
          instagram: savedChannels.instagram ?? '',
          tiktok:    savedChannels.tiktok    ?? '',
          youtube:   savedChannels.youtube   ?? '',
          x:         savedChannels.x         ?? '',
          facebook:  savedChannels.facebook  ?? '',
          threads:   savedChannels.threads   ?? '',
          linkedin:  savedChannels.linkedin  ?? '',
          website:   savedChannels.website   ?? '',
        })
      }
      setLoading(false)
    })
  }, [])

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      await apiFetch('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ full_name: fullName }),
      })
      setProfile((p) => p ? { ...p, full_name: fullName } : p)
      addToast('Profile saved', 'success')
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Failed to save profile', 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSavePreferences = async () => {
    setSavingPrefs(true)
    try {
      await apiFetch('/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          default_platform: defaultPlatform,
          default_tone: defaultTone,
          default_audience: defaultAudience,
          email_notifications: emailNotifications,
          usage_reminders: usageReminders,
        }),
      })
      addToast('Preferences saved', 'success')
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Failed to save preferences', 'error')
    } finally {
      setSavingPrefs(false)
    }
  }

  const handleSaveChannels = async () => {
    setSavingChannels(true)
    try {
      await apiFetch('/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify({ channels }),
      })
      addToast('Channel URLs saved', 'success')
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Failed to save channels', 'error')
    } finally {
      setSavingChannels(false)
    }
  }

  const handlePasswordReset = async () => {
    if (!profile?.email) return
    setSendingReset(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      })
      if (error) throw error
      addToast('Password reset email sent — check your inbox', 'success')
    } catch {
      addToast('Failed to send reset email', 'error')
    } finally {
      setSendingReset(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/user/export')
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `postcrisp-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      addToast('Data exported', 'success')
    } catch {
      addToast('Failed to export data', 'error')
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    try {
      await apiFetch('/api/user/account', { method: 'DELETE' })
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/')
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Failed to delete account', 'error')
      setDeleting(false)
      setShowDelete(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 rounded-xl bg-surface-secondary animate-pulse" />
        ))}
      </div>
    )
  }

  const inputCls = 'w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500/40 focus:ring-1 focus:ring-brand-500/20 transition-colors'
  const labelCls = 'block text-sm font-medium text-zinc-300 mb-1.5'

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Settings</h1>
        <p className="text-zinc-500 mt-1">Manage your account and preferences.</p>
      </div>

      {/* Profile */}
      <SectionCard title="Profile" description="Your public profile information.">
        <div className="flex items-center gap-4">
          <Initials name={profile?.full_name ?? null} email={profile?.email ?? ''} />
          <div>
            <p className="text-sm font-medium text-zinc-200">{profile?.full_name || 'No name set'}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{profile?.email}</p>
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="full_name">Full Name</label>
          <input
            id="full_name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Doe"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Email</label>
          <input
            type="email"
            value={profile?.email ?? ''}
            disabled
            className={`${inputCls} opacity-50 cursor-not-allowed`}
          />
          <p className="text-xs text-zinc-600 mt-1">Email cannot be changed here.</p>
        </div>

        <Button onClick={handleSaveProfile} loading={savingProfile} disabled={!fullName.trim()}>
          Save Changes
        </Button>
      </SectionCard>

      {/* Preferences */}
      <SectionCard title="Default Preferences" description="These defaults pre-fill the generator forms.">
        <div>
          <label className={labelCls}>Default Platform</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setDefaultPlatform(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  defaultPlatform === p.id
                    ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                    : 'bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover'
                }`}
              >
                <p.icon className="w-4 h-4" style={{ color: p.color }} /> {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Default Tone</label>
          <div className="flex flex-wrap gap-2">
            {TONES.map((t) => (
              <button
                key={t.id}
                onClick={() => setDefaultTone(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  defaultTone === t.id
                    ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                    : 'bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover'
                }`}
              >
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="default_audience">Default Target Audience</label>
          <input
            id="default_audience"
            type="text"
            value={defaultAudience}
            onChange={(e) => setDefaultAudience(e.target.value)}
            placeholder="e.g., fitness enthusiasts aged 25-35"
            className={inputCls}
          />
        </div>

        <div className="space-y-3 pt-1 border-t border-brand-500/10">
          <p className="text-sm font-medium text-zinc-300">Notifications</p>
          <Toggle
            checked={emailNotifications}
            onChange={setEmailNotifications}
            label="Weekly tips and new feature emails"
          />
          <Toggle
            checked={usageReminders}
            onChange={setUsageReminders}
            label="Daily usage reminder"
          />
        </div>

        <Button onClick={handleSavePreferences} loading={savingPrefs}>
          Save Preferences
        </Button>
      </SectionCard>

      {/* Channel URLs */}
      <SectionCard
        title="Your Channel URLs"
        description="Saved here once, used automatically by YouTube SEO, Brand Pitch, and other features that reference your channels."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            { key: 'instagram', label: 'Instagram',    placeholder: 'https://instagram.com/yourhandle' },
            { key: 'tiktok',    label: 'TikTok',       placeholder: 'https://tiktok.com/@yourhandle' },
            { key: 'youtube',   label: 'YouTube',      placeholder: 'https://youtube.com/@yourchannel' },
            { key: 'x',         label: 'X',            placeholder: 'https://x.com/yourhandle' },
            { key: 'facebook',  label: 'Facebook',     placeholder: 'https://facebook.com/yourpage' },
            { key: 'threads',   label: 'Threads',      placeholder: 'https://threads.net/@yourhandle' },
            { key: 'linkedin',  label: 'LinkedIn',     placeholder: 'https://linkedin.com/in/yourprofile' },
            { key: 'website',   label: 'Website / link-in-bio', placeholder: 'https://yoursite.com' },
          ] as const).map((c) => (
            <div key={c.key}>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">{c.label}</label>
              <input
                value={channels[c.key]}
                onChange={(e) => setChannels({ ...channels, [c.key]: e.target.value })}
                placeholder={c.placeholder}
                className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-3 py-2 text-sm focus:outline-none focus:border-brand-500/40"
              />
            </div>
          ))}
        </div>
        <Button onClick={handleSaveChannels} loading={savingChannels}>
          Save Channel URLs
        </Button>
      </SectionCard>

      {/* Account */}
      <SectionCard title="Account" description="Manage your account data and security.">
        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="secondary" onClick={handlePasswordReset} loading={sendingReset}>
            🔑 Change Password
          </Button>
          <Button variant="secondary" onClick={handleExport} loading={exporting}>
            📦 Export My Data
          </Button>
        </div>

        <div className="pt-4 border-t border-red-500/10">
          <h3 className="text-sm font-semibold text-red-400 mb-1">Danger Zone</h3>
          <p className="text-xs text-zinc-500 mb-3">
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
          <Button variant="danger" onClick={() => setShowDelete(true)}>
            🗑 Delete Account
          </Button>
        </div>
      </SectionCard>

      {/* Delete confirmation modal */}
      <Modal isOpen={showDelete} onClose={() => { setShowDelete(false); setDeleteConfirm('') }} title="Delete Account">
        <p className="text-sm text-zinc-400 mb-4">
          This will permanently delete your account, all generated content, and all saved data. This action <strong className="text-zinc-200">cannot be undone</strong>.
        </p>
        <p className="text-sm text-zinc-400 mb-2">
          Type <strong className="text-red-400 font-mono">DELETE</strong> to confirm:
        </p>
        <input
          type="text"
          value={deleteConfirm}
          onChange={(e) => setDeleteConfirm(e.target.value)}
          placeholder="DELETE"
          className="w-full rounded-lg bg-surface-primary border border-red-500/20 text-zinc-200 placeholder:text-zinc-600 px-4 py-2.5 text-sm focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-colors mb-5 font-mono"
        />
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={() => { setShowDelete(false); setDeleteConfirm('') }}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={deleting}
            disabled={deleteConfirm !== 'DELETE'}
            onClick={handleDeleteAccount}
          >
            Delete My Account
          </Button>
        </div>
      </Modal>
    </div>
  )
}
