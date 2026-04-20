"use client";
import { useState } from "react";
import { PLATFORMS } from "@/lib/constants";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { EngineBadge } from "@/components/ui/EngineBadge";
import { GenerationLoader } from "@/components/ui/GenerationLoader";
import { InlineError } from "@/components/ui/ErrorBoundary";
import { useToast } from "@/components/ui/Toast";

interface BioOption {
  text: string;
  charCount: number;
  approach: string;
  keywords: string[];
  ctaStrength: string;
  emojiCount: number;
}

const COMMUNICATE_OPTIONS = ["What you do", "Who you help", "Personality/humor", "Credentials", "Call to action", "Location", "Contact"];
const TONES = ["Professional", "Casual", "Witty", "Bold", "Minimalist"];

export default function BioOptimizerPage() {
  const [currentBio, setCurrentBio] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [niche, setNiche] = useState("");
  const [communicate, setCommunicate] = useState<string[]>(["What you do", "Who you help", "Call to action"]);
  const [tone, setTone] = useState("Casual");
  const [options, setOptions] = useState<BioOption[]>([]);
  const [charLimit, setCharLimit] = useState(150);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const toggleCommunicate = (c: string) => setCommunicate((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);

  const handleOptimize = async () => {
    if (!niche.trim()) { addToast("Enter your niche", "warning"); return; }
    setLoading(true); setError(null); setOptions([]);
    try {
      const data = await apiFetch<{ options: BioOption[]; charLimit: number }>("/api/bio-optimizer", {
        method: "POST",
        body: JSON.stringify({ currentBio, platform, niche, communicate, tone }),
      });
      setOptions(data.options);
      setCharLimit(data.charLimit);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    } finally { setLoading(false); }
  };

  const ctaColor: Record<string, string> = {
    Strong: "text-emerald-300 bg-emerald-500/10",
    Medium: "text-brand-300 bg-brand-500/10",
    Weak:   "text-zinc-400 bg-zinc-500/10",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Bio Optimizer</h1>
        <p className="text-zinc-500 mt-1">A better bio in 30 seconds, per platform.</p>
      </div>

      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Current bio <span className="text-zinc-600">(optional — helps us compare)</span></label>
          <textarea rows={2} value={currentBio} onChange={(e) => setCurrentBio(e.target.value)}
            placeholder="Paste your current bio..."
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40 resize-none" />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Platform</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button key={p.id} onClick={() => setPlatform(p.id)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${platform === p.id ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>
                <p.icon className="w-4 h-4" style={{ color: p.color }} /><span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Your niche *</label>
          <input value={niche} onChange={(e) => setNiche(e.target.value)}
            placeholder="e.g., personal finance for Gen Z"
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40" />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">What should the bio communicate?</label>
          <div className="flex flex-wrap gap-2">
            {COMMUNICATE_OPTIONS.map((c) => (
              <button key={c} onClick={() => toggleCommunicate(c)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${communicate.includes(c) ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>{c}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Tone</label>
          <div className="flex flex-wrap gap-2">
            {TONES.map((t) => (
              <button key={t} onClick={() => setTone(t)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tone === t ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>{t}</button>
            ))}
          </div>
        </div>

        <Button onClick={handleOptimize} loading={loading} size="lg" className="w-full sm:w-auto">
          {loading ? "Optimizing..." : "🧬 Optimize Bio"}
        </Button>
      </div>

      {loading && <GenerationLoader messages={["Trying 5 different angles...", "Counting characters...", "Tuning for discoverability..."]} />}
      {error && !loading && <InlineError message={error} onRetry={handleOptimize} />}

      {options.length > 0 && !loading && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-200">5 bio options</h2>
              <p className="text-xs text-zinc-500">{platform} limit: {charLimit} characters</p>
            </div>
            <EngineBadge />
          </div>
          {options.map((o, i) => {
            const over = o.charCount > charLimit;
            return (
              <div key={i} className={`rounded-xl border p-5 ${over ? "border-red-500/30 bg-red-500/5" : "border-brand-500/10 bg-surface-secondary"}`}>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="text-xs font-semibold text-brand-300">#{i + 1}</span>
                  <span className="text-xs font-medium text-zinc-400 bg-surface-tertiary px-2 py-0.5 rounded-full">{o.approach}</span>
                  <span className={`text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${ctaColor[o.ctaStrength] ?? "text-zinc-400"}`}>{o.ctaStrength} CTA</span>
                  <span className="text-xs text-zinc-500">{o.emojiCount} emoji</span>
                  <span className={`ml-auto text-xs font-mono ${over ? "text-red-400" : o.charCount > charLimit * 0.9 ? "text-amber-400" : "text-emerald-400"}`}>
                    {o.charCount} / {charLimit}
                  </span>
                </div>
                <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed mb-3">{o.text}</p>
                {o.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {o.keywords.map((k) => <span key={k} className="text-2xs text-zinc-500 bg-surface-tertiary px-2 py-0.5 rounded-full">{k}</span>)}
                  </div>
                )}
                <CopyButton text={o.text} />
              </div>
            );
          })}
        </div>
      )}

      {options.length === 0 && !loading && !error && (
        <div className="text-center py-12 text-zinc-500">
          <span className="text-4xl block mb-4">🧬</span>
          <p>Pick a platform and niche to get 5 bio options with different angles.</p>
        </div>
      )}
    </div>
  );
}
