# Rocket Loader — Design Spec

**Date:** 2026-04-29
**Status:** Draft, pending user review
**Goal:** Replace the dot-based loader on heavy AI features with an animated rocket + "STAND BY / Charting your trajectory…" framing, so testers waiting 30-90s for a generation see intentional motion instead of static spinners and don't wonder if the app is hung.

---

## Scope

### In-scope
- Add a `variant?: "default" | "rocket"` prop to the existing `src/components/ui/GenerationLoader.tsx` component.
- Implement the rocket variant inline in the same file using SVG + CSS keyframes (no new dependencies, no asset files).
- Update **9 heavy-AI dashboard pages** to pass `variant="rocket"` to `GenerationLoader`.
- Keep the existing `messages` prop (rotating per-feature messages) intact in both variants.
- Honor `prefers-reduced-motion` — animations stop, copy + static rocket remain visible.

### Out-of-scope
- New animation libraries (Lottie, Framer Motion, GSAP). Inline SVG + CSS keyframes only.
- Server-sent events / streaming responses. The loader is decorative; it doesn't change request lifecycle.
- Replacing the loader on the 11 fast pages (hashtags, captions, polls, bio-optimizer, dm-templates, comment-replies, best-times, platform-tips, collab-finder, youtube-seo, scripts, rate-calculator, cta-optimizer, competitor-analysis). Default dot loader stays for them.
- Sound effects, haptics, confetti at completion. Decorative wait UX only.

---

## Pages getting `variant="rocket"`

| Page | Reason |
|------|--------|
| `dashboard/channel-analysis` | Opus + refine pass, 60-90s on Elite tier |
| `dashboard/repurpose` | Multi-platform output, 30-60s |
| `dashboard/blog-to-social` | Multi-post output, 30-60s |
| `dashboard/viral-ideas` | Opus on Elite, 30-50s |
| `dashboard/brand-pitch` | Opus on Elite, 30-50s |
| `dashboard/trends` | Multi-platform aggregation |
| `dashboard/sounds` | Multi-platform aggregation |

Each page already imports `GenerationLoader` and renders it during `loading === true`. The change is one new prop per page (7 lines total).

### Deferred — pages that don't use GenerationLoader

These two pages are heavy AI calls but render their own custom progress UIs, not `GenerationLoader`. Migrating them to the rocket loader is a separate refactor, deferred post-launch:

- `dashboard/thumbnail-analyzer` — uses an inline 5-stage progress card with a stage-aware progress bar ("Reading your thumbnail…" → "Drafting your improvements…"). The custom UI is informative for the 15-30s vision wait; replacing it would lose the stage signal.
- `dashboard/voice` — uses an in-button spinner via `<Button loading={analyzing}>`, not a full-screen loader. Adding a rocket here would require restructuring the analyze layout.

---

## Visual design

### Layout (top to bottom)

```
   ✦   ·     ✦                     ← starfield (5 absolutely-positioned dots)
        ✦
                    ___
                   /   \             ← rocket SVG (Electric Blue body,
                   |   |                Hangar White window, Gunmetal fins)
                  /| · |\
                 / |   | \
                   |   |
                   ‖‖‖‖‖             ← engine flame (orange→yellow gradient,
                  \\\\\\\                flickering scale)
                  /‖‖‖‖\
                  ('‖‖')             ← exhaust puffs (3 staggered, fade+fall)

         STAND BY                    ← headline: Hangar White, tracking-wide,
                                        font-bold, text-base
   Charting your trajectory…         ← subline: Warship Grey, text-sm

   <feature-specific message>        ← existing messages[] prop, rotates 2.5s

   ▰▰▰▰▰▱▱▱▱▱                       ← existing shimmer bar, kept
```

### Colors (from brand tokens)

