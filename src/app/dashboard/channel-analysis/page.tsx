"use client";
import { useState } from "react";
import { PLATFORMS, NICHES } from "@/lib/constants";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { EngineBadge } from "@/components/ui/EngineBadge";
import { FeatureGate } from "@/components/ui/FeatureGate";
import { GenerationLoader } from "@/components/ui/GenerationLoader";
import { InlineError } from "@/components/ui/ErrorBoundary";
import { useToast } from "@/components/ui/Toast";

interface Result {
  overallAssessment: string;
  strengths: string[];
  gaps: string[];
  contentMix: { observation: string; recommendation: string };
  postingConsistency: { observation: string; recommendation: string };
  audienceEngagement: { observation: string; recommendation: string };
  missedOpportunities: string[];
  quickWins: { title: string; action: string; impact: string }[];
  longTermMoves: { title: string; action: string; timeframe: string }[];
}

const CADENCES = ["Daily", "4-5x/week", "2-3x/week", "Weekly", "Less than weekly", "Not sure"];
const FOCUS_OPTIONS = ["Educational", "Entertainment", "Storytelling", "Behind-the-scenes", "Product reviews", "Tutorials", "Commentary", "Lifestyle", "Inspirational"];

const impactColor: Record<string, string> = {
  High: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  Medium: "bg-brand-500/10 text-brand-300 border-brand-500/20",
  Low: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export default function ChannelAnalysisPage() {
  const [platform, setPlatform] = useState("instagram");
  const [niche, setNiche] = useState("");
  const [useCustomNiche, setUseCustomNiche] = useState(false);
  const [followerCount, setFollowerCount] = useState("");
  const [postingCadence, setPostingCadence] = useState("Weekly");
  const [contentFocus, setContentFocus] = useState<string[]>(["Educational"]);
  const [currentChallenges, setCurrentChallenges] = useState("");
  const [analyzeHandle, setAnalyzeHandle] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const toggleFocus = (f: string) => setContentFocus((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);

  const handleAnalyze = async () => {
    if (!niche.trim()) { addToast("Enter or select your niche", "warning"); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const data = await apiFetch<Result>("/api/channel-analysis", {
        method: "POST",
        body: JSON.stringify({
          platform, niche, followerCount, postingCadence,
          contentFocus: contentFocus.join(", "),
          currentChallenges, analyzeHandle,
        }),
        // 120s — matches the route's maxDuration. Refine pass for Elite tier
        // can take up to ~50s; this gives us comfortable headroom over that
        // plus Anthropic Opus latency variance.
        timeout: 120000,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Analysis failed");
    } finally { setLoading(false); }
  };

  const handleSaveReport = async () => {
    if (!result) return;
    const report = [
      `# Channel Analysis — ${platform}`,
      `Niche: ${niche}`,
      followerCount && `Followers: ${followerCount}`,
      ``,
      `## Overall Assessment`,
      result.overallAssessment,
      ``,
      `## Strengths`,
      ...result.strengths.map((s) => `- ${s}`),
      ``,
      `## Gaps`,
      ...result.gaps.map((s) => `- ${s}`),
      ``,
      `## Content Mix`,
      `Observation: ${result.contentMix.observation}`,
      `Recommendation: ${result.contentMix.recommendation}`,
      ``,
      `## Posting Consistency`,
      `Observation: ${result.postingConsistency.observation}`,
      `Recommendation: ${result.postingConsistency.recommendation}`,
      ``,
      `## Audience Engagement`,
      `Observation: ${result.audienceEngagement.observation}`,
      `Recommendation: ${result.audienceEngagement.recommendation}`,
      ``,
      `## Missed Opportunities`,
      ...result.missedOpportunities.map((s) => `- ${s}`),
      ``,
      `## Quick Wins (this week)`,
      ...result.quickWins.map((w, i) => `${i + 1}. ${w.title} (${w.impact} impact) — ${w.action}`),
      ``,
      `## Long-Term Moves`,
      ...result.longTermMoves.map((m, i) => `${i + 1}. [${m.timeframe}] ${m.title} — ${m.action}`),
    ].filter(Boolean).join("\n");

    try {
      await apiFetch("/api/saved", {
        method: "POST",
        body: JSON.stringify({ type: "channel_report", content: report, platform, topic: `Channel Analysis — ${niche}` }),
      });
      addToast("Analysis saved!", "success");
    } catch {
      addToast("Failed to save", "error");
    }
  };

  return (
    <FeatureGate
      feature="channel-analysis"
      featureLabel="Channel Analysis"
      featureIcon="🪞"
      featureTagline="An honest strategic audit of your own channel, refreshed on demand."
      valueProps={[
        "Identify the single biggest thing holding your growth back",
        "3 quick-win actions you can execute this week",
        "A 90-day roadmap of strategic moves tied to your niche",
        "Re-run the audit anytime your strategy or platform shifts",
      ]}
    >
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Channel Analysis</h1>
        <p className="text-zinc-500 mt-1">An honest audit of your own channel, with quick wins and long-term moves.</p>
      </div>

      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
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

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Primary content focus</label>
          <div className="flex flex-wrap gap-2">
            {FOCUS_OPTIONS.map((f) => (
              <button key={f} onClick={() => toggleFocus(f)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${contentFocus.includes(f) ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>{f}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Current challenges / what&apos;s not working <span className="text-zinc-600">(optional)</span></label>
          <textarea rows={3} value={currentChallenges} onChange={(e) => setCurrentChallenges(e.target.value)}
            placeholder="e.g., Reach stalled after 10K followers, Reels aren't hitting, engagement rate dropping..."
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40 resize-none" />
        </div>

        <Button onClick={handleAnalyze} loading={loading} size="lg" className="w-full sm:w-auto">
          {loading ? "Analyzing..." : "🪞 Analyze My Channel"}
        </Button>
      </div>

      {loading && <GenerationLoader messages={["Auditing your channel...", "Identifying strengths and gaps...", "Building quick wins...", "Planning long-term moves...", "Refining for sharper insights — this can take up to a minute on the deepest tier.", "Critiquing every recommendation for specificity..."]} />}
      {error && !loading && <InlineError message={error} onRetry={handleAnalyze} />}

      {result && !loading && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-200">Your audit</h2>
            <div className="flex items-center gap-3">
              <EngineBadge />
              <Button variant="secondary" size="sm" onClick={handleSaveReport}>💾 Save Report</Button>
            </div>
          </div>

          {/* Overall */}
          <div className="rounded-xl border border-brand-500/30 bg-brand-900/10 p-5">
            <h3 className="text-sm font-semibold text-brand-300 uppercase tracking-wider mb-2">Overall assessment</h3>
            <p className="text-sm text-zinc-200 leading-relaxed">{result.overallAssessment}</p>
          </div>

          {/* Strengths + Gaps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <h3 className="text-sm font-semibold text-zinc-100 mb-3">✅ Strengths</h3>
              <ul className="space-y-2">
                {result.strengths.map((s, i) => <li key={i} className="text-sm text-zinc-300 flex gap-2"><span className="text-emerald-400">▸</span>{s}</li>)}
              </ul>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
              <h3 className="text-sm font-semibold text-zinc-100 mb-3">⚠️ Gaps to close</h3>
              <ul className="space-y-2">
                {result.gaps.map((g, i) => <li key={i} className="text-sm text-zinc-300 flex gap-2"><span className="text-amber-400">▸</span>{g}</li>)}
              </ul>
            </div>
          </div>

          {/* Content mix / consistency / engagement */}
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

          {/* Missed opportunities */}
          <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
            <h3 className="text-sm font-semibold text-zinc-100 mb-3">💎 Features you&apos;re probably underusing</h3>
            <ul className="space-y-2">
              {result.missedOpportunities.map((m, i) => <li key={i} className="text-sm text-zinc-300 flex gap-2"><span className="text-brand-400">▸</span>{m}</li>)}
            </ul>
          </div>

          {/* Quick wins */}
          <div>
            <h3 className="text-base font-semibold text-zinc-200 mb-3">⚡ Quick wins this week</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {result.quickWins.map((w, i) => (
                <div key={i} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-brand-300">#{i + 1}</span>
                    <span className={`text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${impactColor[w.impact] ?? ""}`}>{w.impact}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-zinc-100 mb-1">{w.title}</h4>
                  <p className="text-xs text-zinc-400">{w.action}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Long-term moves */}
          <div>
            <h3 className="text-base font-semibold text-zinc-200 mb-3">🎯 Long-term moves</h3>
            <div className="space-y-2">
              {result.longTermMoves.map((m, i) => (
                <div key={i} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4 flex items-start gap-4">
                  <span className="text-2xs text-brand-300 bg-brand-500/10 px-2 py-1 rounded-full whitespace-nowrap">{m.timeframe}</span>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-zinc-100">{m.title}</h4>
                    <p className="text-xs text-zinc-400 mt-1">{m.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!result && !loading && !error && (
        <div className="text-center py-12 text-zinc-500">
          <span className="text-4xl block mb-4">🪞</span>
          <p>Fill in your profile to get an honest audit of your own channel.</p>
        </div>
      )}
    </div>
    </FeatureGate>
  );
}
