#!/usr/bin/env bash
# The category-weighted arithmetic of the Shift Matrix lives in one place,
# lib/shiftMatrix.ts. This check fails when components/, app/ or hooks/
# declare one of its functions again or read the run's category shares
# directly. `npm run lint` runs it, locally and in CI.
set -euo pipefail

fail=0

# 1. No second declaration of a lib/shiftMatrix function, in any style.
if grep -rnE "(function[[:space:]]+(weightedAvg|categoryShares|getYearPercentiles)[[:space:]]*\()|((const|let|var)[[:space:]]+(weightedAvg|categoryShares|getYearPercentiles)[[:space:]]*=)" components app hooks 2>/dev/null; then
  echo "ERROR: a lib/shiftMatrix function is declared again; import it from '@/lib/shiftMatrix'." >&2
  fail=1
fi

# 2. The category shares are read through categoryShares, never indexed inline.
if grep -rn "category_weights_used\[" components app hooks 2>/dev/null; then
  echo "ERROR: the run's category shares are read inline; use categoryShares from '@/lib/shiftMatrix'." >&2
  fail=1
fi

if [ "$fail" -ne 0 ]; then exit 1; fi
echo "Shift Matrix single-source check: OK"
