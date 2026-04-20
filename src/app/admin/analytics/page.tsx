"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { TIER_LABELS, type Tier } from "@/lib/crisp-engine-config";

interface AnalyticsResponse {
  window: { days: number; start: string; end: string };
  kpi: {
    totalUsers: number;
    paidUsers: number;
    newSignups30d: number;
    mrrEstimate: number;
    dau: number;
    mau: number;
    totalGenerations30d: number;
    totalTokens30d: number;
    creditsConsumed30d: number;
    tierCounts: Record<Tier, number>;
  };
  daily: { date: string; count: number; tokens: number }[];
  featureBreakdown: { feature: string; count: number; tokens: number }[];
  topUsers: { user_id: string; email: string; full_name: string | null; tier: Tier; count: number; tokens: number }[];
}

const FEATURE_LABEL: Record<string, { icon: string; label: string }> = {
  captions:            { icon: "✍️", label: "Captions" },
  hashtags:            { icon: "🏷️", label: "Hashtags" },
  bio:                 { icon: "👤", label: "Bio Generator" },
  repurpose:           { icon: "🔁", label: "Repurpose" },
  blog_to_social:      { icon: "📝", label: "Blog → Social" },
  viral_ideas:         { icon: "🔥", label: "Viral Ideas" },
  trend_radar:         { icon: "📡", label: "Trend Radar" },
  trending_sounds:     { icon: "🎵", label: "Trending Sounds" },
  seo:                 { icon: "🔍", label: "SEO" },
  channel_analysis:    { icon: "📊", label: "Channel Analysis" },
  best_times:          { icon: "⏰", label: "Best Times" },
  content_calendar:    { icon: "📅", label: "Content Calendar" },
  brand_pitch:         { icon: "💼", label: "Brand Pitch" },
  thumbnail_ideas:     { icon: "🖼️", label: "Thumbnails" },
  comment_reply:       { icon: "💬", label: "Comment Reply" },
  polls:               { icon: "📊", label: "Polls" },
  stories:             { icon: "📸", label: "Stories" },
  voice_match:         { icon: "🎙️", label: "Voice Match" },
  hook_lab:            { icon: "🪝", label: "Hook Lab" },
  title_split_test:    { icon: "🧪", label: "Title Split Test" },
};

const tierColor: Record<Tier, string> = {
  starter: "text-zinc-400",
  creator: "text-brand-300",
  team:    "text-sky-300",
  elite:   "text-amber-300",
};

function KpiTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="text-2xl font-bold text-zinc-100 mt-1">{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-1">{sub}</div>}
    </div>
  );
}

function DailyBarChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div>
      <div className="flex items-end gap-1 h-36">
        {data.map((d) => {
          const pct = max > 0 ? (d.count / max) * 100 : 0;
          const barHeight = d.count > 0 ? Math.max(4, pct) : 0;
          return (
            <div
              key={d.date}
              className="flex-1 h-full flex items-end group relative"
              title={`${d.date}: ${d.count} gens`}
            >
              <div
                className="w-full bg-gradient-to-t from-brand-600 to-brand-400 rounded-t transition-all group-hover:from-brand-500 group-hover:to-brand-300"
                style={{ height: `${barHeight}%` }}
              />
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block px-2 py-1 text-[10px] bg-surface-elevated border border-brand-500/20 rounded text-zinc-200 whitespace-nowrap z-10 pointer-events-none">
                {d.date}: {d.count.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 mt-1.5">
        {data.map((d) => {
          const day = new Date(d.date).getUTCDate();
          const showLabel = day === 1 || day % 7 === 0;
          return (
            <div key={d.date} className="flex-1 text-[10px] text-center text-zinc-600">
              {showLabel ? day : ""}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-600">
        <span>Peak: {max.toLocaleString()} gens</span>
        <span>Total: {data.reduce((a, b) => a + b.count, 0).toLocaleString()}</span>
      </div>
    </div>
  );
}

function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await apiFetch<AnalyticsResponse>("/api/admin/analytics");
        setData(res);
      } catch (err) {
        addToast(err instanceof ApiError ? err.message : "Failed to load analytics", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Analytics</h1>
          <p className="text-zinc-500 mt-1">Loading…</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-surface-secondary border border-brand-500/10 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { kpi, daily, featureBreakdown, topUsers } = data;
  const maxFeatureTokens = Math.max(1, ...featureBreakdown.map((f) => f.tokens));
  const maxUserTokens = Math.max(1, ...topUsers.map((u) => u.tokens));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Analytics</h1>
        <p className="text-zinc-500 mt-1">Last {data.window.days} days</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiTile label="DAU" value={kpi.dau.toLocaleString()} sub="unique users today" />
        <KpiTile label="MAU" value={kpi.mau.toLocaleString()} sub="unique users 30d" />
        <KpiTile label="New signups" value={kpi.newSignups30d.toLocaleString()} sub="last 30d" />
        <KpiTile label="Paid users" value={kpi.paidUsers.toLocaleString()} sub={`of ${kpi.totalUsers.toLocaleString()} total`} />
        <KpiTile label="Est. MRR" value={`$${kpi.mrrEstimate.toLocaleString()}`} sub="tier counts × list price" />
        <KpiTile label="Generations" value={compactNumber(kpi.totalGenerations30d)} sub="last 30d" />
        <KpiTile label="Tokens" value={compactNumber(kpi.totalTokens30d)} sub="last 30d" />
        <KpiTile label="Credits used" value={compactNumber(kpi.creditsConsumed30d)} sub="last 30d" />
      </div>

      {/* Tier distribution */}
      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-4">
        <h2 className="text-sm font-semibold text-zinc-200 mb-3">Tier distribution</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.keys(kpi.tierCounts) as Tier[]).map((t) => (
            <div key={t} className="flex items-baseline justify-between px-3 py-2 rounded-lg bg-surface-tertiary">
              <span className={`text-xs uppercase tracking-wider font-semibold ${tierColor[t]}`}>{TIER_LABELS[t]}</span>
              <span className="text-lg font-bold text-zinc-100">{kpi.tierCounts[t].toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Daily chart + feature breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4">Generations per day</h2>
          <DailyBarChart data={daily} />
        </div>

        <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4">Feature breakdown</h2>
          {featureBreakdown.length === 0 ? (
            <p className="text-sm text-zinc-500">No generations yet in this window.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {featureBreakdown.map((f) => {
                const meta = FEATURE_LABEL[f.feature] ?? { icon: "✨", label: f.feature };
                const pct = (f.tokens / maxFeatureTokens) * 100;
                return (
                  <div key={f.feature} className="group">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-zinc-300">
                        <span className="mr-1.5">{meta.icon}</span>
                        {meta.label}
                      </span>
                      <span className="text-zinc-500 font-mono">
                        {f.count.toLocaleString()} gens · {compactNumber(f.tokens)} tk
                      </span>
                    </div>
                    <div className="h-2 bg-surface-tertiary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand-600 to-brand-400 group-hover:from-brand-500 group-hover:to-brand-300 transition-all"
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top users by tokens */}
      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary overflow-hidden">
        <div className="px-5 py-4 border-b border-brand-500/10">
          <h2 className="text-sm font-semibold text-zinc-200">Top users by token consumption</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Last {data.window.days} days — spot your power users and cost drivers</p>
        </div>
        {topUsers.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-zinc-500">No usage yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-tertiary">
              <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">User</th>
                <th className="px-4 py-2.5 font-medium">Tier</th>
                <th className="px-4 py-2.5 font-medium text-right">Gens</th>
                <th className="px-4 py-2.5 font-medium">Tokens</th>
                <th className="px-4 py-2.5 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-500/5">
              {topUsers.map((u, i) => {
                const pct = (u.tokens / maxUserTokens) * 100;
                return (
                  <tr key={u.user_id} className="hover:bg-surface-tertiary/30 transition-colors">
                    <td className="px-4 py-2.5 text-zinc-500 font-mono text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col">
                        <span className="text-zinc-200 truncate">{u.full_name ?? "—"}</span>
                        <span className="text-xs text-zinc-500 truncate">{u.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-2xs font-bold uppercase tracking-wider ${tierColor[u.tier]}`}>
                        {TIER_LABELS[u.tier]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-zinc-300">{u.count.toLocaleString()}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-surface-tertiary rounded-full overflow-hidden min-w-[60px] max-w-[180px]">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-red-500"
                            style={{ width: `${Math.max(2, pct)}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs text-zinc-400 tabular-nums">{compactNumber(u.tokens)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/admin/users/${u.user_id}`} className="text-xs text-brand-400 hover:text-brand-300 font-medium">
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
