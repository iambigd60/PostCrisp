"use client";
import { useState } from "react";
import { NICHES } from "@/lib/constants";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { EngineBadge } from "@/components/ui/EngineBadge";
import { GenerationLoader } from "@/components/ui/GenerationLoader";
import { InlineError } from "@/components/ui/ErrorBoundary";

interface Sound {
  name: string; artist?: string; platforms: string[]; usesEstimate: string;
  stage: string; bestFor: string[]; contentIdeas: string[]; timingAdvice: string;
}

const stageColor: Record<string, string> = {
  New:       "bg-sky-500/10 text-sky-300",
  Rising:    "bg-emerald-500/10 text-emerald-300",
  Peak:      "bg-brand-500/10 text-brand-300",
  Declining: "bg-zinc-500/10 text-zinc-400",
};

export default function SoundsPage() {
  const [niche, setNiche] = useState("");
  const [trending, setTrending] = useState<Sound[]>([]);
  const [rising, setRising] = useState<Sound[]>([]);
  const [nicheList, setNicheList] = useState<Sound[]>([]);
  const [activeTab, setActiveTab] = useState<"trending" | "rising" | "niche">("trending");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiFetch<{ trending: Sound[]; rising: Sound[]; niche: Sound[] }>("/api/sounds", {
        method: "POST",
        body: JSON.stringify({ niche }),
        timeout: 90000,
      });
      setTrending(data.trending ?? []);
      setRising(data.rising ?? []);
      setNicheList(data.niche ?? []);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    } finally { setLoading(false); }
  };

  const active = activeTab === "trending" ? trending : activeTab === "rising" ? rising : nicheList;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Sound Tracker</h1>
        <p className="text-zinc-500 mt-1">Catch trending sounds before they peak.</p>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200/80">
        <strong>Note:</strong> Sound trends evolve fast. This is based on recent training data — cross-check with TikTok&apos;s Creative Center before using.
      </div>

      {!loaded && (
        <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Your niche <span className="text-zinc-600">(optional)</span></label>
            <select value={niche} onChange={(e) => setNiche(e.target.value)} className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40">
              <option value="">All niches</option>
              {NICHES.map((n) => <option key={n.id} value={n.label}>{n.label}</option>)}
            </select>
          </div>
          <Button onClick={handleLoad} loading={loading} size="lg" className="w-full sm:w-auto">
            {loading ? "Loading..." : "🎵 Load Sound Trends"}
          </Button>
        </div>
      )}

      {loading && <GenerationLoader messages={["Scanning TikTok and Reels...", "Ranking by momentum...", "Matching to niches..."]} />}
      {error && !loading && <InlineError message={error} onRetry={handleLoad} />}

      {loaded && !loading && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-1">
              {[
                { id: "trending", label: "🔥 Trending", count: trending.length },
                { id: "rising",   label: "📈 Rising",   count: rising.length },
                { id: "niche",    label: "🎯 Niche",    count: nicheList.length },
              ].map((t) => (
                <button key={t.id} onClick={() => setActiveTab(t.id as typeof activeTab)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-secondary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>
                  {t.label} <span className="text-2xs text-zinc-500 ml-1">{t.count}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <EngineBadge />
              <Button size="sm" variant="secondary" onClick={handleLoad} loading={loading}>🔄 Refresh</Button>
            </div>
          </div>

          <div className="space-y-3">
            {active.map((s, i) => (
              <div key={i} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4">
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-zinc-100">🎵 {s.name}</h3>
                      <span className={`text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${stageColor[s.stage] ?? ""}`}>{s.stage}</span>
                    </div>
                    {s.artist && <p className="text-xs text-zinc-500 mt-0.5">by {s.artist}</p>}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-zinc-400">{s.usesEstimate}</div>
                    <div className="text-2xs text-zinc-600">uses</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {s.platforms.map((p) => <span key={p} className="text-2xs text-zinc-400 bg-surface-tertiary px-2 py-0.5 rounded-full">{p}</span>)}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-brand-500/5">
                  <div>
                    <p className="text-2xs text-zinc-500 uppercase tracking-wider mb-1">Best for</p>
                    <div className="flex flex-wrap gap-1">
                      {s.bestFor.map((b) => <span key={b} className="text-2xs text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full">{b}</span>)}
                    </div>
                  </div>
                  <div>
                    <p className="text-2xs text-zinc-500 uppercase tracking-wider mb-1">Timing</p>
                    <p className="text-xs text-zinc-300">{s.timingAdvice}</p>
                  </div>
                </div>
                {s.contentIdeas.length > 0 && (
                  <div className="pt-3 mt-3 border-t border-brand-500/5">
                    <p className="text-2xs text-zinc-500 uppercase tracking-wider mb-1.5">Content ideas</p>
                    <ul className="space-y-1">
                      {s.contentIdeas.map((idea, j) => <li key={j} className="text-xs text-zinc-300 flex gap-2"><span className="text-brand-400">▸</span>{idea}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
