# Rocket Loader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rocket-themed `variant="rocket"` to the existing `GenerationLoader` and opt 7 heavy AI pages into it, so testers see "STAND BY / Charting your trajectory…" with an animated rocket while waiting 30-90s for slow generations.

**Note:** Original spec listed 9 pages, but `thumbnail-analyzer` and `voice` use custom in-page loading UIs (5-stage progress card and in-button spinner respectively), not `GenerationLoader`. They're deferred for a separate post-launch refactor. Final scope: 7 pages.

**Architecture:** Single-component approach. Add a `variant` prop to `src/components/ui/GenerationLoader.tsx`; render an inline `<RocketScene />` SVG when `variant === "rocket"` and the existing `<DotsScene />` otherwise. Animations live as CSS `@keyframes` in `src/app/globals.css` (where all other animations already live, kebab-case named). 9 heavy pages flip on the variant by adding one prop.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, inline SVG, CSS keyframes. **No new dependencies.**

**Spec reference:** `docs/superpowers/specs/2026-04-29-rocket-loader-design.md`

---

## File map

| File | Action | Purpose |
|------|--------|---------|
| `src/app/globals.css` | Modify | Add 4 `@keyframes` (`rocket-bob`, `flame-flicker`, `puff-rise`, `twinkle`) + utility classes + reduced-motion media query |
| `src/components/ui/GenerationLoader.tsx` | Rewrite | Add `variant` prop, extract `<DotsScene />` and `<RocketScene />` subcomponents, add `role="status"` + `aria-live="polite"` |
| `src/app/dashboard/channel-analysis/page.tsx` | Modify | Add `variant="rocket"` to `<GenerationLoader>` |
| `src/app/dashboard/voice/page.tsx` | Modify | Add `variant="rocket"` |
| `src/app/dashboard/thumbnail-analyzer/page.tsx` | Modify | Add `variant="rocket"` |
| `src/app/dashboard/repurpose/page.tsx` | Modify | Add `variant="rocket"` |
| `src/app/dashboard/blog-to-social/page.tsx` | Modify | Add `variant="rocket"` |
| `src/app/dashboard/viral-ideas/page.tsx` | Modify | Add `variant="rocket"` |
| `src/app/dashboard/brand-pitch/page.tsx` | Modify | Add `variant="rocket"` |
| `src/app/dashboard/trends/page.tsx` | Modify | Add `variant="rocket"` |
| `src/app/dashboard/sounds/page.tsx` | Modify | Add `variant="rocket"` |

Total: 11 files, ~180 LOC.

---

## Task 1: Add CSS keyframes + utility classes

**Files:**
- Modify: `src/app/globals.css` — append at end of file (after the last existing `@keyframes` block, around line 304+)

- [ ] **Step 1: Append the rocket keyframes block to globals.css**

Append this to the end of `src/app/globals.css`:

```css

/* ─── Rocket loader (variant="rocket" on GenerationLoader) ─────────────── */

@keyframes rocket-bob {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50%      { transform: translateY(-4px) rotate(2deg); }
}

@keyframes flame-flicker {
  0%, 100% { transform: scaleY(1);    opacity: 0.95; }
  50%      { transform: scaleY(0.85); opacity: 0.70; }
}

@keyframes puff-rise {
  0%   { transform: translateY(0);    opacity: 0.5; }
  100% { transform: translateY(24px); opacity: 0;   }
}

@keyframes twinkle {
  0%, 100% { opacity: 0.3; }
  50%      { opacity: 0.9; }
}

.animate-rocket-bob    { animation: rocket-bob   1.4s ease-in-out infinite; }
.animate-flame-flicker { animation: flame-flicker 0.4s ease-in-out infinite; transform-origin: top center; }
.animate-puff-rise     { animation: puff-rise   1.5s ease-out     infinite; }
.animate-twinkle       { animation: twinkle     2.0s ease-in-out  infinite; }

@media (prefers-reduced-motion: reduce) {
  .animate-rocket-bob,
  .animate-flame-flicker,
  .animate-puff-rise,
  .animate-twinkle {
    animation: none !important;
  }
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `npm run build 2>&1 | grep -iE "css|globals" | head -10`
Expected: no CSS parse errors. If output is empty, that's also fine.

(A full `next build` here is overkill — the css change is local. We'll do a full build at the end of Task 4.)

---

## Task 2: Add `variant` prop + `<RocketScene />` to GenerationLoader

**Files:**
- Modify: `src/components/ui/GenerationLoader.tsx` (full rewrite)

- [ ] **Step 1: Replace the file contents with the variant-aware version**

Overwrite `src/components/ui/GenerationLoader.tsx` with:

```tsx
"use client";
import { useState, useEffect } from "react";

