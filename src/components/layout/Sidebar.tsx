"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Top-level links (rendered above groups)
const DASHBOARD_ITEM: NavItem = { href: "/dashboard", label: "Dashboard", icon: "📊" };
const VOICE_ITEM: NavItem = { href: "/dashboard/voice", label: "Voice Trainer", icon: "🎙️" };
const TUTORIAL_ITEM: NavItem = { href: "/onboarding", label: "Tutorial", icon: "🎓" };

// Grouped feature navigation. Fixed order: Create · Optimize · Grow · Monetize · Library.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Create",
    items: [
      { href: "/dashboard/generate",       label: "Captions",         icon: "✍️" },
      { href: "/dashboard/hashtags",       label: "Hashtags",         icon: "🏷️" },
      { href: "/dashboard/scripts",        label: "Scripts",          icon: "🎬" },
      { href: "/dashboard/repurpose",      label: "Repurpose",        icon: "♻️" },
      { href: "/dashboard/blog-to-social", label: "Blog → Social",    icon: "📰" },
      { href: "/dashboard/polls",          label: "Polls",            icon: "📊" },
      { href: "/dashboard/dm-templates",   label: "DM Templates",     icon: "✉️" },
      { href: "/dashboard/comment-replies",label: "Comment Replies",  icon: "💬" },
    ],
  },
  {
    label: "Optimize",
    items: [
      { href: "/dashboard/best-times",        label: "Best Times",       icon: "⏰" },
      { href: "/dashboard/youtube-seo",       label: "YouTube SEO",      icon: "📺" },
      { href: "/dashboard/bio-optimizer",     label: "Bio Optimizer",    icon: "🧬" },
      { href: "/dashboard/platform-tips",     label: "Platform Tips",    icon: "💡" },
      { href: "/dashboard/channel-analysis",  label: "Channel Analysis", icon: "🪞" },
      { href: "/dashboard/thumbnail-analyzer",label: "Thumbnail Analyzer",icon: "🖼️" },
    ],
  },
  {
    label: "Grow",
    items: [
      { href: "/dashboard/viral-ideas",    label: "Viral Ideas",      icon: "🚀" },
      { href: "/dashboard/trends",         label: "Trend Radar",      icon: "📡" },
      { href: "/dashboard/sounds",         label: "Sound Tracker",    icon: "🎵" },
      { href: "/dashboard/collab-finder",  label: "Collab Finder",    icon: "🤝" },
    ],
  },
  {
    label: "Monetize",
    items: [
      { href: "/dashboard/brand-pitch",        label: "Brand Pitch",         icon: "📧" },
      { href: "/dashboard/rate-calculator",    label: "Rate Calculator",     icon: "💵" },
      { href: "/dashboard/competitor-analysis",label: "Competitor Analysis", icon: "🔍" },
    ],
  },
  {
    label: "Library",
    items: [
      { href: "/dashboard/saved",          label: "Saved Content",    icon: "💾" },
      { href: "/dashboard/settings",       label: "Settings",         icon: "⚙️" },
      { href: "/dashboard/billing",        label: "Billing",          icon: "💳" },
    ],
  },
];

