"use client";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  TASK_LABELS,
  MODEL_CATALOG,
  CONFIGURABLE_TIERS,
  TIER_LABELS,
  type CrispTask,
  type PowerProfile,
  type ProfileConfig,
  type ConfigurableTier,
} from "@/lib/crisp-engine-config";
import { SUPPORTED_PROVIDERS, type ProviderId } from "@/lib/providers/types";

interface TierCell {
  defaultProfile: PowerProfile;
  default: ProfileConfig;
  override: (ProfileConfig & { updatedAt: string }) | null;
  effective: ProfileConfig;
}

interface ConfigItem {
  task: CrispTask;
  tiers: Record<ConfigurableTier, TierCell>;
}

const tierAccent: Record<ConfigurableTier, string> = {
  starter: "border-sky-500/30 bg-sky-500/[0.03]",
  creator: "border-emerald-500/30 bg-emerald-500/[0.03]",
  elite:   "border-amber-500/30 bg-amber-500/[0.03]",
};

const tierHeader: Record<ConfigurableTier, string> = {
  starter: "text-sky-300 bg-sky-500/10 border-sky-500/20",
  creator: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
  elite:   "text-amber-300 bg-amber-500/10 border-amber-500/20",
};

const profileBadge: Record<PowerProfile, string> = {
  FAST:     "bg-sky-500/10 text-sky-300 border-sky-500/20",
  STANDARD: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  PREMIUM:  "bg-amber-500/10 text-amber-300 border-amber-500/20",
};

type CellKey = `${string}::${ConfigurableTier}`;
const keyOf = (task: string, tier: ConfigurableTier): CellKey => `${task}::${tier}`;

