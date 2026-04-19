"use client";
import { useMemo, useState } from "react";
import { PLATFORMS } from "@/lib/constants";
import { apiFetch, ApiError } from "@/lib/api";
import { CopyButton } from "@/components/ui/CopyButton";
import { GenerationLoader } from "@/components/ui/GenerationLoader";
import { InlineError } from "@/components/ui/ErrorBoundary";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { HASHTAG_MESSAGES } from "@/lib/constants";

type Category = "HIGH_REACH" | "MEDIUM_REACH" | "LOW_COMPETITION";

interface Hashtag {
  tag: string;
  score: number;
  posts: string;
  category: Category;
}

const CATEGORY_META: Record<Category, { label: string; chip: string; badge: string; desc: string }> = {
  HIGH_REACH: {
    label: "High reach",
    chip: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:border-emerald-400/40",
    badge: "bg-emerald-500/15 text-emerald-300",
    desc: "Popular — broad audience, high competition",
  },
  MEDIUM_REACH: {
    label: "Medium reach",
    chip: "bg-amber-500/10 border-amber-500/20 text-amber-200 hover:border-amber-400/40",
    badge: "bg-amber-500/15 text-amber-300",
    desc: "Balanced — moderate competition, good discovery",
  },
  LOW_COMPETITION: {
    label: "Low competition",
    chip: "bg-sky-500/10 border-sky-500/20 text-sky-200 hover:border-sky-400/40",
    badge: "bg-sky-500/15 text-sky-300",
    desc: "Niche — easier to rank, more engaged audiences",
  },
};

