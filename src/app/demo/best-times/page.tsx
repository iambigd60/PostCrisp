"use client";
import { useState, useMemo } from "react";
import { PLATFORMS, DAYS } from "@/lib/constants";

// Mock: 7 days (Mon-Sun) x 24 hours with realistic engagement patterns
const MOCK_WEEK_DATA: number[][] = [
  // Mon: low overnight, builds to lunch peak, dips, evening bump
  [8, 5, 3, 2, 2, 4, 12, 28, 45, 58, 68, 75, 82, 72, 60, 52, 58, 65, 78, 85, 72, 52, 28, 15],
  // Tue: similar but slightly higher peaks
  [7, 4, 3, 2, 3, 5, 14, 32, 50, 62, 72, 82, 95, 80, 62, 55, 62, 70, 82, 88, 75, 55, 30, 16],
  // Wed: mid-week lull, but solid lunch
  [9, 5, 3, 2, 2, 4, 13, 30, 48, 60, 70, 78, 88, 75, 60, 52, 58, 68, 80, 85, 70, 50, 28, 14],
  // Thu: strong evening
  [10, 6, 4, 3, 3, 5, 15, 33, 52, 65, 74, 80, 86, 74, 60, 54, 62, 72, 85, 92, 80, 60, 35, 18],
  // Fri: winds down earlier
  [12, 8, 5, 3, 3, 6, 18, 38, 58, 68, 75, 82, 85, 72, 58, 50, 55, 62, 72, 78, 68, 48, 28, 15],
  // Sat: late start, strong afternoon/evening
  [22, 15, 8, 4, 3, 4, 8, 18, 32, 50, 65, 75, 80, 82, 78, 72, 68, 70, 75, 82, 85, 70, 48, 28],
  // Sun: similar to Sat, quieter
  [20, 14, 7, 3, 3, 5, 10, 22, 38, 55, 68, 72, 75, 78, 72, 65, 60, 62, 68, 72, 65, 50, 32, 20],
];

const MOCK_TOP_SLOTS = [
  { day: "Tuesday", time: "12:00 PM", score: 95, reason: "Peak lunch-break scrolling — highest engagement across weekdays" },
  { day: "Thursday", time: "7:00 PM", score: 92, reason: "Evening wind-down creates maximum discovery potential" },
  { day: "Saturday", time: "8:00 PM", score: 85, reason: "Weekend prime-time for entertainment content" },
  { day: "Wednesday", time: "12:00 PM", score: 88, reason: "Midweek lunch spike — consistent performer" },
  { day: "Monday", time: "7:00 PM", score: 82, reason: "End-of-day scroll after commute or dinner" },
];

const MOCK_TIPS = [
  "Post 15-30 minutes before peak hours so the algorithm has time to surface your content during the spike.",
  "Reels and short video consistently outperform static posts on Instagram between 6-9 PM — prioritize video for evening slots.",
  "Your audience is most active on weekend afternoons — save your highest-effort content for Saturday 6-8 PM.",
];

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

export default function DemoBestTimesPage() {
  const [platform, setPlatform] = useState("instagram");

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

      <div className="space-y-6 animate-fade-in">
        <div className="space-y-2">
          {MOCK_TIPS.map((tip, i) => (
            <div key={i} className="rounded-xl bg-brand-900/20 border border-brand-500/20 p-4 flex items-start gap-3">
              <span className="text-xl flex-shrink-0">💡</span>
              <p className="text-sm text-zinc-300">{tip}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 sm:p-6 overflow-x-auto">
          <h2 className="text-lg font-semibold text-zinc-200 mb-4">Weekly Engagement Heatmap</h2>
          <div className="min-w-[600px]">
            <div className="flex mb-1 pl-12">
              {hourLabels.map((label, i) => (
                <div key={i} className="flex-1 text-center text-2xs text-zinc-600">{label}</div>
              ))}
            </div>

            {MOCK_WEEK_DATA.map((dayData, dayIndex) => (
              <div key={dayIndex} className="flex items-center gap-1 mb-1">
                <span className="w-10 text-xs text-zinc-500 text-right flex-shrink-0">{DAYS[dayIndex]}</span>
                <div className="flex-1 grid grid-cols-24 gap-0.5">
                  {dayData.map((value, hourIndex) => (
                    <HeatmapCell key={hourIndex} value={value} />
                  ))}
                </div>
              </div>
            ))}

            <div className="flex items-center justify-end gap-2 mt-4 text-xs text-zinc-500">
              <span>Low</span>
              <div className="flex gap-0.5">
                {[10, 30, 50, 70, 90].map((v) => (
                  <div key={v} className="w-4 h-4 rounded-sm" style={{ backgroundColor: `rgba(139, 92, 246, ${v / 100})` }} />
                ))}
              </div>
              <span>High</span>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-base font-semibold text-zinc-200 mb-3">Top 5 Time Slots</h2>
          <div className="space-y-2">
            {MOCK_TOP_SLOTS.map((slot, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-brand-500/10 bg-surface-secondary">
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
    </div>
  );
}
