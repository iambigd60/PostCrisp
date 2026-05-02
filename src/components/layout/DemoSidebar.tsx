"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Whether this tool has a working demo page. The 4 originals do; the
   *  rest land on /signup so visitors convert instead of clicking dead
   *  links. */
  interactive?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const DASHBOARD_ITEM: NavItem = { href: "/demo", label: "Dashboard", icon: "📊", interactive: true };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Create",
    items: [
      { href: "/demo/captions",       label: "Captions",        icon: "✍️", interactive: true },
      { href: "/demo/hashtags",       label: "Hashtags",        icon: "🏷️", interactive: true },
      { href: "/signup?from=demo&tool=scripts",         label: "Scripts",          icon: "🎬" },
      { href: "/signup?from=demo&tool=repurpose",       label: "Repurpose",        icon: "♻️" },
      { href: "/signup?from=demo&tool=blog-to-social",  label: "Blog → Social",    icon: "📰" },
      { href: "/signup?from=demo&tool=polls",           label: "Polls",            icon: "📊" },
      { href: "/signup?from=demo&tool=dm-templates",    label: "DM Templates",     icon: "✉️" },
      { href: "/signup?from=demo&tool=comment-replies", label: "Comment Replies",  icon: "💬" },
    ],
  },
  {
    label: "Optimize",
    items: [
      { href: "/demo/best-times",     label: "Best Times",      icon: "⏰", interactive: true },
      { href: "/signup?from=demo&tool=youtube-seo",        label: "YouTube SEO",        icon: "📺" },
      { href: "/signup?from=demo&tool=bio-optimizer",      label: "Bio Optimizer",      icon: "🧬" },
      { href: "/signup?from=demo&tool=platform-tips",      label: "Platform Tips",      icon: "💡" },
      { href: "/signup?from=demo&tool=channel-analysis",   label: "Channel Analysis",   icon: "🪞" },
      { href: "/signup?from=demo&tool=foundation-analysis",label: "Foundation Analysis",icon: "🏛️" },
      { href: "/signup?from=demo&tool=thumbnail-analyzer", label: "Thumbnail Analyzer", icon: "🖼️" },
      { href: "/signup?from=demo&tool=cta-optimizer",      label: "CTA Optimizer",      icon: "🎯" },
    ],
  },
  {
    label: "Grow",
    items: [
      { href: "/demo/viral-ideas",    label: "Viral Ideas",     icon: "🚀", interactive: true },
      { href: "/signup?from=demo&tool=trends",        label: "Trend Radar",   icon: "📡" },
      { href: "/signup?from=demo&tool=sounds",        label: "Sound Tracker", icon: "🎵" },
      { href: "/signup?from=demo&tool=collab-finder", label: "Collab Finder", icon: "🤝" },
    ],
  },
  {
    label: "Monetize",
    items: [
      { href: "/signup?from=demo&tool=brand-pitch",         label: "Brand Pitch",         icon: "📧" },
      { href: "/signup?from=demo&tool=rate-calculator",     label: "Rate Calculator",     icon: "💵" },
      { href: "/signup?from=demo&tool=competitor-analysis", label: "Competitor Analysis", icon: "🔍" },
    ],
  },
];

export function DemoSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/demo" ? pathname === "/demo" : pathname === href;

  const renderItem = (item: NavItem) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={() => setMobileOpen(false)}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all min-h-[40px] group ${
        isActive(item.href)
          ? "bg-brand-600/20 text-brand-300 border border-brand-500/20 shadow-glow"
          : item.interactive
          ? "text-zinc-400 hover:text-zinc-200 hover:bg-surface-hover"
          : "text-zinc-500 hover:text-brand-300 hover:bg-surface-hover"
      }`}
      title={item.interactive ? undefined : "Sign up to try this tool"}
    >
      <span className={`text-lg flex-shrink-0 ${isActive(item.href) ? "" : "group-hover:scale-110 transition-transform"}`}>
        {item.icon}
      </span>
      <span className="flex-1">{item.label}</span>
      {!item.interactive && (
        <span className="text-2xs text-zinc-600 group-hover:text-brand-400 transition-colors">🔒</span>
      )}
    </Link>
  );

  const navContent = (
    <>
      <div className="flex items-center gap-3 px-4 h-16 border-b border-brand-500/10 flex-shrink-0">
        <Link href="/" aria-label="PostCrisp home" className="flex items-center">
          <Image
            src="/postcrisp-logo-header.png"
            alt="PostCrisp"
            width={1162}
            height={431}
            priority
            className="h-9 w-auto"
          />
        </Link>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-3 overflow-y-auto">
        {/* Top-level Dashboard link */}
        {renderItem(DASHBOARD_ITEM)}

        {/* Grouped tool nav */}
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-0.5">
            <div className="px-3 py-1 text-2xs uppercase tracking-wider text-zinc-600 font-semibold">
              {group.label}
            </div>
            {group.items.map(renderItem)}
          </div>
        ))}
      </nav>

      <div className="mt-auto px-3 py-4 border-t border-brand-500/10 space-y-2">
        <Link
          href="/signup"
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-all hover:shadow-glow min-h-[44px]"
        >
          🚀 Start free
        </Link>
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
          className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-surface-hover transition-colors"
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
