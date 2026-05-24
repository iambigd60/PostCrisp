"use client";
import { useState } from "react";
import { PLATFORMS, NICHES, type PlatformId } from "@/lib/constants";
import { isSocialPlatformUrl, looksLikeUrl, socialPlatformLabel, validateEvidencePostsForPlatform } from "@/lib/social-url";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { EngineBadge } from "@/components/ui/EngineBadge";
import { FeatureGate } from "@/components/ui/FeatureGate";
import { GenerationLoader } from "@/components/ui/GenerationLoader";
import { InlineError } from "@/components/ui/ErrorBoundary";
import { useToast } from "@/components/ui/Toast";

type Sophistication = 'beginner' | 'intermediate' | 'advanced'
type GrowthGoal = 'followers' | 'engagement' | 'monetization' | 'authority' | 'community'
type MonetizationStage = 'none' | 'brand-deals' | 'digital-products' | 'services' | 'multi-stream'

interface SamplePost { sourceUrl: string; caption: string; metric: string; whyItWorked: string }

interface Result {
  overallAssessment: string
  strengths: string[]
  gaps: string[]
  contentMix: { observation: string; recommendation: string }
  postingConsistency: { observation: string; recommendation: string }
  audienceEngagement: { observation: string; recommendation: string }
  missedOpportunities: string[]
  quickWins: { title: string; action: string; impact: string }[]
  longTermMoves: { title: string; action: string; timeframe: string }[]
  topPostPatterns: string[]
  recommendedFormatLean: string
  repeatableHookStructures: { pattern: string; example: string }[]
  creatorProfile: {
    contentPillars: string[]
    voiceSignature: { adjectives: string[]; examplePhrasing: string }
    audiencePersona: { description: string; sophistication: Sophistication }
    growthStage: 'pre-traction' | 'early-traction' | 'scaling' | 'established'
    monetizationPosition: { stage: string; primaryStreams: string[] }
    formatStrengths: string[]
    differentiators: string[]
    topBlockers: string[]
  }
  analysis_id: string | null
}

const CADENCES = ["Daily", "4-5x/week", "2-3x/week", "Weekly", "Less than weekly", "Not sure"];
const FORMATS = ["Carousels", "Short-form video", "Long-form video", "Lives", "Stills", "Threads", "Stories"];
const GOALS: { id: GrowthGoal; label: string }[] = [
  { id: 'followers', label: 'Followers' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'monetization', label: 'Monetization' },
  { id: 'authority', label: 'Authority' },
  { id: 'community', label: 'Community' },
];
const STAGES: { id: MonetizationStage; label: string }[] = [
  { id: 'none', label: 'None yet' },
  { id: 'brand-deals', label: 'Brand deals' },
  { id: 'digital-products', label: 'Digital products' },
  { id: 'services', label: 'Services' },
  { id: 'multi-stream', label: 'Multi-stream' },
];
const SOPHISTICATIONS: { id: Sophistication; label: string }[] = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];

