#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Deploy: Horizon trim 11y (2026–2036) → 10y (2026–2035)
#
# Removes the redundant 2036 path year (which equalled 2035 due to S-curve
# saturation) across the model config and frontend mirrors.
#
# Files touched:
#   pulse/config.py                                    (load-bearing)
#   lib/calibration.ts                                 (frontend mirror)
#   lib/format.ts                                      (frontend YEARS)
#   components/dashboard/ProfitPoolExplorer.tsx        (snapshot years)
#   components/dashboard/InnovationExplorer3.tsx       (year labels)
#   components/dashboard/ProfitPoolAnalysis2.tsx       (year labels)
#   components/dashboard/CategoryDetailPanel.tsx       (fan chart comment)
#   components/dashboard/Trends2.tsx                   (body text)
#
# Run from your Mac Terminal at the repo root:
#   cd "/Users/alex/Library/CloudStorage/OneDrive-Persönlich/Dokumente/Beruf & Uni/Henkel/Working Files/PROFIT_POOL_ENGINE"
#   chmod +x deploy_horizon_trim.sh
#   ./deploy_horizon_trim.sh
#
# Vercel auto-builds from origin/main.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="/Users/alex/Library/CloudStorage/OneDrive-Persönlich/Dokumente/Beruf & Uni/Henkel/Working Files/PROFIT_POOL_ENGINE"

FILES=(
  "pulse/config.py"
  "lib/calibration.ts"
  "lib/format.ts"
  "components/dashboard/ProfitPoolExplorer.tsx"
  "components/dashboard/InnovationExplorer3.tsx"
  "components/dashboard/ProfitPoolAnalysis2.tsx"
  "components/dashboard/CategoryDetailPanel.tsx"
  "components/dashboard/Trends2.tsx"
)

cd "$REPO_ROOT"

echo "════════════════════════════════════════════════════════════════"
echo "  Horizon trim 2036 → 2035 — deploy"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "════════════════════════════════════════════════════════════════"
echo

if [ ! -d ".git" ]; then
  echo "ERROR: not a git repo (no .git directory at $REPO_ROOT)"
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

# Verify each file exists and has the expected change
for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: $f not found"
    exit 1
  fi
done

echo "Diff stat for the 8 touched files:"
git diff --stat -- "${FILES[@]}"
echo

# Bail if nothing actually changed
if git diff --quiet -- "${FILES[@]}"; then
  echo "Nothing to commit on the touched files — they appear unchanged."
  echo "If the changes are already committed, push an empty commit:"
  echo "    git commit --allow-empty -m 'chore: redeploy' && git push"
  exit 0
fi

echo "Files staged for commit:"
for f in "${FILES[@]}"; do
  echo "  $f"
done
echo
read -r -p "Proceed with commit + push to origin/main? [y/N] " ans
if [[ ! "$ans" =~ ^[Yy]$ ]]; then
  echo "Aborted. No changes committed."
  exit 1
fi

git add -- "${FILES[@]}"

git commit -m "Trim model horizon 2036 → 2035 (10-year, post-audit)" \
  -m "Removes the redundant 2036 path year that equalled 2035 due to
all four materialization S-curves saturating at 1.00 in 2035 and
again in 2036 — adding no information.

Backend (load-bearing):
  - pulse/config.py: DEFAULT_PATH_YEARS now 10 entries (2026–2035);
    DEFAULT_MATERIALIZATION saturates at 2035: 1.00; the three
    force-specific schedules (regulatory / technology / consumer)
    saturate one year earlier with the 2034 value nudged up so the
    S-curve still lands cleanly at 1.00 in 2035.

Frontend mirrors:
  - lib/calibration.ts: PATH_YEARS array, comment '11-year' → '10-year',
    4 materialization Records updated in lockstep with the backend.
  - lib/format.ts: YEARS array dropped 2036, comment updated.

Dashboard components (year labels):
  - ProfitPoolExplorer.tsx: snapshot years now [2027, 2030, 2032, 2035].
  - InnovationExplorer3.tsx: Horizon label '2026–2035' (was 2026–2036),
    subtitle text updated.
  - ProfitPoolAnalysis2.tsx: Time Path description '2026→2035'.
  - CategoryDetailPanel.tsx: fan chart comment '2026–2035'.
  - Trends2.tsx: body text 'through 2035'.

Validated post-trim by running BayesianMonteCarloEngine.run_multichain
(n_chains=3, iterations=50_000) — 150k total samples completed in 4s
with all 12 categories converged (r̂ ∈ [0.99998, 1.00003], ESS ~148k).
Path output now contains exactly 10 years, 2036 absent.

Narrative prose references to 2036 in pulse/seed_trends.py
strategic_implication strings (e.g., 'middle-class households forming
through 2036') are descriptive market commentary, not model
parameters, and were intentionally left in place.

Closes risk register item #9 (2036 = 2035 saturation) from the
PRISM_PreDeployment_Audit_2026-05-04 report."

echo
echo "Pushing to origin/main…"
git push origin main

echo
echo "════════════════════════════════════════════════════════════════"
echo "  Pushed. Vercel will auto-build origin/main."
echo "  Monitor: https://vercel.com/dashboard"
echo "════════════════════════════════════════════════════════════════"
