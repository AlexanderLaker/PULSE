"""Derive the overlap correction (attenuation and overlap matrices) from the driver base.

Some mechanisms are carried by more than one driver or force: a packaging
levy is a Government and an Environmental matter, and discounters, drugstores
and buyer power compress one trade margin. The overlap correction keeps such a
mechanism from being counted twice. It is structured judgment built on the
drivers' category exposure vectors, not a fit to outcomes:

  1. pairwise weighted Jaccard similarity of the 13-category exposure vectors
  2. excess over the random-pair baseline J0, so shared breadth alone is noise
  3. cross-force only: an asymmetric force-size factor sqrt(n_j / n_i), capped at 1.5
  4. an additive mechanism adjustment per cell, each with its written reason below
  5. clamps: within-force [0.10, 0.45], cross-force [0.00, 0.45]

and per force the attenuation is 0.5 x (1 - the mean of the force's row in the
cross-force matrix over the five other forces). The script also reports the minimum eigenvalue of the
driver-level copula correlation matrix the default correlations imply on this
driver base; it must stay positive.

The result depends on the exposure space, so re-run the script whenever the
taxonomy or the exposure scores change, copy the three blocks it prints into
prism/config.py and give the new record its own CALIBRATION_VERSION.

    python3 scripts/compute_attenuation.py           write the record, print the blocks for prism/config.py
    python3 scripts/compute_attenuation.py --check   exit 1 if the record or prism/config.py is out of date

Output: data/calibration/attenuation.json (tests/test_calibration.py holds
the constants in prism/config.py to it).
"""
import argparse
import itertools
import json
import math
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from prism.config import (FORCES, CATEGORIES, build_driver_correlation_matrix,  # noqa: E402
                          DEFAULT_FORCE_CORRELATIONS, DEFAULT_WITHIN_FORCE_RHO)
from scripts.generate_seed import base_drivers  # noqa: E402

CALIBRATION_VERSION = "overlap-correction-2026-09"
OUT_JSON = REPO / "data" / "calibration" / "attenuation.json"

WITHIN_FLOOR, WITHIN_CEIL = 0.10, 0.45
CROSS_FLOOR, CROSS_CEIL = 0.00, 0.45


def weighted_jaccard(a, b):
    num = sum(min(x, y) for x, y in zip(a, b))
    den = sum(max(x, y) for x, y in zip(a, b))
    return num / den if den else 0.0


def asymm_factor(n_i, n_j):
    """How much a broad force j 'covers' a narrow force i's signal."""
    return min(1.5, math.sqrt(n_j / n_i))


# ── Mechanism adjustments ─────────────────────────────────────────────────
# Within a force: redundancy of mechanism among the force's own drivers (the
# same margin counted by several of them). Additive on the excess, in steps of
# a few hundredths; the floor of 0.10 keeps light dampening where the excess is 0.
WITHIN_MECH = {
    "Consumer": (0.00, "20 drivers with one mechanism each; the premium-hair (C-03, C-04, C-07, C-02), "
                       "value (C-01, C-06, C-11, C-35) and demographic (C-05, C-25, C-18, C-34) clusters "
                       "act on different P&L lines or regions; the excess is 0 and the floor of 0.10 "
                       "applies without adjustment"),
    "Customer": (+0.05, "K-01 discounters, K-12 drugstores, K-03 buyer power and K-13 retail media all "
                        "compress the same European trade margin on the same LHC volume; the channels "
                        "differ, so they are separate drivers, but the P&L line is one"),
    "Technology": (+0.05, "T-11 AI agents, T-13 generative search and T-08 platform replenishment form one "
                          "digital-intermediation cluster (three of six drivers); the high raw overlap also "
                          "reflects category-broad exposure vectors, so the adjustment stays moderate"),
    "Government": (+0.05, "six of ten drivers come out of one European legislative programme (microplastics, "
                          "PPWR/EPR, EmpCo, EUDR/CSDDD, Detergents Regulation, UWWTD), and G-04, G-16 and "
                          "G-17 stack compliance cost on the same detergent SKUs"),
    "Environmental": (+0.05, "four COGS-side cost drivers on the same European manufactured volume; E-07 "
                             "energy, E-12 oil feedstock and E-03 carbon move with the same 2026 energy shock"),
    "Competitive": (0.00, "four drivers with distinct actors and mechanisms (scale leaders, challengers, share "
                          "windows, salon channel); the excess is 0 and the floor of 0.10 applies without "
                          "adjustment"),
}

