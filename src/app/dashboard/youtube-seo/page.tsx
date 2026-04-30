"use client";
import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { EngineBadge } from "@/components/ui/EngineBadge";
import { GenerationLoader } from "@/components/ui/GenerationLoader";
import { InlineError } from "@/components/ui/ErrorBoundary";
import { useToast } from "@/components/ui/Toast";

interface Result {
  titles: { text: string; charCount: number; keywordPlacement: string }[];
  description: string;
  tags: string[];
  thumbnailText: string[];
  seoScore: number;
  improvements: string[];
}

const CATEGORIES = ["General", "Education", "How-To & Style", "Gaming", "Entertainment", "Music", "News", "Science & Tech", "Sports", "Travel"];

export default function YouTubeSEOPage() {
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [category, setCategory] = useState("General");
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const handleOptimize = async () => {
    if (!topic.trim()) { addToast("Enter a video topic", "warning"); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const data = await apiFetch<Result>("/api/youtube-seo", {
        method: "POST",
        body: JSON.stringify({ topic, keywords, category, competitorUrl }),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    } finally { setLoading(false); }
  };

  const scoreColor = result ? (result.seoScore >= 85 ? "text-emerald-400" : result.seoScore >= 70 ? "text-brand-300" : "text-amber-400") : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">YouTube SEO</h1>
        <p className="text-zinc-500 mt-1">Rank higher on YouTube search and suggested videos.</p>
      </div>

      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Video topic / title idea *</label>
          <textarea rows={2} value={topic} onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., How to edit reels in CapCut like a pro"
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40 resize-none" />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Target keywords <span className="text-zinc-600">(optional, comma-separated)</span></label>
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="capcut tutorial, reels editing, video editing"
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Competitor URL <span className="text-zinc-600">(optional)</span></label>
            <input value={competitorUrl} onChange={(e) => setCompetitorUrl(e.target.value)} placeholder="youtube.com/watch?v=..."
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40" />
          </div>
        </div>

        <Button onClick={handleOptimize} loading={loading} size="lg" className="w-full sm:w-auto">
          {loading ? "Optimizing..." : "📺 Optimize for YouTube"}
        </Button>
      </div>

      {loading && <GenerationLoader messages={["Researching keywords...", "Writing titles...", "Building description...", "Scoring SEO..."]} />}
      {error && !loading && <InlineError message={error} onRetry={handleOptimize} />}

      {result && !loading && (
        <div className="space-y-5 animate-fade-in">
          <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-zinc-200">Optimization complete</h2><EngineBadge /></div>

          {/* SEO Score */}
          <div className="rounded-2xl border border-brand-500/20 bg-gradient-to-br from-brand-900/20 to-surface-secondary p-5 flex items-center gap-5">
            <div className={`text-4xl sm:text-5xl font-extrabold ${scoreColor}`}>{result.seoScore}</div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-zinc-200">Estimated SEO score</p>
              <p className="text-xs text-zinc-500">Based on title, description, tags, and keyword placement</p>
            </div>
          </div>

          {/* Titles */}
          <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
            <h3 className="text-base font-semibold text-zinc-100 mb-3">📝 Title suggestions</h3>
            <div className="space-y-2">
              {result.titles.map((t, i) => (
                <div key={i} className="rounded-lg bg-surface-tertiary p-3 border border-brand-500/5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-zinc-200 font-medium flex-1">{t.text}</p>
                    <CopyButton text={t.text} variant="icon" />
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-2xs text-zinc-500">
                    <span className={t.charCount > 60 ? "text-amber-400" : "text-emerald-400"}>{t.charCount} chars</span>
                    <span>·</span>
                    <span>{t.keywordPlacement}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-zinc-100">📄 Optimized description</h3>
              <CopyButton text={result.description} />
            </div>
            <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono bg-surface-tertiary rounded-lg p-4 border border-brand-500/5 leading-relaxed">{result.description}</pre>
          </div>

          {/* Tags */}
          <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-zinc-100">🏷️ Tags <span className="text-xs text-zinc-500 font-normal">({result.tags.length})</span></h3>
              <CopyButton text={result.tags.join(", ")} label="Copy as CSV" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.tags.map((tag) => (
                <span key={tag} className="text-xs text-brand-300 bg-brand-500/10 border border-brand-500/20 px-2 py-1 rounded-full">{tag}</span>
              ))}
            </div>
          </div>

          {/* Thumbnail text */}
          <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
            <h3 className="text-base font-semibold text-zinc-100 mb-3">🎨 Thumbnail text ideas</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {result.thumbnailText.map((t, i) => (
                <div key={i} className="rounded-lg bg-gradient-to-br from-brand-700/30 to-surface-tertiary p-4 text-center border border-brand-500/20">
                  <p className="text-lg font-extrabold text-zinc-100 uppercase">{t}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Improvements */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
            <h3 className="text-base font-semibold text-zinc-100 mb-3">💡 Boost your score further</h3>
            <ul className="space-y-2">
              {result.improvements.map((imp, i) => (
                <li key={i} className="flex gap-2 text-sm text-zinc-300">
                  <span className="text-amber-400 font-bold">{i + 1}.</span><span className="flex-1">{imp}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {!result && !loading && !error && (
        <div className="text-center py-12 text-zinc-500">
          <span className="text-4xl block mb-4">📺</span>
          <p>Enter a video topic to get titles, description, tags, and thumbnail text.</p>
        </div>
      )}
    </div>
  );
}
