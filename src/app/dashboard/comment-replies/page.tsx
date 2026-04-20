"use client";
import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { EngineBadge } from "@/components/ui/EngineBadge";
import { GenerationLoader } from "@/components/ui/GenerationLoader";
import { InlineError } from "@/components/ui/ErrorBoundary";
import { useToast } from "@/components/ui/Toast";

const TONES = ["Friendly", "Professional", "Funny", "Grateful", "Educational"];
const GOALS = ["Build Relationship", "Drive Engagement", "Answer Question", "Redirect to DM", "Promote Content"];

export default function CommentRepliesPage() {
  const [comment, setComment] = useState("");
  const [postContext, setPostContext] = useState("");
  const [replyTone, setReplyTone] = useState("Friendly");
  const [replyGoal, setReplyGoal] = useState("Build Relationship");
  const [replies, setReplies] = useState<{ short: string; medium: string; detailed: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const handleGenerate = async () => {
    if (!comment.trim()) { addToast("Paste the comment to reply to", "warning"); return; }
    setLoading(true); setError(null); setReplies(null);
    try {
      const data = await apiFetch<typeof replies>("/api/comment-reply", {
        method: "POST",
        body: JSON.stringify({ comment, postContext, replyTone, replyGoal }),
      });
      setReplies(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Comment Reply Generator</h1>
        <p className="text-zinc-500 mt-1">Engage every comment with replies that actually sound like you.</p>
      </div>

      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Incoming comment *</label>
          <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="Paste what the commenter wrote..."
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40 resize-none" />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">What was your post about? <span className="text-zinc-600">(optional)</span></label>
          <input value={postContext} onChange={(e) => setPostContext(e.target.value)}
            placeholder="Brief context about the post"
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Tone</label>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button key={t} onClick={() => setReplyTone(t)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${replyTone === t ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Goal</label>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <button key={g} onClick={() => setReplyGoal(g)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${replyGoal === g ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>{g}</button>
              ))}
            </div>
          </div>
        </div>

        <Button onClick={handleGenerate} loading={loading} size="lg" className="w-full sm:w-auto">
          {loading ? "Writing..." : "💬 Generate Replies"}
        </Button>
      </div>

      {loading && <GenerationLoader messages={["Thinking of the right angle...", "Keeping it authentic...", "Adding a hook to drive engagement..."]} />}
      {error && !loading && <InlineError message={error} onRetry={handleGenerate} />}

      {replies && !loading && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-200">3 reply options</h2>
            <EngineBadge />
          </div>
          {[
            { label: "Short", icon: "⚡", text: replies.short, tone: "text-sky-300" },
            { label: "Medium", icon: "💬", text: replies.medium, tone: "text-brand-300" },
            { label: "Detailed", icon: "📝", text: replies.detailed, tone: "text-amber-300" },
          ].map((r) => (
            <div key={r.label} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold ${r.tone}`}>{r.icon} {r.label}</span>
                <CopyButton text={r.text} />
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed">{r.text}</p>
            </div>
          ))}

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200/80">
            💡 <strong>Why this matters:</strong> Replying to comments within the first hour signals to the algorithm that your content is driving conversation — boosting reach on the original post.
          </div>
        </div>
      )}

      {!replies && !loading && !error && (
        <div className="text-center py-12 text-zinc-500">
          <span className="text-4xl block mb-4">💬</span>
          <p>Paste an incoming comment to get three reply options.</p>
        </div>
      )}
    </div>
  );
}
