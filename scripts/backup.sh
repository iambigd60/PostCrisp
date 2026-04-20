#!/usr/bin/env bash
# backup.sh — mechanical "stage everything, commit, push" for backup-only flows.
#
# Use this ONLY when you already have tracker docs updated (or don't need them
# updated) and just want to push current work to GitHub. For full save with
# intelligent doc updates + commit message, use the /save slash command in
# Claude Code instead.

set -euo pipefail

cd "$(dirname "$0")/.."

# ─── Safety: refuse to proceed on main with nothing to commit ──────────────
if [[ -z "$(git status --porcelain)" ]]; then
  echo "✓ Working tree is clean — nothing to back up."
  exit 0
fi

# ─── Safety: bail if any tracked file path looks like a secret ─────────────
SUSPECT=$(git status --porcelain | awk '{print $2}' | grep -iE '\.env$|\.env\.[^.]+$|credential|secret|\.pem$|id_rsa' || true)
if [[ -n "$SUSPECT" ]]; then
  echo "⚠ Possible secret file detected in the pending changes:"
  echo "$SUSPECT"
  echo ""
  read -p "Type 'yes' to continue anyway: " CONFIRM
  if [[ "$CONFIRM" != "yes" ]]; then
    echo "Aborted."
    exit 1
  fi
fi

# ─── Compose commit message ────────────────────────────────────────────────
MSG="${1:-chore: backup $(date +%Y-%m-%d)}"

echo "→ Staging all tracked changes…"
git add -u
git add PICKUP.md ROADMAP.md 2>/dev/null || true

echo "→ Committing: $MSG"
git commit -m "$MSG"

echo "→ Pushing to origin…"
git push

echo ""
echo "✓ Done. Latest commit:"
git log --oneline -1
