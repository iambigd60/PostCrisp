"use client";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { TASK_LABELS, TIER_LABELS, type CrispTask, type Tier } from "@/lib/crisp-engine-config";

interface AccessItem {
  feature: CrispTask;
  defaultMinTier: Tier;
  minTier: Tier;
  enabled: boolean;
  override: { feature: string; min_tier: Tier; enabled: boolean; updated_at: string } | null;
}

const TIER_OPTIONS: Tier[] = ["starter", "creator", "elite"];

const tierBadge: Record<Tier, string> = {
  starter: "bg-zinc-500/15 text-zinc-300 border-zinc-500/20",
  creator: "bg-brand-500/15 text-brand-300 border-brand-500/20",
  elite:   "bg-amber-500/15 text-amber-300 border-amber-500/20",
};

export default function FeatureAccessPage() {
  const [items, setItems] = useState<AccessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingFeature, setSavingFeature] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, { minTier?: Tier; enabled?: boolean }>>({});
  const { addToast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ items: AccessItem[] }>("/api/admin/feature-access");
      setItems(data.items);
      setPending({});
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Failed to load", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const getEffective = (item: AccessItem) => ({
    minTier: pending[item.feature]?.minTier ?? item.minTier,
    enabled: pending[item.feature]?.enabled ?? item.enabled,
  });

  const isDirty = (item: AccessItem) => {
    const eff = getEffective(item);
    return eff.minTier !== item.minTier || eff.enabled !== item.enabled;
  };

  const updatePending = (feature: string, patch: { minTier?: Tier; enabled?: boolean }) => {
    setPending((prev) => ({ ...prev, [feature]: { ...prev[feature], ...patch } }));
  };

  const handleSave = async (item: AccessItem) => {
    const eff = getEffective(item);
    setSavingFeature(item.feature);
    try {
      await apiFetch("/api/admin/feature-access", {
        method: "PUT",
        body: JSON.stringify({ feature: item.feature, minTier: eff.minTier, enabled: eff.enabled }),
      });
      addToast(`${TASK_LABELS[item.feature]} saved`, "success");
      await load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Save failed", "error");
    } finally {
      setSavingFeature(null);
    }
  };

  const handleReset = async (item: AccessItem) => {
    setSavingFeature(item.feature);
    try {
      await apiFetch("/api/admin/feature-access", {
        method: "PUT",
        body: JSON.stringify({ feature: item.feature, reset: true }),
      });
      addToast(`${TASK_LABELS[item.feature]} reset to default`, "success");
      await load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Reset failed", "error");
    } finally {
      setSavingFeature(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Feature Access</h1>
        <p className="text-zinc-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Feature Access</h1>
        <p className="text-zinc-500 mt-1">
          Control which subscription tier unlocks each feature. Adjust as you grow.
        </p>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200/80">
        <strong>How it works:</strong> Each feature has a code-default minimum tier. Overrides here
        take priority. Users below the minimum get an upgrade prompt when they try to use the feature.
        Changes take effect within 60 seconds.
      </div>

      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-tertiary">
              <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3 font-medium">Feature</th>
                <th className="px-4 py-3 font-medium">Default</th>
                <th className="px-4 py-3 font-medium">Minimum tier</th>
                <th className="px-4 py-3 font-medium">Enabled</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-500/5">
              {items.map((item) => {
                const eff = getEffective(item);
                const dirty = isDirty(item);
                const hasOverride = !!item.override;
                const saving = savingFeature === item.feature;

                return (
                  <tr key={item.feature} className={hasOverride ? "bg-amber-500/[0.03]" : ""}>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-zinc-200">{TASK_LABELS[item.feature]}</span>
                        <span className="text-2xs text-zinc-600 font-mono">{item.feature}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${tierBadge[item.defaultMinTier]}`}>
                        {TIER_LABELS[item.defaultMinTier]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={eff.minTier}
                        onChange={(e) => updatePending(item.feature, { minTier: e.target.value as Tier })}
                        className="rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500/40 transition-colors"
                      >
                        {TIER_OPTIONS.map((t) => (
                          <option key={t} value={t}>{TIER_LABELS[t]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={eff.enabled}
                          onChange={(e) => updatePending(item.feature, { enabled: e.target.checked })}
                          className="w-4 h-4 accent-brand-500 cursor-pointer"
                        />
                        <span className="text-xs text-zinc-400">{eff.enabled ? "Live" : "Disabled"}</span>
                      </label>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {dirty && (
                          <Button size="sm" onClick={() => handleSave(item)} loading={saving}>Save</Button>
                        )}
                        {hasOverride && !dirty && (
                          <Button size="sm" variant="secondary" onClick={() => handleReset(item)} loading={saving}>Reset</Button>
                        )}
                        {!hasOverride && !dirty && (
                          <span className="text-2xs text-zinc-600">default</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
