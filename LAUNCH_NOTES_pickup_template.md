# Task 16 — PICKUP.md Session 17 shipped section (TEMPLATE)

**Usage:** Sunday evening 2026-05-03 (post-wave). Replace every `{{PLACEHOLDER}}` with real numbers/notes. Then:
1. In `PICKUP.md`, replace the existing `## 🟡 Session 17 — IN PROGRESS — Beta launch readiness brainstorm + NDA → beta v1.1` section (currently lines 11-75ish) with the rendered version below.
2. Update the file header (lines 3-7): bump `Last updated:`, change `Build status:` to reflect main being current with merge `df47019`, change `Pre-launch status:` to `Post-wave status:`.
3. `git add PICKUP.md && git commit -m "docs: session 17 shipped — beta wave 1 launched"` and push.

This file is untracked operational scratch — delete after pasting into PICKUP.md.

---

## Session 17 shipped — Beta Wave 1 launched

**{{N}} testers invited, {{M}} accepted, {{K}} ran Foundation Analysis end-to-end.** Soft cutover B held — Saturday canary clean, Sunday wave-blast went green / required {{rollback or extension}} (delete what doesn't apply).

### 📋 What shipped to production

- Foundation Analysis (Elite-only) with saved Creator Profile + downstream injection into Captions / Viral Ideas / Bio Optimizer
- Team tier dropped (3-tier ladder: Starter / Creator / Elite)
- NDA bumped 1.0 → 1.1 (alpha → beta language)
- Foundation Analysis added to dashboard + demo sidebars (icon 🏛️, Optimize group)
- `previewSnapshotUrl` deferred (paywall preview screenshot pending — Task 2 follow-up)
- Beta tester feedback focus doc (`docs/beta-tester-feedback-focus.md`)
- Beta launch readiness spec + plan (`docs/superpowers/specs|plans/2026-05-01-*`)
- Merged on 2026-05-01 as `df47019` (`merge: foundation-analysis branch`)

### 🎯 Wave success criteria — actuals

| Criterion | Target | Actual | Status |
|---|---|---|---|
| Invite redemption rate | ≥80% | {{X}}% ({{M}}/{{N}}) | ✅/❌ |
| Tutorial completion | ≥50% | {{X}}% | ✅/❌ |
| Sentry error rate | ≤2× baseline | {{baseline → peak}} | ✅/❌ |
| Invite-code race conditions | 0 | {{count}} | ✅/❌ |
| FA → downstream coherence | ≥2 testers | {{count}} testers ran FA + downstream tool | ✅/❌ |
| Anthropic spend | <$20 | ${{X}} | ✅/❌ |
| NDA-acceptance regressions | 0 | {{count}} | ✅/❌ |
| No critical regression rollback | true | true / false (rolled back at {{when}}) | ✅/❌ |

### 🛠 Rollback events

{{None — delete this section if no rollbacks. Otherwise document each:}}
- **When:** {{Sat HH:MM PT}}
- **Trigger:** {{which backout criterion fired}}
- **Action:** Promoted previous Vercel deployment ({{prev-deploy-id}}); reverted merge `df47019` on main with `git revert -m 1`
- **Comms:** {{X}} canary testers notified; resumed {{when}} after fix

### 💬 Top 3 actionable feedback themes

1. **{{Theme}}** — {{N}} testers mentioned. Action: {{ship-now / queue / no-action}}
2. **{{Theme}}** — {{N}} testers mentioned. Action: {{...}}
3. **{{Theme}}** — {{N}} testers mentioned. Action: {{...}}

### 🚀 What ships next based on feedback

- **{{Item}}** — drives from feedback theme {{1/2/3}}; estimated effort {{S/M/L}}
- **{{Item}}** — {{...}}
- **{{Item}}** — {{...}}

### 📋 Manual follow-ups still pending

1. **Capture FA paywall preview screenshot** (`public/foundation-analysis-preview.png`, 1600×900) and re-add `previewSnapshotUrl` prop in `src/app/dashboard/foundation-analysis/page.tsx` (commit `f44f5e8` removed it temporarily). Without the prop the paywall renders cleanly without a preview image — adding it back lifts the upgrade signal for Starter / Creator users
2. **{{`og:image`}}** — production `<meta property="og:image">` not configured; social shares of `postcrisp.com` render text-only. 1200×630 image + 2 lines in `src/app/layout.tsx` `openGraph` config
3. **{{theme-color}}** — `src/app/layout.tsx:35` still `#8b5cf6` (purple, pre-brand-refresh). Update to Gunmetal `#0E1216` (matches page bg)
4. **{{Other items surfaced during the wave}}**

### 🛠 Process notes

- {{Pacing observations: was the soft cutover the right call? Did the canary catch anything the cold walkthrough missed?}}
- {{What slowed the launch? — e.g. screenshot deferral, env var verification, etc.}}
- {{Did honest pushback save anything? — chatbot deferral, hard-cutover rejection, scope discipline}}
