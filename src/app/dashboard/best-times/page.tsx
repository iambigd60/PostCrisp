"use client";
import { useState, useEffect, useMemo } from "react";
import { PLATFORMS, DAYS, BEST_TIME_MESSAGES } from "@/lib/constants";
import { apiFetch, ApiError } from "@/lib/api";
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

function HeatmapCell({ value }: { value: number }) {
  const opacity = Math.max(0.08, value / 100);
  return (
    <div
      className="aspect-square rounded-sm sm:rounded transition-all hover:scale-110 hover:z-10 relative group cursor-default"
      style={{ backgroundColor: `rgba(139, 92, 246, ${opacity})` }}
      title={`Engagement: ${value}%`}
    >
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-surface-elevated border border-brand-500/20 rounded text-2xs text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
        {value}%
      </div>
    </div>
  );
}

export default function BestTimesPage() {
  const [platform, setPlatform] = useState("instagram");
  const [data, setData] = useState<BestTimesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (p: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<BestTimesData>(`/api/best-times?platform=${p}`);
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(platform); }, [platform]);

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

      {/* Platform selector */}
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPlatform(p.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
              platform === p.id
                ? "bg-brand-600/20 text-brand-300 border border-brand-500/30"
                : "bg-surface-secondary text-zinc-400 border border-transparent hover:bg-surface-hover hover:text-zinc-200"
            }`}
          >
            <p.icon className="w-4 h-4" style={{ color: p.color }} />
            <span>{p.label}</span>
          </button>
        ))}
      </div>

      {loading && <GenerationLoader messages={BEST_TIME_MESSAGES} />}
      {error && !loading && <InlineError message={error} onRetry={() => fetchData(platform)} />}

      {data && !loading && !error && (
        <div className="space-y-6 animate-fade-in">
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
          <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 sm:p-6 overflow-x-auto">
            <h2 className="text-lg font-semibold text-zinc-200 mb-4">Weekly Engagement Heatmap</h2>

            <div className="min-w-[600px]">
              {/* Hour labels */}
              <div className="flex mb-1 pl-12">
                {hourLabels.map((label, i) => (
                  <div key={i} className="flex-1 text-center text-2xs text-zinc-600">
                    {label}
                  </div>
                ))}
              </div>

              {/* Heatmap rows */}
              {data.weekData.map((dayData, dayIndex) => (
                <div key={dayIndex} className="flex items-center gap-1 mb-1">
                  <span className="w-10 text-xs text-zinc-500 text-right flex-shrink-0">{DAYS[dayIndex]}</span>
                  <div className="flex-1 grid grid-cols-24 gap-0.5">
                    {dayData.map((value, hourIndex) => (
                      <HeatmapCell key={hourIndex} value={value} />
                    ))}
                  </div>
                </div>
              ))}

              {/* Legend */}
              <div className="flex items-center justify-end gap-2 mt-4 text-xs text-zinc-500">
                <span>Low</span>
                <div className="flex gap-0.5">
                  {[10, 30, 50, 70, 90].map((v) => (
                    <div
                      key={v}
                      className="w-4 h-4 rounded-sm"
                      style={{ backgroundColor: `rgba(139, 92, 246, ${v / 100})` }}
                    />
                  ))}
                </div>
                <span>High</span>
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
    </div>
  );
}
