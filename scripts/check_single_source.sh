#!/usr/bin/env bash
# The category-weighted aggregation of the Shift Matrix lives in one place,
# lib/shiftMatrix.ts. This check fails when components/, app/ or hooks/
# declare one of its functions again or resolve category weights inline.
# `npm run lint` runs it, locally and in CI.
set -euo pipefail

fail=0

# 1. No second declaration of a lib/shiftMatrix function, in any style. A thin
#    local binding that calls the library (const f = (a, b) => catWeightFor(a, b))
#    is fine; a re-implementation is caught by rule 2.
if grep -rnE "(function[[:space:]]+(weightedAvg|catWeightFor|getYearPercentiles|computeImpactFractions)[[:space:]]*\()|((const|let|var)[[:space:]]+(weightedAvg|getYearPercentiles|computeImpactFractions)[[:space:]]*=)" components app hooks 2>/dev/null; then
  echo "ERROR: a lib/shiftMatrix function is declared again; import it from '@/lib/shiftMatrix'." >&2
  fail=1
fi

# 2. No inline weight resolution: reading the raw category-weights map
#    (catWeightsRaw[...]) belongs in lib/shiftMatrix.
if grep -rn "catWeightsRaw\[" components app hooks 2>/dev/null; then
  echo "ERROR: category weights are resolved inline; use catWeightFor from '@/lib/shiftMatrix'." >&2
  fail=1
fi

if [ "$fail" -ne 0 ]; then exit 1; fi
echo "Shift Matrix single-source check: OK"
