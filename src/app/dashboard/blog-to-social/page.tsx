"use client";
import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { EngineBadge } from "@/components/ui/EngineBadge";
import { GenerationLoader } from "@/components/ui/GenerationLoader";
import { InlineError } from "@/components/ui/ErrorBoundary";
import { useToast } from "@/components/ui/Toast";

interface Post { platform: string; type: string; sourceSection: string; content: string; hashtags?: string[] }

const TARGET_OPTIONS = ["Instagram", "X", "LinkedIn", "TikTok", "Facebook", "Threads"];
const FOCUS_OPTIONS = ["Key Takeaways", "Quotes", "Statistics", "Tips", "Story Moments"];

const typeColor: Record<string, string> = {
  quote:     "bg-brand-500/10 text-brand-300 border-brand-500/20",
  stat:      "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  tip:       "bg-amber-500/10 text-amber-300 border-amber-500/20",
  takeaway:  "bg-sky-500/10 text-sky-300 border-sky-500/20",
  story:     "bg-pink-500/10 text-pink-300 border-pink-500/20",
};

const LOADING_MESSAGES = ["Scanning the blog...", "Finding shareable moments...", "Rewriting for each platform...", "Adding hashtags..."];

export default function BlogToSocialPage() {
  const [blog, setBlog] = useState("");
  const [count, setCount] = useState(5);
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>(["Instagram", "X", "LinkedIn"]);
  const [focus, setFocus] = useState<string[]>(FOCUS_OPTIONS);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const togglePlatform = (p: string) => setTargetPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  const toggleFocus = (f: string) => setFocus((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);

  const handleConvert = async () => {
    if (!blog.trim()) { addToast("Paste blog content", "warning"); return; }
    setLoading(true); setError(null); setPosts([]);
    try {
      const data = await apiFetch<{ posts: Post[] }>("/api/blog-to-social", {
        method: "POST",
        body: JSON.stringify({ blog, count, targetPlatforms, focus }),
      });
      setPosts(data.posts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    } finally { setLoading(false); }
  };

  const handleSave = async (post: Post) => {
    const content = post.hashtags ? `${post.content}\n\n${post.hashtags.join(" ")}` : post.content;
    try {
      await apiFetch("/api/saved", { method: "POST", body: JSON.stringify({ type: "caption", content, platform: post.platform.toLowerCase(), topic: "Blog extract" }) });
      addToast("Saved!", "success");
    } catch { addToast("Failed to save", "error"); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Blog → Social</h1>
        <p className="text-zinc-500 mt-1">Extract standalone social posts from any long-form article.</p>
      </div>

      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Blog content *</label>
          <textarea rows={8} value={blog} onChange={(e) => setBlog(e.target.value)}
            placeholder="Paste blog article, newsletter, or long-form post..."
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40 resize-y" />
          <p className="text-xs text-zinc-600 mt-1">{blog.length.toLocaleString()} characters</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-zinc-300">Number of posts to extract</label>
            <span className="text-sm font-mono text-brand-300">{count}</span>
          </div>
          <input type="range" min={3} max={10} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full accent-brand-500" />
          <div className="flex justify-between text-2xs text-zinc-600 mt-1"><span>3</span><span>10</span></div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Target platforms</label>
          <div className="flex flex-wrap gap-2">
            {TARGET_OPTIONS.map((p) => (
              <button key={p} onClick={() => togglePlatform(p)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${targetPlatforms.includes(p) ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>{p}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Focus on</label>
          <div className="flex flex-wrap gap-2">
            {FOCUS_OPTIONS.map((f) => (
              <button key={f} onClick={() => toggleFocus(f)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${focus.includes(f) ? "bg-brand-600/20 text-brand-300 border border-brand-500/30" : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover"}`}>{f}</button>
            ))}
          </div>
        </div>

        <Button onClick={handleConvert} loading={loading} size="lg" className="w-full sm:w-auto">
          {loading ? "Extracting..." : "📰 Convert to Social"}
        </Button>
      </div>

      {loading && <GenerationLoader messages={LOADING_MESSAGES} />}
      {error && !loading && <InlineError message={error} onRetry={handleConvert} />}

      {posts.length > 0 && !loading && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-200">{posts.length} posts extracted</h2>
            <EngineBadge />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {posts.map((post, i) => (
              <div key={i} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-zinc-400 bg-surface-tertiary px-2 py-0.5 rounded-full">{post.platform}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${typeColor[post.type] ?? "bg-zinc-500/10 text-zinc-300"}`}>{post.type}</span>
                  <span className="text-xs text-zinc-600 ml-auto truncate max-w-[50%]">from: {post.sourceSection}</span>
                </div>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                {post.hashtags && post.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-brand-500/5">
                    {post.hashtags.map((h) => <span key={h} className="text-xs text-brand-300 bg-brand-500/10 px-2 py-0.5 rounded-full">{h}</span>)}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <CopyButton text={post.hashtags ? `${post.content}\n\n${post.hashtags.join(" ")}` : post.content} />
                  <Button variant="secondary" size="sm" onClick={() => handleSave(post)}>💾 Save</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {posts.length === 0 && !loading && !error && (
        <div className="text-center py-12 text-zinc-500">
          <span className="text-4xl block mb-4">📰</span>
          <p>Paste a blog post above to mine it for social-ready posts.</p>
        </div>
      )}
    </div>
  );
}
