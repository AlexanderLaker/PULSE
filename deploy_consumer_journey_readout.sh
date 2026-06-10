#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Deploy: Consumer Journey — PRISM read-out rewrite
#
# Ships ONLY the rewritten generatePrismAnalysis() in
#   components/dashboard/ConsumerJourney2.tsx
#
# Other working-tree changes (claude.md, InnovationDeepDive.tsx,
# data/innovationImages.ts, scripts/download-images.mjs,
# innovation-photo-review.html, tsconfig.check.tsbuildinfo) are LEFT ALONE.
#
# Run this from your Mac Terminal at the repo root:
#   cd "/Users/alex/Library/CloudStorage/OneDrive-Persönlich/Dokumente/Beruf & Uni/Henkel/Working Files/PROFIT_POOL_ENGINE"
#   chmod +x deploy_consumer_journey_readout.sh
#   ./deploy_consumer_journey_readout.sh
#
# Vercel auto-builds from origin/main.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="/Users/alex/Library/CloudStorage/OneDrive-Persönlich/Dokumente/Beruf & Uni/Henkel/Working Files/PROFIT_POOL_ENGINE"
TARGET_FILE="components/dashboard/ConsumerJourney2.tsx"

cd "$REPO_ROOT"

echo "════════════════════════════════════════════════════════════════"
echo "  Consumer Journey — PRISM read-out rewrite — deploy"
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

# Clear any stale index.lock from OneDrive-sandbox interactions
if [ -f .git/index.lock ]; then
  echo "Clearing stale .git/index.lock"
  rm -f .git/index.lock
fi

# Confirm we're on main
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  echo "ERROR: current branch is '$BRANCH', expected 'main'."
  echo "       Switch with: git checkout main"
  exit 1
fi

# Confirm the target file actually has uncommitted changes
if git diff --quiet -- "$TARGET_FILE"; then
  echo "Nothing to commit in $TARGET_FILE — it is already clean."
  echo "If the file looks right and you want to redeploy, push an empty commit:"
  echo "    git commit --allow-empty -m 'chore: redeploy' && git push"
  exit 0
fi

# Show what we're about to ship — single file only
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

git commit -m "Consumer Journey: tighten PRISM read-out to two sections" \
  -m "Replaces the 4-paragraph templated PRISM Analysis (Trend Mechanism / Henkel Portfolio Position / Competitive Dynamics / Strategic Recommendation) with two focused sections:

1. Summary  — what the entry is + which PRISM forces are moving it, with a
   hard data point pulled from the source trend's description and attributed
   to its trend code (e.g. 'source signal, C-14: …8-10% CAGR'). Per-trend
   descriptions are not duplicated — those already render in the
   'Trend Drivers — Rationale' card directly above.

2. Strategic Evaluation — brand-agnostic effect on HCB (no individual
   Henkel brand names), with named external competitors (P&G, Reckitt/Advent,
   L'Oreal, Olaplex, K18, retail PL, etc.) plus opportunity (white-space-aware)
   and threat (intensity-aware).

Cuts the toolbox phrasing: no Tier 1/2/3 priorities, no '(1) Reformulate
(2) Pivot (3) Managed harvest' option lists, no boilerplate WTP-test closer.

Modal rendering, Impact Summary card, Trend Drivers — Rationale card,
admin edit form, navigation, and all journey data unchanged. Single-file
change in components/dashboard/ConsumerJourney2.tsx."

echo
echo "Pushing to origin/main…"
git push origin main

echo
echo "════════════════════════════════════════════════════════════════"
echo "  Pushed. Vercel will auto-build origin/main."
echo "  Check status: https://vercel.com/dashboard"
echo "  Or run:        vercel ls"
echo "════════════════════════════════════════════════════════════════"
