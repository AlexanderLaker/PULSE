#!/usr/bin/env python3
"""
v3.11 attenuation calibration: recalibration on the 51-driver base
(release 2.11.0, owner ruling O11, September 2026).

Same method as v3.1/v3.5 (docs/Attenuation_Calibration_Methodology.md):
  Step 1: pairwise weighted Jaccard on the 12-category exposure vectors
  Step 2: excess over the random-pair baseline J0 (noise floor removed)
  Step 3a: asymmetric force-size factor sqrt(n_j / n_i), capped at 1.5 (cross-force only)
  Step 3b: additive mechanism adjustments per cell, RE-JUDGED for the 51-driver
           population (owner decision 2026-09-10); every non-zero cell carries
           its reason below and in the JSON
  Clamp: within-force [0.10, 0.45], cross-force [0.00, 0.45]
  eff_att_i = 0.5 x (1 - mean(O[i][j] for j != i))

Also reports the copula validity on the new population: the minimum eigenvalue
of the trend-level correlation matrix implied by DEFAULT_FORCE_CORRELATIONS and
DEFAULT_WITHIN_FORCE_RHO over the 51 drivers (D1 / F6 spectral gate).

Outputs
  console                                  before/after table vs v3.5
  data/attenuation_calibration_v3_11.json  machine-readable, tracked; the
                                           source of the 2.11.0 defaults in
                                           pulse/config.py (tests lock them)
"""
import itertools
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from pulse.seed_trends import get_report_trends  # noqa: E402
from pulse.config import (FORCES, CATEGORIES, build_trend_correlation_matrix,  # noqa: E402
                          DEFAULT_FORCE_CORRELATIONS, DEFAULT_WITHIN_FORCE_RHO)

CALIBRATION_VERSION = "calibrated_v3.11_september2026"
V3_5_JSON = REPO / "data" / "attenuation_calibration_v3_5.json"
OUT_JSON = REPO / "data" / "attenuation_calibration_v3_11.json"

WITHIN_FLOOR, WITHIN_CEIL = 0.10, 0.45
CROSS_FLOOR, CROSS_CEIL = 0.00, 0.45


def weighted_jaccard(a, b):
    num = sum(min(x, y) for x, y in zip(a, b))
    den = sum(max(x, y) for x, y in zip(a, b))
    return num / den if den else 0.0


def asymm_factor(n_i, n_j):
    """How much a broad force j 'covers' a narrow force i's signal."""
    return min(1.5, math.sqrt(n_j / n_i))


# ── Step 3b: mechanism adjustments, re-judged per cell for the 51 drivers ──
# Within-force: mechanism redundancy inside a force (the same margin counted
# by several drivers of one force). Scale ±0.03 … ±0.10, additive on the
# excess; the floor 0.10 keeps light dampening where the excess is zero.
WITHIN_MECH = {
    "Consumer": (0.00, "20 drivers, one mechanism each after the review (duplicated regional lines, "
                       "GLP-1 shedding, longevity claims consolidated); residual premium-hair "
                       "(C-03/C-04/C-07/C-02), value (C-01/C-06/C-11/C-35) and demographic "
                       "(C-05/C-25/C-18/C-34) clusters act on different P&L lines or regions; "
                       "empirical excess 0, floor 0.10 applies, no adjustment"),
    "Customer": (+0.05, "K-01 discounters, K-12 drugstores, K-03 buyer power and K-13 retail media "
                        "all compress the same European trade margin on the same LHC volume; kept "
                        "separate because the channels differ, but the P&L line is one"),
    "Technology": (+0.05, "T-11 AI agents, T-13 generative search and T-08 platform replenishment "
                          "are one digital-intermediation cluster (three of six drivers); the high "
                          "raw overlap also reflects category-broad vectors, so the adjustment stays "
                          "at the v3.5 level"),
    "Government": (+0.05, "six of ten drivers come out of one legislative programme (microplastics, "
                          "PPWR/EPR, EmpCo, EUDR/CSDDD, Detergents Regulation, UWWTD) and G-04, G-16 "
                          "and G-17 stack compliance cost on the same detergent SKUs; the review "
                          "removed the triple count of the packaging stack, the cluster remains"),
    "Environmental": (+0.05, "four COGS-side cost drivers on the same European manufactured volume; "
                             "E-07 energy, E-12 oil feedstock and E-03 carbon move with the same 2026 "
                             "energy shock"),
    "Competitive": (0.00, "four drivers with distinct actors and mechanisms (scale leaders, "
                          "challengers, share windows, salon channel); empirical excess 0, floor "
                          "0.10 applies, no adjustment"),
}

