"use client";
import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { EngineBadge } from "@/components/ui/EngineBadge";
import { GenerationLoader } from "@/components/ui/GenerationLoader";
import { InlineError } from "@/components/ui/ErrorBoundary";
import { useToast } from "@/components/ui/Toast";

interface Item { targetPlatform: string; content: string; hashtags?: string[]; notes?: string }

const SOURCE_TYPES = ["YouTube Script", "Blog Post", "Podcast Transcript", "Long Caption", "Newsletter", "Interview"];
const TARGET_OPTIONS = [
  "Instagram Post",
  "Instagram Reel caption",
  "TikTok caption",
  "X Thread",
  "LinkedIn Post",
  "Facebook Post",
  "Threads Post",
  "YouTube Description",
];

const LOADING_MESSAGES = ["Reading your source...", "Rewriting for each platform...", "Tuning tone and length...", "Adding native touches..."];

export default function RepurposePage() {
  const [source, setSource] = useState("");
  const [sourceType, setSourceType] = useState(SOURCE_TYPES[1]);
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>(["Instagram Post", "X Thread", "LinkedIn Post"]);
  const [toneAdjustment, setToneAdjustment] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const toggle = (p: string) => setTargetPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);

  const handleRepurpose = async () => {
    if (!source.trim() || targetPlatforms.length === 0) { addToast("Paste source content and pick at least one target", "warning"); return; }
    setLoading(true); setError(null); setItems([]);
    try {
      const data = await apiFetch<{ items: Item[] }>("/api/repurpose", {
        method: "POST",
        body: JSON.stringify({ source, sourceType, targetPlatforms, toneAdjustment }),
      });
      setItems(data.items);
      setActiveTab(0);
      addToast(`Generated ${data.items.length} versions`, "success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to repurpose");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOne = async (item: Item) => {
    const content = item.hashtags ? `${item.content}\n\n${item.hashtags.join(" ")}` : item.content;
    try {
      await apiFetch("/api/saved", {
        method: "POST",
        body: JSON.stringify({ type: "repurposed", content, platform: item.targetPlatform, topic: sourceType }),
      });
      addToast(`Saved ${item.targetPlatform}`, "success");
    } catch { addToast("Failed to save", "error"); }
  };

  const handleCopyAll = () => {
    const text = items.map((i) => `### ${i.targetPlatform}\n${i.content}${i.hashtags ? `\n\n${i.hashtags.join(" ")}` : ""}`).join("\n\n---\n\n");
    navigator.clipboard.writeText(text);
    addToast("All versions copied!", "success");
  };

  const active = items[activeTab];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Content Repurposer</h1>
        <p className="text-zinc-500 mt-1">One piece of content, rewritten to feel native on every platform.</p>
      </div>

      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Source content *</label>
          <textarea rows={8} value={source} onChange={(e) => setSource(e.target.value)}
            placeholder="Paste your YouTube script, blog post, newsletter, or any long-form content..."
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40 resize-y" />
          <p className="text-xs text-zinc-600 mt-1">{source.length.toLocaleString()} characters</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Source type</label>
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value)}
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40">
            {SOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Target platforms</label>
          <div className="flex flex-wrap gap-2">
            {TARGET_OPTIONS.map((p) => (
              <button key={p} onClick={() => toggle(p)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${targetPlatforms.includes(p) ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>{p}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Tone adjustment <span className="text-zinc-600">(optional)</span></label>
          <input value={toneAdjustment} onChange={(e) => setToneAdjustment(e.target.value)}
            placeholder="e.g., make it punchier, more professional, more casual"
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40" />
        </div>

        <Button onClick={handleRepurpose} loading={loading} size="lg" className="w-full sm:w-auto">
          {loading ? "Repurposing..." : "♻️ Repurpose"}
        </Button>
      </div>

      {loading && <GenerationLoader messages={LOADING_MESSAGES} />}
      {error && !loading && <InlineError message={error} onRetry={handleRepurpose} />}

      {items.length > 0 && !loading && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-zinc-200">{items.length} versions</h2>
              <EngineBadge />
            </div>
            <Button variant="secondary" size="sm" onClick={handleCopyAll}>📋 Copy All</Button>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-1 border-b border-brand-500/10">
            {items.map((item, i) => (
              <button key={i} onClick={() => setActiveTab(i)}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-all -mb-px ${activeTab === i ? "text-brand-300 border-brand-500" : "text-zinc-500 border-transparent hover:text-zinc-300"}`}>
                {item.targetPlatform}
              </button>
            ))}
          </div>

          {active && (
            <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 space-y-3">
              <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{active.content}</p>
              {active.hashtags && active.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-brand-500/5">
                  {active.hashtags.map((h) => <span key={h} className="text-xs text-brand-300 bg-brand-500/10 px-2 py-0.5 rounded-full">{h}</span>)}
                </div>
              )}
              {active.notes && <p className="text-xs text-zinc-500 italic">💡 {active.notes}</p>}
              <div className="flex gap-2 pt-2">
                <CopyButton text={active.hashtags ? `${active.content}\n\n${active.hashtags.join(" ")}` : active.content} />
                <Button variant="secondary" size="sm" onClick={() => handleSaveOne(active)}>💾 Save</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {items.length === 0 && !loading && !error && (
        <div className="text-center py-12 text-zinc-500">
          <span className="text-4xl block mb-4">♻️</span>
          <p>Paste long-form content and pick target platforms to get native versions for each.</p>
        </div>
      )}
    </div>
  );
}
