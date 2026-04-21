"use client";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type Status = "new" | "in_progress" | "resolved";
type Category = "bug" | "feature" | "general";

interface FeedbackEntry {
  id: string;
  user_id: string | null;
  message: string;
  category: Category | null;
  url: string | null;
  user_agent: string | null;
  status: Status;
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  user: { email: string; full_name: string | null } | null;
}

interface ListResponse {
  feedback: FeedbackEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  new:          { label: "New",         color: "bg-sky-500/15 text-sky-300 border-sky-500/20" },
  in_progress:  { label: "In progress", color: "bg-amber-500/15 text-amber-300 border-amber-500/20" },
  resolved:     { label: "Resolved",    color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20" },
};

const CATEGORY_META: Record<Category, { label: string; icon: string }> = {
  bug:     { label: "Bug",     icon: "🐛" },
  feature: { label: "Idea",    icon: "💡" },
  general: { label: "General", icon: "💬" },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AdminFeedbackPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");
  const [page, setPage] = useState(1);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const { addToast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter, category: categoryFilter, page: String(page) });
      const res = await apiFetch<ListResponse>(`/api/admin/feedback?${params.toString()}`);
      setData(res);
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Failed to load feedback", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter, categoryFilter, page]); // eslint-disable-line

  const updateEntry = async (id: string, patch: { status?: Status; admin_notes?: string }) => {
    try {
      await apiFetch("/api/admin/feedback", {
        method: "PATCH",
        body: JSON.stringify({ id, ...patch }),
      });
      addToast("Updated", "success");
      await load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Update failed", "error");
    }
  };

  const stats = useMemo(() => {
    if (!data) return { new: 0, in_progress: 0, resolved: 0 };
    return data.feedback.reduce(
      (acc, f) => {
        acc[f.status] = (acc[f.status] ?? 0) + 1;
        return acc;
      },
      { new: 0, in_progress: 0, resolved: 0 } as Record<Status, number>
    );
  }, [data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Feedback</h1>
        <p className="text-zinc-500 mt-1">
          {data ? `${data.total.toLocaleString()} total — ${stats.new} new on this page` : "Loading…"}
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 flex flex-wrap gap-3 items-center">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as Status | "all"); setPage(1); }}
          className="rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500/40"
        >
          <option value="all">All statuses</option>
          <option value="new">New</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value as Category | "all"); setPage(1); }}
          className="rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500/40"
        >
          <option value="all">All categories</option>
          <option value="bug">🐛 Bugs</option>
          <option value="feature">💡 Ideas</option>
          <option value="general">💬 General</option>
        </select>
      </div>

      {/* Entries */}
      <div className="space-y-3">
        {loading && <p className="text-zinc-500 text-center py-10">Loading…</p>}
        {!loading && data && data.feedback.length === 0 && (
          <p className="text-zinc-500 text-center py-10">No feedback matching these filters.</p>
        )}
        {!loading && data?.feedback.map((f) => {
          const statusMeta = STATUS_META[f.status];
          const catMeta = f.category ? CATEGORY_META[f.category] : null;
          const notes = notesDraft[f.id] ?? f.admin_notes ?? "";
          const notesDirty = notes !== (f.admin_notes ?? "");

          return (
            <div key={f.id} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusMeta.color}`}>
                    {statusMeta.label}
                  </span>
                  {catMeta && (
                    <span className="text-2xs font-semibold text-zinc-400 bg-surface-tertiary px-2 py-0.5 rounded-full">
                      {catMeta.icon} {catMeta.label}
                    </span>
                  )}
                  <span className="text-xs text-zinc-500">
                    {f.user?.email ?? "(anonymous)"} · {relativeTime(f.created_at)}
                  </span>
                  {f.url && (
                    <span className="text-xs text-zinc-600 font-mono">{f.url}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {f.status !== "in_progress" && (
                    <Button size="sm" variant="secondary" onClick={() => updateEntry(f.id, { status: "in_progress" })}>
                      Mark in progress
                    </Button>
                  )}
                  {f.status !== "resolved" && (
                    <Button size="sm" onClick={() => updateEntry(f.id, { status: "resolved" })}>
                      Resolve
                    </Button>
                  )}
                  {f.status === "resolved" && (
                    <Button size="sm" variant="secondary" onClick={() => updateEntry(f.id, { status: "new" })}>
                      Reopen
                    </Button>
                  )}
                </div>
              </div>

              <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">{f.message}</p>

              <details className="text-xs">
                <summary className="text-zinc-500 cursor-pointer hover:text-zinc-300">
                  {f.admin_notes ? "Admin notes + details" : "Add admin notes + details"}
                </summary>
                <div className="mt-2 space-y-2">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotesDraft({ ...notesDraft, [f.id]: e.target.value })}
                    placeholder="Private admin notes (not shown to user)"
                    rows={2}
                    className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-3 py-2 text-xs focus:outline-none focus:border-brand-500/40 resize-none"
                  />
                  {notesDirty && (
                    <Button size="sm" variant="secondary" onClick={() => updateEntry(f.id, { admin_notes: notes })}>
                      Save note
                    </Button>
                  )}
                  {f.user_agent && (
                    <p className="text-2xs text-zinc-600 font-mono break-all">UA: {f.user_agent}</p>
                  )}
                </div>
              </details>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-zinc-500">
            Page {data.page} of {data.totalPages}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={data.page <= 1}>
              ← Previous
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={data.page >= data.totalPages}>
              Next →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
