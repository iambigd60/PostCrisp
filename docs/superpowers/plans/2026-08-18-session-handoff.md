# Session Handoff — 2026-08-18

**Purpose:** resume point after a VS Code restart. Read this first, then `2026-08-17-launch-readiness.md` for the full plan.

**Repo state at save:** `main` @ `085b190`, in sync with `origin/main` (0 ahead / 0 behind).

---

## Immediate next action

**Complete the Supabase MCP OAuth flow.** It did NOT succeed before the restart — only the two OAuth
tools (`authenticate`, `complete_authentication`) were exposed; the real tools (`execute_sql`,
`list_projects`, `list_migrations`) never appeared, meaning the authorization code was never exchanged.

The failure mode: the browser redirects to `http://localhost:3118/callback?code=...`, that page shows a
connection error, and it *looks* finished — but the code still has to be handed back to Claude.

After restart, start a fresh flow (the old code is single-use and short-lived). If the redirect page
errors again, copy the **full URL from the address bar** and pass it to `complete_authentication`.

Scope note: the Supabase MCP token is write-capable (`database:write`, `projects:write`, `secrets:read`,
`environment:write`, `storage:write`). Wave 0 is verification only — keep every production query
read-only and confirm before any write.

---

## Three AImigos — DONE, verified working

- Installed: **`1.1.0-beta.16`**. Local tarball hash `2b694337…f12e4` matches the published GitHub
  release digest.
- Live full-council run `1f39ada9`: `completed`, **APPROVED**, 5/5 provider calls, 0 failures,
  usage `exact`, 64 sec, no files modified.
- Yesterday's three failure modes (`malformed-response`, `provider-failure`, `permission-denied`) are
  all gone.
- Both issues reported against beta.15 are fixed in beta.16: `prerequisites` no longer marks Gemini CLI
  required for an xAI/Grok lineup, and the "Disagreements" heading is now "Council perspectives".

### Skill cleanup (completed)

The legacy `three-aimigos` auto-router is **fully removed**. Renaming its folder had NOT disabled it —
Claude Code keys off the presence of `SKILL.md`, so it was still loading.

Final layout under `~/.claude/skills/`:

```
_aimigos-shared/     data only, no SKILL.md — check-risk.mjs, status.json, log.jsonl, log.md, dashboard/
the-three-aimigos/   the only aimigos skill that loads
```

Deleted: `three-aimigos.disabled/`, `three-aimigos.legacy.disabled/`.
Backups (`~/.claude` is NOT git-tracked):

```
~/.claude/.skill-backups/three-aimigos-legacy-2026-08-18.tar.gz       20K
~/.claude/.skill-backups/dependents-before-repoint-2026-08-18.tar.gz  4.4K
```

Repointed 11 references in `clarify-to-confidence`, `sparring-partner`, `skill-mining` from the dead
`skills/three-aimigos/` path to `skills/_aimigos-shared/`. Also fixed a *live* path resolution in
`dashboard/aimigos-dashboard.mjs` (`join(HOME, '.claude', 'skills', 'three-aimigos')`) that the
string-based find-and-replace missed. Refreshed `status.json` (was stale at codex-cli 0.133.0 /
gemini 0.40.1; actual 0.147.0 / 0.55.1). Corrected stale prose in `clarify-to-confidence` that claimed
a forced-Codex review still fires automatically — it does not; review is now explicit-invocation only.

---

## Wave 0 — 4 of 8 gates cleared

| Gate | Status |
|---|---|
| Keep paid checkout disabled | ⬜ not re-verified this session |
| Sync working tree | ✅ pulled 11 commits → `085b190` |
| Required commits `085b190` + `48fcf33` present | ✅ locally (production side still unverified) |
| All 5 migrations present in tree | ✅ |
| **Reserve-before-generate on every AI route** | ✅ **PASSES** |
| Deployed Vercel commit SHA | ⛔ needs Vercel |
| Live Supabase inspection | ⛔ needs Supabase auth |
| Vercel WAF rules fire | ⛔ needs Vercel |
| Production exploit attempt | ⛔ needs anon-key JWT + prod URL |

### Reserve-before-generate: detailed result

All **23** AI-invoking routes call `checkAuthAndUsage` → `reserveCredits` → `refundCredits`.
Zero unguarded model calls. The plan's concern that it was "just captions" is **unfounded** on
`origin/main`.

Five routes initially flagged are **false positives** — they import `crisp-engine-config` for metadata
and make no model calls: `admin/ai-config`, `admin/analytics`, `admin/feature-access`,
`admin/users/[id]`, `stripe/credit-pack`.

`reserveCredits` fails **closed** on a debit error (returns 503, no generation) — correct posture.

### Remaining production gates (need credentials)

1. **Deployed Vercel SHA** — confirm production runs a commit containing `085b190` and `48fcf33`.
   Vercel MCP tools ARE connected; this can be done without Supabase.
2. **Live Supabase inspection** — `profiles` UPDATE policy + column-level grants for `authenticated`;
   `protect_privileged_profile_columns` trigger definition (does it cover `credits_balance`?);
   `consume_user_credits` body + ACL and **absence of the vulnerable 4-arg overload**; confirm all 5
   migrations actually applied.
3. **Vercel WAF rules** — `src/lib/rate-limit.ts` is deleted and there is no `vercel.json` in the tree,
   so rate limiting lives entirely outside version control and is unverifiable from the repo.
4. **Exploit attempt** — PATCH your own `credits_balance` via REST with an anon-key JWT; it must fail.
   Cannot be done over the Supabase MCP connection: a service-role connection bypasses the exact RLS
   boundary under test. Use curl as an ordinary user.

---

## Open decisions for the user

### 1. Nested `PostCrisp/` directory — actively breaking the build

```
npm run typecheck  →  24 errors
  real src/            0
  nested PostCrisp/   24
```

`tsconfig.json` uses `"include": ["**/*.ts", "**/*.tsx"]`, which sweeps a nested **1.1 GB** independent
git clone pinned at a stale commit (`91db5a9`). Real source is completely clean; every error is a
phantom. Anyone running typecheck sees a red build with no obvious signal that it is fake.

Safe to delete — verified: 0 uncommitted changes, same remote, and `91db5a9` **is an ancestor of
`origin/main`**, so it holds nothing unique. Cheaper reversible alternative: add `PostCrisp` to
`tsconfig.exclude` and `.gitignore`.

**Not yet actioned — awaiting the user's call.**

### 2. Uncommitted work

`.aimigos.json` (new, 371 B) — makes the risk gate fire on billing/AI paths. Verified: flags
`src/lib/stripe*`, `credits*`, `auth-usage*`, `api/stripe/**`, `api/generate/**`, `supabase/**`;
stays quiet on docs/UI. **Not committed or pushed — needs approval.**

Also untracked and unaddressed: `supabase/.gitignore`, `supabase/config.toml` (new since the pull),
`SHA256SUMS.txt` (stale — contains only the beta.15 hash, so `sha256sum -c` now fails confusingly),
`the-three-aimigos-*.tgz` ×3, `.three-aimigos/`, and both plan docs in `docs/superpowers/plans/`.

---

## Correction to carry forward

**Appendix B of `2026-08-17-launch-readiness.md` is obsolete.** It records the AImigos failures as an
open blocker and states the Grok/Visionary alternatives pass never ran. Grok ran cleanly in both
verification runs today, so that pass is now **unblocked** — relevant to the plan's own step 4
(competing credit architectures before committing to Wave 1's transactional RPC design).
