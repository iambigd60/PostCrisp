import Link from "next/link";

export default function AdminOverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Admin</h1>
        <p className="text-zinc-500 mt-1">Internal controls for running PostCrisp.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/admin/ai-config"
          className="p-5 rounded-xl border border-amber-500/20 bg-surface-secondary hover:border-amber-500/40 hover:bg-surface-elevated transition-all group"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚙️</span>
            <div className="flex-1">
              <h3 className="font-semibold text-zinc-100 group-hover:text-amber-200 transition-colors">AI Engine Config</h3>
              <p className="text-sm text-zinc-500 mt-1">
                Route each feature × tier to a provider + model. Swap Anthropic ↔ OpenAI, change tiers, roll back bad models.
              </p>
            </div>
            <span className="text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
          </div>
        </Link>

        <Link
          href="/admin/feature-access"
          className="p-5 rounded-xl border border-amber-500/20 bg-surface-secondary hover:border-amber-500/40 hover:bg-surface-elevated transition-all group"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔐</span>
            <div className="flex-1">
              <h3 className="font-semibold text-zinc-100 group-hover:text-amber-200 transition-colors">Feature Access</h3>
              <p className="text-sm text-zinc-500 mt-1">
                Control which tier unlocks each feature. Move Brand Pitch to Elite-only, disable experimental tools, adjust as you grow.
              </p>
            </div>
            <span className="text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
          </div>
        </Link>

        <div className="p-5 rounded-xl border border-brand-500/10 bg-surface-secondary/50 opacity-60 cursor-not-allowed">
          <div className="flex items-start gap-3">
            <span className="text-2xl opacity-50">👥</span>
            <div className="flex-1">
              <h3 className="font-semibold text-zinc-400">User Management</h3>
              <p className="text-sm text-zinc-600 mt-1">List users, grant tiers, flag/ban. <span className="text-zinc-700">Post-launch Phase 2.</span></p>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-brand-500/10 bg-surface-secondary/50 opacity-60 cursor-not-allowed">
          <div className="flex items-start gap-3">
            <span className="text-2xl opacity-50">💳</span>
            <div className="flex-1">
              <h3 className="font-semibold text-zinc-400">Billing Admin</h3>
              <p className="text-sm text-zinc-600 mt-1">Stripe overview, refunds, coupons. <span className="text-zinc-700">Post-launch Phase 2.</span></p>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-brand-500/10 bg-surface-secondary/50 opacity-60 cursor-not-allowed">
          <div className="flex items-start gap-3">
            <span className="text-2xl opacity-50">📈</span>
            <div className="flex-1">
              <h3 className="font-semibold text-zinc-400">Analytics</h3>
              <p className="text-sm text-zinc-600 mt-1">DAU, conversion, token cost by feature. <span className="text-zinc-700">Post-launch Phase 2.</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
