"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "📊", id: "nav-dashboard" },
  { href: "/dashboard/generate", label: "Caption Generator", icon: "✍️", id: "nav-generate" },
  { href: "/dashboard/hashtags", label: "Hashtag Finder", icon: "🏷️", id: "nav-hashtags" },
  { href: "/dashboard/best-times", label: "Best Times", icon: "⏰", id: "nav-best-times" },
  { href: "/dashboard/viral-ideas", label: "Viral Ideas", icon: "🚀", id: "nav-viral-ideas" },
  { href: "/dashboard/saved", label: "Saved Content", icon: "💾", id: "nav-saved" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙️", id: "nav-settings" },
  { href: "/dashboard/billing", label: "Billing", icon: "💳", id: "nav-billing" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (mounted) setIsAdmin(profile?.role === "admin");
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

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

      {/* Nav items */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            id={item.id}
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
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </nav>

      <div className="mt-auto px-3 py-4 border-t border-brand-500/10 space-y-2">
        {isAdmin && (
          <Link
            href="/admin"
            onClick={() => setMobileOpen(false)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 text-sm transition-colors min-h-[44px]"
          >
            {collapsed ? "🛡️" : "🛡️ Admin"}
          </Link>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 text-sm transition-colors min-h-[44px]"
        >
          {collapsed ? "🚪" : "🚪 Logout"}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-surface-hover text-sm transition-colors min-h-[44px]"
        >
          {collapsed ? "→" : "← Collapse"}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 w-11 h-11 flex items-center justify-center rounded-xl bg-surface-secondary border border-brand-500/10 text-zinc-300 hover:text-white transition-colors"
        aria-label="Open menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
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

      {/* Desktop sidebar */}
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