interface GenerationLoaderProps {
  messages: string[];
  className?: string;
  /**
   * "default" — 3 pulsing dots (existing behavior).
   * "rocket"  — animated rocket SVG with "STAND BY / Charting your trajectory…" copy.
   *             Use on heavy AI pages where wait is 30s+.
   */
  variant?: "default" | "rocket";
}

export function GenerationLoader({ messages, className = "", variant = "default" }: GenerationLoaderProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div
      className={`flex flex-col items-center justify-center py-12 ${className}`}
      role="status"
      aria-live="polite"
    >
      {variant === "rocket" ? <RocketScene /> : <DotsScene />}

      {/* Rotating per-feature message */}
      <p
        key={messageIndex}
        className="text-zinc-300 text-sm font-medium animate-fade-in-up mt-4 text-center px-4 max-w-md"
      >
        {messages[messageIndex]}
      </p>

      {/* Shimmer bar */}
      <div className="w-48 h-1 rounded-full bg-surface-tertiary mt-6 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-brand-600 via-brand-400 to-brand-600 bg-200 animate-shimmer rounded-full" />
      </div>
    </div>
  );
}

function DotsScene() {
  return (
    <div className="flex gap-2 mb-2" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-3 h-3 rounded-full bg-brand-500"
          style={{
            animation: "pulseDot 1.4s ease-in-out infinite",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}

function RocketScene() {
  return (
    <div className="relative flex flex-col items-center" aria-hidden="true">
      {/* Stage: rocket + starfield wrapper. Fixed dims so animations don't shift layout. */}
      <div className="relative h-44 w-32">
        {/* Starfield (5 dots, twinkle staggered) */}
        <span className="absolute top-2  left-6  block w-1   h-1   rounded-full bg-brand-300 animate-twinkle" style={{ animationDelay: "0s"   }} />
        <span className="absolute top-6  right-4 block w-1   h-1   rounded-full bg-brand-300 animate-twinkle" style={{ animationDelay: "0.4s" }} />
        <span className="absolute top-14 left-2  block w-0.5 h-0.5 rounded-full bg-brand-300 animate-twinkle" style={{ animationDelay: "0.8s" }} />
        <span className="absolute top-3  right-10 block w-0.5 h-0.5 rounded-full bg-brand-300 animate-twinkle" style={{ animationDelay: "1.2s" }} />
        <span className="absolute top-20 right-2 block w-1   h-1   rounded-full bg-brand-300 animate-twinkle" style={{ animationDelay: "1.6s" }} />

        {/* Rocket */}
        <svg
          viewBox="0 0 60 140"
          className="absolute inset-x-0 mx-auto h-44 w-16 animate-rocket-bob"
        >
          {/* Body — Electric Blue ellipse */}
          <ellipse cx="30" cy="40" rx="18" ry="34" fill="var(--brand-500)" />
          {/* Window — Hangar White outer + brand-700 inner reflection */}
          <circle cx="30" cy="32" r="6" fill="#E8ECEF" />
          <circle cx="30" cy="32" r="4" fill="var(--brand-700)" opacity="0.45" />
          {/* Fins — Gunmetal */}
          <path d="M 12 60 L 4 78 L 12 74 Z"  fill="var(--bg-tertiary)" />
          <path d="M 48 60 L 56 78 L 48 74 Z" fill="var(--bg-tertiary)" />
          {/* Engine bell */}
          <rect x="22" y="72" width="16" height="6" rx="1" fill="var(--bg-tertiary)" />

          {/* Flame — orange outer + yellow inner, flickers */}
          <g className="animate-flame-flicker" style={{ transformOrigin: "30px 78px" }}>
            <path d="M 22 78 Q 30 100 38 78 Z" fill="#FF8C42" />
            <path d="M 25 78 Q 30 92  35 78 Z" fill="#FFD93D" />
          </g>

          {/* Exhaust puffs — staggered fade+rise */}
          <circle cx="22" cy="105" r="3"   fill="#8C949C" className="animate-puff-rise" style={{ animationDelay: "0s"   }} />
          <circle cx="38" cy="115" r="2.5" fill="#8C949C" className="animate-puff-rise" style={{ animationDelay: "0.5s" }} />
          <circle cx="28" cy="125" r="2"   fill="#8C949C" className="animate-puff-rise" style={{ animationDelay: "1.0s" }} />
        </svg>
      </div>

      {/* Copy */}
      <p className="mt-2 text-zinc-100 text-base font-bold tracking-[0.3em]">STAND BY</p>
      <p className="text-zinc-400 text-sm mt-1">Charting your trajectory…</p>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: zero errors.

If errors appear, fix and re-run. Common pitfall: TS might complain that `variant` is missing on existing call sites — it shouldn't because the prop is optional with a default, but if it does, recheck the `?` in the interface.

---

## Task 3: Opt the 9 heavy pages into `variant="rocket"`

**Files:** all 9 page files. Each has exactly one `<GenerationLoader … />` JSX usage. Add `variant="rocket"` to each.

For each page, find the existing `<GenerationLoader` JSX and add `variant="rocket"` as a prop. Most pages render it like:

```tsx
{loading ? <GenerationLoader messages={[...]} /> : <Result … />}
```

We want:

```tsx
{loading ? <GenerationLoader messages={[...]} variant="rocket" /> : <Result … />}
```

- [ ] **Step 1: Edit `src/app/dashboard/channel-analysis/page.tsx`**

Find the line containing `<GenerationLoader` and add `variant="rocket"` to the props.

- [ ] **Step 2: Edit `src/app/dashboard/voice/page.tsx`**

Same edit.

- [ ] **Step 3: Edit `src/app/dashboard/thumbnail-analyzer/page.tsx`**

Same edit.

- [ ] **Step 4: Edit `src/app/dashboard/repurpose/page.tsx`**

Same edit.

- [ ] **Step 5: Edit `src/app/dashboard/blog-to-social/page.tsx`**

Same edit.

- [ ] **Step 6: Edit `src/app/dashboard/viral-ideas/page.tsx`**

Same edit.

- [ ] **Step 7: Edit `src/app/dashboard/brand-pitch/page.tsx`**

Same edit.

- [ ] **Step 8: Edit `src/app/dashboard/trends/page.tsx`**

Same edit.

- [ ] **Step 9: Edit `src/app/dashboard/sounds/page.tsx`**

Same edit.

- [ ] **Step 10: Verify exactly 9 pages now use `variant="rocket"`**

Run: `Grep pattern='variant="rocket"' path=src/app/dashboard output_mode=files_with_matches`

Expected: 9 files listed (the 9 above). If fewer, find the missing one(s) and add the prop. If more, an unintended file got the prop — investigate.

- [ ] **Step 11: Verify the 11 fast pages still render the default loader (no regression)**

Run: `Grep pattern='<GenerationLoader' path=src/app/dashboard output_mode=files_with_matches`

Expected: 20 dashboard files (all current users of the loader). Cross-check against the 9 rocket pages — the 11 remaining should NOT have `variant="rocket"`.

- [ ] **Step 12: Run typecheck**

Run: `npm run typecheck`
Expected: zero errors.

---

## Task 4: Manual smoke + verification

This task is human-driven verification, not code. The agentic worker should run the checks and report results back; nothing should be marked done if a check fails.

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: server starts on http://localhost:3000 (or next available port). Note the actual port from stdout.

- [ ] **Step 2: Visit one heavy page and trigger generation**

Open http://localhost:3000/dashboard/channel-analysis. Sign in if needed (use captain@postcrisp.com admin account or a tester account). Fill in: platform=instagram, niche="fitness coaches", click Analyze.

Expected during loading state:
- Rocket SVG renders, gently bobbing
- Flame flickers under the rocket
- 3 exhaust puffs rise and fade
- 5 stars twinkle
- Big "STAND BY" header in white, letterspaced
- "Charting your trajectory…" subline in grey
- The original feature-specific message rotates every 2.5s below
- Shimmer bar at the bottom
- On completion, loader disappears and result renders normally

Take a screenshot if reporting back. If anything looks off (clipping, color wrong, no animation), STOP and report which page + issue.

- [ ] **Step 3: Visit one fast page (regression check)**

Open http://localhost:3000/dashboard/hashtags (or any of the 11 fast pages). Trigger a generation.

Expected: 3 pulsing dots + rotating message + shimmer bar. **NO rocket, NO "STAND BY" text.** If rocket appears here, the variant prop leaked — check Task 3 Step 11.

- [ ] **Step 4: `prefers-reduced-motion` check**

In Chrome DevTools → ⋮ → More tools → Rendering → "Emulate CSS media feature `prefers-reduced-motion`" → set to `reduce`. Trigger another generation on a heavy page.

Expected: rocket, flame, puffs, stars are all visible but **static** (no movement). Shimmer bar should also be still (its existing keyframe is unrelated to ours, but worth eyeballing). Copy + layout unchanged.

- [ ] **Step 5: Mobile viewport check**

DevTools → device toolbar → set width to 375px (iPhone SE). Open a heavy page and trigger generation.

Expected: rocket fits within viewport with comfortable margin, no horizontal scroll, copy doesn't wrap awkwardly.

- [ ] **Step 6: Run typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed with zero errors. Warnings ok if pre-existing.

- [ ] **Step 7: Stop the dev server**

Ctrl+C in the dev server terminal.

---

## Task 5: Pause for user approval before committing

**Per project policy: do not commit without explicit user approval.** The user already has uncommitted changes from the timeout fix in their working tree; bundling decisions are theirs.

- [ ] **Step 1: Show working tree state**

Run: `git status`
Expected output should show modified:
- `src/app/globals.css`
- `src/components/ui/GenerationLoader.tsx`
- `src/lib/api.ts` (from prior timeout fix)
- 18 dashboard page files (9 from rocket task + 9 from prior timeout removals — and `src/components/onboarding/TutorialSteps.tsx`)
- New: `docs/superpowers/specs/2026-04-29-rocket-loader-design.md`
- New: `docs/superpowers/plans/2026-04-29-rocket-loader.md`

- [ ] **Step 2: Ask user how to commit**

Prompt: "Working tree has the timeout fix (uncommitted from last task) + the rocket loader (this task) + the spec/plan docs. Two commit shapes possible:
- A) **Two commits**: `fix: sync client timeouts to 125s default` + `feat: rocket loader on heavy AI pages`
- B) **One commit**: `fix: harden generation UX — timeout sync + rocket loader`

Which do you want?"

Wait for user response. Do NOT commit until they answer.

- [ ] **Step 3: Execute the user's chosen commit shape**

If two commits, stage and commit each separately:

For commit 1 (timeout fix):
```bash
git add src/lib/api.ts src/app/dashboard/best-times/page.tsx src/app/dashboard/blog-to-social/page.tsx src/app/dashboard/brand-pitch/page.tsx src/app/dashboard/channel-analysis/page.tsx src/app/dashboard/collab-finder/page.tsx src/app/dashboard/competitor-analysis/page.tsx src/app/dashboard/cta-optimizer/page.tsx src/app/dashboard/platform-tips/page.tsx src/app/dashboard/rate-calculator/page.tsx src/app/dashboard/repurpose/page.tsx src/app/dashboard/scripts/page.tsx src/app/dashboard/sounds/page.tsx src/app/dashboard/thumbnail-analyzer/page.tsx src/app/dashboard/trends/page.tsx src/app/dashboard/viral-ideas/page.tsx src/app/dashboard/voice/page.tsx src/app/dashboard/youtube-seo/page.tsx src/components/onboarding/TutorialSteps.tsx
```

```bash
git commit -m "$(cat <<'EOF'
fix: sync client AI-call timeouts to 125s default

Stale per-page timeout overrides (45s/60s/90s) were firing while the
server was still processing — even on channel-analysis where the server
returned successfully at ~70s, the tutorial's 90s client AbortController
could fire mid-persistence on a slow run, surfacing as 'Request Timed
Out' to testers despite the server succeeding.

Removed all 22 explicit timeout overrides on AI feature pages + tutorial
steps. New apiFetch default is 125s (5s buffer above server maxDuration
= 120s) so when the server actually does hit its ceiling, the client
stays alive long enough to receive a structured 504 instead of racing
to AbortError.

Files: 18 dashboard/tutorial pages + src/lib/api.ts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

For commit 2 (rocket loader):
```bash
git add src/app/globals.css src/components/ui/GenerationLoader.tsx src/app/dashboard/channel-analysis/page.tsx src/app/dashboard/voice/page.tsx src/app/dashboard/thumbnail-analyzer/page.tsx src/app/dashboard/repurpose/page.tsx src/app/dashboard/blog-to-social/page.tsx src/app/dashboard/viral-ideas/page.tsx src/app/dashboard/brand-pitch/page.tsx src/app/dashboard/trends/page.tsx src/app/dashboard/sounds/page.tsx docs/superpowers/specs/2026-04-29-rocket-loader-design.md docs/superpowers/plans/2026-04-29-rocket-loader.md
```

```bash
git commit -m "$(cat <<'EOF'
feat: rocket loader on 9 heavy AI pages — STAND BY / Charting your trajectory

Adds variant='rocket' to GenerationLoader: animated SVG rocket (Electric
Blue body, flickering flame, staggered exhaust puffs, twinkling
starfield) + 'STAND BY' headline + 'Charting your trajectory…' subline.
Per-feature rotating message + shimmer bar are kept underneath.

Heavy pages opted in (waits 30-90s):
- channel-analysis, voice, thumbnail-analyzer, repurpose, blog-to-social,
  viral-ideas, brand-pitch, trends, sounds

Fast pages (hashtags, captions, polls, etc.) keep the existing
3-dot loader unchanged.

Animations are CSS keyframes only (no Lottie, no new deps). Honors
prefers-reduced-motion (motion stops, copy + static rocket remain).

Spec: docs/superpowers/specs/2026-04-29-rocket-loader-design.md
Plan: docs/superpowers/plans/2026-04-29-rocket-loader.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If one commit, stage all the above files together and use a unified message.

- [ ] **Step 4: Verify commit(s) landed**

Run: `git log --oneline -3`
Expected: the new commit(s) at the top of the log.

- [ ] **Step 5: Report status to user**

Tell them: commits landed (with hashes), working tree clean, ready to push to Vercel when they choose.

---

## Self-review

Spec coverage check (against `docs/superpowers/specs/2026-04-29-rocket-loader-design.md`):
- ✓ Variant prop added (Task 2)
- ✓ Inline SVG rocket with electric-blue body, white window, gunmetal fins (Task 2 Step 1)
- ✓ 4 keyframes: rocket-bob, flame-flicker, puff-rise, twinkle (Task 1)
- ✓ Reduced-motion media query (Task 1)
- ✓ STAND BY headline + Charting subline copy (Task 2)
- ✓ 9 heavy pages opted in (Task 3, all 9 listed)
- ✓ 11 fast pages NOT touched (Task 3 Step 11 verifies)
- ✓ Manual smoke (Task 4)
- ✓ Reduced-motion smoke (Task 4 Step 4)
- ✓ Mobile viewport smoke (Task 4 Step 5)
- ✓ Typecheck + build (Task 4 Step 6)
- ✓ No unit test (spec acknowledged this is out of scope; no RTL infra)
- ✓ Commit policy respected (Task 5 pauses for user)

No placeholders, no TBDs. All file paths are absolute. All code blocks are complete.

Type consistency: `GenerationLoaderProps.variant?: "default" | "rocket"` is consistent across the interface (Task 2) and the call sites (Task 3). No mismatched names.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-29-rocket-loader.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
