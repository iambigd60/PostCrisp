"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { TIER_LABELS, tierFromDbValue, type Tier } from "@/lib/crisp-engine-config";

interface UserDetail {
  profile: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    subscription_tier: string;
    role: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    credits_balance: number;
    credits_reset_at: string;
    daily_generations_used: number;
    created_at: string;
    updated_at: string;
    tier: Tier;
    tierLabel: string;
  };
  isDisabled: boolean;
  aggregates: {
    totalGenerations: number;
    totalTokens: number;
    savedCount: number;
    featureBreakdown: { feature: string; count: number; tokens: number }[];
  };
  recentGenerations: Array<{ id: string; feature: string; platform: string | null; created_at: string; tokens_used: number }>;
  creditTransactions: Array<{ id: string; type: string; amount: number; balance_after: number; reason: string | null; task: string | null; created_at: string }>;
  adminActions: Array<{ id: string; actor_id: string; action: string; from_value: string | null; to_value: string | null; reason: string | null; created_at: string; actor?: { email: string } | null }>;
}

const tierBadge: Record<string, string> = {
  starter: "bg-zinc-500/15 text-zinc-300 border-zinc-500/20",
  creator: "bg-brand-500/15 text-brand-300 border-brand-500/20",
  team:    "bg-sky-500/15 text-sky-300 border-sky-500/20",
  elite:   "bg-amber-500/15 text-amber-300 border-amber-500/20",
};

const typeBadge: Record<string, string> = {
  grant:    "bg-emerald-500/10 text-emerald-300",
  consume:  "bg-zinc-500/10 text-zinc-400",
  purchase: "bg-brand-500/10 text-brand-300",
  refund:   "bg-sky-500/10 text-sky-300",
  adjust:   "bg-amber-500/10 text-amber-300",
  reset:    "bg-purple-500/10 text-purple-300",
};

function avatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash << 5) - hash + str.charCodeAt(i);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 45%)`;
}

export default function UserDetailPage() {
  const params = useParams();
  const userId = params?.id as string;

  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Pending edits
  const [newTier, setNewTier] = useState<string>("");
  const [newRole, setNewRole] = useState<string>("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [banning, setBanning] = useState(false);
  const [resettingPw, setResettingPw] = useState(false);

  const { addToast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<UserDetail>(`/api/admin/users/${userId}`);
      setData(res);
      setNewTier(res.profile.subscription_tier);
      setNewRole(res.profile.role);
      setReason("");
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Failed to load", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [userId]); // eslint-disable-line

  const isDirty = data && (newTier !== data.profile.subscription_tier || newRole !== data.profile.role);

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (newTier !== data.profile.subscription_tier) payload.tier = newTier;
      if (newRole !== data.profile.role) payload.role = newRole;
      if (reason.trim()) payload.reason = reason.trim();
      await apiFetch(`/api/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify(payload) });
      addToast("User updated", "success");
      await load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDisabled = async () => {
    if (!data) return;
    const newState = data.isDisabled; // flipping
    const confirmMsg = data.isDisabled
      ? "Re-enable this user's account?"
      : "Disable this user's account? They won't be able to log in until you re-enable.";
    if (!confirm(confirmMsg)) return;

    setBanning(true);
    try {
      await apiFetch(`/api/admin/users/${userId}/ban`, {
        method: "POST",
        body: JSON.stringify({ enabled: newState, reason: reason.trim() || undefined }),
      });
      addToast(newState ? "User enabled" : "User disabled", "success");
      await load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Failed", "error");
    } finally {
      setBanning(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!data) return;
    if (!window.confirm(`Send a password reset email to ${data.profile.email}?`)) return;
    setResettingPw(true);
    try {
      await apiFetch(`/api/admin/users/${userId}/reset-password`, { method: "POST" });
      addToast(`Password reset email sent to ${data.profile.email}`, "success");
      await load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Failed to send reset email", "error");
    } finally {
      setResettingPw(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-surface-secondary rounded animate-pulse" />
        <div className="h-64 bg-surface-secondary rounded-xl animate-pulse" />
      </div>
    );
  }

  const p = data.profile;
  const tierId = tierFromDbValue(p.subscription_tier);
  const initial = (p.full_name ?? p.email).slice(0, 1).toUpperCase();

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="text-sm text-zinc-500 hover:text-zinc-300">← All users</Link>

      {/* Header */}
      <div className={`rounded-xl border ${data.isDisabled ? "border-red-500/30 bg-red-500/5" : "border-brand-500/10 bg-surface-secondary"} p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-glow flex-shrink-0"
            style={{ backgroundColor: avatarColor(p.email) }}
          >
            {initial}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-zinc-100">{p.full_name ?? p.email}</h1>
              <span className={`text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${tierBadge[tierId]}`}>
                {TIER_LABELS[tierId]}
              </span>
              {p.role === "admin" && (
                <span className="text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20">🛡️ admin</span>
              )}
              {data.isDisabled && (
                <span className="text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30">disabled</span>
              )}
            </div>
            <p className="text-sm text-zinc-500 mt-0.5">{p.email}</p>
            <p className="text-xs text-zinc-600 mt-1">Joined {new Date(p.created_at).toLocaleDateString()} · {p.id.slice(0, 8)}</p>
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Credits balance", value: p.credits_balance.toLocaleString(), sub: `resets ${new Date(p.credits_reset_at).toLocaleDateString()}` },
          { label: "Total generations", value: data.aggregates.totalGenerations.toLocaleString(), sub: "all time" },
          { label: "Total tokens", value: data.aggregates.totalTokens.toLocaleString(), sub: "all time" },
          { label: "Saved items", value: data.aggregates.savedCount.toLocaleString(), sub: "library count" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4">
            <div className="text-xs text-zinc-500">{s.label}</div>
            <div className="text-xl sm:text-2xl font-bold text-zinc-100 mt-1">{s.value}</div>
            <div className="text-2xs text-zinc-600 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Actions panel */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200">Account actions</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Subscription tier</label>
            <select value={newTier} onChange={(e) => setNewTier(e.target.value)} className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-brand-500/40">
              <option value="free">Starter</option>
              <option value="creator">Creator</option>
              <option value="team">Team</option>
              <option value="elite">Elite</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Role</label>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-brand-500/40">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Reason (audit log)</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g., comped for beta feedback" className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-brand-500/40" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-between items-center">
          <div className="flex flex-wrap gap-2 items-center">
            <Button size="sm" onClick={handleSave} loading={saving} disabled={!isDirty}>Save changes</Button>
            <Button size="sm" variant="secondary" onClick={handleSendPasswordReset} loading={resettingPw}>
              🔑 Send password reset
            </Button>
            <Link href="/admin/credit-adjustments" className="inline-flex items-center px-3 py-1.5 text-sm text-brand-300 hover:text-brand-200">
              🪙 Adjust credits →
            </Link>
          </div>
          <Button
            size="sm"
            variant={data.isDisabled ? "secondary" : "danger"}
            onClick={handleToggleDisabled}
            loading={banning}
          >
            {data.isDisabled ? "🔓 Enable account" : "🚫 Disable account"}
          </Button>
        </div>
      </div>

      {/* Feature breakdown */}
      {data.aggregates.featureBreakdown.length > 0 && (
        <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
          <h2 className="text-sm font-semibold text-zinc-200 mb-3">Feature usage</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {data.aggregates.featureBreakdown.map((f) => (
              <div key={f.feature} className="rounded-lg bg-surface-tertiary border border-brand-500/5 p-3">
                <div className="text-xs text-zinc-400 font-mono">{f.feature}</div>
                <div className="text-lg font-bold text-zinc-100 mt-1">{f.count}</div>
                <div className="text-2xs text-zinc-600">{f.tokens.toLocaleString()} tokens</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two-column: recent generations + credit transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-brand-500/10 bg-surface-secondary overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-500/10 bg-surface-tertiary flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200">Recent generations</h3>
            <span className="text-2xs text-zinc-500">last 15</span>
          </div>
          {data.recentGenerations.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-zinc-500">No generations yet</p>
          ) : (
            <ul className="divide-y divide-brand-500/5">
              {data.recentGenerations.map((g) => (
                <li key={g.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs text-zinc-300 font-mono">{g.feature}</span>
                    <span className="text-2xs text-zinc-600">{g.platform ? `${g.platform} · ` : ""}{new Date(g.created_at).toLocaleString()}</span>
                  </div>
                  <span className="text-2xs text-zinc-500 whitespace-nowrap">{g.tokens_used.toLocaleString()} tok</span>
                  <Link href={`/dashboard/generations/${g.id}`} className="text-2xs text-brand-400 hover:text-brand-300 whitespace-nowrap">view</Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-brand-500/10 bg-surface-secondary overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-500/10 bg-surface-tertiary flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200">Credit transactions</h3>
            <span className="text-2xs text-zinc-500">last 20</span>
          </div>
          {data.creditTransactions.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-zinc-500">No transactions yet</p>
          ) : (
            <ul className="divide-y divide-brand-500/5">
              {data.creditTransactions.map((t) => (
                <li key={t.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-2xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${typeBadge[t.type] ?? ""}`}>{t.type}</span>
                      <span className="text-xs text-zinc-400 truncate">{t.reason}</span>
                    </div>
                    <span className="text-2xs text-zinc-600">{new Date(t.created_at).toLocaleString()}</span>
                  </div>
                  <span className={`text-xs font-mono ${t.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {t.amount > 0 ? "+" : ""}{t.amount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Admin actions audit */}
      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary overflow-hidden">
        <div className="px-4 py-3 border-b border-brand-500/10 bg-surface-tertiary flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-200">Admin actions audit</h3>
          <span className="text-2xs text-zinc-500">last 20</span>
        </div>
        {data.adminActions.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-zinc-500">No admin actions against this user yet</p>
        ) : (
          <ul className="divide-y divide-brand-500/5">
            {data.adminActions.map((a) => (
              <li key={a.id} className="px-4 py-2.5 grid grid-cols-[auto_1fr_auto] gap-3 items-center">
                <span className="text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 whitespace-nowrap">{a.action.replace(/_/g, " ")}</span>
                <div className="text-xs text-zinc-300 min-w-0">
                  {a.from_value && a.to_value && <span className="font-mono">{a.from_value} → {a.to_value}</span>}
                  {a.reason && <span className="text-zinc-500"> · {a.reason}</span>}
                  <div className="text-2xs text-zinc-600 mt-0.5">by {a.actor?.email ?? a.actor_id?.slice(0, 8) ?? "unknown"}</div>
                </div>
                <span className="text-2xs text-zinc-600 whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
