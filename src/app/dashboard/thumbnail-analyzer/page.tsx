'use client'

import { useState, useRef } from 'react'
import { apiFetch, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

interface Improvement {
  priority: 'high' | 'medium' | 'low'
  change: string
  why: string
}

interface ThumbnailAnalysisResult {
  clickPrediction: { score: number; reasoning: string }
  visualHierarchy: string
  textLegibility: { issues: string[]; score: number }
  emotionalHook: string
  subjectFraming: string
  colorContrast: string
  platformFit: string
  strengths: string[]
  improvements: Improvement[]
}

const PLATFORMS = [
  { id: 'youtube', label: 'YouTube', hint: '1280×720, sidebar shows at ~240px wide' },
  { id: 'instagram', label: 'Instagram', hint: 'Grid shows at ~120px square' },
  { id: 'tiktok', label: 'TikTok', hint: 'Full-screen feed, vertical 9:16' },
  { id: 'x', label: 'X / Twitter', hint: 'Inline media at ~500px wide' },
  { id: 'linkedin', label: 'LinkedIn', hint: 'Feed shows at ~550px wide' },
  { id: 'facebook', label: 'Facebook', hint: 'Feed shows at ~470px wide' },
]

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 5 * 1024 * 1024  // 5 MB

// Flatten the structured analysis into readable text the saved-content
// table can store (column is plain TEXT, not JSONB). Markdown-style so it
// renders with reasonable hierarchy in the Saved library.
function formatAnalysisAsText(result: ThumbnailAnalysisResult, platform: string, topic?: string): string {
  const lines: string[] = []
  lines.push(`# Thumbnail Analysis — ${platform}${topic ? ` · ${topic}` : ''}`)
  lines.push('')
  lines.push(`## Click Prediction: ${result.clickPrediction.score}/10`)
  lines.push(result.clickPrediction.reasoning)
  lines.push('')
  if (result.strengths.length > 0) {
    lines.push(`## What's Working`)
    result.strengths.forEach((s) => lines.push(`- ${s}`))
    lines.push('')
  }
  if (result.improvements.length > 0) {
    lines.push(`## Specific Improvements`)
    result.improvements.forEach((imp, i) => {
      lines.push(`${i + 1}. [${imp.priority.toUpperCase()}] ${imp.change}`)
      lines.push(`   Why: ${imp.why}`)
    })
    lines.push('')
  }
  lines.push(`## Visual Analysis`)
  lines.push(`- **Hierarchy:** ${result.visualHierarchy}`)
  lines.push(`- **Text legibility (${result.textLegibility.score}/10):** ${result.textLegibility.issues.length > 0 ? result.textLegibility.issues.join('; ') : 'No issues detected.'}`)
  lines.push(`- **Emotional hook:** ${result.emotionalHook}`)
  lines.push(`- **Subject framing:** ${result.subjectFraming}`)
  lines.push(`- **Color contrast:** ${result.colorContrast}`)
  lines.push(`- **Platform fit:** ${result.platformFit}`)
  return lines.join('\n')
}

export default function ThumbnailAnalyzerPage() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [platform, setPlatform] = useState('youtube')
  const [topic, setTopic] = useState('')
  const [audience, setAudience] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<ThumbnailAnalysisResult | null>(null)
  const [progressStage, setProgressStage] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { addToast } = useToast()

  const handleFileSelect = (selected: File | null) => {
    if (!selected) return
    if (!ALLOWED_TYPES.includes(selected.type)) {
      addToast('Use JPEG, PNG, WebP, or GIF.', 'error')
      return
    }
    if (selected.size > MAX_BYTES) {
      addToast('Image too large. Maximum 5 MB.', 'error')
      return
    }
    setFile(selected)
    setResult(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(selected))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) handleFileSelect(dropped)
  }

  const fileToBase64 = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        // strip "data:image/...;base64," prefix
        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
        resolve(base64)
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(f)
    })

  // Cycle progress stages so the user knows the tab isn't dead during the
  // 15-30s vision call. Resets when analyze completes.
  const startProgressTicker = () => {
    setProgressStage(0)
    const stages = 5
    const interval = setInterval(() => {
      setProgressStage((s) => (s >= stages - 1 ? s : s + 1))
    }, 5000)
    return () => clearInterval(interval)
  }

  const handleAnalyze = async () => {
    if (!file) {
      addToast('Upload a thumbnail first.', 'error')
      return
    }
    setAnalyzing(true)
    setResult(null)
    setSaved(false)
    const stopTicker = startProgressTicker()
    try {
      const imageBase64 = await fileToBase64(file)
      const res = await apiFetch<ThumbnailAnalysisResult>('/api/thumbnail-analyzer', {
        method: 'POST',
        body: JSON.stringify({
          imageBase64,
          mediaType: file.type,
          platform,
          topic: topic.trim() || undefined,
          audience: audience.trim() || undefined,
        }),
        timeout: 120000,
      })
      setResult(res)
      addToast('Thumbnail analyzed', 'success')
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Analysis failed', 'error')
    } finally {
      stopTicker()
      setAnalyzing(false)
    }
  }

  const handleSave = async () => {
    if (!result) return
    setSaving(true)
    try {
      const platformLabel = PLATFORMS.find((p) => p.id === platform)?.label ?? platform
      await apiFetch('/api/saved', {
        method: 'POST',
        body: JSON.stringify({
          type: 'thumbnail_analysis',
          content: formatAnalysisAsText(result, platformLabel, topic.trim() || undefined),
          platform,
          topic: topic.trim() || `Thumbnail — ${platformLabel}`,
        }),
      })
      setSaved(true)
      addToast('Analysis saved to your library', 'success')
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  const stages = [
    'Reading your thumbnail…',
    'Mapping visual hierarchy…',
    'Checking text legibility for ' + (PLATFORMS.find((p) => p.id === platform)?.label ?? platform) + '…',
    'Analyzing emotional hook + framing…',
    'Drafting your improvements…',
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Thumbnail Analyzer</h1>
        <p className="text-zinc-500 mt-1">
          Upload a thumbnail or hero image. We critique the click-stopping power and tell you exactly what to change.
        </p>
      </div>

      {/* Upload area */}
      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
        />

        {!previewUrl ? (
          <div
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-brand-500/30 hover:border-brand-500/60 hover:bg-brand-500/5 transition-colors rounded-xl p-10 text-center cursor-pointer"
          >
            <div className="text-3xl mb-2">🖼️</div>
            <div className="text-sm font-semibold text-zinc-200">Click to upload or drag and drop</div>
            <div className="text-xs text-zinc-500 mt-1">JPEG, PNG, WebP, or GIF · Max 5 MB</div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden border border-brand-500/20 bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Thumbnail preview" className="max-h-[400px] w-full object-contain" />
            </div>
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>
                {file?.name} · {file ? (file.size / 1024).toFixed(0) : '0'} KB · {file?.type.split('/')[1].toUpperCase()}
              </span>
              <button
                onClick={() => {
                  if (previewUrl) URL.revokeObjectURL(previewUrl)
                  setPreviewUrl(null)
                  setFile(null)
                  setResult(null)
                }}
                className="text-zinc-500 hover:text-zinc-300"
              >
                Replace
              </button>
            </div>
          </div>
        )}

        {/* Platform selector */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Where will this run?</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  platform === p.id
                    ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                    : 'bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-2xs text-zinc-600 mt-2">
            {PLATFORMS.find((p) => p.id === platform)?.hint}
          </p>
        </div>

        {/* Optional context */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              Topic <span className="text-zinc-600 normal-case">(optional)</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. how I made $10k in a month"
              maxLength={200}
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-3 py-2 text-sm focus:outline-none focus:border-brand-500/40"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              Audience <span className="text-zinc-600 normal-case">(optional)</span>
            </label>
            <input
              type="text"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. solopreneurs, gym beginners"
              maxLength={200}
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-3 py-2 text-sm focus:outline-none focus:border-brand-500/40"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleAnalyze} loading={analyzing} disabled={!file || analyzing} size="lg">
            Analyze thumbnail · 4 credits
          </Button>
        </div>
      </div>

      {/* Progress while analyzing */}
      {analyzing && (
        <div className="rounded-xl border border-brand-500/20 bg-surface-secondary p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-brand-500/30 border-t-brand-500 animate-spin flex-shrink-0" />
            <div className="text-sm text-zinc-200 font-medium flex-1">{stages[progressStage]}</div>
          </div>
          <div className="h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-500 ease-out"
              style={{ width: `${(progressStage + 1) * 18}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500">
            Vision analysis usually takes 15–30 seconds.
          </p>
        </div>
      )}

      {/* Result */}
      {result && !analyzing && (
        <div className="space-y-5">
          {/* Click prediction — hero card */}
          <div className="rounded-xl border border-brand-500/20 bg-surface-secondary shadow-glow p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="text-2xs font-bold uppercase tracking-wider text-brand-300 mb-1">Click prediction</div>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-4xl font-bold ${
                    result.clickPrediction.score >= 8 ? 'text-emerald-300' :
                    result.clickPrediction.score >= 6 ? 'text-brand-300' :
                    result.clickPrediction.score >= 4 ? 'text-amber-300' :
                    'text-red-300'
                  }`}>
                    {result.clickPrediction.score}
                  </span>
                  <span className="text-zinc-500 text-sm">/ 10</span>
                </div>
              </div>
              <div className="flex-1 text-sm text-zinc-200 leading-relaxed pt-2">
                {result.clickPrediction.reasoning}
              </div>
            </div>
          </div>

          {/* Strengths + Improvements */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {result.strengths.length > 0 && (
              <div className="rounded-xl border border-emerald-500/20 bg-surface-secondary p-5 space-y-3">
                <div className="text-2xs font-bold uppercase tracking-wider text-emerald-300">What&apos;s working</div>
                <ul className="space-y-2">
                  {result.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-zinc-300 leading-relaxed flex gap-2">
                      <span className="text-emerald-400 flex-shrink-0">✓</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className={`rounded-xl border border-amber-500/20 bg-surface-secondary p-5 space-y-3 ${result.strengths.length === 0 ? 'lg:col-span-2' : ''}`}>
              <div className="text-2xs font-bold uppercase tracking-wider text-amber-300">Specific improvements</div>
              <ul className="space-y-3">
                {result.improvements.map((imp, i) => {
                  const priorityColor = imp.priority === 'high'
                    ? 'bg-red-500/15 text-red-300 border-red-500/30'
                    : imp.priority === 'medium'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
                  return (
                    <li key={i} className="text-sm text-zinc-300 leading-relaxed">
                      <div className="flex items-start gap-2 mb-1">
                        <span className={`text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${priorityColor} flex-shrink-0`}>
                          {imp.priority}
                        </span>
                        <span className="font-semibold text-zinc-200">{imp.change}</span>
                      </div>
                      <p className="text-xs text-zinc-500 ml-[4.5rem]">{imp.why}</p>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>

          {/* Detail grid — 2-column for the analytical dimensions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              ['Visual hierarchy', result.visualHierarchy],
              ['Emotional hook', result.emotionalHook],
              ['Subject framing', result.subjectFraming],
              ['Color contrast', result.colorContrast],
              ['Platform fit', result.platformFit],
            ] as const).map(([title, body]) => (
              <div key={title} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4">
                <div className="text-2xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5">{title}</div>
                <p className="text-sm text-zinc-300 leading-relaxed">{body}</p>
              </div>
            ))}

            {/* Text legibility — combine score + issues */}
            <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-2xs font-bold uppercase tracking-wider text-zinc-500">Text legibility</div>
                <span className={`text-xs font-bold tabular-nums ${
                  result.textLegibility.score >= 8 ? 'text-emerald-300' :
                  result.textLegibility.score >= 6 ? 'text-brand-300' :
                  result.textLegibility.score >= 4 ? 'text-amber-300' :
                  'text-red-300'
                }`}>
                  {result.textLegibility.score}/10
                </span>
              </div>
              {result.textLegibility.issues.length > 0 ? (
                <ul className="space-y-1">
                  {result.textLegibility.issues.map((iss, i) => (
                    <li key={i} className="text-sm text-zinc-300 leading-relaxed flex gap-2">
                      <span className="text-amber-400 flex-shrink-0">▴</span>
                      <span>{iss}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-300 leading-relaxed">No legibility issues detected.</p>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={saved || saving}
              variant={saved ? 'secondary' : 'primary'}
              size="lg"
            >
              {saved ? '✓ Saved to library' : 'Save analysis to library'}
            </Button>
            <button
              onClick={() => {
                setResult(null)
                setSaved(false)
                if (previewUrl) URL.revokeObjectURL(previewUrl)
                setPreviewUrl(null)
                setFile(null)
              }}
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              Analyze another thumbnail →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
