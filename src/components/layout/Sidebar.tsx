"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { toolsForCategory, type ToolCategory } from "@/lib/tools-meta";
import { openCommandPalette } from "@/components/ui/CommandPalette";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface NavGroup {
  label: string;
  /** Hub page for the category. The row toggles the list; a small link opens the hub. */
  hubHref: string;
  items: NavItem[];
}

// Top-level links (rendered above groups)
const DASHBOARD_ITEM: NavItem = { href: "/dashboard", label: "Dashboard", icon: "🏠" };
const VOICE_ITEM: NavItem = { href: "/dashboard/voice", label: "Voice Trainer", icon: "🎙️" };
const TUTORIAL_ITEM: NavItem = { href: "/onboarding", label: "Finish setup", icon: "✨" };
const SAVED_ITEM: NavItem = { href: "/dashboard/saved", label: "Saved Content", icon: "💾" };

// Tool groups are derived from the canonical registry in tools-meta.ts so the
// sidebar can never disagree with the hubs or the dashboard about a tool's
// name, icon or link. Fixed order: Create · Optimize · Grow · Monetize.
const TOOL_CATEGORIES: { label: string; category: ToolCategory }[] = [
  { label: "Create",   category: "create" },
  { label: "Optimize", category: "optimize" },
  { label: "Grow",     category: "grow" },
  { label: "Monetize", category: "monetize" },
];

const navGroups: NavGroup[] = TOOL_CATEGORIES.map(({ label, category }) => ({
  label,
  hubHref: `/dashboard/${category}`,
  items: toolsForCategory(category).map((t) => ({ href: t.href, label: t.label, icon: t.icon })),
}));

const GROUPS_STORAGE_KEY = "postcrisp.sidebar.groups";