# Cross-force: cell (row i, column j) = how much of force i's signal is also
# carried by force j's drivers. Symmetric judgments unless stated.
CROSS_MECH = {}


def _pair(i, j, delta, reason):
    CROSS_MECH[(i, j)] = (delta, reason)
    CROSS_MECH[(j, i)] = (delta, reason)


_pair("Government", "Environmental", +0.05,
      "E-03 carbon pricing (ETS2, CBAM) is a regulatory instrument; E-01 palm cost sits with "
      "G-06 EUDR; the regulation-plus-ESG cost axis of v3.5 remains")
_pair("Government", "Technology", +0.05,
      "G-02 microplastics, G-03 ingredient restrictions and G-16 film criteria trigger the "
      "reformulation R&D of T-02 bio-based substitution and T-03 formats")
_pair("Customer", "Technology", +0.08,
      "raised from +0.05: retail media now sits in Customer (K-13) and is the same digital-shelf "
      "visibility tax that T-11 AI agents and T-13 generative search impose; K-02 marketplaces "
      "and T-08 platform replenishment are one channel mechanism")
_pair("Environmental", "Technology", +0.05,
      "E-01 palm/lauric cost drives T-02 bio-based substitution; T-03 compaction reduces the "
      "packaging-resin and freight exposure of E-12")
_pair("Consumer", "Competitive", +0.05,
      "C-11 dupes and C-16 China domestic brands are the demand side of X-16 challenger "
      "fragmentation; C-35 mass unit decline is the demand side of X-15 scale-leader escalation")
_pair("Customer", "Government", +0.03,
      "lowered from +0.05: the PVA retailer-reformulation link went with G-14; what remains is "
      "G-15 SNAP retrenchment acting on the discounter shopper of K-01 and retailer compliance "
      "under G-04/G-16 labels")
_pair("Consumer", "Customer", +0.05,
      "new: C-01 private label and K-01 discounters / K-12 drugstores are two faces of one "
      "shift (Aldi and Lidl growth is own-label growth); C-06 trading down feeds the same channels")
_pair("Consumer", "Government", +0.03,
      "new: G-15 SNAP retrenchment and G-08 tariff pass-through hit the same low-income shopper "
      "as C-06; C-34 immigration reversal is a policy-driven demographic")
_pair("Customer", "Competitive", +0.08,
      "new: K-07 pro brands crossing into retail and X-18 salon channel restructuring are one "
      "shift seen from the retail and the salon side; K-04 social commerce and X-16 "
      "social-commerce-native challengers share the channel")
_pair("Technology", "Competitive", +0.03,
      "new: AI productivity (T-01) accrues to the scale leaders of X-15 (the L'Oréal tech "
      "platform lines merged into X-15)")
_pair("Environmental", "Customer", +0.03,
      "new: E-01/E-12 cost pass-through is negotiated against K-03 buyer power; price recovery "
      "is the shared mechanism")
# Deliberately 0: Consumer-Environmental (C-06 and E-12 share the 2026 energy shock but on
# different P&L lines: demand vs COGS; co-movement is the copula's job, not overlap),
# Consumer-Technology, Government-Competitive, Environmental-Competitive.


