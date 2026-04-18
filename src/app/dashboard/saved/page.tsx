"use client";
import { useState, useEffect } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { CopyButton } from "@/components/ui/CopyButton";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineError } from "@/components/ui/ErrorBoundary";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import type { SavedItem } from "@/lib/constants";

export default function SavedPage() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "caption" | "hashtags">("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { addToast } = useToast();

  const fetchSaved = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ items: SavedItem[] }>("/api/saved");
      setItems(data.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load saved content");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSaved(); }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/saved?id=${deleteId}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== deleteId));
      addToast("Item deleted", "success");
    } catch {
      addToast("Failed to delete item", "error");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const filtered = filter === "all" ? items : items.filter((i) => i.type === filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Saved Content</h1>
        <p className="text-zinc-500 mt-1">Your saved captions and hashtag sets.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "caption", "hashtags"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
              filter === f
                ? "bg-brand-600/20 text-brand-300 border border-brand-500/30"
                : "bg-surface-secondary text-zinc-400 hover:bg-surface-hover hover:text-zinc-200"
            }`}
          >
            {f === "all" ? "All" : f === "caption" ? "✍️ Captions" : "🏷️ Hashtags"}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && <SkeletonGrid count={6} />}

      {/* Error */}
      {error && !loading && <InlineError message={error} onRetry={fetchSaved} />}

      {/* Content */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 hover:border-brand-500/20 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
                  item.type === "caption"
                    ? "bg-brand-500/10 text-brand-300"
                    : "bg-blue-500/10 text-blue-300"
                }`}>
                  {item.type === "caption" ? "✍️ Caption" : "🏷️ Hashtags"}
                </span>
                <span className="text-xs text-zinc-600">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-zinc-300 whitespace-pre-wrap mb-4 line-clamp-4">
                {item.content}
              </p>
              <div className="flex items-center gap-2">
                <CopyButton text={item.content} />
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setDeleteId(item.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && items.length === 0 && (
        <EmptyState
          icon="💾"
          title="No saved content yet"
          description="Start generating captions or finding hashtags, then save your favorites!"
          actionLabel="Generate Captions"
          actionHref="/dashboard/generate"
        />
      )}

      {!loading && !error && filtered.length === 0 && items.length > 0 && (
        <div className="text-center py-12 text-zinc-500">
          <span className="text-3xl block mb-3">🔍</span>
          <p>No {filter === "caption" ? "captions" : "hashtag sets"} saved yet.</p>
        </div>
      )}

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Item"
      >
        <p className="text-zinc-400 mb-6">Are you sure you want to delete this item? This cannot be undone.</p>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
