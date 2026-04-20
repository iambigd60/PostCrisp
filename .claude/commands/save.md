---
description: Full save — update tracker docs, commit, and push to GitHub
---

Do a full save of the current session's work. Execute these steps in order:

## 1. Inspect what changed
Run in parallel:
- `git status` (no `-uall` flag)
- `git diff` (unstaged)
- `git diff --cached` (staged)
- `git log --oneline -5` (for commit message style)

## 2. Safety scan
Before doing anything else, search for common secret patterns in the pending changes: API keys (sk-, xoxb-, AKIA, eyJ… JWTs > 100 chars), passwords, private keys. If you find anything suspicious, **stop and ask the user** before continuing — don't commit it.

## 3. Update tracker docs

**PICKUP.md** — rewrite the "Last updated" date, "What this session shipped" section, "Status snapshot" table, and "Next session" options to reflect what actually changed in this session. Keep the "SQL migrations run" and "Known issues / punchlist" and "Manual setup pending" sections current. Trim stale content.

**ROADMAP.md** — if any items marked ⏳ or 📋 were completed, change to ✅ and add the completion date (today). If new work surfaced, add it in the appropriate section. Don't rewrite sections that haven't changed.

Only touch these files if there's actual work to record. Small/no-op sessions skip doc updates and just commit code.

## 4. Stage & commit
- `git add` the specific files changed (avoid `-A`/`.`)
- Write a commit message following the existing style: `feat:` / `fix:` / `docs:` / `chore:` / `refactor:` / `perf:` prefix, concise title (<72 chars), optional body with bullet points. Focus on the **why**, not a file list.
- Commit with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer via HEREDOC

## 5. Push
- `git push` (origin/main is already tracking)
- Confirm success with `git status` + `git log --oneline -3`

## 6. Summary
Tell the user in 2-3 sentences: commit hash, files changed, and the GitHub URL of the new commit (`https://github.com/iambigd60/PostCrisp/commit/<hash>`).

Be fast. Don't narrate every step — just get it done.
