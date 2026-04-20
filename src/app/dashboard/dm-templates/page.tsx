"use client";
import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { EngineBadge } from "@/components/ui/EngineBadge";
import { GenerationLoader } from "@/components/ui/GenerationLoader";
import { InlineError } from "@/components/ui/ErrorBoundary";
import { useToast } from "@/components/ui/Toast";

interface Template { subject?: string; body: string }

const CATEGORIES = [
  { id: "brand-outreach",    label: "Brand Collaboration Outreach", icon: "📧" },
  { id: "brand-response",    label: "Responding to Brand Inquiries", icon: "💼" },
  { id: "fan-thank-you",     label: "Fan / Follower Thank You",      icon: "💖" },
  { id: "creator-collab",    label: "Collab with Other Creators",    icon: "🤝" },
  { id: "decline-politely",  label: "Declining Offers Politely",     icon: "🙅" },
  { id: "negotiate-rates",   label: "Negotiating Rates",             icon: "💵" },
  { id: "follow-up",         label: "Follow-up Messages",            icon: "⏰" },
  { id: "partnership",       label: "Partnership Proposals",         icon: "🌱" },
];

export default function DMTemplatesPage() {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].id);
  const [recipient, setRecipient] = useState("");
  const [yourNiche, setYourNiche] = useState("");
  const [specificDetails, setSpecificDetails] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const activeLabel = CATEGORIES.find((c) => c.id === activeCategory)?.label ?? "";

  const handleGenerate = async () => {
    if (useCustom && !customPrompt.trim()) { addToast("Describe your scenario", "warning"); return; }
    setLoading(true); setError(null); setTemplate(null);
    try {
      const data = await apiFetch<Template>("/api/dm-template", {
        method: "POST",
        body: JSON.stringify({
          category: useCustom ? null : activeLabel,
          recipient,
          yourNiche,
          specificDetails,
          customPrompt: useCustom ? customPrompt : null,
        }),
      });
      setTemplate(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    } finally { setLoading(false); }
  };

  const fullText = (t: Template) => t.subject ? `Subject: ${t.subject}\n\n${t.body}` : t.body;

  const handleSave = async () => {
    if (!template) return;
    try {
      await apiFetch("/api/saved", {
        method: "POST",
        body: JSON.stringify({ type: "dm_template", content: fullText(template), platform: "dm", topic: useCustom ? "Custom DM" : activeLabel }),
      });
      addToast("Template saved!", "success");
    } catch { addToast("Failed to save", "error"); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">DM Template Library</h1>
        <p className="text-zinc-500 mt-1">Pre-built templates personalized to your situation.</p>
      </div>

      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-zinc-300">Scenario</label>
            <button onClick={() => setUseCustom(!useCustom)} className="text-xs text-brand-400 hover:text-brand-300">
              {useCustom ? "← Back to categories" : "Custom prompt →"}
            </button>
          </div>

          {!useCustom && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CATEGORIES.map((c) => (
                <button key={c.id} onClick={() => setActiveCategory(c.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left ${activeCategory === c.id ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>
                  <span>{c.icon}</span><span>{c.label}</span>
                </button>
              ))}
            </div>
          )}

          {useCustom && (
            <textarea rows={3} value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Describe your DM scenario..."
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40 resize-none" />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Recipient <span className="text-zinc-600">(optional)</span></label>
            <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="e.g., @lululemon, John (PR manager)"
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Your niche</label>
            <input value={yourNiche} onChange={(e) => setYourNiche(e.target.value)} placeholder="e.g., yoga for busy moms"
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Specific details <span className="text-zinc-600">(optional but improves personalization)</span></label>
          <textarea rows={3} value={specificDetails} onChange={(e) => setSpecificDetails(e.target.value)}
            placeholder="Any specifics — dates, follower counts, past collabs, product references..."
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40 resize-none" />
        </div>

        <Button onClick={handleGenerate} loading={loading} size="lg" className="w-full sm:w-auto">
          {loading ? "Writing..." : "✉️ Generate DM"}
        </Button>
      </div>

      {loading && <GenerationLoader messages={["Personalizing your template...", "Crafting the opener...", "Adding a clear CTA..."]} />}
      {error && !loading && <InlineError message={error} onRetry={handleGenerate} />}

      {template && !loading && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-200">Your DM</h2>
            <EngineBadge />
          </div>
          <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
            {template.subject && (
              <div className="mb-3 pb-3 border-b border-brand-500/5">
                <p className="text-xs text-zinc-500 mb-1">Subject</p>
                <p className="text-sm font-medium text-zinc-200">{template.subject}</p>
              </div>
            )}
            <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{template.body}</p>
            <div className="flex gap-2 mt-4 pt-3 border-t border-brand-500/5">
              <CopyButton text={fullText(template)} />
              <Button variant="secondary" size="sm" onClick={handleSave}>💾 Save</Button>
              <Button variant="secondary" size="sm" onClick={handleGenerate}>🔄 Regenerate</Button>
            </div>
          </div>
        </div>
      )}

      {!template && !loading && !error && (
        <div className="text-center py-12 text-zinc-500">
          <span className="text-4xl block mb-4">✉️</span>
          <p>Pick a scenario and customize the details to get a DM that&apos;s ready to copy-paste.</p>
        </div>
      )}
    </div>
  );
}
