"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { InlineError } from "@/components/ui/ErrorBoundary";
import { useToast } from "@/components/ui/Toast";

interface GenerationRow {
  id: string;
  feature: string;
  platform: string | null;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  tokens_used: number;
  created_at: string;
}

const FEATURE_META: Record<string, { icon: string; label: string; backHref: string }> = {
  captions:           { icon: '✍️', label: 'Captions',            backHref: '/dashboard/generate' },
  hashtags:           { icon: '🏷️', label: 'Hashtags',            backHref: '/dashboard/hashtags' },
  posting_times:      { icon: '⏰', label: 'Posting Times',        backHref: '/dashboard/best-times' },
  viral_ideas:        { icon: '🚀', label: 'Viral Ideas',          backHref: '/dashboard/viral-ideas' },
  script:             { icon: '🎬', label: 'Script',               backHref: '/dashboard/scripts' },
  repurpose:          { icon: '♻️', label: 'Repurpose',            backHref: '/dashboard/repurpose' },
  blog_to_social:     { icon: '📰', label: 'Blog → Social',        backHref: '/dashboard/blog-to-social' },
  polls:              { icon: '📊', label: 'Polls',                backHref: '/dashboard/polls' },
  dm_template:        { icon: '✉️', label: 'DM Template',          backHref: '/dashboard/dm-templates' },
  comment_reply:      { icon: '💬', label: 'Comment Replies',      backHref: '/dashboard/comment-replies' },
  youtube_seo:        { icon: '📺', label: 'YouTube SEO',          backHref: '/dashboard/youtube-seo' },
  bio_optimizer:      { icon: '🧬', label: 'Bio Optimizer',        backHref: '/dashboard/bio-optimizer' },
  platform_tips:      { icon: '💡', label: 'Platform Tips',        backHref: '/dashboard/platform-tips' },
  channel_analysis:   { icon: '🪞', label: 'Channel Analysis',     backHref: '/dashboard/channel-analysis' },
  trend_radar:        { icon: '📡', label: 'Trend Radar',          backHref: '/dashboard/trends' },
  sound_tracker:      { icon: '🎵', label: 'Sound Tracker',        backHref: '/dashboard/sounds' },
  collab_finder:      { icon: '🤝', label: 'Collab Finder',        backHref: '/dashboard/collab-finder' },
  brand_pitch:        { icon: '📧', label: 'Brand Pitch',          backHref: '/dashboard/brand-pitch' },
  rate_calculator:    { icon: '💵', label: 'Rate Calculator',      backHref: '/dashboard/rate-calculator' },
  competitor_analysis:{ icon: '🔍', label: 'Competitor Analysis',  backHref: '/dashboard/competitor-analysis' },
};

// Generic recursive renderer: turns any JSON-ish structure into a readable block.
function renderValue(value: unknown, depth = 0): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-zinc-600">—</span>;
  if (typeof value === 'string') return <span className="whitespace-pre-wrap text-zinc-300">{value}</span>;
  if (typeof value === 'number' || typeof value === 'boolean') return <span className="font-mono text-brand-300">{String(value)}</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-zinc-600">[]</span>;
    if (value.every((v) => typeof v === 'string')) {
      return (
        <ul className="space-y-1">
          {value.map((v, i) => <li key={i} className="flex gap-2 text-sm text-zinc-300"><span className="text-brand-400 flex-shrink-0">▸</span><span>{v as string}</span></li>)}
        </ul>
      );
    }
    return (
      <div className={`space-y-2 ${depth > 0 ? 'pl-3 border-l border-brand-500/10' : ''}`}>
        {value.map((v, i) => (
          <div key={i} className="rounded-lg bg-surface-tertiary/40 p-3">
            <div className="text-2xs text-zinc-600 uppercase tracking-wider mb-2">#{i + 1}</div>
            {renderValue(v, depth + 1)}
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <div className={`space-y-2 ${depth > 0 ? 'pl-3 border-l border-brand-500/10' : ''}`}>
        {entries.map(([k, v]) => (
          <div key={k}>
            <div className="text-2xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">{formatKey(k)}</div>
            {renderValue(v, depth + 1)}
          </div>
        ))}
      </div>
    );
  }
  return <span>{String(value)}</span>;
}

function formatKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function GenerationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [gen, setGen] = useState<GenerationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('generations')
        .select('id, feature, platform, input_data, output_data, tokens_used, created_at')
        .eq('id', id)
        .maybeSingle();
      if (error) setError(error.message);
      else if (!data) setError('Generation not found.');
      else setGen(data as GenerationRow);
      setLoading(false);
    })();
  }, [id]);

  const meta = gen ? (FEATURE_META[gen.feature] ?? { icon: '✨', label: gen.feature, backHref: '/dashboard' }) : null;

  const fullTextForCopy = gen?.output_data ? JSON.stringify(gen.output_data, null, 2) : '';

  const handleSaveToLibrary = async () => {
    if (!gen) return;
    setSaving(true);
    try {
      await apiFetch('/api/saved', {
        method: 'POST',
        body: JSON.stringify({
          type: gen.feature,
          content: JSON.stringify(gen.output_data, null, 2),
          platform: gen.platform ?? 'general',
          topic: meta?.label ?? gen.feature,
        }),
      });
      addToast('Saved to library', 'success');
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!gen) return;
    if (!confirm('Delete this generation? This cannot be undone.')) return;
    setDeleting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('generations').delete().eq('id', gen.id);
      if (error) throw error;
      addToast('Deleted', 'success');
      router.push('/dashboard');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="space-y-4"><div className="h-8 w-64 bg-surface-secondary rounded animate-pulse" /><div className="h-48 bg-surface-secondary rounded-xl animate-pulse" /></div>;
  }

  if (error || !gen || !meta) {
    return <InlineError message={error ?? 'Generation not found'} onRetry={() => router.push('/dashboard')} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          ← Back to dashboard
        </Link>
      </div>

      {/* Header */}
      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-700/20 border border-brand-500/20 flex items-center justify-center text-2xl">
            {meta.icon}
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-zinc-100">{meta.label}</h1>
            <p className="text-xs text-zinc-500">
              {gen.platform ? `${gen.platform} · ` : ''}{timeAgo(gen.created_at)} · {gen.tokens_used.toLocaleString()} tokens
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            href={meta.backHref}
            className="px-3 py-1.5 rounded-lg border border-brand-500/20 text-brand-300 hover:bg-brand-500/10 text-sm font-medium transition-colors"
          >
            Run again
          </Link>
          <Button variant="secondary" size="sm" onClick={handleSaveToLibrary} loading={saving}>💾 Save to library</Button>
          <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>🗑️ Delete</Button>
        </div>
      </div>

      {/* Output */}
      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-zinc-200">Output</h2>
          <CopyButton text={fullTextForCopy} label="Copy JSON" />
        </div>
        {gen.output_data ? renderValue(gen.output_data) : <p className="text-sm text-zinc-500">No output data.</p>}
      </div>

      {/* Input (collapsible) */}
      {gen.input_data && (
        <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
          <button
            type="button"
            onClick={() => setShowInput(!showInput)}
            className="w-full flex items-center justify-between text-sm font-semibold text-zinc-200 hover:text-zinc-100"
          >
            <span>📥 Input used for this generation</span>
            <span className="text-zinc-500">{showInput ? '▾' : '▸'}</span>
          </button>
          {showInput && (
            <div className="mt-4 pt-4 border-t border-brand-500/10">
              {renderValue(gen.input_data)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
