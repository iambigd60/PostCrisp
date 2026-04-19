"use client";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  TASK_LABELS,
  MODEL_CATALOG,
  type CrispTask,
  type PowerProfile,
  type ProfileConfig,
} from "@/lib/crisp-engine-config";
import { SUPPORTED_PROVIDERS, type ProviderId } from "@/lib/providers/types";

interface ConfigItem {
  task: CrispTask;
  defaultProfile: PowerProfile;
  default: ProfileConfig;
  override: (ProfileConfig & { updatedAt: string }) | null;
  effective: ProfileConfig;
}

const profileBadge: Record<PowerProfile, string> = {
  FAST:     "bg-sky-500/10 text-sky-300 border-sky-500/20",
  STANDARD: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  PREMIUM:  "bg-amber-500/10 text-amber-300 border-amber-500/20",
};

export default function AIConfigPage() {
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTask, setSavingTask] = useState<string | null>(null);
  // Pending edits per task: user-chosen provider/model that hasn't been saved yet
  const [pending, setPending] = useState<Record<string, Partial<ProfileConfig>>>({});
  // Bulk edit state
  const [selected, setSelected] = useState<Set<string>>(new Set());
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

  // Default bulk model to the first option of the current bulk provider
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

  const handleBulkApply = async () => {
    if (selected.size === 0) return;
    setBulkSaving(true);
    try {
      await apiFetch("/api/admin/ai-config", {
        method: "POST",
        body: JSON.stringify({
          tasks: Array.from(selected),
          provider: bulkProvider,
          model: bulkModel,
        }),
      });
      addToast(`Applied ${bulkModel} to ${selected.size} feature${selected.size === 1 ? "" : "s"}`, "success");
      setSelected(new Set());
      await load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Bulk apply failed", "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const handleBulkReset = async () => {
    if (selected.size === 0) return;
    setBulkSaving(true);
    try {
      await apiFetch("/api/admin/ai-config", {
        method: "POST",
        body: JSON.stringify({ tasks: Array.from(selected), reset: true }),
      });
      addToast(`Reset ${selected.size} feature${selected.size === 1 ? "" : "s"} to defaults`, "success");
      setSelected(new Set());
      await load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Bulk reset failed", "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const getEffective = (item: ConfigItem): ProfileConfig => {
    const p = pending[item.task];
    return {
      provider: (p?.provider ?? item.effective.provider) as ProviderId,
      model: p?.model ?? item.effective.model,
    };
  };

  const isDirty = (item: ConfigItem) => {
    const eff = getEffective(item);
    return eff.provider !== item.effective.provider || eff.model !== item.effective.model;
  };

  const updatePending = (task: string, patch: Partial<ProfileConfig>) => {
    setPending((prev) => ({ ...prev, [task]: { ...prev[task], ...patch } }));
  };

  const handleSave = async (item: ConfigItem) => {
    const eff = getEffective(item);
    setSavingTask(item.task);
    try {
      await apiFetch("/api/admin/ai-config", {
        method: "PUT",
        body: JSON.stringify({ task: item.task, provider: eff.provider, model: eff.model }),
      });
      addToast(`${TASK_LABELS[item.task]} → ${eff.model}`, "success");
      await load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Save failed", "error");
    } finally {
      setSavingTask(null);
    }
  };

  const handleReset = async (item: ConfigItem) => {
    setSavingTask(item.task);
    try {
      await apiFetch("/api/admin/ai-config", {
        method: "PUT",
        body: JSON.stringify({ task: item.task, reset: true }),
      });
      addToast(`${TASK_LABELS[item.task]} reset to default`, "success");
      await load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Reset failed", "error");
    } finally {
      setSavingTask(null);
    }
  };

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
          Route each feature to a provider + model. Changes take effect within 60 seconds (engine override cache).
        </p>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200/80">
        <p>
          <strong>How it works:</strong> Each task has a code-level default (Fast / Standard / Premium).
          Overrides set here take priority. Click &quot;Reset&quot; to delete an override and fall back to the default.
          Check multiple rows to bulk-change provider/model for several features at once.
        </p>
      </div>

      {/* Bulk action bar — sticky, appears when 1+ rows selected */}
      {selected.size > 0 && (
        <div className="sticky top-12 z-10 rounded-xl border border-brand-500/30 bg-surface-elevated shadow-glow-lg p-4 flex flex-wrap items-center gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-xs font-bold text-brand-300">
              {selected.size}
            </span>
            <span className="text-sm text-zinc-300">selected</span>
          </div>

          <div className="h-5 w-px bg-zinc-700 mx-1" />

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
              Reset to defaults
            </Button>
            <Button size="sm" onClick={handleBulkApply} loading={bulkSaving}>
              Apply to {selected.size}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-tertiary">
              <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3 font-medium w-10">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selected.size === items.length}
                    ref={(el) => { if (el) el.indeterminate = selected.size > 0 && selected.size < items.length; }}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 accent-brand-500 cursor-pointer"
                    aria-label="Select all"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Feature</th>
                <th className="px-4 py-3 font-medium">Default tier</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-500/5">
              {items.map((item) => {
                const eff = getEffective(item);
                const dirty = isDirty(item);
                const saving = savingTask === item.task;
                const hasOverride = !!item.override;
                const modelsForProvider = MODEL_CATALOG[eff.provider as ProviderId] ?? [];

                const isSelected = selected.has(item.task);

                return (
                  <tr key={item.task} className={`${hasOverride ? "bg-amber-500/[0.03]" : ""} ${isSelected ? "bg-brand-500/[0.06]" : ""}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.task)}
                        className="w-4 h-4 accent-brand-500 cursor-pointer"
                        aria-label={`Select ${TASK_LABELS[item.task]}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-zinc-200">{TASK_LABELS[item.task]}</span>
                        <span className="text-2xs text-zinc-600 font-mono">{item.task}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${profileBadge[item.defaultProfile]}`}>
                        {item.defaultProfile}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={eff.provider}
                        onChange={(e) => updatePending(item.task, { provider: e.target.value as ProviderId, model: MODEL_CATALOG[e.target.value as ProviderId]?.[0]?.id })}
                        className="rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500/40 focus:ring-1 focus:ring-brand-500/20 transition-colors"
                      >
                        {SUPPORTED_PROVIDERS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={eff.model}
                        onChange={(e) => updatePending(item.task, { model: e.target.value })}
                        className="rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500/40 focus:ring-1 focus:ring-brand-500/20 transition-colors min-w-[220px]"
                      >
                        {modelsForProvider.map((m) => (
                          <option key={m.id} value={m.id}>{m.label}{m.notes ? ` — ${m.notes}` : ""}</option>
                        ))}
                        {/* Show the current model as an option if it's not in the catalog */}
                        {!modelsForProvider.find((m) => m.id === eff.model) && (
                          <option value={eff.model}>{eff.model} (custom)</option>
                        )}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {dirty && (
                          <Button size="sm" onClick={() => handleSave(item)} loading={saving}>
                            Save
                          </Button>
                        )}
                        {hasOverride && !dirty && (
                          <Button size="sm" variant="secondary" onClick={() => handleReset(item)} loading={saving}>
                            Reset
                          </Button>
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
