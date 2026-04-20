"use client";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface Transaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  balance_after: number;
  reason: string | null;
  task: string | null;
  created_at: string;
  profiles?: { email: string | null; full_name: string | null } | null;
}

const typeBadge: Record<string, string> = {
  grant:    "bg-emerald-500/10 text-emerald-300",
  consume:  "bg-zinc-500/10 text-zinc-400",
  purchase: "bg-brand-500/10 text-brand-300",
  refund:   "bg-sky-500/10 text-sky-300",
  adjust:   "bg-amber-500/10 text-amber-300",
  reset:    "bg-purple-500/10 text-purple-300",
};

export default function CreditAdjustmentsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ transactions: Transaction[] }>("/api/admin/credit-adjustments");
      setTransactions(data.transactions);
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Failed to load", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    const amt = parseInt(amount, 10);
    if (!userEmail.trim() || !reason.trim() || isNaN(amt) || amt === 0) {
      addToast("Enter email, non-zero amount, and reason", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiFetch<{ action: string; newBalance: number }>("/api/admin/credit-adjustments", {
        method: "POST",
        body: JSON.stringify({ userEmail: userEmail.trim(), amount: amt, reason: reason.trim() }),
      });
      addToast(`${result.action === 'granted' ? 'Granted' : 'Adjusted'} ${Math.abs(amt)} credits — new balance ${result.newBalance}`, "success");
      setUserEmail(""); setAmount(""); setReason("");
      await load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Credit Adjustments</h1>
        <p className="text-zinc-500 mt-1">Grant or revoke credits for any user. All changes audited.</p>
      </div>

      {/* Adjustment form */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200">Grant or adjust credits</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">User email</label>
            <input
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-brand-500/40"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Amount (+/-)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g., 100 or -50"
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-brand-500/40"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Reason (shown in audit log)</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., support issue credit"
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-3 py-2 text-sm focus:outline-none focus:border-brand-500/40"
            />
          </div>
        </div>
        <Button onClick={handleSubmit} loading={submitting}>Apply adjustment</Button>
      </div>

      {/* Recent transactions */}
      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary overflow-hidden">
        <div className="px-5 py-3 border-b border-brand-500/10 bg-surface-tertiary">
          <h2 className="text-sm font-semibold text-zinc-200">Recent transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 border-b border-brand-500/10">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium text-right">Balance</th>
                <th className="px-4 py-3 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-500/5">
              {loading && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-zinc-500">Loading…</td></tr>
              )}
              {!loading && transactions.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-zinc-500">No transactions yet</td></tr>
              )}
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2.5 text-xs text-zinc-500 whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-xs text-zinc-300">
                    {t.profiles?.email ?? t.user_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${typeBadge[t.type] ?? 'bg-zinc-500/10 text-zinc-400'}`}>{t.type}</span>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono ${t.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {t.amount > 0 ? '+' : ''}{t.amount}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-zinc-400">{t.balance_after}</td>
                  <td className="px-4 py-2.5 text-xs text-zinc-500">{t.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
