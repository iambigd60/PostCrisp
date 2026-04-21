"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface AuditEntry {
  id: string;
  actor_id: string | null;
  target_user_id: string;
  action: string;
  from_value: string | null;
  to_value: string | null;
  reason: string | null;
  created_at: string;
  actor: { email: string; full_name: string | null } | null;
  target: { email: string; full_name: string | null } | null;
}

interface ListResponse {
  actions: AuditEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const ACTION_META: Record<string, { label: string; color: string; icon: string }> = {
  tier_change:   { label: "Tier change",    color: "bg-sky-500/15 text-sky-300 border-sky-500/20",       icon: "🎚️" },
  role_change:   { label: "Role change",    color: "bg-amber-500/15 text-amber-300 border-amber-500/20", icon: "🛡️" },
  disable:       { label: "Disabled",       color: "bg-red-500/15 text-red-300 border-red-500/20",       icon: "🚫" },
  enable:        { label: "Enabled",        color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20", icon: "✓" },
  credit_grant:  { label: "Credits +",      color: "bg-brand-500/15 text-brand-300 border-brand-500/20", icon: "🪙" },
  credit_adjust: { label: "Credits −",      color: "bg-zinc-500/15 text-zinc-300 border-zinc-500/20",    icon: "🪙" },
  impersonate:   { label: "Impersonate",    color: "bg-purple-500/15 text-purple-300 border-purple-500/20", icon: "👤" },
  password_reset:{ label: "Password reset", color: "bg-sky-500/15 text-sky-300 border-sky-500/20",       icon: "🔑" },
  note:          { label: "Note",           color: "bg-zinc-500/15 text-zinc-300 border-zinc-500/20",    icon: "📝" },
};

function metaFor(action: string) {
  return ACTION_META[action] ?? { label: action, color: "bg-zinc-500/15 text-zinc-300 border-zinc-500/20", icon: "•" };
}

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

export default function AdminAuditPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("all");
  const [emailInput, setEmailInput] = useState("");
  const [targetEmail, setTargetEmail] = useState("");
  const [windowDays, setWindowDays] = useState("30");
  const [page, setPage] = useState(1);
  const { addToast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ action, targetEmail, window: windowDays, page: String(page) });
      const res = await apiFetch<ListResponse>(`/api/admin/audit?${params.toString()}`);
      setData(res);
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Failed to load audit log", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [action, targetEmail, windowDays, page]); // eslint-disable-line

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setTargetEmail(emailInput.trim().toLowerCase());
  };

  const resetFilters = () => {
    setAction("all");
    setEmailInput("");
    setTargetEmail("");
    setWindowDays("30");
    setPage(1);
  };

  const activeFilters = useMemo(
    () => [action !== "all", targetEmail !== "", windowDays !== "30"].filter(Boolean).length,
    [action, targetEmail, windowDays]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Audit Log</h1>
        <p className="text-zinc-500 mt-1">
          {data ? `${data.total.toLocaleString()} admin action${data.total === 1 ? "" : "s"}` : "Loading…"}
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 space-y-3">
        <form onSubmit={handleEmailSubmit} className="flex gap-2">
          <input
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="Search by target user email…"
            className="flex-1 rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-2 text-sm focus:outline-none focus:border-brand-500/40"
          />
          <Button size="sm" type="submit">Search</Button>
        </form>
        <div className="flex flex-wrap gap-3 items-center">
          <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500/40">
            <option value="all">All actions</option>
            <option value="tier_change">Tier changes</option>
            <option value="role_change">Role changes</option>
            <option value="disable">Disables</option>
            <option value="enable">Enables</option>
            <option value="credit_grant">Credits granted</option>
            <option value="credit_adjust">Credits adjusted</option>
            <option value="impersonate">Impersonations</option>
            <option value="password_reset">Password resets</option>
            <option value="note">Notes</option>
          </select>
          <select value={windowDays} onChange={(e) => { setWindowDays(e.target.value); setPage(1); }} className="rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500/40">
            <option value="1">Last 24 hours</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="0">All time</option>
          </select>
          {activeFilters > 0 && (
            <button onClick={resetFilters} className="text-xs text-brand-400 hover:text-brand-300">
              Clear {activeFilters} filter{activeFilters === 1 ? "" : "s"}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-tertiary">
              <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium">Change</th>
                <th className="px-4 py-3 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-500/5">
              {loading && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-500">Loading…</td></tr>
              )}
              {!loading && data && data.actions.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-500">No admin actions match these filters</td></tr>
              )}
              {!loading && data?.actions.map((a) => {
                const meta = metaFor(a.action);
                return (
                  <tr key={a.id} className="hover:bg-surface-tertiary/30 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-zinc-500 whitespace-nowrap" title={new Date(a.created_at).toLocaleString()}>
                      {relativeTime(a.created_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${meta.color}`}>
                        {meta.icon} {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-400">
                      {a.actor?.email ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/users/${a.target_user_id}`} className="text-xs text-brand-400 hover:text-brand-300 truncate">
                        {a.target?.email ?? "(deleted)"}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-zinc-400 whitespace-nowrap">
                      {a.from_value != null && a.to_value != null
                        ? <><span className="text-zinc-500">{a.from_value}</span> → <span className="text-zinc-200">{a.to_value}</span></>
                        : a.to_value != null
                          ? <span className="text-zinc-200">{a.to_value}</span>
                          : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-400 max-w-xs truncate" title={a.reason ?? undefined}>
                      {a.reason ?? <span className="text-zinc-600 italic">no reason given</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
