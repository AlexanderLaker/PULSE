#!/bin/bash
# PRISM v3.4 — Attenuation Recalibration Deploy Script
# ─────────────────────────────────────────────────────
# Stages, commits, and pushes every v3.4-touched file so Vercel rebuilds
# with the new 95-trend calibration baseline.
#
# Run this from Terminal on the user's machine (not in the sandbox).
# OneDrive-sync + sandbox permissions prevent direct in-sandbox git ops.
#
# Prerequisites:
#   - cwd is the repo root containing this script
#   - git remote configured and authenticated
#   - Vercel project linked to the remote (auto-deploy on push)

set -euo pipefail

echo "=================================================="
echo "  PRISM v3.4 Deploy — 95-trend calibration"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=================================================="
echo

# Sanity: are we at the repo root?
if [ ! -d ".git" ]; then
  echo "ERROR: must run from repo root (no .git directory found)"
  exit 1
fi

# Sanity: required files exist
REQUIRED=(
  "pulse/config.py"
  "pulse/config_validation.py"
  "lib/calibration.ts"
  "data/attenuation_calibration_v3_4.json"
  "data/Attenuation_Calibration_v3_4.xlsx"
  "Attenuation_Calibration_Methodology.md"
  "types/config.ts"
  "pulse/dashboard/src/types/config.ts"
  "components/dashboard/SettingsModal.tsx"
  "pulse/dashboard/src/components/SettingsPage.tsx"
  "components/dashboard/ProfitPoolAnalysis2.tsx"
  "components/dashboard/ConsumerJourney2.tsx"
  "pulse/dashboard/src/components/ConsumerJourney.tsx"
  "tests/conftest.py"
  "pulse/simulation/bayesian_mc.py"
  "pulse/dashboard/src/lib/innovations.ts"
  "data/innovations.ts"
  "pulse/seed_trends.py"
  "compute_attenuation_v3_4.py"
  "build_attenuation_xlsx.py"
)

echo "Checking required files…"
MISSING=0
for f in "${REQUIRED[@]}"; do
  if [ ! -f "$f" ]; then
    echo "  ⚠ MISSING: $f"
    MISSING=$((MISSING+1))
  fi
done
if [ $MISSING -gt 0 ]; then
  echo "ERROR: $MISSING required files missing — aborting deploy."
  exit 1
fi
echo "  ✓ all $(echo "${REQUIRED[@]}" | wc -w) required files present"
echo

# Show what will be committed
echo "Files with modifications (git status --short):"
git status --short | head -50
echo
read -p "Proceed with commit + push? [y/N] " -r REPLY
if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
  echo "Aborted by user."
  exit 0
fi

# Stage v3.4 artifacts explicitly
echo
echo "Staging v3.4 artifacts…"
git add \
  pulse/config.py \
  pulse/config_validation.py \
  pulse/seed_trends.py \
  pulse/simulation/bayesian_mc.py \
  lib/calibration.ts \
  types/config.ts \
  pulse/dashboard/src/types/config.ts \
  pulse/dashboard/src/components/SettingsPage.tsx \
  pulse/dashboard/src/components/ConsumerJourney.tsx \
  pulse/dashboard/src/lib/innovations.ts \
  components/dashboard/SettingsModal.tsx \
  components/dashboard/ProfitPoolAnalysis2.tsx \
  components/dashboard/ConsumerJourney2.tsx \
  data/attenuation_calibration_v3_4.json \
  data/innovations.ts \
  Attenuation_Calibration_Methodology.md \
  tests/conftest.py \
  compute_attenuation_v3_4.py \
  build_attenuation_xlsx.py \
  deploy_v3_4.sh

# Excel is gitignored via *.xlsx but this is a versioned deliverable — force-add
git add -f data/Attenuation_Calibration_v3_4.xlsx

echo "Staged files:"
git diff --cached --name-only
echo

COMMIT_MSG="PRISM v3.4 attenuation recalibration on 95-trend base

- Recalibrate DEFAULT_PER_FORCE_ATTENUATION (pulse/config.py, lib/calibration.ts)
    Consumer      0.482 -> 0.495
    Customer      0.418 -> 0.402
    Technology    0.435 -> 0.432
    Government    0.403 -> 0.397
    Environmental 0.413 -> 0.416
    Competitive   0.486 -> 0.479
- J0 random-pair baseline: 0.4846 -> 0.4592 (95-trend base)
- Trend-weighted mean attenuation: 0.4462 -> 0.4492
- attenuation_source enum widened to 3-way
    calibrated_v3.4_april2026 (new default) | calibrated_v3.1_april2026 (legacy) | admin_override
    enforced across Python validator, TS union types, UI defaults, test fixtures
- Add companion Excel data/Attenuation_Calibration_v3_4.xlsx (6 sheets, 180 formulas, 0 errors)
- Extend Methodology doc with Sec.7-11 v3.4 sections (v3.1 Sec.1-6 retained)
- Add 45 missing TREND_CONTEXT entries across ConsumerJourney x2 (catalog now 98 entries)
- Weave Tier-1 v3.4 shortcodes (T-17 Neuro-Scents, C-25 Household Atomisation,
    X-13 Retailer Vertical Integration, G-13 AfCFTA) into stage trendDrivers
- Scrub trailing 82-trend / v3.3 references across UI copy
- Update bayesian_mc fallback, innovations.ts comments

Methodology unchanged - inputs (95 trends vs 82) and derived outputs differ only.
Re-run Monte Carlo post-deploy to refresh profit-pool bands."

echo "Committing…"
git commit -m "$COMMIT_MSG"
echo

echo "Pushing to origin…"
git push origin HEAD
echo

echo "=================================================="
echo "  DEPLOY COMPLETE"
echo "=================================================="
echo "Vercel will rebuild on push webhook. Check progress:"
echo "  https://vercel.com/dashboard"
echo
echo "Next: run Monte Carlo refresh once Vercel is green:"
echo "  python3 -m pulse.simulation.bayesian_mc --config live --iterations 50000"
echo
