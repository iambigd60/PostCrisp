"use client";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const MIN_SAMPLES = 3;
const MAX_SAMPLES = 25;
const MAX_SAMPLE_CHARS = 10_000;

interface VoiceSample {
  id: string;
  content: string;
  label: string | null;
  platform: string | null;
  added_at: string;
}

interface VoiceTraits {
  tone: string;
  sentence_rhythm: string;
  vocabulary_level: string;
  signature_phrases: string[];
  openers: string[];
  closers: string[];
  emoji_style: string;
  punctuation_style: string;
  energy: string;
  avoid: string[];
  notes: string;
}

interface VoiceProfile {
  user_id: string;
  samples: VoiceSample[];
  traits: VoiceTraits | null;
  last_analyzed_at: string | null;
  created_at: string;
  updated_at: string;
}

const PLATFORMS = [
  { id: "", label: "— Any platform —" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "x", label: "X / Twitter" },
  { id: "threads", label: "Threads" },
  { id: "facebook", label: "Facebook" },
  { id: "newsletter", label: "Newsletter" },
  { id: "blog", label: "Blog" },
];

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

export default function VoiceTrainerPage() {
  const [profile, setProfile] = useState<VoiceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [sampleContent, setSampleContent] = useState("");
  const [sampleLabel, setSampleLabel] = useState("");
  const [samplePlatform, setSamplePlatform] = useState("");
  const [adding, setAdding] = useState(false);
  const { addToast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const { profile } = await apiFetch<{ profile: VoiceProfile }>("/api/voice-profile");
      setProfile(profile);
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Failed to load voice profile", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const handleAddSample = async () => {
    if (!sampleContent.trim()) {
      addToast("Paste some content first.", "error");
      return;
    }
    if (sampleContent.length > MAX_SAMPLE_CHARS) {
      addToast(`Sample is too long (max ${MAX_SAMPLE_CHARS.toLocaleString()} chars).`, "error");
      return;
    }
    setAdding(true);
    try {
      await apiFetch("/api/voice-profile/samples", {
        method: "POST",
        body: JSON.stringify({
          content: sampleContent.trim(),
          label: sampleLabel.trim() || null,
          platform: samplePlatform || null,
        }),
      });
      setSampleContent("");
      setSampleLabel("");
      setSamplePlatform("");
      setAddOpen(false);
      addToast("Sample added", "success");
      await load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Failed to add sample", "error");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteSample = async (sampleId: string) => {
    if (!window.confirm("Remove this sample?")) return;
    try {
      await apiFetch(`/api/voice-profile/samples/${sampleId}`, { method: "DELETE" });
      addToast("Sample removed", "success");
      await load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Failed to remove sample", "error");
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await apiFetch("/api/voice-profile/analyze", { method: "POST" });
      addToast("Voice profile analyzed", "success");
      await load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Analysis failed", "error");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Delete your entire voice profile? All samples and analysis will be removed.")) return;
    try {
      await apiFetch("/api/voice-profile", { method: "DELETE" });
      addToast("Voice profile cleared", "success");
      await load();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Failed to reset", "error");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 bg-surface-secondary rounded animate-pulse" />
        <div className="h-64 bg-surface-secondary rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!profile) return null;

  const sampleCount = profile.samples?.length ?? 0;
  const canAnalyze = sampleCount >= MIN_SAMPLES;
  const samplesNeeded = Math.max(0, MIN_SAMPLES - sampleCount);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Voice Trainer</h1>
          <span className="text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300 border border-brand-500/20">
            Beta
          </span>
        </div>
        <p className="text-zinc-500 mt-1">
          Paste examples of your existing content. PostCrisp learns your distinctive voice and uses it on every
          caption, script, and post it writes for you.
        </p>
      </div>

      {/* Status banner */}
      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${profile.traits ? "bg-emerald-500/15" : "bg-zinc-500/15"}`}>
            {profile.traits ? "✓" : "🧪"}
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-200">
              {profile.traits
                ? "Voice profile active"
                : canAnalyze
                  ? "Ready to analyze"
                  : `Add ${samplesNeeded} more sample${samplesNeeded === 1 ? "" : "s"} to get started`}
            </div>
            <div className="text-xs text-zinc-500">
              {sampleCount} of {MAX_SAMPLES} samples
              {profile.last_analyzed_at && <> · last analyzed {relativeTime(profile.last_analyzed_at)}</>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {profile.traits && (
            <Button size="sm" variant="secondary" onClick={handleReset}>
              Clear all
            </Button>
          )}
          <Button size="sm" onClick={handleAnalyze} disabled={!canAnalyze} loading={analyzing}>
            {profile.traits ? "Re-analyze" : "Analyze voice"}
          </Button>
        </div>
      </div>

      {/* Two-column: samples on left, traits on right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Samples */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">Content samples</h2>
            <Button size="sm" variant="secondary" onClick={() => setAddOpen((v) => !v)} disabled={sampleCount >= MAX_SAMPLES}>
              {addOpen ? "Cancel" : "+ Add sample"}
            </Button>
          </div>

          {addOpen && (
            <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-4 space-y-3">
              <textarea
                value={sampleContent}
                onChange={(e) => setSampleContent(e.target.value)}
                rows={8}
                maxLength={MAX_SAMPLE_CHARS}
                placeholder="Paste a caption, script, email, or post you've written. The longer and more natural, the better the analysis."
                className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-3 py-2 text-sm focus:outline-none focus:border-brand-500/40 resize-none"
              />
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={sampleLabel}
                  onChange={(e) => setSampleLabel(e.target.value)}
                  placeholder="Optional label (e.g. 'newsletter intro')"
                  className="flex-1 min-w-[180px] rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500/40"
                  maxLength={100}
                />
                <select
                  value={samplePlatform}
                  onChange={(e) => setSamplePlatform(e.target.value)}
                  className="rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500/40"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between text-2xs">
                <span className="text-zinc-600">{sampleContent.length.toLocaleString()} / {MAX_SAMPLE_CHARS.toLocaleString()} chars</span>
                <Button size="sm" onClick={handleAddSample} loading={adding} disabled={!sampleContent.trim()}>
                  Save sample
                </Button>
              </div>
            </div>
          )}

          {sampleCount === 0 && !addOpen && (
            <div className="rounded-xl border border-dashed border-brand-500/20 bg-surface-secondary p-8 text-center">
              <p className="text-sm text-zinc-400">
                No samples yet. Add 3 or more pieces of your real content for the best results.
              </p>
              <Button size="sm" onClick={() => setAddOpen(true)} className="mt-3">
                Add your first sample
              </Button>
            </div>
          )}

          {profile.samples.map((s) => (
            <div key={s.id} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 group">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {s.platform && (
                    <span className="text-2xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-tertiary text-zinc-300">
                      {s.platform}
                    </span>
                  )}
                  {s.label && <span className="text-xs text-zinc-400">{s.label}</span>}
                  <span className="text-xs text-zinc-600">· {relativeTime(s.added_at)}</span>
                </div>
                <button
                  onClick={() => handleDeleteSample(s.id)}
                  className="text-xs text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  aria-label="Remove sample"
                >
                  Remove
                </button>
              </div>
              <p className="text-xs text-zinc-400 line-clamp-4 whitespace-pre-wrap">{s.content}</p>
            </div>
          ))}
        </div>

        {/* Traits */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-200">Analyzed voice</h2>

          {!profile.traits && (
            <div className="rounded-xl border border-dashed border-brand-500/20 bg-surface-secondary p-8 text-center">
              <p className="text-sm text-zinc-400">
                {canAnalyze
                  ? "Click 'Analyze voice' above once you're happy with your samples."
                  : `Add ${samplesNeeded} more sample${samplesNeeded === 1 ? "" : "s"} to unlock analysis.`}
              </p>
            </div>
          )}

          {profile.traits && (
            <div className="space-y-3">
              <TraitBlock label="Tone" value={profile.traits.tone} />
              <TraitBlock label="Sentence rhythm" value={profile.traits.sentence_rhythm} />
              <TraitBlock label="Vocabulary" value={profile.traits.vocabulary_level} />
              <TraitBlock label="Energy" value={profile.traits.energy} />
              <TraitBlock label="Emoji style" value={profile.traits.emoji_style} />
              <TraitBlock label="Punctuation" value={profile.traits.punctuation_style} />
              <TraitList label="Signature phrases" items={profile.traits.signature_phrases} />
              <TraitList label="Typical openers" items={profile.traits.openers} />
              <TraitList label="Typical closers" items={profile.traits.closers} />
              <TraitList label="Avoids" items={profile.traits.avoid} variant="warning" />
              {profile.traits.notes && (
                <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4">
                  <div className="text-2xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Notes</div>
                  <p className="text-sm text-zinc-300 leading-relaxed">{profile.traits.notes}</p>
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200/80 mt-4">
            <strong className="block text-amber-200 mb-1">What happens next</strong>
            Once analyzed, your voice profile automatically feeds into content-generation features
            (captions, scripts, repurposer, and more). Output will start sounding like you,
            not like a generic AI.
          </div>
        </div>
      </div>
    </div>
  );
}

function TraitBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4">
      <div className="text-2xs font-bold uppercase tracking-wider text-zinc-500 mb-1">{label}</div>
      <p className="text-sm text-zinc-300 leading-relaxed">{value}</p>
    </div>
  );
}

function TraitList({ label, items, variant = "default" }: { label: string; items: string[]; variant?: "default" | "warning" }) {
  if (!items || items.length === 0) return null;
  const pillColor =
    variant === "warning"
      ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
      : "bg-brand-500/10 text-brand-300 border-brand-500/20";
  return (
    <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4">
      <div className="text-2xs font-bold uppercase tracking-wider text-zinc-500 mb-2">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span key={i} className={`text-xs px-2 py-1 rounded-lg border ${pillColor}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
