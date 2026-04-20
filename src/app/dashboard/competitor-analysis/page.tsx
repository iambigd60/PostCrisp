"use client";
import { useState } from "react";
import { PLATFORMS, NICHES } from "@/lib/constants";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { EngineBadge } from "@/components/ui/EngineBadge";
import { FeatureGate } from "@/components/ui/FeatureGate";
import { GenerationLoader } from "@/components/ui/GenerationLoader";
import { InlineError } from "@/components/ui/ErrorBoundary";
import { useToast } from "@/components/ui/Toast";

interface Result {
  contentStrategy: string;
  strengths: string[];
  weaknesses: string[];
  hashtagStrategy: string;
  engagementTactics: string[];
  keyTakeaways: string[];
  contentIdeas: { title: string; why: string }[];
}

const FOCUS_OPTIONS = [
  "Content strategy",
  "Posting frequency",
  "Hashtag usage",
  "Engagement tactics",
  "Content themes",
  "Growth tactics",
];

const LOADING_MESSAGES = [
  "Studying their content patterns...",
  "Identifying strengths and gaps...",
  "Crafting counter-strategies...",
  "Extracting actionable lessons...",
];

export default function CompetitorAnalysisPage() {
  const [competitor, setCompetitor] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [yourNiche, setYourNiche] = useState("");
  const [focusAreas, setFocusAreas] = useState<string[]>(FOCUS_OPTIONS);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const toggleFocus = (area: string) => {
    setFocusAreas((prev) => prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]);
  };

  const handleAnalyze = async () => {
    if (!competitor.trim() || !yourNiche.trim()) {
      addToast("Enter a competitor and your niche", "warning");
      return;
    }
    setLoading(true); setError(null); setResult(null);
    try {
      const data = await apiFetch<Result>("/api/competitor-analysis", {
        method: "POST",
        body: JSON.stringify({ competitor, platform, yourNiche, focusAreas }),
        timeout: 60000,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReport = async () => {
    if (!result) return;
    const report = [
      `# Competitor Analysis: ${competitor} on ${platform}`,
      ``,
      `## Content Strategy`,
      result.contentStrategy,
      ``,
      `## Strengths`,
      ...result.strengths.map((s) => `- ${s}`),
      ``,
      `## Weaknesses / Opportunities`,
      ...result.weaknesses.map((s) => `- ${s}`),
      ``,
      `## Hashtag Strategy`,
      result.hashtagStrategy,
      ``,
      `## Engagement Tactics`,
      ...result.engagementTactics.map((s) => `- ${s}`),
      ``,
      `## Key Takeaways`,
      ...result.keyTakeaways.map((s, i) => `${i + 1}. ${s}`),
      ``,
      `## Content Ideas Inspired by Their Strategy`,
      ...result.contentIdeas.map((c, i) => `${i + 1}. ${c.title} — ${c.why}`),
    ].join("\n");

    try {
      await apiFetch("/api/saved", {
        method: "POST",
        body: JSON.stringify({ type: "competitor_report", content: report, platform, topic: competitor }),
      });
      addToast("Report saved!", "success");
    } catch {
      addToast("Failed to save", "error");
    }
  };

  return (
    <FeatureGate
      feature="competitor-analysis"
      featureLabel="Competitor Analysis"
      featureIcon="🔍"
      featureTagline="Study what's working for the creators you're up against — ethically."
      valueProps={[
        "6-section strategic breakdown: content, strengths, gaps, hashtags, engagement, takeaways",
        "5 specific content ideas inspired by (not copying) their approach",
        "Identifies their blind spots — your opportunities",
        "Premium AI on this feature — strategic quality matters",
      ]}
    >
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Competitor Analysis</h1>
        <p className="text-zinc-500 mt-1">Study what&apos;s working for others in your space — ethically.</p>
      </div>

      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Competitor handle or name *</label>
          <input
            value={competitor}
            onChange={(e) => setCompetitor(e.target.value)}
            placeholder="e.g., @aliabdaal or 'Morning Brew'"
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Platform</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  platform === p.id
                    ? "bg-brand-600/20 text-brand-300 border border-brand-500/30"
                    : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"
                }`}
              >
                <p.icon className="w-4 h-4" style={{ color: p.color }} />
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Your niche *</label>
          <select
            value={yourNiche}
            onChange={(e) => setYourNiche(e.target.value)}
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40"
          >
            <option value="">Select a niche…</option>
            {NICHES.map((n) => <option key={n.id} value={n.label}>{n.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">What to analyze</label>
          <div className="flex flex-wrap gap-2">
            {FOCUS_OPTIONS.map((f) => (
              <button
                key={f}
                onClick={() => toggleFocus(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  focusAreas.includes(f)
                    ? "bg-brand-600/20 text-brand-300 border border-brand-500/30"
                    : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={handleAnalyze} loading={loading} size="lg" className="w-full sm:w-auto">
          {loading ? "Analyzing..." : "🔍 Analyze Competitor"}
        </Button>
      </div>

      {loading && <GenerationLoader messages={LOADING_MESSAGES} />}
      {error && !loading && <InlineError message={error} onRetry={handleAnalyze} />}

      {result && !loading && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-200">Analysis: {competitor}</h2>
            <div className="flex items-center gap-3">
              <EngineBadge />
              <Button variant="secondary" size="sm" onClick={handleSaveReport}>💾 Save Report</Button>
            </div>
          </div>

          <Section title="📋 Content Strategy">
            <p className="text-sm text-zinc-300 leading-relaxed">{result.contentStrategy}</p>
          </Section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Section title="✅ Strengths" color="emerald">
              <ul className="space-y-2">
                {result.strengths.map((s, i) => <li key={i} className="text-sm text-zinc-300 flex gap-2"><span className="text-emerald-400">▸</span>{s}</li>)}
              </ul>
            </Section>
            <Section title="⚠️ Weaknesses / Your opportunities" color="amber">
              <ul className="space-y-2">
                {result.weaknesses.map((s, i) => <li key={i} className="text-sm text-zinc-300 flex gap-2"><span className="text-amber-400">▸</span>{s}</li>)}
              </ul>
            </Section>
          </div>

          <Section title="🏷️ Hashtag Strategy">
            <p className="text-sm text-zinc-300 leading-relaxed">{result.hashtagStrategy}</p>
          </Section>

          <Section title="💬 Engagement Tactics">
            <ul className="space-y-2">
              {result.engagementTactics.map((s, i) => <li key={i} className="text-sm text-zinc-300 flex gap-2"><span className="text-brand-400">▸</span>{s}</li>)}
            </ul>
          </Section>

          <Section title="🎯 Key Takeaways" highlighted>
            <ol className="space-y-2">
              {result.keyTakeaways.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm text-zinc-200">
                  <span className="w-6 h-6 rounded-full bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-xs font-bold text-brand-300 flex-shrink-0">{i + 1}</span>
                  <span className="flex-1">{s}</span>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="💡 Content ideas inspired by (not copied from) their strategy">
            <div className="space-y-3">
              {result.contentIdeas.map((idea, i) => (
                <div key={i} className="rounded-lg bg-surface-tertiary p-3 border border-brand-500/5">
                  <p className="text-sm font-medium text-zinc-200">{idea.title}</p>
                  <p className="text-xs text-zinc-500 mt-1">{idea.why}</p>
                  <CopyButton text={idea.title} className="mt-2" />
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {!result && !loading && !error && (
        <div className="text-center py-12 text-zinc-500">
          <span className="text-4xl block mb-4">🔍</span>
          <p>Enter a competitor above to get a strategic breakdown.</p>
        </div>
      )}
    </div>
    </FeatureGate>
  );
}

function Section({ title, children, color = "brand", highlighted = false }: { title: string; children: React.ReactNode; color?: "brand" | "emerald" | "amber"; highlighted?: boolean }) {
  const borderColor = color === "emerald" ? "border-emerald-500/20" : color === "amber" ? "border-amber-500/20" : "border-brand-500/10";
  return (
    <div className={`rounded-xl border ${borderColor} ${highlighted ? "bg-brand-900/10" : "bg-surface-secondary"} p-5`}>
      <h3 className="text-sm font-semibold text-zinc-200 mb-3">{title}</h3>
      {children}
    </div>
  );
}