| Element | Token / Hex |
|---------|-------------|
| Rocket body | `brand-500` (#4A9EE0 Electric Blue) |
| Rocket window | `text-zinc-100` / Hangar White |
| Rocket fins | `surface-tertiary` (#2D343C Gunmetal) |
| Flame inner | `#FFD93D` (yellow) |
| Flame outer | `#FF8C42` (orange) |
| Exhaust puffs | `text-zinc-500` at 40% opacity, fading to 0 |
| Headline text | `text-zinc-100` |
| Subline text | `text-zinc-400` |
| Stars | `brand-300` at 60% opacity |
| Background | inherit (no card; sits on existing surface) |

### Animations (CSS keyframes, all loop infinitely)

| Animation | Duration | Effect |
|-----------|----------|--------|
| `rocketBob` | 1.4s ease-in-out | Translate Y ±4px, slight rotate ±2deg |
| `flameFlicker` | 0.4s ease-in-out | scaleY 0.85 → 1.15, opacity 0.7 → 1.0 |
| `puffRise` | 1.5s ease-out | translateY 0 → 24px, opacity 0.5 → 0; 3 puffs staggered 0s/0.5s/1.0s |
| `starTwinkle` | 2.0s ease-in-out | opacity 0.3 → 0.9 → 0.3, on 5 stars staggered |

All keyframes wrapped in `@media (prefers-reduced-motion: no-preference)`. With reduced motion: rocket visible static, flame visible static, puffs hidden, stars at fixed 0.5 opacity.

---

## Component API

```ts
interface GenerationLoaderProps {
  messages: string[];              // existing — per-feature rotating messages
  className?: string;              // existing
  variant?: "default" | "rocket";  // NEW — defaults to "default"
}
```

Behavior:
- `variant="default"` (default): exact current rendering — 3 pulsing dots, rotating messages, shimmer bar. **No regression for the 11 pages that don't opt in.**
- `variant="rocket"`: starfield + rocket SVG + STAND BY headline + Charting subline + rotating messages + shimmer bar.

Internally implemented as two render branches in the same component, sharing the `useEffect` interval logic for `messages` rotation.

---

## File changes

| File | Change | Approx LOC |
|------|--------|-----------|
| `src/components/ui/GenerationLoader.tsx` | Add `variant` prop, add `<RocketScene />` inline subcomponent with SVG + keyframes | +130 |
| `src/app/globals.css` | Add `@keyframes rocketBob`, `flameFlicker`, `puffRise`, `starTwinkle` (kept here so they're not duplicated per render) | +40 |
| 7 page files (channel-analysis, repurpose, blog-to-social, viral-ideas, brand-pitch, trends, sounds) | Add `variant="rocket"` to existing `<GenerationLoader>` JSX | +7 |

Total: ~180 LOC across 9 files. One commit.

---

## Accessibility

- `prefers-reduced-motion: reduce`: all 4 keyframes disabled; static rocket + flame visible at neutral state, puffs hidden, stars at constant 0.5 opacity.
- Headline + subline are real text, not images — screen readers announce them.
- `role="status"` + `aria-live="polite"` on the loader root so the rotating message is announced.
- No flashing exceeding 3Hz (flame at 0.4s = 2.5Hz, well under).
- No autoplay sound.

---

## Testing

This is a visual component; primary verification is manual smoke. The codebase has no React component testing infrastructure (`@testing-library/react` and `jsdom` are not installed; existing `__tests__` are pure-logic only), so adding RTL setup just for this component is out of scope for a launch-blocker.

- **Manual smoke** on each of the 9 heavy pages: trigger a generation, confirm rocket renders, animations smooth, copy correct, completion swaps loader for result.
- **`prefers-reduced-motion`** check via Chrome DevTools rendering tab — confirm motion stops but layout intact (rocket, copy, shimmer all still visible).
- **Mobile viewport** check (375px wide via DevTools): confirm no horizontal overflow, rocket fits within container.
- **Typecheck + build** must pass: `npm run typecheck` and `npm run build`.

---

## Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| SVG keyframes feel cheap vs. Lottie | Acceptable for beta. Lottie polish is a post-launch upgrade pass; not a launch blocker. |
| 9 page edits introduces drift if a 10th heavy page is added later | Document the heavy-page list in a one-line comment above each `variant="rocket"` line OR add a `tools-meta.ts` marker. **Decision: skip the marker — 9 calls is small enough to grep.** |
| Animation jank on low-end mobile | Keyframes use `transform` + `opacity` only (GPU-composited, no layout). Should be smooth on any device that runs 2026 JS. |
| Mobile portrait clipping (rocket too tall) | Rocket SVG is ~140px tall, fits in 12rem (192px) container with margin. Verified during manual testing. |

---

## Open questions

None blocking. If user wants the original phrasing back ("PLEASE STAND BY / Creating your social media journey…"), the change is two strings in one file.
