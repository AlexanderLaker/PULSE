#!/usr/bin/env python3
"""
v3.5 Attenuation Calibration — empirical recalibration on the 99-trend base.

Mirrors the v3.1 methodology documented in docs/Attenuation_Calibration_Methodology.md:
  Step 1: pairwise weighted Jaccard on 12-category exposure vectors
  Step 2: excess-over-baseline transform (noise floor removed)
  Step 3a: asymmetric force-size normalization (cross-force only)
  Step 3b: per-cell additive mechanism adjustments (±0.03 … ±0.10)
  Clamp: within-force ∈ [0.10, 0.45], cross-force ∈ [0.00, 0.45]

Then derives DEFAULT_PER_FORCE_ATTENUATION via:
  eff_att_i = 0.5 × (1 − mean(O[i][j] for j ≠ i))

Outputs
-------
- Console: full before/after table + delta vs v3.1
- JSON:    data/attenuation_calibration_v3_5.json (machine-readable, tracked)
"""
import sys
import json
import itertools
import math
from pathlib import Path
from collections import defaultdict, Counter

# M16 (July 2026 review): repo-relative — the old hardcoded sandbox path
# made this provenance script unrunnable anywhere else.
REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from pulse.seed_trends import get_report_trends
from pulse.config import FORCES, CATEGORIES

trends = get_report_trends()
print(f"Loaded {len(trends)} trends")

by_force = defaultdict(list)
for t in trends:
    by_force[t.force].append(t)

print("\nForce distribution:")
for f in FORCES:
    print(f"  {f:14s}: {len(by_force[f])}")
print(f"  TOTAL        : {sum(len(by_force[f]) for f in FORCES)}")

# ── Step 1 — weighted Jaccard on 12-category vectors ────────────────────
def exposure_vec(t):
    return [t.category_exposure.get(c, 0) for c in CATEGORIES]

def weighted_jaccard(a, b):
    num = sum(min(x, y) for x, y in zip(a, b))
    den = sum(max(x, y) for x, y in zip(a, b))
    return num / den if den else 0.0

vecs = {t.id: exposure_vec(t) for t in trends}

# ── J₀ baseline (random-pair mean J across ALL trends) ─────────────────
all_ids = [t.id for t in trends]
pair_js = []
for a, b in itertools.combinations(all_ids, 2):
    pair_js.append(weighted_jaccard(vecs[a], vecs[b]))
J0 = sum(pair_js) / len(pair_js)
n_pairs = len(pair_js)
print(f"\n=== Baseline ===")
print(f"  n trends       : {len(trends)}")
print(f"  n unique pairs : {n_pairs:,}")
print(f"  J₀ (baseline)  : {J0:.4f}")

# ── Step 2 — excess-over-baseline transform ─────────────────────────────
def excess(jbar):
    return max(0.0, (jbar - J0) / (1.0 - J0))

# ── Within-force raw, excess, final ─────────────────────────────────────
print("\n=== Within-force mean weighted Jaccard ===")
within_raw = {}
within_excess = {}
for f in FORCES:
    fids = [t.id for t in by_force[f]]
    if len(fids) < 2:
        within_raw[f], within_excess[f] = 0.0, 0.0
        continue
    pairs = [weighted_jaccard(vecs[a], vecs[b]) for a, b in itertools.combinations(fids, 2)]
    m = sum(pairs) / len(pairs)
    within_raw[f] = m
    within_excess[f] = excess(m)
    print(f"  {f:14s}  n={len(fids):2d}  mean J={m:.4f}  excess={within_excess[f]:.4f}")

# Mechanism adjustments (same framing as v3.1 — ±0.03 … ±0.10)
# v3.1 rationale retained; newly added v3.5 trends (4) evaluated for impact:
#   consumer_r33  (ultra-fast-fashion) — diversifies Consumer further, keep −0.03
#   technology_r19 (neuro-scents)     — adds to tech innovation cluster, keep +0.05
#   competitive_r14 (AfCFTA)          — geo/competitive independent, keep −0.05
#   government_r14 (PVA regulatory)   — joins Green Deal cluster → strengthens +0.05 case
within_mech = {
    "Consumer":      -0.03,  # v3.1 was -0.03 (diversity); v3.5 r33 adds further diversity
    "Customer":       0.00,  # v3.1 was 0.00 (channel/digital coexist)
    "Technology":    +0.05,  # v3.1 was +0.05 (AI cluster 8 + bio-chem 5 + now neuro-scents in bio-chem)
    "Government":    +0.05,  # v3.1 was +0.05; v3.5 r14 (PVA) is another Green-Deal trend, strengthens cluster
    "Environmental": +0.05,  # v3.1 was +0.05 (climate/water/palm web intact)
    "Competitive":   -0.05,  # v3.1 was -0.05; v3.5 r14 (AfCFTA geo) remains distinct
}

