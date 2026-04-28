"use client";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type InviteCode = {
  code: string;
  created_at: string;
  created_by: string | null;
  notes: string | null;
  used_at: string | null;
  used_by: string | null;
};

type ListResponse = {
  items: InviteCode[];
  stats: { total: number; used: number; available: number };
};

type Filter = "all" | "available" | "used";

function formatCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function AdminInviteCodesPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [count, setCount] = useState(10);
  const [batchNotes, setBatchNotes] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const { addToast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<ListResponse>("/api/admin/invite-codes");
      setData(res);
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Failed to load codes", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = async () => {
    if (count < 1 || count > 100) {
      addToast("Generate between 1 and 100 codes at a time", "error");
      return;
    }
    setGenerating(true);
    try {
      await apiFetch("/api/admin/invite-codes", {
        method: "POST",
        body: JSON.stringify({ count, notes: batchNotes.trim() || undefined }),
      });
      addToast(`Generated ${count} code${count === 1 ? "" : "s"}`, "success");
      setBatchNotes("");
      await load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Generation failed", "error");
    } finally {
      setGenerating(false);
    }
  };

  const remove = async (code: string) => {
    if (!confirm(`Delete invite code ${formatCode(code)}? This can't be undone.`)) return;
    try {
      await apiFetch(`/api/admin/invite-codes?code=${encodeURIComponent(code)}`, { method: "DELETE" });
      addToast("Code deleted", "success");
      await load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Delete failed", "error");
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast("Copied", "success");
    } catch {
      addToast("Copy failed — select and copy manually", "error");
    }
  };

  const copyAllAvailable = async () => {
    if (!data) return;
    const lines = data.items
      .filter((i) => i.used_at === null)
      .map((i) => formatCode(i.code))
      .join("\n");
    if (!lines) {
      addToast("No available codes to copy", "info");
      return;
    }
    await copy(lines);
  };

  const filtered = data?.items.filter((i) => {
    if (filter === "available") return i.used_at === null;
    if (filter === "used") return i.used_at !== null;
    return true;
  }) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Invite Codes</h1>
        <p className="text-zinc-500 mt-1">
          Single-use codes for signup when access control is in invite-only mode. Each code works once and is consumed on signup.
        </p>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Total</div>
            <div className="text-2xl font-bold text-zinc-100 mt-1">{data.stats.total}</div>
          </div>
          <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-5">
            <div className="text-xs uppercase tracking-wider text-emerald-300">Available</div>
            <div className="text-2xl font-bold text-emerald-200 mt-1">{data.stats.available}</div>
          </div>
          <div className="rounded-xl border border-zinc-500/10 bg-surface-secondary p-5">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Used</div>
            <div className="text-2xl font-bold text-zinc-300 mt-1">{data.stats.used}</div>
          </div>
        </div>
      )}

      {/* Generate batch */}
      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-6">
        <h2 className="text-sm font-semibold text-zinc-200 mb-1">Generate codes</h2>
        <p className="text-xs text-zinc-500 mb-4">Random 8-character codes. Display format <code className="text-brand-300">XXXX-XXXX</code> for legibility — testers can paste with or without the dash.</p>

        <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr_auto] gap-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Count</label>
            <input
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-brand-500/40"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Notes (optional)</label>
            <input
              type="text"
              value={batchNotes}
              onChange={(e) => setBatchNotes(e.target.value)}
              placeholder="e.g. Twitter beta wave 2026-04"
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-brand-500/40"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={generate} loading={generating} disabled={generating}>
              Generate
            </Button>
          </div>
        </div>
      </div>

      {/* Filter + bulk actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["all", "available", "used"] as Filter[]).map((f) => {
            const count = data
              ? f === "all"
                ? data.stats.total
                : f === "available"
                ? data.stats.available
                : data.stats.used
              : 0;
            const label = f === "all" ? "All" : f === "available" ? "✅ Available" : "🔒 Used";
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                  filter === f
                    ? "bg-brand-600/20 text-brand-300 border border-brand-500/30"
                    : "bg-surface-secondary text-zinc-400 hover:bg-surface-hover hover:text-zinc-200"
                }`}
              >
                <span>{label}</span>
                <span className="text-2xs text-zinc-500 bg-surface-tertiary px-1.5 py-0.5 rounded-full">{count}</span>
              </button>
            );
          })}
        </div>

        <Button variant="ghost" size="sm" onClick={copyAllAvailable} disabled={!data || data.stats.available === 0}>
          📋 Copy all available
        </Button>
      </div>

      {/* List */}
      {loading && <div className="text-zinc-500 text-sm">Loading…</div>}

      {!loading && filtered.length === 0 && (
        <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-8 text-center text-zinc-500 text-sm">
          {filter === "all" && "No invite codes yet — generate a batch above."}
          {filter === "available" && "No unused codes. Generate more above."}
          {filter === "used" && "No codes have been claimed yet."}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="rounded-xl border border-brand-500/10 bg-surface-secondary overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 border-b border-brand-500/10">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 hidden md:table-cell">Notes</th>
                <th className="px-4 py-3 hidden lg:table-cell">Created</th>
                <th className="px-4 py-3 hidden lg:table-cell">Used</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const used = item.used_at !== null;
                return (
                  <tr key={item.code} className="border-b border-brand-500/5 last:border-b-0">
                    <td className="px-4 py-3 font-mono text-brand-300">{formatCode(item.code)}</td>
                    <td className="px-4 py-3">
                      {used ? (
                        <span className="text-2xs px-2 py-0.5 rounded-full bg-zinc-500/10 text-zinc-400">🔒 Used</span>
                      ) : (
                        <span className="text-2xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300">✅ Available</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-zinc-400 text-xs">{item.notes ?? "—"}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-zinc-500 text-xs">{formatDate(item.created_at)}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-zinc-500 text-xs">
                      {item.used_at ? formatDate(item.used_at) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => copy(formatCode(item.code))}
                          className="text-xs text-brand-400 hover:text-brand-300"
                          title="Copy code"
                        >
                          📋 Copy
                        </button>
                        {!used && (
                          <button
                            onClick={() => remove(item.code)}
                            className="text-xs text-red-400 hover:text-red-300"
                            title="Delete"
                          >
                            🗑 Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Help block */}
      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 text-xs text-zinc-400">
        <strong className="block text-zinc-200 mb-1">How testers use a code</strong>
        On <code className="text-brand-300">/signup</code> when access control is in <em>invite-only</em> mode, they paste the 8-character code (with or without the dash). Codes are case-insensitive on input. Once a tester signs up, the code is consumed and can&apos;t be reused.
      </div>
    </div>
  );
}
