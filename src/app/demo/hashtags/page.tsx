"use client";
import { useState, useMemo } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { Button } from "@/components/ui/Button";

const MOCK_HASHTAGS = [
  { tag: "#fitnessmotivation", score: 94, posts: "48.2M" },
  { tag: "#homeworkout", score: 91, posts: "26.1M" },
  { tag: "#fitlife", score: 88, posts: "31.5M" },
  { tag: "#fitnessjourney", score: 86, posts: "18.9M" },
  { tag: "#workoutmotivation", score: 82, posts: "12.4M" },
  { tag: "#transformation", score: 79, posts: "22.8M" },
  { tag: "#trainhard", score: 76, posts: "9.3M" },
  { tag: "#healthyliving", score: 74, posts: "15.7M" },
  { tag: "#gainsbaby", score: 71, posts: "4.2M" },
  { tag: "#pushday", score: 69, posts: "7.1M" },
  { tag: "#fitover40", score: 67, posts: "2.8M" },
  { tag: "#nogymnoproblem", score: 64, posts: "3.1M" },
  { tag: "#strengthtraining", score: 62, posts: "6.8M" },
  { tag: "#mobilitywork", score: 58, posts: "1.4M" },
  { tag: "#dailygrind", score: 55, posts: "11.2M" },
  { tag: "#progressoverperfection", score: 52, posts: "890K" },
  { tag: "#functionalfitness", score: 48, posts: "2.2M" },
  { tag: "#movementismedicine", score: 42, posts: "520K" },
];

export default function DemoHashtagsPage() {
  const [query, setQuery] = useState("fitness");

  const allHashtagsText = useMemo(
    () => MOCK_HASHTAGS.map((h) => h.tag).join(" "),
    []
  );

  const scoreColor = (score: number) => {
    if (score >= 85) return "text-emerald-400 bg-emerald-500/10";
    if (score >= 65) return "text-amber-400 bg-amber-500/10";
    return "text-zinc-400 bg-zinc-500/10";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Hashtag Finder</h1>
        <p className="text-zinc-500 mt-1">Search for trending hashtags with engagement scores.</p>
      </div>

      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">🔍</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl bg-surface-secondary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:border-brand-500/40 focus:ring-1 focus:ring-brand-500/20 transition-colors min-h-[48px]"
        />
      </div>

      <div className="space-y-4 animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-200">
            {MOCK_HASHTAGS.length} hashtags found
          </h2>
          <div className="flex gap-2">
            <CopyButton text={allHashtagsText} label="Copy All" />
            <Button variant="secondary" size="sm">💾 Save Set</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MOCK_HASHTAGS.map((h) => (
            <div
              key={h.tag}
              className="flex items-center justify-between rounded-xl border border-brand-500/10 bg-surface-secondary p-4 hover:border-brand-500/20 transition-all group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-brand-300 truncate">{h.tag}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{h.posts} posts</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${scoreColor(h.score)}`}>
                  {h.score}
                </span>
                <CopyButton text={h.tag} variant="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
