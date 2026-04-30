"use client";
import { useMemo, useState } from "react";
import {
  PLATFORMS,
  DAYS,
  BEST_TIME_MESSAGES,
  BEST_TIME_CONTENT_TYPES,
  AUDIENCE_REGIONS,
  NICHES,
} from "@/lib/constants";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { EngineBadge } from "@/components/ui/EngineBadge";
import { GenerationLoader } from "@/components/ui/GenerationLoader";
import { InlineError } from "@/components/ui/ErrorBoundary";

interface TopSlot {
  day: string;
  time: string;
  score: number;
  reason: string;
}

interface BestTimesData {
  platform: string;
  weekData: number[][];
  topSlots: TopSlot[];
  tips: string[];
}

// Ice blue (low) → cyan → green → amber → red (high)
function heatColor(value: number): string {
  const v = Math.max(0, Math.min(100, value));
  const hue = 220 - (v / 100) * 220; // 220 (blue) at 0 → 0 (red) at 100
  const sat = 70 + (v / 100) * 15;   // 70% → 85%
  const light = 62 - (v / 100) * 18; // 62% → 44%
  const alpha = 0.35 + (v / 100) * 0.5; // 0.35 → 0.85
  return `hsla(${hue.toFixed(0)}, ${sat.toFixed(0)}%, ${light.toFixed(0)}%, ${alpha.toFixed(2)})`;
}

function HeatmapCell({ value, hour }: { value: number; hour: number }) {
  const textColor = value >= 45 ? "text-white/95" : "text-zinc-100/60";
  const hourLabel = hour === 0 ? "12a" : hour < 12 ? `${hour}a` : hour === 12 ? "12p" : `${hour - 12}p`;
  return (
    <div
      className={`flex-1 aspect-square min-w-[14px] max-w-[32px] flex items-center justify-center rounded-sm transition-all hover:scale-125 hover:z-10 relative group cursor-default ${textColor}`}
      style={{ backgroundColor: heatColor(value) }}
    >
      <span className="text-[9px] font-mono leading-none">{value}</span>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-surface-elevated border border-brand-500/20 rounded text-2xs text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
        {hourLabel} · {value}%
      </div>
    </div>
  );
}

