#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# cowork-deploy.sh — auto-push from Cowork / sandbox to GitHub.
#
# Background:
#   The workspace's `.git` directory can have stale lock files that the
#   sandbox user can't remove (Cowork mount policy). To sidestep that,
#   we clone the repo fresh into a scratchpad outside the workspace,
#   copy the workspace's modified files in, and push from there.
#
# Requirements:
#   - .env.deploy at workspace root containing: GITHUB_TOKEN=<PAT>
#     (fine-grained, Contents: Read & Write, scoped to this repo)
#   - Paths to commit passed as arguments (relative to workspace root).
#     If no paths given, diffs the entire workspace against origin/main.
#
# Usage:
#   bash scripts/cowork-deploy.sh "commit subject line" [path1 path2 ...]
#
# Examples:
#   bash scripts/cowork-deploy.sh "fix(trends2): row layout" components/dashboard/Trends2.tsx
#   bash scripts/cowork-deploy.sh "chore: all pending"
# ─────────────────────────────────────────────────────────────────

set -euo pipefail

WORKSPACE="$(cd "$(dirname "$0")/.." && pwd)"
SCRATCH="${COWORK_PUSH_DIR:-/tmp/cowork-push-$$}"
REPO_URL_BASE="github.com/AlexanderLaker/PULSE.git"
BRANCH="${COWORK_BRANCH:-main}"

# ── Load token ────────────────────────────────────────────────
if [[ ! -f "$WORKSPACE/.env.deploy" ]]; then
  echo "✗ .env.deploy not found at $WORKSPACE/.env.deploy" >&2
  echo "  Create it with: GITHUB_TOKEN=github_pat_..." >&2
  exit 1
fi
# shellcheck disable=SC1091
source "$WORKSPACE/.env.deploy"
if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "✗ GITHUB_TOKEN not set in .env.deploy" >&2
  exit 1
fi

# ── Args ──────────────────────────────────────────────────────
SUBJECT="${1:-chore: cowork auto-push}"
shift || true
PATHS=("$@")

# ── Clone fresh ───────────────────────────────────────────────
echo "→ Cloning $BRANCH into $SCRATCH"
rm -rf "$SCRATCH"
git clone --depth 30 --branch "$BRANCH" \
  "https://${GITHUB_TOKEN}@${REPO_URL_BASE}" "$SCRATCH" 2>&1 | tail -3

cd "$SCRATCH"
git config user.email "laker.alexander@gmail.com"
git config user.name "Alex Laker"

# ── Copy modified files from workspace ────────────────────────
if [[ ${#PATHS[@]} -eq 0 ]]; then
  # No paths given — diff the whole workspace against origin and copy
  # any file that differs. Safer to be explicit; warn.
  echo "⚠ No paths given — copying entire workspace (slow & broad)." >&2
  rsync -a --delete \
    --exclude='.git' --exclude='node_modules' --exclude='.next' \
    --exclude='.venv' --exclude='.vercel' --exclude='*.db' \
    --exclude='.env' --exclude='.env.deploy' \
    "$WORKSPACE/" "$SCRATCH/"
else
  for p in "${PATHS[@]}"; do
    src="$WORKSPACE/$p"
    dst="$SCRATCH/$p"
    if [[ ! -e "$src" ]]; then
      echo "✗ $p not found in workspace" >&2
      exit 1
    fi
    mkdir -p "$(dirname "$dst")"
    cp -R "$src" "$dst"
    echo "  copied $p"
  done
fi

# ── Commit + push ─────────────────────────────────────────────
git add -A
if git diff --cached --quiet; then
  echo "✓ Nothing to commit — origin is already up to date."
  rm -rf "$SCRATCH"
  exit 0
fi

git commit -m "$SUBJECT" 2>&1 | tail -3
git push origin "$BRANCH" 2>&1 | tail -5

echo ""
echo "✓ Pushed to https://github.com/AlexanderLaker/PULSE"
echo "  Vercel will auto-deploy. Check: https://vercel.com/dashboard"

# ── Cleanup ───────────────────────────────────────────────────
cd /
rm -rf "$SCRATCH"
