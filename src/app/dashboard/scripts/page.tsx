"use client";
import { useState } from "react";
import { TONES } from "@/lib/constants";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { EngineBadge } from "@/components/ui/EngineBadge";
import { GenerationLoader } from "@/components/ui/GenerationLoader";
import { InlineError } from "@/components/ui/ErrorBoundary";
import { useToast } from "@/components/ui/Toast";

interface Script {
  hook: string;
  intro: string;
  sections: { timestamp: string; title: string; body: string; bRoll?: string }[];
  cta: string;
  outro: string;
  estimatedReadTime: string;
  wordCount: number;
}

const SCRIPT_PLATFORMS = [
  { id: "YouTube Short",    label: "YouTube Short" },
  { id: "YouTube",          label: "YouTube (long)" },
  { id: "TikTok",           label: "TikTok" },
  { id: "Instagram Reel",   label: "Instagram Reel" },
  { id: "Facebook Reel",    label: "Facebook Reel" },
];

const LENGTHS = [
  { id: "15 seconds", label: "15s" },
  { id: "30 seconds", label: "30s" },
  { id: "60 seconds", label: "60s" },
  { id: "3 minutes",  label: "3m"  },
  { id: "5 minutes",  label: "5m"  },
  { id: "10+ minutes",label: "10m+" },
];

const LOADING_MESSAGES = ["Writing your hook...", "Structuring sections...", "Adding B-roll cues...", "Polishing the CTA..."];

export default function ScriptsPage() {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("TikTok");
  const [length, setLength] = useState("60 seconds");
  const [tone, setTone] = useState("casual");
  const [audience, setAudience] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [script, setScript] = useState<Script | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const handleGenerate = async () => {
    if (!topic.trim()) { addToast("Describe your video", "warning"); return; }
    setLoading(true); setError(null); setScript(null);
    try {
      const data = await apiFetch<Script>("/api/script", {
        method: "POST",
        body: JSON.stringify({ topic, platform, length, tone, audience, keyPoints }),
        timeout: 60000,
      });
      setScript(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate");
    } finally {
      setLoading(false);
    }
  };

  const fullScript = (s: Script) => [
    `🎬 HOOK`,
    s.hook,
    ``,
    `📍 INTRO`,
    s.intro,
    ``,
    ...s.sections.flatMap((sec) => [
      `⏱️ ${sec.timestamp} — ${sec.title}`,
      sec.body,
      sec.bRoll ? `[B-ROLL: ${sec.bRoll}]` : ``,
      ``,
    ]),
    `🎯 CTA`,
    s.cta,
    ``,
    `👋 OUTRO`,
    s.outro,
  ].join("\n");

  const handleSave = async () => {
    if (!script) return;
    try {
      await apiFetch("/api/saved", {
        method: "POST",
        body: JSON.stringify({ type: "script", content: fullScript(script), platform, topic }),
      });
      addToast("Script saved!", "success");
    } catch { addToast("Failed to save", "error"); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Script Generator</h1>
        <p className="text-zinc-500 mt-1">Camera-ready scripts with hooks, timestamps, and B-roll suggestions.</p>
      </div>

      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Video topic *</label>
          <textarea
            rows={2}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., 5 morning habits that changed my productivity"
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Platform</label>
          <div className="flex flex-wrap gap-2">
            {SCRIPT_PLATFORMS.map((p) => (
              <button key={p.id} onClick={() => setPlatform(p.id)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${platform === p.id ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>{p.label}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Length</label>
          <div className="flex flex-wrap gap-2">
            {LENGTHS.map((l) => (
              <button key={l.id} onClick={() => setLength(l.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${length === l.id ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>{l.label}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Tone</label>
          <div className="flex flex-wrap gap-2">
            {TONES.map((t) => (
              <button key={t.id} onClick={() => setTone(t.id)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tone === t.id ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>
                <span>{t.icon}</span><span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Target audience <span className="text-zinc-600">(optional)</span></label>
          <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g., busy parents, indie devs, home cooks"
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40" />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Key points to include <span className="text-zinc-600">(optional)</span></label>
          <textarea rows={3} value={keyPoints} onChange={(e) => setKeyPoints(e.target.value)}
            placeholder="Any specific points, stats, stories, or references to weave in..."
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40 resize-none" />
        </div>

        <Button onClick={handleGenerate} loading={loading} size="lg" className="w-full sm:w-auto">
          {loading ? "Writing..." : "🎬 Generate Script"}
        </Button>
      </div>

      {loading && <GenerationLoader messages={LOADING_MESSAGES} />}
      {error && !loading && <InlineError message={error} onRetry={handleGenerate} />}

      {script && !loading && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-zinc-200">Your script</h2>
              <EngineBadge />
            </div>
            <div className="flex gap-2">
              <CopyButton text={fullScript(script)} label="Copy Full Script" />
              <Button variant="secondary" size="sm" onClick={handleSave}>💾 Save</Button>
            </div>
          </div>

          <div className="text-xs text-zinc-500 flex gap-4">
            <span>⏱️ {script.estimatedReadTime}</span>
            <span>📝 {script.wordCount} words</span>
          </div>

          <Block title="🎬 Hook" subtitle="First 3 seconds — make it count" accent>{script.hook}</Block>
          <Block title="📍 Intro">{script.intro}</Block>

          {script.sections.map((sec, i) => (
            <div key={i} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-mono text-brand-300 bg-brand-500/10 px-2 py-0.5 rounded">⏱️ {sec.timestamp}</span>
                <h4 className="text-sm font-semibold text-zinc-200">{sec.title}</h4>
              </div>
              <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{sec.body}</p>
              {sec.bRoll && (
                <p className="text-xs text-zinc-500 mt-2 italic">📹 B-roll: {sec.bRoll}</p>
              )}
            </div>
          ))}

          <Block title="🎯 Call to Action" accent>{script.cta}</Block>
          <Block title="👋 Outro">{script.outro}</Block>
        </div>
      )}

      {!script && !loading && !error && (
        <div className="text-center py-12 text-zinc-500">
          <span className="text-4xl block mb-4">🎬</span>
          <p>Describe your video above and get a camera-ready script.</p>
        </div>
      )}
    </div>
  );
}

function Block({ title, subtitle, children, accent }: { title: string; subtitle?: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-xl border ${accent ? "border-brand-500/30 bg-brand-900/10" : "border-brand-500/10 bg-surface-secondary"} p-5`}>
      <h4 className="text-sm font-semibold text-zinc-200">{title}</h4>
      {subtitle && <p className="text-xs text-zinc-500 mb-2">{subtitle}</p>}
      <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed mt-2">{children}</p>
    </div>
  );
}
