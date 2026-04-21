"use client";
import { useState } from "react";
import { PLATFORMS, NICHES } from "@/lib/constants";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { EngineBadge } from "@/components/ui/EngineBadge";
import { GenerationLoader } from "@/components/ui/GenerationLoader";
import { InlineError } from "@/components/ui/ErrorBoundary";

interface Trend {
  name: string; description: string; platforms: string[]; stage: string;
  viralityScore: number; niche: boolean; howToUse: string; contentAngle: string;
}

const stageColor: Record<string, string> = {
  Flash:     "bg-red-500/10 text-red-300 border-red-500/20",
  Short:     "bg-amber-500/10 text-amber-300 border-amber-500/20",
  Sustained: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
};

export default function TrendsPage() {
  const [niche, setNiche] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["Instagram", "TikTok", "YouTube"]);
  const [trending, setTrending] = useState<Trend[]>([]);
  const [rising, setRising] = useState<Trend[]>([]);
  const [nicheList, setNicheList] = useState<Trend[]>([]);
  const [activeTab, setActiveTab] = useState<"trending" | "rising" | "niche">("trending");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePlatform = (p: string) => setSelectedPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);

  const handleLoad = async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiFetch<{ trending: Trend[]; rising: Trend[]; niche: Trend[] }>("/api/trend-radar", {
        method: "POST",
        body: JSON.stringify({ niche, platforms: selectedPlatforms }),
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
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Trend Radar</h1>
        <p className="text-zinc-500 mt-1">What&apos;s peaking, what&apos;s rising, and what&apos;s hot in your niche.</p>
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
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Platforms to cover</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button key={p.id} onClick={() => togglePlatform(p.label)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedPlatforms.includes(p.label) ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>
                  <p.icon className="w-4 h-4" style={{ color: p.color }} /><span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>
          <Button onClick={handleLoad} loading={loading} size="lg" className="w-full sm:w-auto">
            {loading ? "Loading..." : "📡 Load Trends"}
          </Button>
        </div>
      )}

      {loading && <GenerationLoader messages={["Scanning platforms...", "Ranking by virality...", "Finding niche-specific opportunities..."]} />}
      {error && !loading && <InlineError message={error} onRetry={handleLoad} />}

      {loaded && !loading && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-1">
              {[
                { id: "trending", label: "🔥 Trending",  count: trending.length },
                { id: "rising",   label: "📈 Rising",    count: rising.length },
                { id: "niche",    label: "🎯 Niche",     count: nicheList.length },
              ].map((t) => (
                <button key={t.id} onClick={() => setActiveTab(t.id as "trending" | "rising" | "niche")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-secondary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>
                  {t.label} <span className="text-2xs text-zinc-500 ml-1">{t.count}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <EngineBadge />
              <Button size="sm" variant="secondary" onClick={handleLoad} loading={loading}>🔄 Refresh</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {active.map((t, i) => (
              <div key={i} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 hover:border-brand-500/20 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-base font-semibold text-zinc-100 flex-1">{t.name}</h3>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xl font-bold text-brand-300">{t.viralityScore}</div>
                    <div className="text-2xs text-zinc-600">virality</div>
                  </div>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed mb-3">{t.description}</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className={`text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${stageColor[t.stage] ?? ""}`}>{t.stage}</span>
                  {t.platforms.map((p) => (
                    <span key={p} className="text-2xs text-zinc-400 bg-surface-tertiary px-2 py-0.5 rounded-full">{p}</span>
                  ))}
                </div>
                <div className="space-y-2 pt-3 border-t border-brand-500/5">
                  <div>
                    <p className="text-2xs text-zinc-500 uppercase tracking-wider mb-0.5">How to use it</p>
                    <p className="text-xs text-zinc-300">{t.howToUse}</p>
                  </div>
                  <div>
                    <p className="text-2xs text-zinc-500 uppercase tracking-wider mb-0.5">Content angle</p>
                    <p className="text-xs text-zinc-300 italic">&ldquo;{t.contentAngle}&rdquo;</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {active.length === 0 && (
            <div className="text-center py-12 text-zinc-500">
              <p>No trends in this bucket. Try a different tab.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
