#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Deploy: Consumer Journey — PRISM Analysis bespoke rewrite (254 entries)
#
# Ships ONLY the rewritten PRISM_OVERRIDES dictionary in
#   components/dashboard/ConsumerJourney2.tsx
#
# Other working-tree changes are LEFT ALONE.
#
# Run from your Mac Terminal at the repo root:
#   cd "/Users/alex/Library/CloudStorage/OneDrive-Persönlich/Dokumente/Beruf & Uni/Henkel/Working Files/PROFIT_POOL_ENGINE"
#   chmod +x deploy_prism_overrides.sh
#   ./deploy_prism_overrides.sh
#
# Vercel auto-builds from origin/main.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="/Users/alex/Library/CloudStorage/OneDrive-Persönlich/Dokumente/Beruf & Uni/Henkel/Working Files/PROFIT_POOL_ENGINE"
TARGET_FILE="components/dashboard/ConsumerJourney2.tsx"

cd "$REPO_ROOT"

echo "════════════════════════════════════════════════════════════════"
echo "  Consumer Journey — PRISM Analysis bespoke rewrite — deploy"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "════════════════════════════════════════════════════════════════"
echo

if [ ! -d ".git" ]; then
  echo "ERROR: not a git repo (no .git directory at $REPO_ROOT)"
  exit 1
fi

if [ ! -f "$TARGET_FILE" ]; then
  echo "ERROR: $TARGET_FILE not found"
  exit 1
fi

# Clear any stale index.lock from sandbox interactions
if [ -f .git/index.lock ]; then
  echo "Clearing stale .git/index.lock"
  rm -f .git/index.lock
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  echo "ERROR: current branch is '$BRANCH', expected 'main'."
  echo "       Switch with: git checkout main"
  exit 1
fi

if git diff --quiet -- "$TARGET_FILE"; then
  echo "Nothing to commit in $TARGET_FILE — it is already clean."
  echo "If the file looks right and you want to redeploy, push an empty commit:"
  echo "    git commit --allow-empty -m 'chore: redeploy' && git push"
  exit 0
fi

echo "About to stage and commit ONLY this file:"
echo "    $TARGET_FILE"
echo
echo "Diff stat:"
git diff --stat -- "$TARGET_FILE"
echo
read -r -p "Proceed? [y/N] " ans
if [[ ! "$ans" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

git add -- "$TARGET_FILE"

git commit -m "Consumer Journey: bespoke PRISM Analysis per entry (254 entries)" \
  -m "Rewrites the PRISM Analysis read-out for every Consumer Journey entry.

Replaces the archetype-based generator (which produced near-identical
'Baukasten' output for many tiles) with a curated PRISM_OVERRIDES dictionary
covering all 254 LHC + Hair entries across 21 stages x 2 directions
(expansion / contraction).

Each entry now has a bespoke Summary and Strategic Evaluation:
  - Summary leads with the profit-pool delta, names the specific PRISM trend
    mechanism (T-/C-/G-/K-/E-/X- codes with hard data: regulation dates,
    market sizes, CAGR, share %), brand-agnostic opening.
  - Strategic Evaluation is HCB-specific: anchors a named brand (Persil,
    Vernel, Sil, Schwarzkopf, Gliss, got2b, Taft, Schauma, Syoss,
    Weisser Riese / Spee / all / Purex), names the competitor it is moving
    against (P&G, L'Oreal, Unilever, Reckitt/Advent, Olaplex/K18, etc.),
    and specifies a move with a window.

Constraints per entry:
  - Summary < 100 words (mean 55, max 76)
  - Strategic Evaluation < 100 words (mean 56, max 75)
  - No two entries share sentence shape

generatePrismAnalysis() falls through to the archetype generator when no
override is found, so any future entry still renders cleanly.

Single-file change in components/dashboard/ConsumerJourney2.tsx."

echo
echo "Pushing to origin/main…"
git push origin main

echo
echo "════════════════════════════════════════════════════════════════"
echo "  Pushed. Vercel will auto-build origin/main."
echo "  Check status: https://vercel.com/dashboard"
echo "════════════════════════════════════════════════════════════════"