export default function HashtagsPage() {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [count, setCount] = useState(20);
  const [mix, setMix] = useState(0.5);
  const [hashtags, setHashtags] = useState<Hashtag[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const { addToast } = useToast();

  const grouped = useMemo(() => {
    const groups: Record<Category, Hashtag[]> = { HIGH_REACH: [], MEDIUM_REACH: [], LOW_COMPETITION: [] };
    for (const h of hashtags) {
      const cat = (h.category || "MEDIUM_REACH") as Category;
      if (groups[cat]) groups[cat].push(h);
      else groups.MEDIUM_REACH.push(h);
    }
    return groups;
  }, [hashtags]);

  const selectedText = useMemo(
    () => hashtags.filter((h) => selected.has(h.tag)).map((h) => h.tag).join(" "),
    [hashtags, selected]
  );
  const allText = useMemo(() => hashtags.map((h) => h.tag).join(" "), [hashtags]);

  const fetchHashtags = async () => {
    const q = query.trim();
    if (!q) {
      addToast("Enter a topic or niche to search", "warning");
      return;
    }
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const params = new URLSearchParams({ q, platform, count: String(count), mix: String(mix) });
      const data = await apiFetch<{ hashtags: Hashtag[] }>(`/api/hashtags?${params.toString()}`);
      setHashtags(data.hashtags);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to fetch hashtags");
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const selectOptimalMix = () => {
    // Balanced pick: top 2 high-reach, top 3 medium-reach, top 3 low-competition (or whatever exists)
    const pick = (arr: Hashtag[], n: number) => arr.slice(0, n).map((h) => h.tag);
    const next = new Set<string>([
      ...pick(grouped.HIGH_REACH, 2),
      ...pick(grouped.MEDIUM_REACH, 3),
      ...pick(grouped.LOW_COMPETITION, 3),
    ]);
    setSelected(next);
    addToast(`${next.size} optimal hashtags selected`, "success");
  };

  const handleSaveSet = async () => {
    const text = selected.size > 0 ? selectedText : allText;
    if (!text) { addToast("Nothing to save", "warning"); return; }
    try {
      await apiFetch("/api/saved", {
        method: "POST",
        body: JSON.stringify({ type: "hashtags", content: text, platform, topic: query }),
      });
      addToast("Hashtag set saved!", "success");
    } catch {
      addToast("Failed to save", "error");
    }
  };

  const platformRecommendation = (() => {
    switch (platform) {
      case "instagram": return "Recommended: 20-30 hashtags";
      case "tiktok":    return "Recommended: 3-5 hashtags";
      case "youtube":   return "Recommended: 5-15 tags";
      case "x":         return "Recommended: 1-2 hashtags";
      case "threads":   return "Recommended: 1-3 hashtags";
      case "facebook":  return "Recommended: 1-3 hashtags";
      case "linkedin":  return "Recommended: 3-5 hashtags";
      default:          return "";
    }
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Hashtag Finder</h1>
        <p className="text-zinc-500 mt-1">Discover the right mix of trending and niche hashtags.</p>
      </div>

      {/* Input form */}
      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
        {/* Topic */}
        <div>
          <label htmlFor="q" className="block text-sm font-medium text-zinc-300 mb-2">
            Topic or niche
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">🔍</span>
            <input
              id="q"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") fetchHashtags(); }}
              placeholder="e.g., fitness, cooking, travel, personal finance..."
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-brand-500/40 focus:ring-1 focus:ring-brand-500/20 transition-colors min-h-[48px]"
            />
          </div>
        </div>

        {/* Platform */}
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

        {/* Count slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="count" className="block text-sm font-medium text-zinc-300">
              Number of hashtags
            </label>
            <span className="text-sm font-mono text-brand-300">{count}</span>
          </div>
          <input
            id="count"
            type="range"
            min={10}
            max={30}
            step={1}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-full accent-brand-500"
          />
          <div className="flex justify-between text-2xs text-zinc-600 mt-1">
            <span>10</span><span>20</span><span>30</span>
          </div>
        </div>

        {/* Mix slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="mix" className="block text-sm font-medium text-zinc-300">
              Mix preference
            </label>
            <span className="text-xs text-zinc-500">
              {mix < 0.33 ? "Popular-heavy" : mix > 0.66 ? "Niche-heavy" : "Balanced"}
            </span>
          </div>
          <input
            id="mix"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={mix}
            onChange={(e) => setMix(Number(e.target.value))}
            className="w-full accent-brand-500"
          />
          <div className="flex justify-between text-2xs text-zinc-600 mt-1">
            <span>← Popular</span><span>Balanced</span><span>Niche →</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={fetchHashtags} loading={loading} size="lg" className="flex-1 sm:flex-none">
            {loading ? "Finding hashtags..." : "🔍 Find Hashtags"}
          </Button>
          {platformRecommendation && (
            <span className="text-xs text-zinc-500 hidden sm:block">{platformRecommendation}</span>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && hashtags.length === 0 && <GenerationLoader messages={HASHTAG_MESSAGES} />}

      {/* Error */}
      {error && !loading && <InlineError message={error} onRetry={fetchHashtags} />}

      {/* Results */}
      {hashtags.length > 0 && !loading && (
        <div className="space-y-5 animate-fade-in">
          {/* Action bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-surface-secondary border border-brand-500/10">
            <div className="text-sm">
              <span className="font-semibold text-zinc-200">{hashtags.length}</span>
              <span className="text-zinc-500"> hashtags · </span>
              <span className="font-semibold text-brand-300">{selected.size}</span>
              <span className="text-zinc-500"> selected</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={selectOptimalMix}>
                ✨ Select Optimal Mix
              </Button>
              <CopyButton text={selectedText || allText} label={selected.size > 0 ? "Copy Selected" : "Copy All"} />
              <Button variant="secondary" size="sm" onClick={handleSaveSet}>
                💾 Save Set
              </Button>
            </div>
          </div>

          {/* Grouped chips */}
          {(["HIGH_REACH", "MEDIUM_REACH", "LOW_COMPETITION"] as Category[]).map((cat) => {
            const meta = CATEGORY_META[cat];
            const items = grouped[cat];
            if (!items.length) return null;
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${meta.badge}`}>
                    {meta.label}
                  </span>
                  <span className="text-xs text-zinc-500">{meta.desc}</span>
                  <span className="text-xs text-zinc-600 ml-auto">{items.length}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {items.map((h) => {
                    const isSelected = selected.has(h.tag);
                    return (
                      <button
                        key={h.tag}
                        onClick={() => toggleTag(h.tag)}
                        className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                          isSelected
                            ? "bg-brand-600/20 text-brand-200 border-brand-500/40 shadow-glow"
                            : meta.chip + " border"
                        }`}
                      >
                        {isSelected && <span className="text-brand-300">✓</span>}
                        <span>{h.tag}</span>
                        <span className="text-2xs text-zinc-500 font-mono">{h.posts}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !searched && (
        <div className="text-center py-16 text-zinc-500">
          <span className="text-4xl block mb-4">🏷️</span>
          <p>Enter a topic above and click Find Hashtags to start.</p>
        </div>
      )}

      {!loading && !error && searched && hashtags.length === 0 && (
        <div className="text-center py-12 text-zinc-500">
          <span className="text-3xl block mb-3">🤷</span>
          <p>No hashtags found for &quot;{query}&quot;. Try a different search.</p>
        </div>
      )}
    </div>
  );
}