# Across forces: cell (i, j) is how much of force i's signal force j's drivers
# also carry. The judgments below are symmetric.
CROSS_MECH = {}


def _pair(i, j, delta, reason):
    CROSS_MECH[(i, j)] = (delta, reason)
    CROSS_MECH[(j, i)] = (delta, reason)


_pair("Government", "Environmental", +0.05,
      "E-03 carbon pricing (ETS2, CBAM) is a regulatory instrument and E-01 palm cost sits with G-06 "
      "EUDR: regulation and environmental cost share one axis")
_pair("Government", "Technology", +0.05,
      "G-02 microplastics, G-03 ingredient restrictions and G-16 film criteria trigger the reformulation "
      "R&D of T-02 bio-based substitution and T-03 formats")
_pair("Customer", "Technology", +0.08,
      "retail media (K-13) is the same digital-shelf visibility tax that T-11 AI agents and T-13 "
      "generative search impose, and K-02 marketplaces and T-08 platform replenishment are one channel "
      "mechanism")
_pair("Environmental", "Technology", +0.05,
      "E-01 palm and lauric cost drives T-02 bio-based substitution; T-03 compaction reduces the "
      "packaging-resin and freight exposure of E-12")
_pair("Consumer", "Competitive", +0.05,
      "C-11 dupes and C-16 China domestic brands are the demand side of X-16 challenger fragmentation; "
      "C-35 mass unit decline is the demand side of X-15 scale-leader escalation")
_pair("Customer", "Government", +0.03,
      "G-15 SNAP retrenchment acts on the discounter shopper of K-01, and retailers carry the label "
      "compliance of G-04 and G-16")
_pair("Consumer", "Customer", +0.05,
      "C-01 private label and K-01 discounters and K-12 drugstores are two faces of one shift (Aldi and "
      "Lidl growth is own-label growth); C-06 trading down feeds the same channels")
_pair("Consumer", "Government", +0.03,
      "G-15 SNAP retrenchment and G-08 tariff pass-through hit the same low-income shopper as C-06; "
      "C-34 immigration reversal is a policy-driven demographic")
_pair("Customer", "Competitive", +0.08,
      "K-07 professional brands crossing into retail and X-18 salon channel restructuring are one shift "
      "seen from the retail and the salon side; K-04 social commerce and X-16 social-commerce-native "
      "challengers share the channel")
_pair("Technology", "Competitive", +0.03,
      "AI productivity (T-01) accrues to the scale leaders of X-15")
_pair("Environmental", "Customer", +0.03,
      "E-01 and E-12 cost pass-through is negotiated against K-03 buyer power; price recovery is the "
      "shared mechanism")
# Deliberately 0: Consumer-Environmental (C-06 and E-12 share the 2026 energy
# shock but on different P&L lines, demand against COGS; co-movement is the
# copula's job, not the overlap correction's), Consumer-Technology,
# Government-Competitive, Environmental-Competitive.