def main(out_json: Path = OUT_JSON, verbose: bool = True):
    trends = get_report_trends()
    by_force = defaultdict(list)
    for t in trends:
        by_force[t.force].append(t)
    n_force = {f: len(by_force[f]) for f in FORCES}
    say = print if verbose else (lambda *a, **k: None)
    say(f"Loaded {len(trends)} drivers: " + ", ".join(f"{f} {n_force[f]}" for f in FORCES))

    vecs = {t.id: [t.category_exposure.get(c, 0) for c in CATEGORIES] for t in trends}
    ids = [t.id for t in trends]
    pair_js = [weighted_jaccard(vecs[a], vecs[b]) for a, b in itertools.combinations(ids, 2)]
    J0 = sum(pair_js) / len(pair_js)
    say(f"J0 random-pair baseline = {J0:.4f} over {len(pair_js):,} pairs")

    def excess(j):
        return max(0.0, (j - J0) / (1.0 - J0))

    # within-force
    within_raw, within_excess, within_final = {}, {}, {}
    for f in FORCES:
        fids = [t.id for t in by_force[f]]
        pairs = [weighted_jaccard(vecs[a], vecs[b]) for a, b in itertools.combinations(fids, 2)]
        m = sum(pairs) / len(pairs) if pairs else 0.0
        within_raw[f], within_excess[f] = m, excess(m)
        v = within_excess[f] + WITHIN_MECH[f][0]
        within_final[f] = round(max(WITHIN_FLOOR, min(WITHIN_CEIL, v)), 3)

    # cross-force
    cross_raw = {i: {j: 0.0 for j in FORCES} for i in FORCES}
    for i, j in itertools.combinations(FORCES, 2):
        pairs = [weighted_jaccard(vecs[a.id], vecs[b.id]) for a in by_force[i] for b in by_force[j]]
        m = sum(pairs) / len(pairs)
        cross_raw[i][j] = cross_raw[j][i] = m
    cross_excess = {i: {j: (excess(cross_raw[i][j]) if i != j else 0.0) for j in FORCES} for i in FORCES}
    cross_asymm = {i: {j: (cross_excess[i][j] * asymm_factor(n_force[i], n_force[j]) if i != j else 0.0)
                       for j in FORCES} for i in FORCES}
    cross_mech = {i: {j: (CROSS_MECH.get((i, j), (0.0, ""))[0] if i != j else 0.0) for j in FORCES} for i in FORCES}
    cross_final = {i: {j: 0.0 for j in FORCES} for i in FORCES}
    for i in FORCES:
        for j in FORCES:
            if i == j:
                continue
            v = cross_asymm[i][j] + cross_mech[i][j]
            cross_final[i][j] = round(max(CROSS_FLOOR, min(CROSS_CEIL, v)), 3)

    row_means, per_force_att = {}, {}
    for i in FORCES:
        row = [cross_final[i][j] for j in FORCES if j != i]
        row_means[i] = sum(row) / len(row)
        per_force_att[i] = round(0.5 * (1 - row_means[i]), 3)
    tw_mean = sum(n_force[f] * per_force_att[f] for f in FORCES) / len(trends)

    # copula validity on the new population (D1 / F6)
    R = np.asarray(build_trend_correlation_matrix([t.force for t in trends], DEFAULT_WITHIN_FORCE_RHO,
                                                  DEFAULT_FORCE_CORRELATIONS), dtype=float)
    lambda_min = float(np.linalg.eigvalsh(R).min())

    v35 = json.loads(V3_5_JSON.read_text()) if V3_5_JSON.exists() else {}
    v35_within = v35.get("within_force_final", {})
    v35_att = v35.get("per_force_effective_attenuation", {})

    say("\n=== Within-force overlap (raw J -> excess -> mech -> FINAL | v3.5) ===")
    for f in FORCES:
        say(f"  {f:14s} n={n_force[f]:2d}  {within_raw[f]:.4f} -> {within_excess[f]:.4f} "
              f"{WITHIN_MECH[f][0]:+.2f} -> {within_final[f]:.3f} | {v35_within.get(f, float('nan')):.3f}")
    say("\n=== Cross-force overlap FINAL (row covered by column) ===")
    say("  " + " " * 14 + "  ".join(f"{f[:5]:>6s}" for f in FORCES))
    for i in FORCES:
        say(f"  {i:14s}" + "  ".join(f"{cross_final[i][j]:6.3f}" if i != j else "     -" for j in FORCES))
    say("\n=== Per-force effective attenuation (v3.11 | v3.5 | delta) ===")
    for f in FORCES:
        old = v35_att.get(f, float("nan"))
        say(f"  {f:14s} row mean {row_means[f]:.4f}  eff_att {per_force_att[f]:.3f} | {old:.3f} | {per_force_att[f] - old:+.3f}")
    say(f"\nTrend-weighted mean attenuation: {tw_mean:.4f} (v3.5: {v35.get('trend_weighted_mean_attenuation', float('nan'))})")
    say(f"Copula validity on the 51 drivers: lambda_min = {lambda_min:+.4f} "
          f"({'PSD, defaults kept' if lambda_min > 0 else 'NOT PSD: rescale DEFAULT_FORCE_CORRELATIONS'})")

    out = {
        "calibration_version": CALIBRATION_VERSION,
        "base": "51-driver core set, September 2026 review (release 2.11.0, owner ruling O10/O11)",
        "method": "v3.1 methodology: weighted Jaccard on 12-category exposure vectors, excess over J0, "
                  "asymmetric force-size factor (cross-force), per-cell mechanism adjustments re-judged "
                  "for the 51-driver population, clamps within [0.10, 0.45] and cross [0.00, 0.45], "
                  "eff_att = 0.5 x (1 - mean cross-force row overlap)",
        "n_trends": len(trends),
        "force_counts": n_force,
        "J0_baseline": round(J0, 6),
        "n_unique_pairs": len(pair_js),
        "within_force_raw_J": {f: round(within_raw[f], 6) for f in FORCES},
        "within_force_excess": {f: round(within_excess[f], 6) for f in FORCES},
        "within_force_mechanism_adj": {f: WITHIN_MECH[f][0] for f in FORCES},
        "within_force_mechanism_reason": {f: WITHIN_MECH[f][1] for f in FORCES},
        "within_force_final": within_final,
        "cross_force_raw_J": {i: {j: round(cross_raw[i][j], 6) for j in FORCES if j != i} for i in FORCES},
        "cross_force_excess": {i: {j: round(cross_excess[i][j], 6) for j in FORCES if j != i} for i in FORCES},
        "cross_force_asymm": {i: {j: round(cross_asymm[i][j], 6) for j in FORCES if j != i} for i in FORCES},
        "cross_force_mechanism_adj": {i: {j: cross_mech[i][j] for j in FORCES if j != i} for i in FORCES},
        "cross_force_mechanism_reason": {f"{i}->{j}": r for (i, j), (d, r) in sorted(CROSS_MECH.items()) if d},
        "cross_force_final": cross_final,
        "per_force_row_mean_cross_overlap": {f: round(row_means[f], 6) for f in FORCES},
        "per_force_effective_attenuation": per_force_att,
        "trend_weighted_mean_attenuation": round(tw_mean, 4),
        "correlation_lambda_min_51": round(lambda_min, 6),
        "correlation_defaults_kept": bool(lambda_min > 0),
        "v3_5_within_force_final": v35_within,
        "v3_5_per_force_effective_attenuation": v35_att,
        "v3_5_cross_force_final": v35.get("cross_force_final", {}),
    }
    out_json.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    say(f"\nWrote {out_json}")
    return out


if __name__ == "__main__":
    main()
