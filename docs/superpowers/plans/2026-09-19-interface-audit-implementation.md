# Interface Audit — Implementation Plan for Beta

**Date:** 2026-09-19
**Input:** Greybeard interface audit dated 2026-08-17 (20 findings, F01–F20, three-wave fix plan)
**Verified against:** `main` @ `713685c` (identical to `origin/main` and `claude/vigilant-hamilton-juu4a5`), plus every other branch on GitHub
**Verdict:** **None of the 20 findings has been implemented.** All three waves remain open. This plan sequences them into four working sessions ahead of the beta, with one item deliberately deferred to post-beta.

---

## 1. What was checked

| Where | State on 2026-09-19 | Relevance to the audit |
|---|---|---|
| `main` / `origin/main` | `713685c`, 2026-08-20, CI green | Baseline for every check below |
| `codex/phase-0-containment` (GitHub) | `0ad498d`, fully contained in `main` | Database containment only; no UI files |
| `claude/repo-sync-check-vzass3` (GitHub, open [PR #8](https://github.com/iambigd60/PostCrisp/pull/8)) | 2 commits ahead of `main`: Join Beta Test signup form + CodeRabbit fixes, 7 new files | Beta prerequisite, unrelated to the audit; needs a merge decision |
| Commits between the audit (Aug 17) and now | Onboarding charge-safety, first-session redesign, telemetry, Phase 0 database work | None touched a finding. The old 860-line wizard was deleted, which is why some usage counts fell slightly |
| Open GitHub issues | 0 | No tracking of the findings exists |

## 2. Finding-by-finding status

Counts re-measured from source. "Partial" means an incidental improvement, not a fix.

| ID | Finding | Status | Evidence now |
|---|---|---|---|
| F01 | Credit cost never shown before spending | ❌ Open | `CREDITS_PER_TASK` still only imported by `src/lib/credits.ts` and API routes; `ToolMeta` has no cost field; `cta-optimizer/page.tsx:270` "2 credits" and `thumbnail-analyzer/page.tsx:303` "4 credits" still hard-coded; kebab/snake key mismatch unchanged; `media-kit-bio` still priced with no tool |
| F02 | Failed dashboard load renders as empty account with 0 credits | ❌ Open | `dashboard/page.tsx` `load()` catch at line 629 still console-only; `CategoryHub.tsx:61` still `const { data: rows }` with error discarded |
| F03 | Three drifting tool registries; Foundation Analysis missing | ❌ Open | `NAV_GROUPS` (Sidebar.tsx:29), `FEATURE_META` (dashboard/page.tsx:72) and `tools-meta.ts` all still exist; "Best Times" vs "Posting Times" drift still present at dashboard/page.tsx:83; `foundation_analysis` still absent from `FEATURE_META` |
| F04 | Secondary text fails contrast | ❌ Open | `text-zinc-500` 346 uses (was 359), `text-zinc-600` 186 (was 192); `--text-secondary` still referenced by 0 components and not exposed as a Tailwind utility |
| F05 | Card borders invisible | ❌ Open | `border-brand-500/10` 307 uses (was 321); no ≥3:1 border token defined (`--border-strong` is 0.3 alpha, unused by components) |
| F06 | Active nav signalled by colour alone, no `aria-current` | ❌ Open | Sidebar.tsx:178 still `bg-brand-600/20 text-brand-300`; zero `aria-current` |
| F07 | Six recommenders on one dashboard | ❌ Open | `dashboard/page.tsx` now 939 lines (was 916); all blocks present; no click instrumentation on any recommender |
| F08 | 27 nav items, all expanded, no search | ❌ Open | `expandedGroups` defaults to all groups (Sidebar.tsx:102); no palette/search component exists |
| F09 | Collapsed sidebar is unlabelled emoji | ❌ Open | Tool links still have no `title`/`aria-label`; only group toggles and the logo are labelled |
| F10 | Settings/Billing under "Library", no account menu | ❌ Open | Sidebar.tsx:78–83, source comment still concedes it |
| F11 | ~14px disclosure arrow, label navigates instead of expanding | ❌ Open | Sidebar.tsx:267–283 unchanged, `text-zinc-600` arrow |
| F12 | CTA Optimizer, Thumbnail Analyzer, Voice skip the house pattern | ❌ Open | None of the three imports `GenerationLoader` or `InlineError`; duration hint still used only by Foundation Analysis |
| F13 | Foundation Analysis has no copy/save/export; three copy implementations | ❌ Open | No `CopyButton` in foundation-analysis or channel-analysis; `rate-calculator/page.tsx:84` still hand-rolls `navigator.clipboard` |
| F14 | Zero `aria-*` across dashboard pages | 🟡 Partial | 2 of 34 dashboard routes now carry an aria attribute; `generate/page.tsx` has `htmlFor` on topic and audience but not on the three pickers; no skip link; credit ring unlabelled |
| F15 | Typewriter briefing withheld ~3s, interval never cleared | ❌ Open | `TypedBriefing` at dashboard/page.tsx:392; `clearInterval` cleanup still inside the timeout callback (line 412) |
| F16 | Reduced-motion covers 4 of ~20 animations | ❌ Open | `globals.css:426` block unchanged |
| F17 | Three dismiss patterns | ❌ Open | `location.reload()` at dashboard/page.tsx:685; `window.confirm` in GettingStartedCard.tsx:76, NextToolsCard.tsx:127 and also ChannelsSection.tsx:91 |
| F18 | Offline banner covers mobile menu button | ❌ Open | OfflineBanner `fixed top-0 z-[90]`; hamburger `fixed top-3 left-3 z-50` unchanged |
| F19 | Theme colour still violet | ❌ Open | `layout.tsx:35` and `manifest.ts:11` both `#8b5cf6` |
| F20 | Inter loaded twice; unused Geist files | ❌ Open | `globals.css:1` Google Fonts `@import` plus `next/font/google` in layout; `GeistVF.woff` and `GeistMonoVF.woff` still present |

Also not done from the audit's closing section:

- No `@axe-core/playwright` or contrast lint in CI (CI runs lint, typecheck, vitest only).
- No click tracking on the six dashboard recommenders.
- The 1.1 GB untracked `PostCrisp/` duplicate directory is not in the GitHub clone; it can only exist on the local machine. Check for it there and delete it or add it to `.gitignore`.

## 3. How this fits the beta gate

- Phase 0 (database containment) is integrated into `main` but its **operational exit is still blocked** on three items that are not code: the isolated restore drill, Vercel firewall/provider spend evidence, and a valid Three AImigos verdict. The UI work below does not touch the database, billing or auth, so it can proceed on a feature branch in parallel. **Deploying it to production should wait for the Phase 0 exit, or an explicit decision to deploy anyway.**
- The beta is invite-only with no Stripe checkout, but credits are still metered, so F01 (showing cost) is fully relevant to testers.
- The Join Beta Test signup form in PR #8 is a separate beta prerequisite and needs its own review and merge.

## 4. The plan — four working sessions

Each session ends with `npm run lint`, `npm run typecheck`, `npm test` green, a visual check in the browser (the audit never ran the app), and a push to a feature branch. Effort estimates are working days of focused implementation.

### Session A — Stop misleading the user (Wave 1, ~1 day, low risk) — ✅ DONE 2026-09-19

Closes F01, F02, F04, F05, F06. Shipped on `claude/vigilant-hamilton-juu4a5`: `task` + `creditCost` on `ToolMeta` derived from `CREDITS_PER_TASK`; `CreditCost` chip on all 24 generate buttons and every hub card; `useSpendConfirm` dialog on the five 5+-credit tools; orphan `media-kit-bio` price removed; `text-zinc-500/600` → `text-crisp` (532 sites); new `border-edge` token (#5C6E80, 3.2:1) replacing `border-brand-500/5|10|15` (337 sites) with hover/focus borders bumped so they no longer dim; dashboard and hubs show `InlineError` + retry instead of a zero-credit account; sidebar active item has a left-edge bar and `aria-current`. Guard test: `src/lib/__tests__/tools-meta.test.ts`. Visual check: login and landing pages rendered via headless Chromium; authenticated pages still owed a look in production.

1. **Price on every action (F01).**
   - Add `task: CrispTask` and `creditCost: number` to `ToolMeta` in `src/lib/tools-meta.ts`, deriving cost from `CREDITS_PER_TASK` so there is one price table.
   - Add a drift test (pattern: `src/lib/__tests__/tutorial-feature-keys.test.ts`) asserting every tool key maps to a priced task, and every priced task maps to a tool or is explicitly listed as an exception.
   - Render the cost on every `CategoryHub` card and beside every generate button; delete the two hard-coded strings.
   - Confirmation step via the existing `Modal` for any action costing 5 or more credits.
   - Decision needed: `media-kit-bio` is priced but has no tool. Recommend removing it from the price table.
2. **Fix the two failing greys (F04).** Expose `--text-secondary` and `--text-tertiary` as Tailwind utilities, then codemod `text-zinc-500` → `text-secondary` (346 sites) and `text-zinc-600` → `text-secondary` or `text-tertiary` where a user is expected to read it (186 sites). Mechanical; review the diff by page.
3. **Real border token (F05).** Define `--border-card` at roughly 3:1 against `#181E24` (about `rgba(74,158,224,0.35)`), expose it as `border-card`, replace the 307 uses of `border-brand-500/10`.
4. **Dashboard error state (F02).** In `dashboard/page.tsx`, the `load()` catch sets an error; render `InlineError` with retry; never render `CreditMeter` or the stat tiles from null stats. Same in `CategoryHub`: capture the query error and show `InlineError` instead of the empty state.
5. **Current page marker (F06).** `aria-current="page"` and a visible left-edge bar on the active sidebar item.

### Session B — One registry, one tool pattern (~1 day)

Closes F03, F12, F13, F15, F17.

1. **Retire the duplicate registries (F03).** Drive `Sidebar` groups and the dashboard's Recent Content from `tools-meta.ts`; delete `NAV_GROUPS` and `FEATURE_META`. Add `foundation_analysis` and any other missing key to the registry. Extend the drift test from Session A so a registry gap fails CI. Give Dashboard, Polls and the All-time tile distinct icons.
2. **Bring the three outliers onto the house pattern (F12).** CTA Optimizer, Thumbnail Analyzer and Voice Trainer get labelled inputs, `GenerationLoader`, `InlineError` with retry, and the "takes about N s" duration hint. Add the duration hint to every tool that takes more than a few seconds.
3. **Make expensive outputs keepable (F13).** `CopyButton` + Save on Foundation Analysis; `CopyButton` on Channel Analysis; replace the hand-rolled clipboard call in Rate Calculator with `CopyButton`.
4. **Fix the briefing (F15).** Render the briefing instantly; delete `TypedBriefing` or move the interval cleanup into the effect body if the animation is kept.
5. **One dismiss pattern (F17).** Replace `window.confirm` (three components) and `location.reload()` with the existing `Modal` and local state updates; disable the button while the request is in flight.

### Session C — Navigation a person can operate (~1 day)

Closes F08, F09, F10, F11.

1. **Collapsed mode (F09).** `title` and `aria-label` on every icon-only link, and a tooltip on hover. If this proves fiddly, remove the collapse affordance instead.
2. **Account menu (F10).** Move Settings and Billing into an account menu in the sidebar footer that shows the signed-in email; move Logout into it and out of the primary navigation.
3. **Disclosure control (F11).** Make the whole group row the expand/collapse target at a 44px minimum, with a separate small "open hub" link.
4. **Default expansion (F08).** Only the group containing the current page opens by default; everything else collapsed.
5. **Command palette (F08, optional for beta).** Ctrl/Cmd-K search over label, tagline and best-for text from `tools-meta.ts`. Recommend shipping it if Session C finishes early; otherwise first post-beta item.

### Session D — Accessibility sweep, housekeeping, guardrails (~half day)

Closes F14, F16, F18, F19, F20 and adds the checks the audit asked for.

1. **Accessibility (F14).** `htmlFor` on every picker label in the Caption Generator; `role="img"` and an accessible name on the credit ring; `aria-hidden` on decorative emoji; a skip link in `src/app/layout.tsx`.
2. **Reduced motion (F16).** Extend the `prefers-reduced-motion` block to every keyframe animation and gate the typewriter (if kept) behind the same query.
3. **Offline banner (F18).** Push the mobile menu button down by the banner height while the banner is showing.
4. **Theme colour (F19).** `#4A9EE0` in both `layout.tsx` and `manifest.ts`.
5. **Fonts (F20).** Delete the Google Fonts `@import` from `globals.css` and the two Geist files.
6. **Guardrail: accessibility test in CI.** Add `@axe-core/playwright` against five routes (dashboard, generate, foundation-analysis, a hub page, settings) as a CI job. Chromium is already available in the CI image via Playwright.
7. **Guardrail: contrast lint.** An ESLint or grep-based check that fails on new `text-zinc-500`, `text-zinc-600` or `border-brand-500/10` usages.
8. **Instrumentation for Wave 2.** Emit a click event (existing `onboarding-client.ts` emitter pattern) for each of the six recommenders so the post-beta consolidation is decided with data.

### Deferred to post-beta — Dashboard consolidation (F07)

The audit itself says to decide this with data. Ship Session D's instrumentation in the beta, collect two to three weeks of tester clicks, then collapse the six recommenders into one "next best move" block and merge the three duplicate stat tiles. Estimated 1–2 days once the data is in.

## 5. Decisions needed

1. **Proceed with UI work while Phase 0 is blocked?** Recommend yes, on a feature branch, with deployment gated on the Phase 0 exit.
2. **F07 dashboard consolidation:** now, or instrument first and consolidate post-beta? Recommend instrument first (the audit's own advice).
3. **Command palette:** in beta or after? Recommend after, unless Session C runs short.
4. **`media-kit-bio` price entry:** delete it, or build the tool? Recommend delete.
5. **PR #8 (beta signup form):** review and merge before the beta? It is a prerequisite for recruiting testers.
6. **Local machine:** check for the untracked 1.1 GB `PostCrisp/` copy and remove it.

## 6. Exit criteria for the audit work

- All 20 findings closed or explicitly deferred (F07 only), with the finding ID in each commit message.
- Zero uses of `text-zinc-500`, `text-zinc-600`, `border-brand-500/10` in `src/`; `NAV_GROUPS` and `FEATURE_META` deleted.
- `npm run lint`, `npm run typecheck`, `npm test` and the new axe job green in CI.
- Visual check on a laptop viewport and a phone viewport for the dashboard, the sidebar in both modes, and one tool page from each category.
- `PICKUP.md` and `ROADMAP.md` updated with the outcome.