within_final = {}
WITHIN_FLOOR = 0.10
WITHIN_CEIL  = 0.45
for f in FORCES:
    v = within_excess[f] + within_mech[f]
    v = max(WITHIN_FLOOR, min(WITHIN_CEIL, v))
    within_final[f] = round(v, 3)

print("\n=== Within-force FINAL ===")
print(f"  {'force':14s}  {'raw J':>6s}  {'excess':>6s}  {'mech':>5s}  {'FINAL':>5s}")
for f in FORCES:
    print(f"  {f:14s}  {within_raw[f]:.4f}  {within_excess[f]:.4f}  {within_mech[f]:+.2f}   {within_final[f]:.3f}")

# ── Cross-force mean weighted Jaccard (symmetric) ───────────────────────
cross_raw = {i: {j: 0.0 for j in FORCES} for i in FORCES}
for i, j in itertools.combinations(FORCES, 2):
    ids_i = [t.id for t in by_force[i]]
    ids_j = [t.id for t in by_force[j]]
    if not ids_i or not ids_j:
        continue
    pairs = [weighted_jaccard(vecs[a], vecs[b]) for a in ids_i for b in ids_j]
    m = sum(pairs) / len(pairs)
    cross_raw[i][j] = m
    cross_raw[j][i] = m

# Excess-transform
cross_excess = {i: {j: excess(cross_raw[i][j]) if i != j else 0.0 for j in FORCES} for i in FORCES}

# ── Step 3a — asymmetric force-size normalization ───────────────────────
n_force = {f: len(by_force[f]) for f in FORCES}

def asymm_factor(n_i, n_j):
    """
    How much does force j "cover" force i's signal? A broad force (n_j large)
    is more likely to contain i's mechanism than a narrow one.
    """
    return min(1.5, math.sqrt(n_j / n_i))

cross_asymm = {i: {j: 0.0 for j in FORCES} for i in FORCES}
for i in FORCES:
    for j in FORCES:
        if i == j: continue
        cross_asymm[i][j] = cross_excess[i][j] * asymm_factor(n_force[i], n_force[j])

# ── Step 3b — mechanism adjustments (v3.1 cell-level values, retained) ──
# v3.1 mechanism adjustments per cross-force cell. We retain these ±0.03..0.10
# additive deltas because the underlying FMCG causal couplings have not
# changed — only trend count has. Where new v3.5 trends strengthen a
# coupling (e.g., government_r14 PVA reinforces Gov↔Env), the empirical
# raw Jaccard already captures it in Step 1.
cross_mech = {i: {j: 0.0 for j in FORCES} for i in FORCES}
# Strong regulatory-ESG axis (reinforced by government_r14 PVA)
cross_mech["Government"]["Environmental"] = +0.05
cross_mech["Environmental"]["Government"] = +0.05
# Regulation → reformulation R&D
cross_mech["Government"]["Technology"]    = +0.05
cross_mech["Technology"]["Government"]    = +0.05
# Retail tech / channel digital (reinforced by competitive_r04 TikTok-Shop)
cross_mech["Customer"]["Technology"]      = +0.05
cross_mech["Technology"]["Customer"]      = +0.05
# Bio-chem / supply axis
cross_mech["Environmental"]["Technology"] = +0.05
cross_mech["Technology"]["Environmental"] = +0.05
# Consumer ↔ Competitive (dupe/indie bridge, reinforced by consumer_r33 + competitive_r04)
cross_mech["Consumer"]["Competitive"]     = +0.05
cross_mech["Competitive"]["Consumer"]     = +0.05
# Retailer compliance under regulation (NEW v3.5 emphasis: PVA→retailer reformulation)
cross_mech["Customer"]["Government"]      = +0.05
cross_mech["Government"]["Customer"]      = +0.05

# ── Combine and clamp ───────────────────────────────────────────────────
CROSS_FLOOR = 0.00
CROSS_CEIL  = 0.45

cross_final = {i: {j: 0.0 for j in FORCES} for i in FORCES}
for i in FORCES:
    for j in FORCES:
        if i == j: continue
        v = cross_asymm[i][j] + cross_mech[i][j]
        v = max(CROSS_FLOOR, min(CROSS_CEIL, v))
        cross_final[i][j] = round(v, 3)

# ── Print cross-force matrix (final) ────────────────────────────────────
print("\n=== Cross-force overlap FINAL (rows = 'how much of row_force is covered by col_force') ===")
header = f"  {'':14s}  " + "  ".join(f"{f[:5]:>5s}" for f in FORCES)
print(header)
for i in FORCES:
    row = [f"{cross_final[i][j]:.3f}" if i != j else "  -  " for j in FORCES]
    print(f"  {i:14s}  " + "  ".join(f"{r:>5s}" for r in row))

