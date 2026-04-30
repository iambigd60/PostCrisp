"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { TIER_LABELS, tierFromDbValue } from "@/lib/crisp-engine-config";

interface UserListItem {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  subscription_tier: string;
  role: string;
  credits_balance: number;
  credits_reset_at: string;
  daily_generations_used: number;
  created_at: string;
  generations_this_month: number;
}

interface ListResponse {
  users: UserListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const tierBadge: Record<string, string> = {
  starter: "bg-zinc-500/15 text-zinc-300 border-zinc-500/20",
  creator: "bg-brand-500/15 text-brand-300 border-brand-500/20",
  elite:   "bg-amber-500/15 text-amber-300 border-amber-500/20",
};

function avatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash << 5) - hash + str.charCodeAt(i);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 45%)`;
}

export default function UsersListPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [tier, setTier] = useState("all");
  const [role, setRole] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const { addToast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search, tier, role, sort, page: String(page) });
      const res = await apiFetch<ListResponse>(`/api/admin/users?${params.toString()}`);
      setData(res);
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Failed to load users", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search, tier, role, sort, page]); // eslint-disable-line

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setTier("all");
    setRole("all");
    setSort("newest");
    setPage(1);
  };

  const activeFilters = useMemo(() => [search, tier, role].filter((v) => v && v !== "all").length, [search, tier, role]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Users</h1>
        <p className="text-zinc-500 mt-1">
          {data ? `${data.total.toLocaleString()} total users` : "Loading…"}
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by email…"
            className="flex-1 rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-2 text-sm focus:outline-none focus:border-brand-500/40"
          />
          <Button size="sm" type="submit">Search</Button>
        </form>
        <div className="flex flex-wrap gap-3 items-center">
          <select value={tier} onChange={(e) => { setTier(e.target.value); setPage(1); }} className="rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500/40">
            <option value="all">All tiers</option>
            <option value="free">Starter</option>
            <option value="creator">Creator</option>
            <option value="elite">Elite</option>
          </select>
          <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500/40">
            <option value="all">All roles</option>
            <option value="user">Users</option>
            <option value="admin">Admins</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500/40">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="credits">Highest credits</option>
            <option value="usage">Most daily usage</option>
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
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium text-right">Credits</th>
                <th className="px-4 py-3 font-medium text-right">Gens / mo</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-500/5">
              {loading && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-zinc-500">Loading…</td></tr>
              )}
              {!loading && data && data.users.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-zinc-500">No users match these filters</td></tr>
              )}
              {!loading && data?.users.map((u) => {
                const tierId = tierFromDbValue(u.subscription_tier);
                const initial = (u.full_name ?? u.email).slice(0, 1).toUpperCase();
                return (
                  <tr key={u.id} className="hover:bg-surface-tertiary/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: avatarColor(u.email) }}
                        >
                          {initial}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm text-zinc-200 truncate">{u.full_name ?? "—"}</span>
                          <span className="text-xs text-zinc-500 truncate">{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${tierBadge[tierId]}`}>
                        {TIER_LABELS[tierId]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {u.role === "admin" ? (
                        <span className="text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20">🛡️ admin</span>
                      ) : (
                        <span className="text-2xs text-zinc-500">user</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-zinc-300">{u.credits_balance.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-zinc-400">{u.generations_this_month.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-xs text-zinc-500 whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/admin/users/${u.id}`} className="text-xs text-brand-400 hover:text-brand-300 font-medium">
                        Manage →
                      </Link>
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