function groupFor(pathname: string): NavGroup | undefined {
  return navGroups.find(
    (g) => pathname === g.hubHref || g.items.some((item) => pathname.startsWith(item.href)),
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [tutorialCompleted, setTutorialCompleted] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  // Which groups are expanded. Default: only the group you are in. Twenty-six
  // tool rows all open at once is taller than most laptop viewports.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const g = groupFor(pathname);
    return new Set(g ? [g.label] : []);
  });
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;
      setEmail(user.email ?? null);
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

  // Restore groups the user opened themselves; the current group is always added.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(GROUPS_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as string[];
        if (Array.isArray(saved)) setExpandedGroups((prev) => new Set([...prev, ...saved]));
      }
    } catch { /* localStorage unavailable — keep defaults */ }
  }, []);

  // Auto-expand the group containing the current route (never hide where you are).
  useEffect(() => {
    const activeGroup = groupFor(pathname);
    if (activeGroup) {
      setExpandedGroups((prev) => {
        if (prev.has(activeGroup.label)) return prev;
        const next = new Set(prev);
        next.add(activeGroup.label);
        return next;
      });
    }
  }, [pathname]);

  // Close the account menu on outside click or Escape.
  useEffect(() => {
    if (!accountOpen) return;
    const onClick = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setAccountOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

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

  // Active item: a solid left-edge bar plus aria-current, so "where am I" is
  // not signalled by a colour shift alone (the old highlight measured 1.28:1).
  const linkClass = (href: string) =>
    `relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all min-h-[40px] group ${
      collapsed ? "justify-center" : ""
    } ${
      isActive(href)
        ? "bg-brand-500/15 text-brand-200 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-brand-400 before:content-['']"
        : "text-zinc-400 hover:text-zinc-200 hover:bg-surface-hover"
    }`;

  // In collapsed mode the label is hidden, so every link carries it as a
  // tooltip and an accessible name; a screen reader must never hear only an emoji.
  const linkProps = (item: NavItem) => ({
    className: linkClass(item.href),
    "aria-current": isActive(item.href) ? ("page" as const) : undefined,
    title: collapsed ? item.label : undefined,
    "aria-label": item.label,
    onClick: () => setMobileOpen(false),
  });

  const NavLink = ({ item, badge }: { item: NavItem; badge?: string }) => (
    <Link href={item.href} {...linkProps(item)}>
      <span aria-hidden="true" className="text-lg flex-shrink-0">{item.icon}</span>
      {!collapsed && (
        <span className="flex items-center gap-1.5">
          {item.label}
          {badge && (
            <span className="text-2xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-500/15 text-brand-300 border border-brand-500/20">
              {badge}
            </span>
          )}
        </span>
      )}
    </Link>
  );

  const initial = (email ?? "?").charAt(0).toUpperCase();

  const navContent = (
    <>
      {/* Logo */}
      <div className="flex items-center px-4 h-16 border-b border-edge flex-shrink-0">
        {collapsed ? (
          <Link href="/dashboard" aria-label="PostCrisp dashboard" title="Dashboard" className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-lg shadow-glow">
            <span aria-hidden="true">⚡</span>
          </Link>
        ) : (
          <Link href="/dashboard" aria-label="PostCrisp dashboard" className="flex items-center">
            <Image
              src="/postcrisp-logo-header.png"
              alt="PostCrisp"
              width={1162}
              height={431}
              priority
              className="h-9 w-auto"
            />
          </Link>
        )}
      </div>

      <nav aria-label="Main" className="flex-1 py-4 px-3 space-y-4 overflow-y-auto">
        {/* Search — the escape hatch for a 27-tool product */}
        <button
          type="button"
          onClick={() => { setMobileOpen(false); openCommandPalette(); }}
          title={collapsed ? "Search tools (Ctrl+K)" : undefined}
          aria-label="Search tools"
          aria-keyshortcuts="Control+K Meta+K"
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-edge bg-surface-tertiary/40 text-sm text-crisp hover:text-zinc-200 hover:border-brand-400 transition-colors min-h-[40px] ${collapsed ? "justify-center" : ""}`}
        >
          <span aria-hidden="true" className="text-base flex-shrink-0">🔍</span>
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search tools</span>
              <kbd className="text-2xs border border-edge rounded px-1.5 py-0.5 text-crisp">⌘K</kbd>
            </>
          )}
        </button>

        <div className="space-y-0.5">
          <NavLink item={DASHBOARD_ITEM} />
          <NavLink item={VOICE_ITEM} badge="New" />
          {!tutorialCompleted && <NavLink item={TUTORIAL_ITEM} />}
        </div>

        {/* Grouped feature nav */}
        {navGroups.map((group) => {
          const isOpen = expandedGroups.has(group.label);
          const listId = `nav-group-${group.label.toLowerCase()}`;
          const hubActive = pathname === group.hubHref;
          return (
            <div key={group.label}>
              {!collapsed ? (
                // The whole row is the disclosure control at a 44px minimum;
                // the hub page gets its own small, separate link.
                <div className="flex items-center gap-1 mb-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    aria-expanded={isOpen}
                    aria-controls={listId}
                    className="flex-1 flex items-center justify-between px-3 rounded-lg min-h-[44px] text-2xs uppercase tracking-wider font-semibold text-crisp hover:text-zinc-200 hover:bg-surface-hover transition-colors"
                  >
                    <span>{group.label}</span>
                    <span
                      aria-hidden="true"
                      className={`inline-block text-sm transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}
                    >
                      ▾
                    </span>
                  </button>
                  <Link
                    href={group.hubHref}
                    onClick={() => setMobileOpen(false)}
                    aria-current={hubActive ? "page" : undefined}
                    aria-label={`Open the ${group.label} hub`}
                    title={`${group.label} hub`}
                    className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-xs transition-colors ${
                      hubActive ? "text-brand-200 bg-brand-500/15" : "text-crisp hover:text-brand-300 hover:bg-surface-hover"
                    }`}
                  >
                    <span aria-hidden="true">↗</span>
                  </Link>
                </div>
              ) : (
                <div role="separator" aria-label={group.label} title={group.label} className="h-px bg-edge mx-3 my-2" />
              )}
              {/* Collapsed sidebar always shows items (icons with tooltips). Expanded respects the toggle. */}
              {(collapsed || isOpen) && (
                <div id={listId} className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavLink key={item.href} item={item} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="space-y-0.5">
          <NavLink item={SAVED_ITEM} />
        </div>
      </nav>

      {/* Account menu — who is signed in, plus Settings, Billing, Admin and
          Logout. Logout is no longer a red button in the primary navigation. */}
      <div ref={accountRef} className="relative mt-auto px-3 py-3 border-t border-edge space-y-1">
        {accountOpen && (
          <div
            role="menu"
            aria-label="Account"
            className="absolute bottom-full left-3 right-3 mb-1 rounded-xl border border-edge bg-surface-elevated shadow-lg py-1 min-w-[220px]"
          >
            <div className="px-3 py-2 border-b border-edge">
              <div className="text-2xs uppercase tracking-wider text-crisp">Signed in as</div>
              <div className="text-sm text-zinc-100 truncate" title={email ?? undefined}>{email ?? "…"}</div>
            </div>
            <Link role="menuitem" href="/dashboard/settings" onClick={() => { setAccountOpen(false); setMobileOpen(false); }} className="flex items-center gap-2 px-3 py-2 min-h-[44px] text-sm text-zinc-300 hover:text-zinc-100 hover:bg-surface-hover">
              <span aria-hidden="true">⚙️</span> Settings
            </Link>
            <Link role="menuitem" href="/dashboard/billing" onClick={() => { setAccountOpen(false); setMobileOpen(false); }} className="flex items-center gap-2 px-3 py-2 min-h-[44px] text-sm text-zinc-300 hover:text-zinc-100 hover:bg-surface-hover">
              <span aria-hidden="true">💳</span> Billing &amp; credits
            </Link>
            {isAdmin && (
              <Link role="menuitem" href="/admin" onClick={() => { setAccountOpen(false); setMobileOpen(false); }} className="flex items-center gap-2 px-3 py-2 min-h-[44px] text-sm text-amber-300 hover:text-amber-200 hover:bg-amber-500/10">
                <span aria-hidden="true">🛡️</span> Admin
              </Link>
            )}
            <button role="menuitem" type="button" onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 min-h-[44px] text-sm text-zinc-300 hover:text-red-300 hover:bg-red-500/10 border-t border-edge">
              <span aria-hidden="true">🚪</span> Log out
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setAccountOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={accountOpen}
          aria-label={email ? `Account menu for ${email}` : "Account menu"}
          title={collapsed ? (email ?? "Account") : undefined}
          className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-hover transition-colors min-h-[44px] ${collapsed ? "justify-center" : ""}`}
        >
          <span aria-hidden="true" className="w-8 h-8 rounded-full bg-brand-600 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
            {initial}
          </span>
          {!collapsed && (
            <>
              <span className="flex-1 min-w-0 text-left">
                <span className="block text-sm text-zinc-200 truncate">{email ?? "Account"}</span>
                <span className="block text-2xs text-crisp">Settings · Billing · Log out</span>
              </span>
              <span aria-hidden="true" className="text-crisp text-xs">{accountOpen ? "▾" : "▴"}</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : undefined}
          className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-2 rounded-lg text-crisp hover:text-zinc-300 hover:bg-surface-hover text-sm transition-colors min-h-[40px]"
        >
          <span aria-hidden="true">{collapsed ? "→" : "←"}</span>
          {!collapsed && "Collapse"}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button. Drops below the offline banner when it is showing
          (the banner adds `offline` to <html>), so connectivity loss never
          covers the navigation. */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 [.offline_&]:top-14 left-3 z-50 w-11 h-11 flex items-center justify-center rounded-xl bg-surface-secondary border border-edge text-zinc-300 hover:text-white transition-all"
        aria-label="Open menu"
        aria-expanded={mobileOpen}
      >
        <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        aria-label="Sidebar"
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-[260px] bg-surface-secondary border-r border-edge flex flex-col transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center rounded-lg text-crisp hover:text-zinc-300 hover:bg-surface-hover transition-colors"
          aria-label="Close menu"
        >
          ✕
        </button>
        {navContent}
      </aside>

      <aside
        aria-label="Sidebar"
        className={`hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col bg-surface-secondary border-r border-edge transition-all duration-300 ${
          collapsed ? "w-[72px]" : "w-[260px]"
        }`}
      >
        {navContent}
      </aside>
    </>
  );
}