export default function AIConfigPage() {
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<CellKey | null>(null);

  // Pending edits keyed by (task::tier)
  const [pending, setPending] = useState<Record<CellKey, Partial<ProfileConfig>>>({});

  // Bulk edit state — users select rows AND which tiers to apply
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTiers, setBulkTiers] = useState<Set<ConfigurableTier>>(new Set<ConfigurableTier>(["creator"]));
  const [bulkProvider, setBulkProvider] = useState<ProviderId>("anthropic");
  const [bulkModel, setBulkModel] = useState<string>("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const { addToast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ items: ConfigItem[] }>("/api/admin/ai-config");
      setItems(data.items);
      setPending({});
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Failed to load config", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // When provider changes in the bulk bar, pick first model in catalog
  useEffect(() => {
    const first = MODEL_CATALOG[bulkProvider]?.[0]?.id;
    if (first) setBulkModel(first);
  }, [bulkProvider]);

  const toggleSelect = (task: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(task)) next.delete(task);
      else next.add(task);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.task))));
  };

  const toggleBulkTier = (tier: ConfigurableTier) => {
    setBulkTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  };

  const getEffective = (item: ConfigItem, tier: ConfigurableTier): ProfileConfig => {
    const cell = item.tiers[tier];
    const p = pending[keyOf(item.task, tier)];
    return {
      provider: (p?.provider ?? cell.effective.provider) as ProviderId,
      model: p?.model ?? cell.effective.model,
    };
  };

  const isDirty = (item: ConfigItem, tier: ConfigurableTier) => {
    const eff = getEffective(item, tier);
    const cell = item.tiers[tier];
    return eff.provider !== cell.effective.provider || eff.model !== cell.effective.model;
  };

  const updatePending = (task: string, tier: ConfigurableTier, patch: Partial<ProfileConfig>) => {
    setPending((prev) => ({ ...prev, [keyOf(task, tier)]: { ...prev[keyOf(task, tier)], ...patch } }));
  };

  const handleSaveCell = async (item: ConfigItem, tier: ConfigurableTier) => {
    const eff = getEffective(item, tier);
    const key = keyOf(item.task, tier);
    setSavingKey(key);
    try {
      await apiFetch("/api/admin/ai-config", {
        method: "PUT",
        body: JSON.stringify({ task: item.task, tier, provider: eff.provider, model: eff.model }),
      });
      addToast(`${TASK_LABELS[item.task]} · ${TIER_LABELS[tier]} → ${eff.model}`, "success");
      await load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Save failed", "error");
    } finally {
      setSavingKey(null);
    }
  };

  const handleResetCell = async (item: ConfigItem, tier: ConfigurableTier) => {
    const key = keyOf(item.task, tier);
    setSavingKey(key);
    try {
      await apiFetch("/api/admin/ai-config", {
        method: "PUT",
        body: JSON.stringify({ task: item.task, tier, reset: true }),
      });
      addToast(`${TASK_LABELS[item.task]} · ${TIER_LABELS[tier]} reset`, "success");
      await load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Reset failed", "error");
    } finally {
      setSavingKey(null);
    }
  };

  const handleBulkApply = async () => {
    if (selected.size === 0 || bulkTiers.size === 0) return;
    setBulkSaving(true);
    try {
      await apiFetch("/api/admin/ai-config", {
        method: "POST",
        body: JSON.stringify({
          tasks: Array.from(selected),
          tiers: Array.from(bulkTiers),
          provider: bulkProvider,
          model: bulkModel,
        }),
      });
      addToast(
        `${bulkModel} applied to ${selected.size} feature${selected.size === 1 ? "" : "s"} × ${bulkTiers.size} tier${bulkTiers.size === 1 ? "" : "s"}`,
        "success"
      );
      setSelected(new Set());
      await load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Bulk apply failed", "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const handleBulkReset = async () => {
    if (selected.size === 0 || bulkTiers.size === 0) return;
    setBulkSaving(true);
    try {
      await apiFetch("/api/admin/ai-config", {
        method: "POST",
        body: JSON.stringify({ tasks: Array.from(selected), tiers: Array.from(bulkTiers), reset: true }),
      });
      addToast(
        `Reset ${selected.size} feature${selected.size === 1 ? "" : "s"} × ${bulkTiers.size} tier${bulkTiers.size === 1 ? "" : "s"}`,
        "success"
      );
      setSelected(new Set());
      await load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Bulk reset failed", "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const selectedTierLabels = useMemo(
    () => Array.from(bulkTiers).map((t) => TIER_LABELS[t]).join(" / "),
    [bulkTiers]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">AI Engine Config</h1>
          <p className="text-zinc-500 mt-1">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">AI Engine Config</h1>
        <p className="text-zinc-500 mt-1">
          Route each feature × tier to a provider + model. Team tier uses the same AI as Creator.
        </p>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200/80 space-y-1">
        <p>
          <strong>How it works:</strong> Each row is a feature. Each column is a paid tier.
          Cells show the current provider + model. Empty border = using code default.
          Amber tint = admin override in effect. Check rows + tiers to bulk-apply.
        </p>
        <p>
          <strong>Team tier</strong> isn&apos;t shown as a column because it runs the same AI as Creator.
          <strong> Changes take effect within 60 seconds</strong> (engine override cache).
        </p>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky top-12 z-10 rounded-xl border border-brand-500/30 bg-surface-elevated shadow-glow-lg p-4 space-y-3 animate-fade-in">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-xs font-bold text-brand-300">
                {selected.size}
              </span>
              <span className="text-sm text-zinc-300">selected</span>
            </div>

            <div className="h-5 w-px bg-zinc-700 mx-1" />

            <span className="text-xs text-zinc-500">Apply to tiers:</span>
            <div className="flex gap-1">
              {CONFIGURABLE_TIERS.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleBulkTier(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    bulkTiers.has(t)
                      ? tierHeader[t]
                      : "bg-surface-tertiary text-zinc-500 border-transparent hover:text-zinc-300"
                  }`}
                >
                  {TIER_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-500">Provider</label>
              <select
                value={bulkProvider}
                onChange={(e) => setBulkProvider(e.target.value as ProviderId)}
                className="rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500/40 transition-colors"
              >
                {SUPPORTED_PROVIDERS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-500">Model</label>
              <select
                value={bulkModel}
                onChange={(e) => setBulkModel(e.target.value)}
                className="rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500/40 transition-colors min-w-[220px]"
              >
                {(MODEL_CATALOG[bulkProvider] ?? []).map((m) => (
                  <option key={m.id} value={m.id}>{m.label}{m.notes ? ` — ${m.notes}` : ""}</option>
                ))}
              </select>
            </div>

            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setSelected(new Set())} disabled={bulkSaving}>
                Clear
              </Button>
              <Button size="sm" variant="secondary" onClick={handleBulkReset} loading={bulkSaving}>
                Reset
              </Button>
              <Button size="sm" onClick={handleBulkApply} loading={bulkSaving} disabled={bulkTiers.size === 0}>
                Apply → {selectedTierLabels || "pick tier"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Grid: header row + per-task rows */}
      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[32px_1.5fr_1fr_1fr_1fr] gap-0 bg-surface-tertiary border-b border-brand-500/10">
          <div className="px-3 py-3 flex items-center">
            <input
              type="checkbox"
              checked={items.length > 0 && selected.size === items.length}
              ref={(el) => { if (el) el.indeterminate = selected.size > 0 && selected.size < items.length; }}
              onChange={toggleSelectAll}
              className="w-4 h-4 accent-brand-500 cursor-pointer"
              aria-label="Select all"
            />
          </div>
          <div className="px-3 py-3 text-xs uppercase tracking-wider text-zinc-500 font-medium">Feature</div>
          {CONFIGURABLE_TIERS.map((tier) => (
            <div
              key={tier}
              className={`px-3 py-3 text-xs uppercase tracking-wider font-medium border-l border-brand-500/10 text-center ${tierHeader[tier].replace('bg-', 'text-').split(' ').filter(c => c.startsWith('text-')).join(' ')}`}
            >
              {TIER_LABELS[tier]}
            </div>
          ))}
        </div>

        {/* Data rows */}
        <div className="divide-y divide-brand-500/5">
          {items.map((item) => {
            const isRowSelected = selected.has(item.task);
            return (
              <div
                key={item.task}
                className={`grid grid-cols-[32px_1.5fr_1fr_1fr_1fr] gap-0 ${isRowSelected ? "bg-brand-500/[0.06]" : ""}`}
              >
                <div className="px-3 py-3 flex items-center">
                  <input
                    type="checkbox"
                    checked={isRowSelected}
                    onChange={() => toggleSelect(item.task)}
                    className="w-4 h-4 accent-brand-500 cursor-pointer"
                    aria-label={`Select ${TASK_LABELS[item.task]}`}
                  />
                </div>
                <div className="px-3 py-3 flex flex-col justify-center">
                  <span className="text-sm font-medium text-zinc-200">{TASK_LABELS[item.task]}</span>
                  <span className="text-2xs text-zinc-600 font-mono">{item.task}</span>
                </div>
                {CONFIGURABLE_TIERS.map((tier) => {
                  const cell = item.tiers[tier];
                  const eff = getEffective(item, tier);
                  const dirty = isDirty(item, tier);
                  const hasOverride = !!cell.override;
                  const saving = savingKey === keyOf(item.task, tier);
                  const modelsForProvider = MODEL_CATALOG[eff.provider as ProviderId] ?? [];

                  return (
                    <div
                      key={tier}
                      className={`px-2 py-2 border-l border-brand-500/10 flex flex-col gap-1.5 ${hasOverride ? tierAccent[tier] : ""}`}
                    >
                      <span className={`self-start text-2xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${profileBadge[cell.defaultProfile]}`}>
                        {cell.defaultProfile}
                      </span>
                      <select
                        value={eff.provider}
                        onChange={(e) => updatePending(item.task, tier, { provider: e.target.value as ProviderId, model: MODEL_CATALOG[e.target.value as ProviderId]?.[0]?.id })}
                        className="w-full rounded bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-2 py-1 text-2xs focus:outline-none focus:border-brand-500/40"
                      >
                        {SUPPORTED_PROVIDERS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <select
                        value={eff.model}
                        onChange={(e) => updatePending(item.task, tier, { model: e.target.value })}
                        className="w-full rounded bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-2 py-1 text-2xs focus:outline-none focus:border-brand-500/40"
                      >
                        {modelsForProvider.map((m) => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                        {!modelsForProvider.find((m) => m.id === eff.model) && (
                          <option value={eff.model}>{eff.model} (custom)</option>
                        )}
                      </select>
                      <div className="flex gap-1">
                        {dirty && (
                          <Button size="sm" onClick={() => handleSaveCell(item, tier)} loading={saving} className="flex-1 !py-1 !text-2xs">
                            Save
                          </Button>
                        )}
                        {hasOverride && !dirty && (
                          <Button size="sm" variant="secondary" onClick={() => handleResetCell(item, tier)} loading={saving} className="flex-1 !py-1 !text-2xs">
                            Reset
                          </Button>
                        )}
                        {!hasOverride && !dirty && (
                          <span className="text-2xs text-zinc-600 px-1">default</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