def compute(out_json: Path = OUT_JSON, verbose: bool = True) -> dict:
    """Derive the record from the driver base, write it to out_json and return it."""
    drivers = base_drivers()
    by_force = defaultdict(list)
    for t in drivers:
        by_force[t.force].append(t)
    n_force = {f: len(by_force[f]) for f in FORCES}
    say = print if verbose else (lambda *a, **k: None)
    say(f"Loaded {len(drivers)} drivers: " + ", ".join(f"{f} {n_force[f]}" for f in FORCES))

    vecs = {t.id: [t.category_exposure.get(c, 0) for c in CATEGORIES] for t in drivers}
    ids = [t.id for t in drivers]
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
    dw_mean = sum(n_force[f] * per_force_att[f] for f in FORCES) / len(drivers)

    # the default copula correlations must stay positive definite on this base
    R = np.asarray(build_driver_correlation_matrix([t.force for t in drivers], DEFAULT_WITHIN_FORCE_RHO,
                                                  DEFAULT_FORCE_CORRELATIONS), dtype=float)
    lambda_min = float(np.linalg.eigvalsh(R).min())

    say("\n=== Within-force overlap (raw J -> excess -> adjustment -> final) ===")
    for f in FORCES:
        say(f"  {f:14s} n={n_force[f]:2d}  {within_raw[f]:.4f} -> {within_excess[f]:.4f} "
            f"{WITHIN_MECH[f][0]:+.2f} -> {within_final[f]:.3f}")
    say("\n=== Cross-force overlap, final (row carried by column) ===")
    say("  " + " " * 14 + "  ".join(f"{f[:5]:>6s}" for f in FORCES))
    for i in FORCES:
        say(f"  {i:14s}" + "  ".join(f"{cross_final[i][j]:6.3f}" if i != j else "     -" for j in FORCES))
    say("\n=== Per-force attenuation ===")
    for f in FORCES:
        say(f"  {f:14s} row mean {row_means[f]:.4f}  attenuation {per_force_att[f]:.3f}")
    say(f"\nDriver-weighted mean attenuation: {dw_mean:.4f}")
    say(f"Copula correlation matrix on the {len(drivers)} drivers: lambda_min = {lambda_min:+.4f} "
        f"({'positive definite' if lambda_min > 0 else 'NOT positive definite: rescale DEFAULT_FORCE_CORRELATIONS'})")

    out = {
        "generated_by": "scripts/compute_attenuation.py",
        "calibration_version": CALIBRATION_VERSION,
        "method": ("Weighted Jaccard on the 13-category exposure vectors, excess over the random-pair "
                   "baseline J0, asymmetric force-size factor across forces, per-cell mechanism "
                   "adjustments with written reasons, clamps within [0.10, 0.45] and across "
                   "[0.00, 0.45]; attenuation = 0.5 x (1 - mean overlap with the five other forces)"),
        "n_drivers": len(drivers),
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
        "driver_weighted_mean_attenuation": round(dw_mean, 4),
        "correlation_lambda_min": round(lambda_min, 6),
    }
    out_json.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    say(f"\nWrote {out_json}\n\nThe blocks for prism/config.py:\n")
    say(config_literals(out))
    return out


def config_literals(record: dict) -> str:
    """The three constants of prism/config.py, formatted as they appear there."""
    width = max(len(f) for f in FORCES) + 6  # the quoted name, the colon and three spaces
    lines = []
    for name, key in (("DEFAULT_PER_FORCE_ATTENUATION", "per_force_effective_attenuation"),
                      ("DEFAULT_WITHIN_FORCE_OVERLAP", "within_force_final")):
        lines.append(f"{name} = {{")
        lines += [f'    {chr(34) + f + chr(34) + ":":<{width}}{record[key][f]:.3f},' for f in FORCES]
        lines += ["}", ""]
    lines.append("DEFAULT_FORCE_OVERLAP_MATRIX = {")
    for i in FORCES:
        row = ", ".join(f'"{j}": {record["cross_force_final"][i][j]:.3f}' for j in FORCES)
        lines.append(f'    "{i}": {{{row}}},')
    lines.append("}")
    return "\n".join(lines)


def main(argv: list | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check", action="store_true",
                    help="compare with the committed record and prism/config.py; write nothing")
    args = ap.parse_args(argv)
    if not args.check:
        compute()
        return 0
    with tempfile.TemporaryDirectory() as tmp:
        fresh = compute(Path(tmp) / "attenuation.json", verbose=False)
    problems = []
    committed = json.loads(OUT_JSON.read_text(encoding="utf-8")) if OUT_JSON.exists() else None
    if committed != json.loads(json.dumps(fresh)):
        problems.append(f"{OUT_JSON.relative_to(REPO)} differs from the derivation (re-run this script)")
    config_source = (REPO / "prism" / "config.py").read_text(encoding="utf-8")
    if not all(block.strip() in config_source for block in config_literals(fresh).split("\n\n")):
        problems.append("prism/config.py does not hold the three blocks this script prints (copy them in)")
    if problems:
        print("overlap correction check FAILED:\n  - " + "\n  - ".join(problems))
        return 1
    print("overlap correction check OK: the record and prism/config.py match the driver base.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
