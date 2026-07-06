#!/usr/bin/env bash
# Review F1 guard: the Layer-C aggregation math must come from lib/shiftMatrix.
# Fails if components/, app/ or hooks/ re-declare one of its exported
# functions. Wired into `npm run lint` so it runs locally and in CI.
#
# M5 (July 2026 review): hardened — the original pattern only matched
# `function weightedAvg(` declarations, so `const weightedAvg = (` and
# inline re-implementations of the weight-resolution body slipped through
# (a divergent copy had accumulated inside ProfitPoolAnalysis2.tsx).
set -euo pipefail

fail=0

# 1. No re-DECLARATION of a lib/shiftMatrix export, in any declaration style.
#    (A thin local `const catWeightFor = (a, b) => resolveCatWeight(...)`
#    binding is allowed; a re-implementation is not — rule 2 catches those.)
if grep -rnE "(function[[:space:]]+(weightedAvg|catWeightFor|getYearPercentiles|computeImpactFractions)[[:space:]]*\()|((const|let|var)[[:space:]]+(weightedAvg|getYearPercentiles|computeImpactFractions)[[:space:]]*=)" components app hooks 2>/dev/null; then
  echo "ERROR: re-declaration of a lib/shiftMatrix function — import from '@/lib/shiftMatrix' instead." >&2
  fail=1
fi

# 2. No inline re-implementation of the weight-resolution rule: any code
#    reading the raw category-weights map directly (the tell-tale
#    `catWeightsRaw[` lookup) must live in lib/shiftMatrix.
if grep -rn "catWeightsRaw\[" components app hooks 2>/dev/null; then
  echo "ERROR: inline category-weight resolution found — use catWeightFor from '@/lib/shiftMatrix'." >&2
  fail=1
fi

if [ "$fail" -ne 0 ]; then exit 1; fi
echo "shiftMatrix single-source guard: OK"
