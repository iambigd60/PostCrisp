"use client";
import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { EngineBadge } from "@/components/ui/EngineBadge";
import { FeatureGate } from "@/components/ui/FeatureGate";
import { GenerationLoader } from "@/components/ui/GenerationLoader";
import { InlineError } from "@/components/ui/ErrorBoundary";
import { useToast } from "@/components/ui/Toast";

interface PitchResult {
  formal: { subject: string; body: string };
  casual: { subject: string; body: string };
  followUp: string;
}

const PROPOSAL_TYPES = [
  "Sponsored Post",
  "Brand Ambassador",
  "Product Review",
  "Giveaway Collaboration",
  "Affiliate Partnership",
  "Event Coverage",
];

const LOADING_MESSAGES = [
  "Researching the brand...",
  "Crafting your pitch...",
  "Writing a follow-up...",
  "Polishing the tone...",
];

export default function BrandPitchPage() {
  const [brandName, setBrandName] = useState("");
  const [brandIndustry, setBrandIndustry] = useState("");
  const [yourNiche, setYourNiche] = useState("");
  const [audience, setAudience] = useState("");
  const [followerCount, setFollowerCount] = useState("");
  const [engagementRate, setEngagementRate] = useState("");
  const [proposalType, setProposalType] = useState("Sponsored Post");
  const [uniqueValue, setUniqueValue] = useState("");
  const [budgetExpectation, setBudgetExpectation] = useState("");
  const [result, setResult] = useState<PitchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const handleGenerate = async () => {
    if (!brandName.trim() || !brandIndustry.trim() || !yourNiche.trim()) {
      addToast("Fill in the brand name, industry, and your niche", "warning");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiFetch<PitchResult>("/api/brand-pitch", {
        method: "POST",
        body: JSON.stringify({
          brandName, brandIndustry, yourNiche, audience, followerCount,
          engagementRate, proposalType, uniqueValue, budgetExpectation,
        }),
      });
      setResult(data);
      addToast("Pitch generated!", "success");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to generate pitch";
      setError(msg);
      addToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (label: string, content: string) => {
    try {
      await apiFetch("/api/saved", {
        method: "POST",
        body: JSON.stringify({ type: "brand_pitch", content, platform: "email", topic: `${label} — ${brandName}` }),
      });
      addToast(`${label} saved!`, "success");
    } catch {
      addToast("Failed to save", "error");
    }
  };

  const fullText = (p: { subject: string; body: string }) => `Subject: ${p.subject}\n\n${p.body}`;

  return (
    <FeatureGate
      feature="brand-pitch"
      featureLabel="Brand Pitch Generator"
      featureIcon="📧"
      featureTagline="Personalized pitches to brands that actually get replies."
      valueProps={[
        "Two pitch variants per brand: formal email + casual DM",
        "Follow-up template for when the brand doesn't reply",
        "Specific content ideas referencing the brand's actual products",
        "Premium AI (Opus-class) on this feature — it's where quality pays",
      ]}
    >
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Brand Pitch Generator</h1>
        <p className="text-zinc-500 mt-1">Craft personalized outreach pitches that actually get replies.</p>
      </div>

      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Brand name *</label>
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="e.g., Gymshark"
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Brand industry *</label>
            <input
              value={brandIndustry}
              onChange={(e) => setBrandIndustry(e.target.value)}
              placeholder="e.g., fitness apparel"
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Your niche *</label>
          <input
            value={yourNiche}
            onChange={(e) => setYourNiche(e.target.value)}
            placeholder="e.g., home workouts for busy parents"
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Your audience <span className="text-zinc-600">(optional)</span></label>
          <input
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="e.g., 25-40 year old women in North America"
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Follower count <span className="text-zinc-600">(optional)</span></label>
            <input
              value={followerCount}
              onChange={(e) => setFollowerCount(e.target.value)}
              placeholder="e.g., 45K on Instagram"
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Avg. engagement rate <span className="text-zinc-600">(optional)</span></label>
            <input
              value={engagementRate}
              onChange={(e) => setEngagementRate(e.target.value)}
              placeholder="e.g., 4.2%"
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">What are you proposing?</label>
          <div className="flex flex-wrap gap-2">
            {PROPOSAL_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setProposalType(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  proposalType === t
                    ? "bg-brand-600/20 text-brand-300 border border-brand-500/30"
                    : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">What makes you different <span className="text-zinc-600">(optional)</span></label>
          <textarea
            rows={2}
            value={uniqueValue}
            onChange={(e) => setUniqueValue(e.target.value)}
            placeholder="e.g., My content gets 3x the average comment rate in this niche because..."
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Budget expectation <span className="text-zinc-600">(optional)</span></label>
          <input
            value={budgetExpectation}
            onChange={(e) => setBudgetExpectation(e.target.value)}
            placeholder="e.g., $500-1,500 per sponsored post, or 'open to discussion'"
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40"
          />
        </div>

        <Button onClick={handleGenerate} loading={loading} size="lg" className="w-full sm:w-auto">
          {loading ? "Generating..." : "📧 Generate Pitch"}
        </Button>
      </div>

      {loading && <GenerationLoader messages={LOADING_MESSAGES} />}
      {error && !loading && <InlineError message={error} onRetry={handleGenerate} />}

      {result && !loading && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex justify-end">
            <EngineBadge />
          </div>

          {/* Formal pitch */}
          <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-semibold text-zinc-100">Formal pitch</h3>
                <p className="text-xs text-zinc-500">Email-style. Best for corporate brands.</p>
              </div>
              <span className="text-xs text-brand-400 bg-brand-500/10 px-2 py-1 rounded-full">👔 Professional</span>
            </div>
            <div className="rounded-lg bg-surface-tertiary p-4 space-y-2 mb-4">
              <p className="text-xs text-zinc-500">Subject</p>
              <p className="text-sm font-medium text-zinc-200">{result.formal.subject}</p>
              <p className="text-xs text-zinc-500 pt-2">Body</p>
              <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{result.formal.body}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={fullText(result.formal)} label="Copy Email" />
              <Button variant="secondary" size="sm" onClick={() => handleSave("Formal pitch", fullText(result.formal))}>💾 Save</Button>
            </div>
          </div>

          {/* Casual pitch */}
          <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-semibold text-zinc-100">Casual pitch</h3>
                <p className="text-xs text-zinc-500">Conversational. Best for DTC brands and startups.</p>
              </div>
              <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">😎 Conversational</span>
            </div>
            <div className="rounded-lg bg-surface-tertiary p-4 space-y-2 mb-4">
              <p className="text-xs text-zinc-500">Subject / opener</p>
              <p className="text-sm font-medium text-zinc-200">{result.casual.subject}</p>
              <p className="text-xs text-zinc-500 pt-2">Body</p>
              <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{result.casual.body}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={fullText(result.casual)} label="Copy Message" />
              <Button variant="secondary" size="sm" onClick={() => handleSave("Casual pitch", fullText(result.casual))}>💾 Save</Button>
            </div>
          </div>

          {/* Follow-up */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">⏰</span>
              <h3 className="text-base font-semibold text-zinc-100">Follow-up</h3>
              <span className="text-xs text-amber-300">Send 5-7 days later if no reply</span>
            </div>
            <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed mb-4">{result.followUp}</p>
            <CopyButton text={result.followUp} label="Copy Follow-up" />
          </div>
        </div>
      )}

      {!result && !loading && !error && (
        <div className="text-center py-12 text-zinc-500">
          <span className="text-4xl block mb-4">📧</span>
          <p>Fill in the details above to generate a pitch tailored to the brand.</p>
        </div>
      )}
    </div>
    </FeatureGate>
  );
}