# ── Top-ranked couplings ────────────────────────────────────────────────
flat = []
for i in FORCES:
    for j in FORCES:
        if i == j: continue
        flat.append((i, j, cross_final[i][j], cross_raw[i][j], cross_excess[i][j], cross_asymm[i][j], cross_mech[i][j]))
flat.sort(key=lambda x: -x[2])
print("\n=== Top 12 cross-force couplings (v3.5) ===")
print(f"  {'rank':>4s}  {'from':14s}  {'to':14s}  {'raw J':>6s}  {'excess':>6s}  {'asymm':>6s}  {'mech':>5s}  {'FINAL':>5s}")
for rank, (i, j, fin, raw, ex, asym, mech) in enumerate(flat[:12], 1):
    print(f"  {rank:>4d}  {i:14s}  {j:14s}  {raw:.4f}  {ex:.4f}  {asym:.4f}  {mech:+.2f}   {fin:.3f}")

# ── Per-force effective attenuation ────────────────────────────────────
# eff_att_i = 0.5 × (1 - mean_{j!=i} O[i][j])
per_force_att = {}
row_means = {}
for i in FORCES:
    row = [cross_final[i][j] for j in FORCES if j != i]
    row_mean = sum(row) / len(row)
    row_means[i] = row_mean
    per_force_att[i] = round(0.5 * (1 - row_mean), 3)

print("\n=== Per-force effective attenuation (v3.5) ===")
print(f"  {'force':14s}  {'row mean':>8s}  {'eff_att_NEW':>12s}  {'v3.1':>6s}  {'Δ':>6s}")
v3_1_eff = {
    "Consumer":      0.482,
    "Customer":      0.418,
    "Technology":    0.435,
    "Government":    0.403,
    "Environmental": 0.413,
    "Competitive":   0.486,
}
for f in FORCES:
    d = per_force_att[f] - v3_1_eff[f]
    print(f"  {f:14s}  {row_means[f]:.4f}    {per_force_att[f]:.3f}         {v3_1_eff[f]:.3f}  {d:+.3f}")

# ── Within-force comparison ─────────────────────────────────────────────
v3_1_within = {
    "Consumer":      0.100,
    "Customer":      0.157,
    "Technology":    0.232,
    "Government":    0.426,
    "Environmental": 0.269,
    "Competitive":   0.100,
}
print("\n=== Within-force comparison ===")
print(f"  {'force':14s}  {'v3.5':>6s}  {'v3.1':>6s}  {'Δ':>6s}")
for f in FORCES:
    d = within_final[f] - v3_1_within[f]
    print(f"  {f:14s}  {within_final[f]:.3f}  {v3_1_within[f]:.3f}  {d:+.3f}")

# ── Trend-weighted mean attenuation (sanity check) ─────────────────────
total = sum(n_force[f] for f in FORCES)
tw_mean = sum(n_force[f] * per_force_att[f] for f in FORCES) / total
print(f"\nTrend-weighted mean attenuation: {tw_mean:.4f}  (v3.1 sanity: ≈0.446)")

# ── Persist for downstream code + docs ─────────────────────────────────
out = {
    "calibration_version": "calibrated_v3.5_april2026",
    "n_trends": len(trends),
    "force_counts": n_force,
    "J0_baseline": round(J0, 6),
    "n_unique_pairs": n_pairs,
    "within_force_raw_J": {f: round(within_raw[f], 6) for f in FORCES},
    "within_force_excess": {f: round(within_excess[f], 6) for f in FORCES},
    "within_force_mechanism_adj": within_mech,
    "within_force_final": within_final,
    "cross_force_raw_J": {i: {j: round(cross_raw[i][j], 6) for j in FORCES if j != i} for i in FORCES},
    "cross_force_excess": {i: {j: round(cross_excess[i][j], 6) for j in FORCES if j != i} for i in FORCES},
    "cross_force_asymm": {i: {j: round(cross_asymm[i][j], 6) for j in FORCES if j != i} for i in FORCES},
    "cross_force_mechanism_adj": cross_mech,
    "cross_force_final": cross_final,
    "per_force_effective_attenuation": per_force_att,
    "per_force_row_mean_cross_overlap": {f: round(row_means[f], 6) for f in FORCES},
    "trend_weighted_mean_attenuation": round(tw_mean, 4),
    "v3_1_within_force_final": v3_1_within,
    "v3_1_per_force_effective_attenuation": v3_1_eff,
}
OUT_JSON = REPO / 'data' / 'attenuation_calibration_v3_5.json'
with open(OUT_JSON, 'w') as f:
    json.dump(out, f, indent=2)
print(f"\nWrote {OUT_JSON}")
