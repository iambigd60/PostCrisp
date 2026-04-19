"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/demo", label: "Dashboard", icon: "📊" },
  { href: "/demo/captions", label: "Caption Generator", icon: "✍️" },
  { href: "/demo/hashtags", label: "Hashtag Finder", icon: "🏷️" },
  { href: "/demo/best-times", label: "Best Times", icon: "⏰" },
  { href: "/demo/viral-ideas", label: "Viral Ideas", icon: "🚀" },
];

export function DemoSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/demo" ? pathname === "/demo" : pathname.startsWith(href);

  const navContent = (
    <>
      <div className="flex items-center gap-3 px-4 h-16 border-b border-brand-500/10 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-lg shadow-glow">
          ⚡
        </div>
        <span className="text-lg font-bold bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
          PostCrisp
        </span>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] group ${
              isActive(item.href)
                ? "bg-brand-600/20 text-brand-300 border border-brand-500/20 shadow-glow"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-surface-hover"
            }`}
          >
            <span className={`text-lg flex-shrink-0 ${isActive(item.href) ? "" : "group-hover:scale-110 transition-transform"}`}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-auto px-3 py-4 border-t border-brand-500/10">
        <Link
          href="/"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-surface-hover text-sm transition-colors min-h-[44px]"
        >
          ← Back to landing
        </Link>
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 w-11 h-11 flex items-center justify-center rounded-xl bg-surface-secondary border border-brand-500/10 text-zinc-300 hover:text-white transition-colors"
        aria-label="Open menu"
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
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-[260px] bg-surface-secondary border-r border-brand-500/10 flex flex-col transition-transform duration-300 ${
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

      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col bg-surface-secondary border-r border-brand-500/10 w-[260px]">
        {navContent}
      </aside>
    </>
  );
}
