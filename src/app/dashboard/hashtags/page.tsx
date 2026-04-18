"use client";
import { useState, useEffect, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { apiFetch, ApiError } from "@/lib/api";
import { CopyButton } from "@/components/ui/CopyButton";
import { GenerationLoader } from "@/components/ui/GenerationLoader";
import { InlineError } from "@/components/ui/ErrorBoundary";
import { SkeletonHashtags } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { HashtagResult } from "@/lib/constants";
import { HASHTAG_MESSAGES } from "@/lib/constants";

export default function HashtagsPage() {
  const [query, setQuery] = useState("");
  const [hashtags, setHashtags] = useState<HashtagResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const debouncedQuery = useDebounce(query, 500);
  const { addToast } = useToast();

  const fetchHashtags = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const data = await apiFetch<{ hashtags: HashtagResult[] }>(`/api/hashtags?q=${encodeURIComponent(q)}`);
      setHashtags(data.hashtags);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to fetch hashtags";
      setError(msg);
      addToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) {
      fetchHashtags(debouncedQuery);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const allHashtagsText = useMemo(
    () => hashtags.map((h) => h.tag).join(" "),
    [hashtags]
  );

  const scoreColor = (score: number) => {
    if (score >= 85) return "text-emerald-400 bg-emerald-500/10";
    if (score >= 65) return "text-amber-400 bg-amber-500/10";
    return "text-zinc-400 bg-zinc-500/10";
  };

  const handleSaveAll = async () => {
    try {
      await apiFetch("/api/saved", {
        method: "POST",
        body: JSON.stringify({ type: "hashtags", content: allHashtagsText, platform: "general" }),
      });
      addToast("Hashtag set saved!", "success");
    } catch {
      addToast("Failed to save hashtags", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Hashtag Finder</h1>
        <p className="text-zinc-500 mt-1">Search for trending hashtags with engagement scores.</p>
      </div>

      {/* Search */}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">🔍</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a topic (e.g., fitness, cooking, travel)..."
          className="w-full rounded-xl bg-surface-secondary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:border-brand-500/40 focus:ring-1 focus:ring-brand-500/20 transition-colors min-h-[48px]"
          id="hashtag-search"
        />
      </div>

      {/* Loading */}
      {loading && !hashtags.length && (
        <GenerationLoader messages={HASHTAG_MESSAGES} />
      )}
      {loading && hashtags.length > 0 && <SkeletonHashtags />}

      {/* Error */}
      {error && !loading && (
        <InlineError message={error} onRetry={() => fetchHashtags(query)} />
      )}

      {/* Results */}
      {hashtags.length > 0 && !loading && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-200">
              {hashtags.length} hashtags found
            </h2>
            <div className="flex gap-2">
              <CopyButton text={allHashtagsText} label="Copy All" />
              <Button variant="secondary" size="sm" onClick={handleSaveAll}>💾 Save Set</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {hashtags.map((h) => (
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
      )}

      {/* Empty state */}
      {!loading && !error && !searched && (
        <div className="text-center py-16 text-zinc-500">
          <span className="text-4xl block mb-4">🏷️</span>
          <p>Search for a topic to find trending hashtags</p>
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
