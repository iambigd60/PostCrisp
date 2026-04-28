"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/admin",                  label: "Overview",          icon: "🛡️",  enabled: true },
  { href: "/admin/ai-config",        label: "AI Engine Config",  icon: "⚙️",  enabled: true },
  { href: "/admin/feature-access",      label: "Feature Access",      icon: "🔐",  enabled: true },
  { href: "/admin/credit-adjustments",  label: "Credit Adjustments",  icon: "🪙",  enabled: true },
  { href: "/admin/users",            label: "Users",             icon: "👥",  enabled: true },
  { href: "/admin/billing",          label: "Billing",           icon: "💳",  enabled: false },
  { href: "/admin/analytics",        label: "Analytics",         icon: "📈",  enabled: true },
  { href: "/admin/moderation",       label: "Moderation",        icon: "🚧",  enabled: false },
  { href: "/admin/audit",            label: "Audit Log",         icon: "📋",  enabled: true },
  { href: "/admin/access-control",   label: "Access Control",    icon: "🚪",  enabled: true },
  { href: "/admin/invite-codes",     label: "Invite Codes",      icon: "🎟️",  enabled: true },
  { href: "/admin/feedback",         label: "Feedback",          icon: "💬",  enabled: true },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const navContent = (
    <>
      <div className="flex items-center gap-3 px-4 h-16 border-b border-brand-500/10 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center text-lg shadow-glow">
          🛡️
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold text-zinc-100">PostCrisp</span>
          <span className="text-2xs uppercase tracking-wider text-amber-400">Admin</span>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) =>
          item.enabled ? (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] group ${
                isActive(item.href)
                  ? "bg-amber-500/15 text-amber-200 border border-amber-500/25"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-surface-hover"
              }`}
            >
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ) : (
            <div
              key={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium min-h-[44px] text-zinc-600 cursor-not-allowed"
              title="Coming in Admin Phase 2 (post-launch)"
            >
              <span className="text-lg flex-shrink-0 opacity-40">{item.icon}</span>
              <span className="opacity-50">{item.label}</span>
              <span className="ml-auto text-2xs text-zinc-700">soon</span>
            </div>
          )
        )}
      </nav>

      <div className="mt-auto px-3 py-4 border-t border-brand-500/10">
        <Link
          href="/dashboard"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-surface-hover text-sm transition-colors min-h-[44px]"
        >
          ← Back to app
        </Link>
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 w-11 h-11 flex items-center justify-center rounded-xl bg-surface-secondary border border-amber-500/20 text-amber-300 hover:text-white transition-colors"
        aria-label="Open admin menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-[260px] bg-surface-secondary border-r border-amber-500/10 flex flex-col transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-surface-hover transition-colors"
          aria-label="Close menu"
        >
          ✕
        </button>
        {navContent}
      </aside>

      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col bg-surface-secondary border-r border-amber-500/10 w-[260px]">
        {navContent}
      </aside>
    </>
  );
}
