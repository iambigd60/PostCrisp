"use client";
import { useEffect, useState, useMemo } from "react";
import { PLATFORMS, NICHES } from "@/lib/constants";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { EngineBadge } from "@/components/ui/EngineBadge";
import { GenerationLoader } from "@/components/ui/GenerationLoader";
import { InlineError } from "@/components/ui/ErrorBoundary";

interface Tip {
  title: string;
  explanation: string;
  difficulty: 'Easy' | 'Medium' | 'Advanced';
  impact: 'Low' | 'Medium' | 'High';
  category: string;
}

const CATEGORIES = [
  { id: "algorithm",         label: "Algorithm insights", icon: "🧠" },
  { id: "best-practices",    label: "Best practices",     icon: "✨" },
  { id: "growth",            label: "Growth tactics",     icon: "📈" },
  { id: "mistakes",          label: "Common mistakes",    icon: "⚠️" },
  { id: "underused-features",label: "Underused features", icon: "💎" },
];

const difficultyColor: Record<string, string> = {
  Easy: "bg-emerald-500/10 text-emerald-300",
  Medium: "bg-amber-500/10 text-amber-300",
  Advanced: "bg-red-500/10 text-red-300",
};

const impactColor: Record<string, string> = {
  High: "bg-brand-500/15 text-brand-300",
  Medium: "bg-sky-500/10 text-sky-300",
  Low: "bg-zinc-500/10 text-zinc-400",
};

export default function PlatformTipsPage() {
  const [platform, setPlatform] = useState("instagram");
  const [niche, setNiche] = useState("");
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTips = async (useNiche = false) => {
    setLoading(true); setError(null);
    try {
      const data = await apiFetch<{ tips: Tip[] }>("/api/platform-tips", {
        method: "POST",
        body: JSON.stringify({ platform, niche: useNiche ? niche : null }),
        timeout: 60000,
      });
      setTips(data.tips);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchTips(false); }, [platform]); // eslint-disable-line

  const grouped = useMemo(() => {
    const out: Record<string, Tip[]> = {};
    for (const c of CATEGORIES) out[c.id] = [];
    for (const t of tips) {
      if (out[t.category]) out[t.category].push(t);
      else (out["best-practices"] = out["best-practices"] ?? []).push(t);
    }
    return out;
  }, [tips]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Platform Tips</h1>
        <p className="text-zinc-500 mt-1">Algorithm insights, best practices, and growth tactics per platform.</p>
      </div>

      {/* Platform tabs */}
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((p) => (
          <button key={p.id} onClick={() => setPlatform(p.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] ${platform === p.id ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-secondary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>
            <p.icon className="w-4 h-4" style={{ color: p.color }} /><span>{p.label}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-zinc-400">Get niche-personalized tips:</span>
        <select value={niche} onChange={(e) => setNiche(e.target.value)} className="rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-3 py-1.5 text-sm focus:outline-none focus:border-brand-500/40">
          <option value="">Choose your niche…</option>
          {NICHES.map((n) => <option key={n.id} value={n.label}>{n.label}</option>)}
        </select>
        <Button size="sm" variant="secondary" onClick={() => fetchTips(true)} loading={loading} disabled={!niche}>
          🎯 Personalize
        </Button>
      </div>

      {loading && <GenerationLoader messages={[`Pulling ${platform} tips...`, "Sorting by impact...", "Checking recent algorithm updates..."]} />}
      {error && !loading && <InlineError message={error} onRetry={() => fetchTips(false)} />}

      {!loading && !error && tips.length > 0 && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex justify-end"><EngineBadge /></div>
          {CATEGORIES.map((cat) => {
            const items = grouped[cat.id];
            if (!items || items.length === 0) return null;
            return (
              <div key={cat.id}>
                <h2 className="text-base font-semibold text-zinc-200 mb-3 flex items-center gap-2">
                  <span className="text-lg">{cat.icon}</span>{cat.label}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {items.map((tip, i) => (
                    <div key={i} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 hover:border-brand-500/20 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="text-sm font-semibold text-zinc-100 flex-1">{tip.title}</h4>
                      </div>
                      <p className="text-sm text-zinc-400 leading-relaxed mb-3">{tip.explanation}</p>
                      <div className="flex gap-1.5">
                        <span className={`text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${difficultyColor[tip.difficulty]}`}>{tip.difficulty}</span>
                        <span className={`text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${impactColor[tip.impact]}`}>Impact: {tip.impact}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
