"use client";
import { useState } from "react";
import { PLATFORMS, NICHES } from "@/lib/constants";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { EngineBadge } from "@/components/ui/EngineBadge";
import { FeatureGate } from "@/components/ui/FeatureGate";
import { GenerationLoader } from "@/components/ui/GenerationLoader";
import { InlineError } from "@/components/ui/ErrorBoundary";
import { useToast } from "@/components/ui/Toast";

interface RateResult {
  currency: string;
  suggestedRate: { min: number; mid: number; premium: number };
  breakdown: { label: string; value: string }[];
  comparison: string;
  rateCard: { contentType: string; min: number; mid: number; premium: number }[];
  negotiationTips: string[];
}

const CONTENT_TYPES = [
  "Feed Post",
  "Reel / Short / TikTok",
  "Story (set of 3-5)",
  "YouTube Integration",
  "YouTube Dedicated Video",
  "Live Stream",
  "Thread / Carousel",
];

const USAGE_RIGHTS = [
  { id: "standard", label: "No exclusivity, no repurpose (standard)" },
  { id: "30day",    label: "30-day exclusivity" },
  { id: "90day",    label: "90-day exclusivity" },
  { id: "perpetual",label: "Perpetual usage + repurpose rights" },
];

const LOADING_MESSAGES = [
  "Pricing your tier...",
  "Factoring niche premiums...",
  "Building your rate card...",
  "Preparing negotiation tips...",
];

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export default function RateCalculatorPage() {
  const [platform, setPlatform] = useState("instagram");
  const [followerCount, setFollowerCount] = useState("");
  const [engagementRate, setEngagementRate] = useState("");
  const [contentType, setContentType] = useState("Feed Post");
  const [niche, setNiche] = useState("general");
  const [usageRights, setUsageRights] = useState("standard");
  const [deliverables, setDeliverables] = useState("1");
  const [result, setResult] = useState<RateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const selectedNicheLabel = NICHES.find((n) => n.id === niche)?.label ?? "general";

  const handleCalc = async () => {
    if (!followerCount.trim()) { addToast("Enter your follower count", "warning"); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const data = await apiFetch<RateResult>("/api/rate-calculator", {
        method: "POST",
        body: JSON.stringify({
          platform, followerCount, engagementRate, contentType,
          niche: selectedNicheLabel, usageRights, deliverables,
        }),
        timeout: 60000,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to calculate rates");
    } finally {
      setLoading(false);
    }
  };

  const copyRateCard = () => {
    if (!result) return;
    const text = result.rateCard.map((r) => `${r.contentType}: ${fmt(r.min)} - ${fmt(r.mid)} - ${fmt(r.premium)}`).join("\n");
    navigator.clipboard.writeText(text);
    addToast("Rate card copied!", "success");
  };

  return (
    <FeatureGate
      feature="rate-calculator"
      featureLabel="Rate Calculator"
      featureIcon="💵"
      featureTagline="Know exactly what to charge before you quote a brand."
      valueProps={[
        "Fair rate ranges based on 2026 industry data",
        "A full rate card covering every content format",
        "Niche premium multipliers so finance creators don't quote lifestyle rates",
        "Negotiation tips specific to your tier",
      ]}
    >
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Rate Calculator</h1>
        <p className="text-zinc-500 mt-1">Know what to charge. Every time.</p>
      </div>

      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Platform</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  platform === p.id
                    ? "bg-brand-600/20 text-brand-300 border border-brand-500/30"
                    : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"
                }`}
              >
                <p.icon className="w-4 h-4" style={{ color: p.color }} />
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Follower count *</label>
            <input
              value={followerCount}
              onChange={(e) => setFollowerCount(e.target.value)}
              placeholder="e.g., 45000 or 45K"
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Engagement rate <span className="text-zinc-600">(optional)</span></label>
            <input
              value={engagementRate}
              onChange={(e) => setEngagementRate(e.target.value)}
              placeholder="e.g., 4.2%"
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Content type</label>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40"
            >
              {CONTENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Niche</label>
            <select
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40"
            >
              {NICHES.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Usage rights</label>
            <select
              value={usageRights}
              onChange={(e) => setUsageRights(e.target.value)}
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40"
            >
              {USAGE_RIGHTS.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Number of deliverables</label>
            <input
              type="number"
              min={1}
              value={deliverables}
              onChange={(e) => setDeliverables(e.target.value)}
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40"
            />
          </div>
        </div>

        <Button onClick={handleCalc} loading={loading} size="lg" className="w-full sm:w-auto">
          {loading ? "Calculating..." : "💵 Calculate Rate"}
        </Button>
      </div>

      {loading && <GenerationLoader messages={LOADING_MESSAGES} />}
      {error && !loading && <InlineError message={error} onRetry={handleCalc} />}

      {result && !loading && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex justify-end"><EngineBadge /></div>

          {/* Suggested rate */}
          <div className="rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-900/30 to-surface-secondary p-6">
            <p className="text-xs uppercase tracking-wider text-brand-300 mb-2">Suggested rate for {contentType}</p>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Min (starting point)", value: result.suggestedRate.min, tone: "text-zinc-300" },
                { label: "Mid (realistic ask)", value: result.suggestedRate.mid, tone: "text-brand-300" },
                { label: "Premium (well-briefed)", value: result.suggestedRate.premium, tone: "text-amber-300" },
              ].map((r) => (
                <div key={r.label} className="text-center">
                  <div className={`text-2xl sm:text-3xl font-extrabold ${r.tone}`}>{fmt(r.value)}</div>
                  <div className="text-2xs text-zinc-500 mt-1">{r.label}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-500 mt-4 italic">{result.comparison}</p>
          </div>

          {/* Breakdown */}
          <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
            <h3 className="text-base font-semibold text-zinc-100 mb-3">How we got there</h3>
            <div className="space-y-2">
              {result.breakdown.map((row) => (
                <div key={row.label} className="flex items-center justify-between text-sm border-b border-brand-500/5 pb-2 last:border-b-0">
                  <span className="text-zinc-400">{row.label}</span>
                  <span className="font-mono text-zinc-200">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rate card */}
          <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-zinc-100">Your full rate card</h3>
                <p className="text-xs text-zinc-500">Quote any of these to brands.</p>
              </div>
              <Button variant="secondary" size="sm" onClick={copyRateCard}>📋 Copy Rate Card</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 border-b border-brand-500/10">
                    <th className="py-2 pr-4 font-medium">Content type</th>
                    <th className="py-2 px-4 font-medium text-right">Min</th>
                    <th className="py-2 px-4 font-medium text-right">Mid</th>
                    <th className="py-2 pl-4 font-medium text-right">Premium</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rateCard.map((r) => (
                    <tr key={r.contentType} className="border-b border-brand-500/5 last:border-b-0">
                      <td className="py-2.5 pr-4 text-zinc-300">{r.contentType}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-zinc-400">{fmt(r.min)}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-brand-300 font-semibold">{fmt(r.mid)}</td>
                      <td className="py-2.5 pl-4 text-right font-mono text-amber-300">{fmt(r.premium)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Negotiation tips */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
            <h3 className="text-base font-semibold text-zinc-100 mb-3">💡 Negotiation tips</h3>
            <ul className="space-y-2">
              {result.negotiationTips.map((tip, i) => (
                <li key={i} className="flex gap-2 text-sm text-zinc-300">
                  <span className="text-amber-400 font-bold">{i + 1}.</span>
                  <span className="flex-1">{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {!result && !loading && !error && (
        <div className="text-center py-12 text-zinc-500">
          <span className="text-4xl block mb-4">💵</span>
          <p>Plug in your stats to see a rate range for this content type, plus a full rate card to quote from.</p>
        </div>
      )}
    </div>
    </FeatureGate>
  );
}