const impactColor: Record<string, string> = {
  High: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  Medium: "bg-brand-500/10 text-brand-300 border-brand-500/20",
  Low: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

function emptySample(): SamplePost { return { sourceUrl: '', caption: '', metric: '', whyItWorked: '' } }

export default function FoundationAnalysisPage() {
  // Section 1
  const [platform, setPlatform] = useState<PlatformId>("instagram");
  const [analyzeHandle, setAnalyzeHandle] = useState("");
  const [niche, setNiche] = useState("");
  const [useCustomNiche, setUseCustomNiche] = useState(false);
  const [followerCount, setFollowerCount] = useState("");
  const [postingCadence, setPostingCadence] = useState("Weekly");
  // Section 2
  const [pillars, setPillars] = useState<[string, string, string]>(['', '', '']);
  const [audienceDesc, setAudienceDesc] = useState("");
  const [sophistication, setSophistication] = useState<Sophistication>('intermediate');
  const [growthGoal, setGrowthGoal] = useState<GrowthGoal>('engagement');
  const [monetizationStage, setMonetizationStage] = useState<MonetizationStage>('none');
  // Section 3
  const [formatStrengths, setFormatStrengths] = useState<string[]>([]);
  const [currentChallenges, setCurrentChallenges] = useState("");
  // Section 4 — evidence layer
  const [samples, setSamples] = useState<[SamplePost, SamplePost, SamplePost]>([emptySample(), emptySample(), emptySample()]);

  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const setPillar = (i: number, v: string) => setPillars((prev) => { const next = [...prev] as [string, string, string]; next[i] = v; return next });
  const setSample = (i: number, patch: Partial<SamplePost>) => setSamples((prev) => { const next = [...prev] as [SamplePost, SamplePost, SamplePost]; next[i] = { ...next[i], ...patch }; return next });
  const toggleFormat = (f: string) => setFormatStrengths((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
  const sampleUrlIsInvalid = (sample: SamplePost) => sample.sourceUrl.trim().length > 0 && !isSocialPlatformUrl(platform, sample.sourceUrl);

  const handleAnalyze = async () => {
    if (!niche.trim()) { addToast("Enter or select your niche", "warning"); return }
    if (!pillars.some((p) => p.trim())) { addToast("Enter at least one content pillar", "warning"); return }
    if (!audienceDesc.trim()) { addToast("Describe your target audience", "warning"); return }
    if (!samples.some((s) => s.caption.trim())) { addToast("Paste at least one of your best-performing posts", "warning"); return }
    if (analyzeHandle.trim() && looksLikeUrl(analyzeHandle) && !isSocialPlatformUrl(platform, analyzeHandle)) { addToast(`Channel URL must be a ${socialPlatformLabel(platform)} link.`, "warning"); return }
    const evidenceUrlErrors = validateEvidencePostsForPlatform(platform, samples)
    if (evidenceUrlErrors.length > 0) { addToast(evidenceUrlErrors[0], "warning"); return }

    setLoading(true); setError(null); setResult(null);
    try {
      const data = await apiFetch<Result>("/api/foundation-analysis", {
        method: "POST",
        body: JSON.stringify({
          platform, niche, followerCount, postingCadence,
          contentPillars: pillars.filter((p) => p.trim()),
          targetAudience: { description: audienceDesc, sophistication },
          growthGoal, monetizationStage,
          formatStrengths,
          currentChallenges,
          analyzeHandle,
          samplePosts: samples.filter((s) => s.caption.trim()),
        }),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Foundation analysis failed");
    } finally { setLoading(false); }
  };

  return (
    <FeatureGate
      feature="foundation-analysis"
      featureLabel="Foundation Analysis"
      featureIcon="🧬"
      featureTagline="Evidence-grounded audit + a reusable Creator Profile that powers every other tool."
      valueProps={[
        "Real-signal audit — the AI evaluates your actual top-performing posts, not just your demographic",
        "Pinpoint the formats your audience rewards by 3-5x",
        "Extract the hook structures behind your wins, repeatable",
        "Saves a Creator Profile that Captions, Viral Ideas, and Bio Optimizer read on every generation",
      ]}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">🧬 Foundation Analysis</h1>
          <p className="text-zinc-500 mt-1">Set your strategic foundation. Captions, Viral Ideas, and Bio Optimizer will all build from this.</p>
        </div>

        {/* Section 1 — Your channel */}
        <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 mb-1">1. Your channel</h2>
            <p className="text-xs text-zinc-500">Where you publish today and the basics of your reach.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Platform to analyze</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button key={p.id} onClick={() => setPlatform(p.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${platform === p.id ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>
                  <p.icon className="w-4 h-4" style={{ color: p.color }} /><span>{p.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-600 mt-2">💡 We&apos;ll use the URL from your Settings → Channel URLs for this platform if saved.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Channel handle / URL to analyze <span className="text-zinc-600">(optional — overrides profile)</span></label>
            <input value={analyzeHandle} onChange={(e) => setAnalyzeHandle(e.target.value)} placeholder="e.g., @yourhandle or full URL"
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-zinc-300">Your niche *</label>
              <button type="button" onClick={() => { setUseCustomNiche(!useCustomNiche); setNiche(""); }} className="text-xs text-brand-400 hover:text-brand-300">
                {useCustomNiche ? "← Use preset list" : "Custom niche →"}
              </button>
            </div>
            {useCustomNiche ? (
              <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g., sourdough for beginners, indie game dev"
                className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40" />
            ) : (
              <select value={niche} onChange={(e) => setNiche(e.target.value)} className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40">
                <option value="">Select a niche…</option>
                {NICHES.map((n) => <option key={n.id} value={n.label}>{n.label}</option>)}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Follower count <span className="text-zinc-600">(optional)</span></label>
              <input value={followerCount} onChange={(e) => setFollowerCount(e.target.value)} placeholder="e.g., 12K"
                className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">How often do you post?</label>
              <select value={postingCadence} onChange={(e) => setPostingCadence(e.target.value)} className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40">
                {CADENCES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Section 2 — Your strategy */}
        <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 mb-1">2. Your strategy</h2>
            <p className="text-xs text-zinc-500">The pillars, audience, and direction that shape your content.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Your 3 content pillars * <span className="text-zinc-600">(≤60 chars each)</span></label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {pillars.map((p, i) => (
                <input key={i} value={p} maxLength={60} onChange={(e) => setPillar(i, e.target.value)} placeholder={`Pillar ${i + 1}`}
                  className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40" />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-zinc-300 mb-2">Describe your target audience *</label>
              <textarea rows={3} value={audienceDesc} onChange={(e) => setAudienceDesc(e.target.value)}
                placeholder="e.g., New homebakers in their 30s who want to make sourdough but feel intimidated by starter culture and timing"
                className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Audience sophistication</label>
              <select value={sophistication} onChange={(e) => setSophistication(e.target.value as Sophistication)} className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40">
                {SOPHISTICATIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Primary growth goal</label>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <button key={g.id} onClick={() => setGrowthGoal(g.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${growthGoal === g.id ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>{g.label}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Monetization stage</label>
            <div className="flex flex-wrap gap-2">
              {STAGES.map((s) => (
                <button key={s.id} onClick={() => setMonetizationStage(s.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${monetizationStage === s.id ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>{s.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 3 — Your reality */}
        <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 mb-1">3. Your reality</h2>
            <p className="text-xs text-zinc-500">What you&apos;re strong at and what&apos;s blocking you right now.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Format strengths <span className="text-zinc-600">(select all that apply)</span></label>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((f) => (
                <button key={f} onClick={() => toggleFormat(f)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${formatStrengths.includes(f) ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>{f}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Current challenges / what&apos;s not working <span className="text-zinc-600">(optional)</span></label>
            <textarea rows={3} value={currentChallenges} onChange={(e) => setCurrentChallenges(e.target.value)}
              placeholder="e.g., Reach stalled after 10K followers, Reels aren't hitting, engagement rate dropping..."
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40 resize-none" />
          </div>
        </div>

        {/* Section 4 — Evidence layer */}
        <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 mb-1">4. Evidence layer * <span className="text-zinc-600 font-normal">— your top 1–3 posts</span></h2>
            <p className="text-xs text-zinc-500">Add links to your highest-performing {socialPlatformLabel(platform)} posts, then paste the caption or script so the audit has reliable evidence.</p>
          </div>

          {samples.map((s, i) => (
            <div key={i} className="rounded-lg border border-brand-500/10 bg-surface-tertiary/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-300">Post #{i + 1}{i === 0 ? ' (required)' : ' (optional)'}</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">{socialPlatformLabel(platform)} post URL <span className="text-zinc-600">(recommended)</span></label>
                <input value={s.sourceUrl} onChange={(e) => setSample(i, { sourceUrl: e.target.value })} placeholder={`Paste a ${socialPlatformLabel(platform)} post link`}
                  className={`w-full rounded-lg bg-surface-tertiary border text-zinc-200 placeholder:text-zinc-600 px-3 py-2.5 text-sm focus:outline-none ${sampleUrlIsInvalid(s) ? "border-red-500/60 focus:border-red-500/80" : "border-brand-500/10 focus:border-brand-500/40"}`} />
                {sampleUrlIsInvalid(s) && (
                  <p className="text-xs text-red-300 mt-1.5">This must be a {socialPlatformLabel(platform)} URL because {socialPlatformLabel(platform)} is selected above.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Caption / script</label>
                <textarea rows={4} value={s.caption} onChange={(e) => setSample(i, { caption: e.target.value })}
                  placeholder="Paste the full caption or hook+script of one of your best-performing posts."
                  className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500/40 resize-none" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Why it performed <span className="text-zinc-600">(metric)</span></label>
                  <input value={s.metric} onChange={(e) => setSample(i, { metric: e.target.value })} placeholder="e.g., 240K views, 8K saves, 1.2K shares"
                    className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500/40" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Your theory on why it worked</label>
                  <input value={s.whyItWorked} onChange={(e) => setSample(i, { whyItWorked: e.target.value })} placeholder="e.g., Counterintuitive hook + saved-for-later utility"
                    className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500/40" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <Button onClick={handleAnalyze} loading={loading} size="lg" className="w-full sm:w-auto">
            {loading ? "Analyzing..." : "🧬 Run Foundation Analysis"}
          </Button>
          <p className="text-xs text-zinc-600 hidden sm:block">Takes 30–60s. Saves your Creator Profile when complete.</p>
        </div>

        {loading && <GenerationLoader variant="rocket" messages={[
          "Reading your evidence — your wins reveal what your audience rewards.",
          "Auditing your channel against 2026 platform dynamics...",
          "Extracting hook patterns from your top posts...",
          "Building your Creator Profile that Captions, Viral Ideas, and Bio Optimizer will use...",
          "Critiquing every recommendation for specificity...",
          "Almost there — finalizing your foundation.",
        ]} />}
        {error && !loading && <InlineError message={error} onRetry={handleAnalyze} />}

        {result && !loading && <FoundationResult result={result} />}

        {!result && !loading && !error && (
          <div className="text-center py-8 text-zinc-500">
            <span className="text-4xl block mb-3">🧬</span>
            <p className="text-sm">Fill in your strategy and paste at least one top-performing post to run your foundation audit.</p>
          </div>
        )}
      </div>
    </FeatureGate>
  );
}

function FoundationResult({ result }: { result: Result }) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Profile-saved banner */}
      <div className="rounded-xl border border-brand-500/30 bg-brand-900/10 p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-300">✨ Your Creator Profile is saved.</p>
          <p className="text-xs text-zinc-400">Captions, Viral Ideas, and Bio Optimizer will read it on every generation.</p>
        </div>
        <a href="/dashboard/settings#profile" className="text-xs text-brand-300 hover:text-brand-200">Manage profile →</a>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-200">Your foundation audit</h2>
        <EngineBadge />
      </div>

      <div className="rounded-xl border border-brand-500/30 bg-brand-900/10 p-5">
        <h3 className="text-sm font-semibold text-brand-300 uppercase tracking-wider mb-2">Overall assessment</h3>
        <p className="text-sm text-zinc-200 leading-relaxed">{result.overallAssessment}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <h3 className="text-sm font-semibold text-zinc-100 mb-3">✅ Strengths</h3>
          <ul className="space-y-2">{result.strengths.map((s, i) => <li key={i} className="text-sm text-zinc-300 flex gap-2"><span className="text-emerald-400">▸</span>{s}</li>)}</ul>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <h3 className="text-sm font-semibold text-zinc-100 mb-3">⚠️ Gaps to close</h3>
          <ul className="space-y-2">{result.gaps.map((g, i) => <li key={i} className="text-sm text-zinc-300 flex gap-2"><span className="text-amber-400">▸</span>{g}</li>)}</ul>
        </div>
      </div>

      {/* Three observation/recommendation cards (content mix / consistency / engagement) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[
          { title: "Content mix", icon: "🎭", data: result.contentMix },
          { title: "Posting consistency", icon: "📅", data: result.postingConsistency },
          { title: "Audience engagement", icon: "💬", data: result.audienceEngagement },
        ].map((s) => (
          <div key={s.title} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
            <h3 className="text-sm font-semibold text-zinc-100 mb-3">{s.icon} {s.title}</h3>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Observation</p>
            <p className="text-sm text-zinc-300 mb-3">{s.data.observation}</p>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Recommendation</p>
            <p className="text-sm text-zinc-200">{s.data.recommendation}</p>
          </div>
        ))}
      </div>

      {/* Evidence-layer findings — top patterns + format lean + hook structures */}
      <div className="rounded-xl border border-brand-500/20 bg-surface-secondary p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 mb-2">🔬 Top post patterns</h3>
          <ul className="space-y-1">{result.topPostPatterns.map((p, i) => <li key={i} className="text-sm text-zinc-300 flex gap-2"><span className="text-brand-400">▸</span>{p}</li>)}</ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 mb-2">🎯 Recommended format lean</h3>
          <p className="text-sm text-zinc-200 font-medium">{result.recommendedFormatLean}</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 mb-2">🪝 Repeatable hook structures</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-zinc-500"><th className="pb-2">Pattern</th><th className="pb-2">Example</th></tr></thead>
            <tbody className="divide-y divide-brand-500/10">
              {result.repeatableHookStructures.map((h, i) => (
                <tr key={i}><td className="py-2 pr-4 text-zinc-300 align-top">{h.pattern}</td><td className="py-2 text-zinc-400 italic">{h.example}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick wins + long-term moves — same as channel-analysis */}
      <div>
        <h3 className="text-base font-semibold text-zinc-200 mb-3">⚡ Quick wins this week</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {result.quickWins.map((w, i) => (
            <div key={i} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4">
              <div className="flex items-center justify-between mb-2"><span className="text-xs font-semibold text-brand-300">#{i + 1}</span><span className={`text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${impactColor[w.impact] ?? ""}`}>{w.impact}</span></div>
              <h4 className="text-sm font-semibold text-zinc-100 mb-1">{w.title}</h4>
              <p className="text-xs text-zinc-400">{w.action}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold text-zinc-200 mb-3">🎯 Long-term moves</h3>
        <div className="space-y-2">
          {result.longTermMoves.map((m, i) => (
            <div key={i} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 flex items-start gap-4">
              <span className="text-2xs text-brand-300 bg-brand-500/10 px-2 py-1 rounded-full whitespace-nowrap">{m.timeframe}</span>
              <div className="flex-1"><h4 className="text-sm font-semibold text-zinc-100">{m.title}</h4><p className="text-xs text-zinc-400 mt-1">{m.action}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
