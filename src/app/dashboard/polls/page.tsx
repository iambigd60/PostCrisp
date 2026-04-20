"use client";
import { useState } from "react";
import { NICHES } from "@/lib/constants";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { EngineBadge } from "@/components/ui/EngineBadge";
import { GenerationLoader } from "@/components/ui/GenerationLoader";
import { InlineError } from "@/components/ui/ErrorBoundary";
import { useToast } from "@/components/ui/Toast";

interface Poll { question: string; format: string; options?: string[]; correctAnswer?: string; expectedEngagement: string }

const ENGAGEMENT_TYPES = ["Mixed", "This or That Poll", "Quiz", "Open Question", "Rating Scale", "Emoji Slider", "AMA Prompt"];
const PLATFORMS = ["Instagram Stories", "TikTok", "X", "Facebook Stories"];

const formatIcon: Record<string, string> = {
  "this-or-that": "⚖️",
  "quiz":         "🧠",
  "open-question":"❓",
  "rating-scale": "📏",
  "emoji-slider": "😊",
  "ama-prompt":   "🎤",
};

const engagementColor: Record<string, string> = {
  High:   "bg-emerald-500/10 text-emerald-300",
  Medium: "bg-brand-500/10 text-brand-300",
  Low:    "bg-zinc-500/10 text-zinc-400",
};

export default function PollsPage() {
  const [niche, setNiche] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [platform, setPlatform] = useState("Instagram Stories");
  const [engagementType, setEngagementType] = useState("Mixed");
  const [count, setCount] = useState(8);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const handleGenerate = async () => {
    if (!niche.trim()) { addToast("Select a niche", "warning"); return; }
    setLoading(true); setError(null); setPolls([]);
    try {
      const data = await apiFetch<{ polls: Poll[] }>("/api/polls", {
        method: "POST",
        body: JSON.stringify({ niche, platform, engagementType: engagementType === "Mixed" ? null : engagementType, count }),
      });
      setPolls(data.polls);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    } finally { setLoading(false); }
  };

  const formatPollText = (p: Poll) => {
    let s = p.question;
    if (p.options) s += "\n" + p.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join("\n");
    if (p.correctAnswer) s += `\n\nCorrect: ${p.correctAnswer}`;
    return s;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Polls &amp; Questions</h1>
        <p className="text-zinc-500 mt-1">Engagement-driving Story prompts tailored to your niche.</p>
      </div>

      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-zinc-300">Your niche *</label>
            <button
              type="button"
              onClick={() => { setUseCustom(!useCustom); setNiche(""); }}
              className="text-xs text-brand-400 hover:text-brand-300"
            >
              {useCustom ? "← Use preset list" : "Custom niche →"}
            </button>
          </div>
          {useCustom ? (
            <input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g., sourdough baking for beginners, indie game dev, DIY van conversions"
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40"
            />
          ) : (
            <select value={niche} onChange={(e) => setNiche(e.target.value)} className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40">
              <option value="">Select a niche…</option>
              {NICHES.map((n) => <option key={n.id} value={n.label}>{n.label}</option>)}
            </select>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Platform</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button key={p} onClick={() => setPlatform(p)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${platform === p ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>{p}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Engagement type</label>
          <div className="flex flex-wrap gap-2">
            {ENGAGEMENT_TYPES.map((t) => (
              <button key={t} onClick={() => setEngagementType(t)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${engagementType === t ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>{t}</button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-zinc-300">Number to generate</label>
            <span className="text-sm font-mono text-brand-300">{count}</span>
          </div>
          <input type="range" min={5} max={15} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full accent-brand-500" />
        </div>

        <Button onClick={handleGenerate} loading={loading} size="lg" className="w-full sm:w-auto">
          {loading ? "Generating..." : "📊 Generate Polls"}
        </Button>
      </div>

      {loading && <GenerationLoader messages={["Thinking of engaging questions...", "Varying the formats...", "Tuning for your niche..."]} />}
      {error && !loading && <InlineError message={error} onRetry={handleGenerate} />}

      {polls.length > 0 && !loading && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-200">{polls.length} polls ready</h2>
            <EngineBadge />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {polls.map((p, i) => (
              <div key={i} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-lg">{formatIcon[p.format] ?? "❓"}</span>
                  <span className="text-xs font-medium text-zinc-400 capitalize">{p.format.replace(/-/g, " ")}</span>
                  <span className={`text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ml-auto ${engagementColor[p.expectedEngagement] ?? "text-zinc-400"}`}>
                    {p.expectedEngagement}
                  </span>
                </div>
                <p className="text-sm text-zinc-200 font-medium mb-2">{p.question}</p>
                {p.options && (
                  <div className="space-y-1 mb-3">
                    {p.options.map((o, j) => (
                      <div key={j} className={`text-sm px-3 py-1.5 rounded-lg ${p.correctAnswer === o ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" : "bg-surface-tertiary text-zinc-300"}`}>
                        {String.fromCharCode(65 + j)}) {o}
                        {p.correctAnswer === o && <span className="ml-2 text-2xs">✓ correct</span>}
                      </div>
                    ))}
                  </div>
                )}
                <CopyButton text={formatPollText(p)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {polls.length === 0 && !loading && !error && (
        <div className="text-center py-12 text-zinc-500">
          <span className="text-4xl block mb-4">📊</span>
          <p>Pick your niche and generate a week&apos;s worth of Story polls.</p>
        </div>
      )}
    </div>
  );
}
