#!/bin/bash
# PRISM v3.5 — Attenuation Recalibration Deploy Script (99 trends)
# ─────────────────────────────────────────────────────────────────
# Stages, commits, and pushes every v3.5-touched file so Vercel rebuilds
# with the new 99-trend calibration baseline. This release combines:
#   - four new Gemini-review trends
#     (consumer_r33 Ultra-Fast Beauty, technology_r19 Neuro-Scents,
#      competitive_r14 AfCFTA, government_r14 PVA Unit-Dose Films)
#   - amended competitive_r04 (DTC Disruption → TikTok Shop Pivot)
#   - full re-calibration of per-force attenuation on the 99-trend base
#
# Run this from Terminal on the user's machine (not in the sandbox).
# OneDrive-sync + sandbox permissions prevent direct in-sandbox git ops.

set -euo pipefail

echo "=================================================="
echo "  PRISM v3.5 Deploy — 99-trend calibration"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=================================================="
echo

if [ ! -d ".git" ]; then
  echo "ERROR: must run from repo root (no .git directory found)"
  exit 1
fi

REQUIRED=(
  "pulse/config.py"
  "pulse/config_validation.py"
  "lib/calibration.ts"
  "data/attenuation_calibration_v3_5.json"
  "data/Attenuation_Calibration_v3_5.xlsx"
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
  "compute_attenuation_v3_5.py"
  "build_attenuation_xlsx.py"
  "scripts/run_50k_prod.py"
  "scripts/migrate_prod_to_v3_5.py"
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

# Remove stale v3.4 artifacts (if present — they'll be git-rm'd)
echo "Cleaning up stale v3.4 artifacts…"
for stale in compute_attenuation_v3_4.py data/attenuation_calibration_v3_4.json data/Attenuation_Calibration_v3_4.xlsx deploy_v3_4.sh; do
  if [ -f "$stale" ]; then
    git rm -f "$stale" 2>/dev/null || rm -f "$stale"
    echo "  rm: $stale"
  fi
done
echo

echo "Files with modifications (git status --short):"
git status --short | head -50
echo
read -p "Proceed with commit + push? [y/N] " -r REPLY
if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
  echo "Aborted by user."
  exit 0
fi

echo
echo "Staging v3.5 artifacts…"
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
  data/attenuation_calibration_v3_5.json \
  data/innovations.ts \
  Attenuation_Calibration_Methodology.md \
  tests/conftest.py \
  compute_attenuation_v3_5.py \
  build_attenuation_xlsx.py \
  scripts/run_50k_prod.py \
  scripts/migrate_prod_to_v3_5.py \
  deploy_v3_5.sh \
  claude.md

# Excel is gitignored via *.xlsx but this is a versioned deliverable — force-add
git add -f data/Attenuation_Calibration_v3_5.xlsx

echo "Staged files:"
git diff --cached --name-only
echo

COMMIT_MSG="PRISM v3.5 — 99-trend recalibration + Gemini external review

New trends (+4 from Gemini external review):
  - consumer_r33    Ultra-Fast-Fashion Beauty (Shein/Temu price-floor collapse)
  - technology_r19  Neuro-Scents (functional fragrance, EEG/fMRI-validated)
  - competitive_r14 AfCFTA Pan-African integration
  - government_r14  PVA Unit-Dose Film biodegradability reclassification
Amended: competitive_r04 DTC Disruption -> TikTok Shop Omnichannel Pivot

Recalibrated DEFAULT_PER_FORCE_ATTENUATION (pulse/config.py, lib/calibration.ts):
    force           v3.1     v3.5    delta
    Consumer        0.482    0.495   +0.013
    Customer        0.418    0.401   -0.017
    Technology      0.435    0.434   -0.001
    Government      0.403    0.415   +0.012
    Environmental   0.413    0.418   +0.005
    Competitive     0.486    0.479   -0.007

Matrix-level shifts (82-trend v3.1 -> 99-trend v3.5):
  - J0 random-pair baseline: 0.4846 -> 0.4525 (-0.0321)
  - Trend-weighted mean attenuation: 0.4462 -> 0.4523 (+0.0061)
  - Within-force cohesion: Customer +0.085, Government -0.114,
    Environmental +0.045, Technology -0.026, Consumer/Competitive floored

attenuation_source enum rebumped to 3-way (v3.5 default):
    calibrated_v3.5_april2026 | calibrated_v3.1_april2026 (legacy) | admin_override
    enforced across Python validator, TS union types, UI defaults, test fixtures

Artifacts:
  - data/Attenuation_Calibration_v3_5.xlsx: 6-sheet companion workbook,
    184 formulas, 0 errors
  - data/attenuation_calibration_v3_5.json: machine-readable calibration export
  - compute_attenuation_v3_5.py: reproducible calibration script
  - Methodology doc: Sec.7-11 rewritten as v3.5 (v3.1 Sec.1-6 retained)
  - TREND_CONTEXT catalog: +4 shortcodes (C-33, T-19, X-14, G-14) in both
    ConsumerJourney files (now 102 entries each)

Interim v3.4 calibration (95-trend) was never shipped — superseded by v3.5.
v3.4 artifacts removed from tree.

Re-run Monte Carlo post-deploy to refresh profit-pool bands:
  python3 scripts/run_50k_prod.py"

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
echo "Next steps (in order):"
echo
echo "  1. Sync prod Neon to v3.5 (99 trends, additive upsert):"
echo "       export POSTGRES_URL='postgresql://...@ep-xxx.neon.tech/neondb?sslmode=require'"
echo "       python3 scripts/migrate_prod_to_v3_5.py           # dry-run"
echo "       python3 scripts/migrate_prod_to_v3_5.py --apply   # commit"
echo
echo "  2. Once Vercel is green AND prod Neon has 99 trends,"
echo "     run the 50K Monte Carlo to refresh profit-pool bands:"
echo "       python3 scripts/run_50k_prod.py"
echo
