"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ALL_TOOLS, type ToolMeta } from "@/lib/tools-meta";

/**
 * Ctrl/Cmd-K search over every tool. The search corpus is the canonical
 * registry (label, tagline, best-for), so a new tool is searchable the moment
 * it is registered. Mounted once in the dashboard layout; the sidebar's
 * "Search tools" button opens it through the `postcrisp:palette` event.
 */
export const OPEN_PALETTE_EVENT = "postcrisp:palette";

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
}

interface Entry {
  href: string;
  icon: string;
  label: string;
  hint: string;
  keywords: string;
  cost?: number;
}

const STATIC_ENTRIES: Entry[] = [
  { href: "/dashboard", icon: "🏠", label: "Dashboard", hint: "Your daily briefing and recent content.", keywords: "home overview" },
  { href: "/dashboard/voice", icon: "🎙️", label: "Voice Trainer", hint: "Teach PostCrisp how you write.", keywords: "voice profile style samples" },
  { href: "/dashboard/saved", icon: "💾", label: "Saved Content", hint: "Everything you kept, in one library.", keywords: "library saved reports" },
  { href: "/dashboard/settings", icon: "⚙️", label: "Settings", hint: "Profile, channels and preferences.", keywords: "account profile channels" },
  { href: "/dashboard/billing", icon: "💳", label: "Billing", hint: "Plan, credits and invoices.", keywords: "credits plan upgrade invoice" },
];

function toEntry(t: ToolMeta): Entry {
  return { href: t.href, icon: t.icon, label: t.label, hint: t.tagline, keywords: `${t.bestFor} ${t.category}`, cost: t.creditCost };
}

const ENTRIES: Entry[] = [...ALL_TOOLS.map(toEntry), ...STATIC_ENTRIES];

function score(entry: Entry, q: string): number {
  const label = entry.label.toLowerCase();
  if (label.startsWith(q)) return 3;
  if (label.includes(q)) return 2;
  if (entry.hint.toLowerCase().includes(q) || entry.keywords.toLowerCase().includes(q)) return 1;
  return 0;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ENTRIES;
    return ENTRIES.map((e) => ({ e, s: score(e, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.e);
  }, [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  const go = useCallback(
    (entry: Entry | undefined) => {
      if (!entry) return;
      close();
      router.push(entry.href);
    },
    [close, router],
  );

  // Global shortcut + programmatic open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => setActive(0), [query]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); go(results[active]); }
  };

  return (
    <div
      className="fixed inset-0 z-[85] flex items-start justify-center p-4 pt-[12vh]"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search tools"
        className="relative w-full max-w-lg rounded-xl border border-edge bg-surface-secondary shadow-lg overflow-hidden"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 px-4 border-b border-edge">
          <span aria-hidden="true" className="text-crisp">🔍</span>
          <input
            ref={inputRef}
            id="command-palette-input"
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools… try “pitch” or “thumbnail”"
            className="flex-1 bg-transparent py-3.5 text-sm text-zinc-100 placeholder:text-crisp focus:outline-none"
          />
          <kbd className="hidden sm:inline text-2xs text-crisp border border-edge rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <ul id={listId} role="listbox" className="max-h-[50vh] overflow-y-auto py-2">
          {results.length === 0 && (
            <li className="px-4 py-6 text-sm text-crisp text-center">No tool matches “{query}”.</li>
          )}
          {results.map((entry, i) => (
            <li
              key={entry.href}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(entry)}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer ${
                i === active ? "bg-brand-500/15 text-zinc-100" : "text-zinc-300"
              }`}
            >
              <span aria-hidden="true" className="text-lg w-7 text-center flex-shrink-0">{entry.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium truncate">{entry.label}</span>
                <span className="block text-xs text-crisp truncate">{entry.hint}</span>
              </span>
              {entry.cost !== undefined && (
                <span className="text-xs text-crisp tabular-nums flex-shrink-0">
                  {entry.cost} {entry.cost === 1 ? "credit" : "credits"}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
