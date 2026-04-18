"use client";
import { useState } from "react";
import { PLATFORMS, TONES, GENERATION_MESSAGES } from "@/lib/constants";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { GenerationLoader } from "@/components/ui/GenerationLoader";
import { InlineError } from "@/components/ui/ErrorBoundary";
import { useToast } from "@/components/ui/Toast";

export default function GeneratePage() {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [tone, setTone] = useState("casual");
  const [captions, setCaptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const handleGenerate = async () => {
    if (!topic.trim()) {
      addToast("Please enter a topic or description", "warning");
      return;
    }

    setLoading(true);
    setError(null);
    setCaptions([]);

    try {
      const data = await apiFetch<{ captions: string[] }>("/api/generate", {
        method: "POST",
        body: JSON.stringify({ topic, platform, tone }),
      });
      setCaptions(data.captions);
      addToast(`${data.captions.length} captions generated!`, "success");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to generate captions";
      setError(msg);
      addToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (caption: string) => {
    try {
      await apiFetch("/api/saved", {
        method: "POST",
        body: JSON.stringify({ type: "caption", content: caption, platform }),
      });
      addToast("Caption saved!", "success");
    } catch {
      addToast("Failed to save caption", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Caption Generator</h1>
        <p className="text-zinc-500 mt-1">Describe your post and let AI craft the perfect caption.</p>
      </div>

      {/* Input form */}
      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
        {/* Topic textarea */}
        <div>
          <label htmlFor="topic" className="block text-sm font-medium text-zinc-300 mb-2">
            What&apos;s your post about?
          </label>
          <textarea
            id="topic"
            rows={3}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., Launching our new product, a sunset photo, fitness motivation..."
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40 focus:ring-1 focus:ring-brand-500/20 transition-colors resize-none"
          />
        </div>

        {/* Platform selector */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Platform</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                  platform === p.id
                    ? "bg-brand-600/20 text-brand-300 border border-brand-500/30"
                    : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover hover:text-zinc-200"
                }`}
              >
                <span>{p.icon}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tone selector */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Tone</label>
          <div className="flex flex-wrap gap-2">
            {TONES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTone(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                  tone === t.id
                    ? "bg-brand-600/20 text-brand-300 border border-brand-500/30"
                    : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover hover:text-zinc-200"
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <Button onClick={handleGenerate} loading={loading} size="lg" className="w-full sm:w-auto">
          {loading ? "Generating..." : "✨ Generate Captions"}
        </Button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="rounded-xl border border-brand-500/10 bg-surface-secondary">
          <GenerationLoader messages={GENERATION_MESSAGES} />
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <InlineError message={error} onRetry={handleGenerate} />
      )}

      {/* Results */}
      {captions.length > 0 && !loading && (
        <div className="space-y-4 stagger-children">
          <h2 className="text-lg font-semibold text-zinc-200">Generated Captions</h2>
          {captions.map((caption, i) => (
            <div
              key={i}
              className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 hover:border-brand-500/20 transition-all group"
            >
              <p className="text-zinc-300 whitespace-pre-wrap mb-4 leading-relaxed">{caption}</p>
              <div className="flex flex-wrap gap-2">
                <CopyButton text={caption} />
                <Button variant="secondary" size="sm" onClick={() => handleSave(caption)}>
                  💾 Save
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state when no results yet */}
      {!loading && !error && captions.length === 0 && (
        <div className="text-center py-12 text-zinc-500">
          <span className="text-4xl block mb-4">✍️</span>
          <p>Describe your post above and hit Generate to get started!</p>
        </div>
      )}
    </div>
  );
}