export default function BestTimesPage() {
  const [platform, setPlatform] = useState("instagram");
  const [contentType, setContentType] = useState("post");
  const [region, setRegion] = useState("north-america");
  const [niche, setNiche] = useState("general");
  const [data, setData] = useState<BestTimesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRegionLabel = useMemo(
    () => AUDIENCE_REGIONS.find((r) => r.id === region)?.label ?? "North America",
    [region]
  );
  const selectedNicheLabel = useMemo(
    () => NICHES.find((n) => n.id === niche)?.label ?? "general",
    [niche]
  );

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        platform,
        contentType,
        region: selectedRegionLabel,
        niche: selectedNicheLabel,
      });
      const result = await apiFetch<BestTimesData>(`/api/best-times?${params.toString()}`);
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const hourLabels = useMemo(() =>
    Array.from({ length: 24 }, (_, i) => {
      if (i % 3 !== 0) return "";
      return i === 0 ? "12a" : i < 12 ? `${i}a` : i === 12 ? "12p" : `${i - 12}p`;
    }),
  []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Best Times to Post</h1>
        <p className="text-zinc-500 mt-1">Discover when your audience is most active.</p>
      </div>

      {/* Input form */}
      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
        {/* Platform selector */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Platform</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                  platform === p.id
                    ? "bg-brand-600/20 text-brand-300 border border-brand-500/30"
                    : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover hover:text-zinc-200"
                }`}
              >
                <p.icon className="w-4 h-4" style={{ color: p.color }} />
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content type pills */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Content type</label>
          <div className="flex flex-wrap gap-2">
            {BEST_TIME_CONTENT_TYPES.map((c) => (
              <button
                key={c.id}
                onClick={() => setContentType(c.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                  contentType === c.id
                    ? "bg-brand-600/20 text-brand-300 border border-brand-500/30"
                    : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover hover:text-zinc-200"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Region + Niche row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="region" className="block text-sm font-medium text-zinc-300 mb-2">
              Audience location
            </label>
            <select
              id="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40 focus:ring-1 focus:ring-brand-500/20 transition-colors"
            >
              {AUDIENCE_REGIONS.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="niche" className="block text-sm font-medium text-zinc-300 mb-2">
              Industry / niche
            </label>
            <select
              id="niche"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40 focus:ring-1 focus:ring-brand-500/20 transition-colors"
            >
              {NICHES.map((n) => (
                <option key={n.id} value={n.id}>{n.label}</option>
              ))}
            </select>
          </div>
        </div>

        <Button onClick={fetchData} loading={loading} size="lg" className="w-full sm:w-auto">
          {loading ? "Analyzing..." : "⏰ Analyze Best Times"}
        </Button>
      </div>

      {loading && <GenerationLoader messages={BEST_TIME_MESSAGES} />}
      {error && !loading && <InlineError message={error} onRetry={fetchData} />}

      {data && !loading && !error && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex justify-end">
            <EngineBadge />
          </div>
          {/* Tips */}
          <div className="space-y-2">
            {data.tips.map((tip, i) => (
              <div key={i} className="rounded-xl bg-brand-900/20 border border-brand-500/20 p-4 flex items-start gap-3">
                <span className="text-xl flex-shrink-0">💡</span>
                <p className="text-sm text-zinc-300">{tip}</p>
              </div>
            ))}
          </div>

          {/* Heatmap chart */}
          <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-zinc-200 mb-4">Weekly Engagement Heatmap</h2>

            <div className="min-w-[400px] max-w-[880px] mx-auto">
              {/* Hour labels */}
              <div className="flex items-center mb-1.5">
                <span className="w-10 flex-shrink-0" />
                <div className="flex-1 flex gap-0.5 pl-0.5">
                  {hourLabels.map((label, i) => (
                    <div key={i} className="flex-1 text-center text-2xs text-zinc-600 min-w-[14px] max-w-[32px]">
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Heatmap rows */}
              {data.weekData.map((dayData, dayIndex) => (
                <div key={dayIndex} className="flex items-center gap-0.5 mb-0.5">
                  <span className="w-10 text-xs text-zinc-500 text-right flex-shrink-0 pr-2">{DAYS[dayIndex]}</span>
                  <div className="flex-1 flex gap-0.5">
                    {dayData.map((value, hourIndex) => (
                      <HeatmapCell key={hourIndex} value={value} hour={hourIndex} />
                    ))}
                  </div>
                </div>
              ))}

              {/* Legend */}
              <div className="flex items-center justify-end gap-2 mt-4 text-xs text-zinc-500">
                <span>Cold</span>
                <div className="flex gap-0.5">
                  {[10, 30, 50, 70, 90].map((v) => (
                    <div
                      key={v}
                      className="w-4 h-4 rounded-sm"
                      style={{ backgroundColor: heatColor(v) }}
                    />
                  ))}
                </div>
                <span>Hot</span>
              </div>
            </div>
          </div>

          {/* Top 5 time slots */}
          <div>
            <h2 className="text-base font-semibold text-zinc-200 mb-3">Top 5 Time Slots</h2>
            <div className="space-y-2">
              {data.topSlots.map((slot, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 rounded-xl border border-brand-500/10 bg-surface-secondary"
                >
                  <div className="w-7 h-7 rounded-full bg-brand-600/20 border border-brand-500/20 flex items-center justify-center text-xs font-bold text-brand-300 flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-200">{slot.day}</span>
                      <span className="text-sm text-brand-300">{slot.time}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">{slot.reason}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-emerald-400">{slot.score}</div>
                    <div className="text-xs text-zinc-600">score</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <div className="text-center py-16 text-zinc-500">
          <span className="text-4xl block mb-4">⏰</span>
          <p>Configure your platform, audience, and niche above — then click Analyze.</p>
        </div>
      )}
    </div>
  );
}
