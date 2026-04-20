"use client";
import { useState } from "react";
import { PLATFORMS, NICHES } from "@/lib/constants";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { EngineBadge } from "@/components/ui/EngineBadge";
import { GenerationLoader } from "@/components/ui/GenerationLoader";
import { InlineError } from "@/components/ui/ErrorBoundary";
import { useToast } from "@/components/ui/Toast";

interface Result {
  partnerProfiles: { description: string; whyItWorks: string }[];
  howToFind: string[];
  outreachTemplate: string;
  contentIdeas: string[];
  dosDonts: { dos: string[]; donts: string[] };
  crossPromotionTips: string[];
}

const FOLLOWER_RANGES = ["< 10K (nano)", "10-50K (micro)", "50-250K (mid)", "250K-1M (macro)", "1M+ (mega)"];
const COLLAB_TYPES = ["Content Collab", "Shoutout Exchange", "Joint Live", "Guest Feature", "Challenge / Duet", "Podcast Guest"];
const LOOKING_FOR = ["Similar Audience", "Complementary Niche", "Larger Following", "Local Creator", "Same Platform Focus"];

export default function CollabFinderPage() {
  const [niche, setNiche] = useState("");
  const [followerRange, setFollowerRange] = useState(FOLLOWER_RANGES[1]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["Instagram", "TikTok"]);
  const [collabType, setCollabType] = useState("Content Collab");
  const [lookingFor, setLookingFor] = useState<string[]>(["Similar Audience", "Complementary Niche"]);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const togglePlatform = (p: string) => setSelectedPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  const toggleLookingFor = (l: string) => setLookingFor((prev) => prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]);

  const handleGenerate = async () => {
    if (!niche) { addToast("Select your niche", "warning"); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const data = await apiFetch<Result>("/api/collab-finder", {
        method: "POST",
        body: JSON.stringify({ niche, followerRange, platforms: selectedPlatforms, collabType, lookingFor }),
        timeout: 60000,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Collaboration Finder</h1>
        <p className="text-zinc-500 mt-1">Strategy, outreach, and content ideas for creator partnerships.</p>
      </div>

      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Your niche *</label>
            <select value={niche} onChange={(e) => setNiche(e.target.value)} className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40">
              <option value="">Select a niche…</option>
              {NICHES.map((n) => <option key={n.id} value={n.label}>{n.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Your follower range</label>
            <select value={followerRange} onChange={(e) => setFollowerRange(e.target.value)} className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40">
              {FOLLOWER_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Active platforms</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button key={p.id} onClick={() => togglePlatform(p.label)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedPlatforms.includes(p.label) ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>
                <p.icon className="w-4 h-4" style={{ color: p.color }} /><span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Collaboration type</label>
          <div className="flex flex-wrap gap-2">
            {COLLAB_TYPES.map((t) => (
              <button key={t} onClick={() => setCollabType(t)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${collabType === t ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>{t}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">What you&apos;re looking for in a partner</label>
          <div className="flex flex-wrap gap-2">
            {LOOKING_FOR.map((l) => (
              <button key={l} onClick={() => toggleLookingFor(l)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${lookingFor.includes(l) ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>{l}</button>
            ))}
          </div>
        </div>

        <Button onClick={handleGenerate} loading={loading} size="lg" className="w-full sm:w-auto">
          {loading ? "Building strategy..." : "🤝 Build Collab Strategy"}
        </Button>
      </div>

      {loading && <GenerationLoader messages={["Profiling ideal partners...", "Writing outreach...", "Sketching collab ideas..."]} />}
      {error && !loading && <InlineError message={error} onRetry={handleGenerate} />}

      {result && !loading && (
        <div className="space-y-5 animate-fade-in">
          <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-zinc-200">Your collab playbook</h2><EngineBadge /></div>

          {/* Partner profiles */}
          <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
            <h3 className="text-base font-semibold text-zinc-100 mb-3">👥 Types of creators to target</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {result.partnerProfiles.map((p, i) => (
                <div key={i} className="rounded-lg bg-surface-tertiary p-3 border border-brand-500/5">
                  <p className="text-sm font-medium text-zinc-200 mb-1">{p.description}</p>
                  <p className="text-xs text-zinc-500">💡 {p.whyItWorks}</p>
                </div>
              ))}
            </div>
          </div>

          {/* How to find */}
          <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
            <h3 className="text-base font-semibold text-zinc-100 mb-3">🔍 How to find them</h3>
            <ol className="space-y-2">
              {result.howToFind.map((h, i) => <li key={i} className="flex gap-3 text-sm text-zinc-300"><span className="text-brand-400 font-bold">{i + 1}.</span><span className="flex-1">{h}</span></li>)}
            </ol>
          </div>

          {/* Outreach */}
          <div className="rounded-xl border border-brand-500/30 bg-brand-900/10 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-zinc-100">✉️ Outreach template</h3>
              <CopyButton text={result.outreachTemplate} />
            </div>
            <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono bg-surface-tertiary rounded-lg p-4 border border-brand-500/5 leading-relaxed">{result.outreachTemplate}</pre>
          </div>

          {/* Content ideas */}
          <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
            <h3 className="text-base font-semibold text-zinc-100 mb-3">💡 Content collab ideas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {result.contentIdeas.map((idea, i) => (
                <div key={i} className="rounded-lg bg-surface-tertiary p-3 text-sm text-zinc-300 border border-brand-500/5">
                  {idea}
                </div>
              ))}
            </div>
          </div>

          {/* Dos and donts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <h3 className="text-base font-semibold text-zinc-100 mb-3">✅ Do</h3>
              <ul className="space-y-2">
                {result.dosDonts.dos.map((d, i) => <li key={i} className="text-sm text-zinc-300 flex gap-2"><span className="text-emerald-400">✓</span>{d}</li>)}
              </ul>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
              <h3 className="text-base font-semibold text-zinc-100 mb-3">❌ Don&apos;t</h3>
              <ul className="space-y-2">
                {result.dosDonts.donts.map((d, i) => <li key={i} className="text-sm text-zinc-300 flex gap-2"><span className="text-red-400">✗</span>{d}</li>)}
              </ul>
            </div>
          </div>

          {/* Cross-promotion tips */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
            <h3 className="text-base font-semibold text-zinc-100 mb-3">📢 Cross-promotion tips</h3>
            <ul className="space-y-2">
              {result.crossPromotionTips.map((tip, i) => <li key={i} className="flex gap-2 text-sm text-zinc-300"><span className="text-amber-400 font-bold">{i + 1}.</span><span className="flex-1">{tip}</span></li>)}
            </ul>
          </div>
        </div>
      )}

      {!result && !loading && !error && (
        <div className="text-center py-12 text-zinc-500">
          <span className="text-4xl block mb-4">🤝</span>
          <p>Fill in your profile to get a complete collab strategy.</p>
        </div>
      )}
    </div>
  );
}
