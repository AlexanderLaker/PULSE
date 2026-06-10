#!/usr/bin/env bash
# Review F1 guard: the Layer-C aggregation math must come from lib/shiftMatrix.
# Fails if components/, app/ or hooks/ re-declare one of its exported functions.
# Wired into `npm run lint` so it runs locally and in the CI frontend job.
set -euo pipefail
if grep -rnE "function (weightedAvg|catWeightFor|getYearPercentiles|computeImpactFractions)[[:space:]]*\(" components app hooks 2>/dev/null; then
  echo "ERROR: inline copy of a lib/shiftMatrix function found — import from '@/lib/shiftMatrix' instead." >&2
  exit 1
fi
echo "shiftMatrix single-source guard: OK"