const GROUPS_STORAGE_KEY = "postcrisp.sidebar.groups";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tutorialCompleted, setTutorialCompleted] = useState(false);
  // Which groups are expanded. Default: all expanded (better discoverability).
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(NAV_GROUPS.map((g) => g.label))
  );
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, preferences")
        .eq("id", user.id)
        .maybeSingle();
      if (mounted) {
        setIsAdmin(profile?.role === "admin");
        const prefs = (profile?.preferences ?? {}) as { tutorial_progress?: { completed?: boolean } };
        setTutorialCompleted(!!prefs.tutorial_progress?.completed);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hydrate expanded groups from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(GROUPS_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as string[];
        if (Array.isArray(saved)) setExpandedGroups(new Set(saved));
      }
    } catch { /* localStorage unavailable — keep defaults */ }
  }, []);

  // Auto-expand the group containing the current active route (never hide where you are)
  useEffect(() => {
    const activeGroup = NAV_GROUPS.find((g) =>
      g.items.some((item) =>
        item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href)
      )
    );
    if (activeGroup) {
      setExpandedGroups((prev) => {
        if (prev.has(activeGroup.label)) return prev;
        const next = new Set(prev);
        next.add(activeGroup.label);
        return next;
      });
    }
  }, [pathname]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      try {
        localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch { /* ignore */ }
      return next;
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  const linkClass = (href: string) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all min-h-[38px] group ${
      isActive(href)
        ? "bg-brand-600/20 text-brand-300 border border-brand-500/20"
        : "text-zinc-400 hover:text-zinc-200 hover:bg-surface-hover"
    }`;

  const navContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-brand-500/10 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-lg shadow-glow">
          ⚡
        </div>
        {!collapsed && (
          <span className="text-lg font-bold bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
            PostCrisp
          </span>
        )}
      </div>

      <nav className="flex-1 py-4 px-3 space-y-4 overflow-y-auto">
        {/* Dashboard (top-level) */}
        <Link
          href={DASHBOARD_ITEM.href}
          onClick={() => setMobileOpen(false)}
          className={linkClass(DASHBOARD_ITEM.href)}
        >
          <span className="text-lg flex-shrink-0">{DASHBOARD_ITEM.icon}</span>
          {!collapsed && <span>{DASHBOARD_ITEM.label}</span>}
        </Link>

        {/* Voice Trainer (top-level) — foundational; set up early */}
        <Link
          href={VOICE_ITEM.href}
          onClick={() => setMobileOpen(false)}
          className={linkClass(VOICE_ITEM.href)}
        >
          <span className="text-lg flex-shrink-0">{VOICE_ITEM.icon}</span>
          {!collapsed && (
            <span className="flex items-center gap-1.5">
              {VOICE_ITEM.label}
              <span className="text-2xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-500/15 text-brand-300 border border-brand-500/20">
                New
              </span>
            </span>
          )}
        </Link>

        {/* Tutorial (top-level) — only shown to users who haven't completed it yet */}
        {!tutorialCompleted && (
          <Link
            href={TUTORIAL_ITEM.href}
            onClick={() => setMobileOpen(false)}
            className={linkClass(TUTORIAL_ITEM.href)}
          >
            <span className="text-lg flex-shrink-0">{TUTORIAL_ITEM.icon}</span>
            {!collapsed && <span>{TUTORIAL_ITEM.label}</span>}
          </Link>
        )}

        {/* Grouped feature nav */}
        {NAV_GROUPS.map((group) => {
          const isOpen = expandedGroups.has(group.label);
          return (
            <div key={group.label}>
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-3 mb-1.5 text-2xs uppercase tracking-wider font-semibold text-zinc-500 hover:text-zinc-300 transition-colors group"
                  aria-expanded={isOpen}
                  aria-label={`${isOpen ? "Collapse" : "Expand"} ${group.label}`}
                >
                  <span>{group.label}</span>
                  <span className={`text-zinc-600 group-hover:text-zinc-400 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}>▾</span>
                </button>
              ) : (
                <div className="h-px bg-brand-500/10 mx-3 my-2" />
              )}
              {/* In collapsed-sidebar mode, always show items (icons only). In expanded-sidebar mode, respect group toggle. */}
              {(collapsed || isOpen) && (
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={linkClass(item.href)}
                    >
                      <span className="text-lg flex-shrink-0">{item.icon}</span>
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="mt-auto px-3 py-4 border-t border-brand-500/10 space-y-2">
        {isAdmin && (
          <Link
            href="/admin"
            onClick={() => setMobileOpen(false)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 text-sm transition-colors min-h-[40px]"
          >
            {collapsed ? "🛡️" : "🛡️ Admin"}
          </Link>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 text-sm transition-colors min-h-[40px]"
        >
          {collapsed ? "🚪" : "🚪 Logout"}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-surface-hover text-sm transition-colors min-h-[40px]"
        >
          {collapsed ? "→" : "← Collapse"}
        </button>
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

      <aside
        className={`hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col bg-surface-secondary border-r border-brand-500/10 transition-all duration-300 ${
          collapsed ? "w-[72px]" : "w-[260px]"
        }`}
      >
        {navContent}
      </aside>
    </>
  );
}
