"""Build the estimated HCB cell-weight matrix (13 categories x 4 regions).

The engine rolls its 52 category x region cells up with each cell's share of
HCB gross profit. Until the finance shares are loaded, it runs on this
estimate. It is NOT Henkel P&L: it is built from public reporting and category
knowledge, and every input carries a grade:

  [B] business mix that public reporting supports at the level used here
  [E] estimate, defensible but unverified
  [G] guess, low confidence, carried only because a cell needs a number

Construction: share = category sales weight x GP1 margin index x that
category's own regional mix, normalised to 1. The regional mix differs by
category on purpose (North America is laundry and body heavy, automatic
dishwashing is a European category, insect control sits in the growth
markets), so the matrix is not separable into a region vector times a
category vector, and regional concentration moves the category numbers.

The finance shares replace the estimate at run time and are never committed:
    python3 scripts/run_production.py --cell-weights <finance file>

    python3 scripts/build_cell_weights.py           write the three outputs
    python3 scripts/build_cell_weights.py --check   exit 1 if one is out of date (CI)

Outputs, never edited by hand:
  data/parameters/cell_weight_estimate.json   the record
  lib/cellWeightProvenance.ts                 the derivation for the dashboard
  prism/cell_weight_estimate.py               the matrix and its source text, which prism/config.py reads

A new estimate moves the category and portfolio numbers: it gets a new
VERSION, and a new MODEL_VERSION, golden pins and a PRISM Analysis record
rebuilt from a production run of the new code go with it (CLAUDE.md,
docs/DRIVER_ANALYSIS.md).
"""
import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from prism.config import CATEGORIES, REGIONS  # noqa: E402

OUT = REPO / "data" / "parameters" / "cell_weight_estimate.json"
OUT_TS = REPO / "lib" / "cellWeightProvenance.ts"
OUT_PY = REPO / "prism" / "cell_weight_estimate.py"

VERSION = "estimate-2026-09"

# ── 1. Category weight inside HCB, by sales ──────────────────────────────
LHC_SHARE, HAIRBODY_SHARE = 0.62, 0.38
SPLIT_GRADE = ("B", "HCB is roughly 60/40 laundry-and-home-care against hair-and-body; "
                    "the split inside each block is an estimate")

LHC_MIX = {
    "LHC: FCN": (0.48, "B", "heavy-duty detergents: Persil, Weisser Riese, Spee, all, Purex"),
    "LHC: FFI": (0.12, "E", "finishers: Vernel, Silan, Snuggle"),
    "LHC: ADW": (0.11, "E", "Somat"),
    "LHC: HSC": (0.07, "E", "surface, bathroom, kitchen, glass, bleach, polishes: Bref surface, Biff, Sidolin, "
                            "Danklorix"),
    "LHC: TOI": (0.04, "E", "toilet care: WC-Frisch, Bref WC Duo-Aktiv and Power-Aktiv; rim blocks are a "
                            "large, high-turnover franchise in Europe and the growth markets"),
    "LHC: FCA": (0.07, "E", "specialty fabric care: Perwoll"),
    "LHC: HDW": (0.06, "E", "Pril"),
    "LHC: LAD": (0.04, "E", "additives and stain removal: Sil, boosters"),
    "LHC: IC":  (0.01, "G", "insect control, a small line for HCB"),
}
HAIRBODY_MIX = {
    "Hair: Color":   (0.35, "B", "Palette, Syoss, Live, plus professional colour"),
    "Hair: Care":    (0.30, "B", "Gliss, Schauma, Syoss, professional care"),
    "Hair: Styling": (0.15, "E", "Taft, got2b, Osis"),
    "Hair: Body":    (0.20, "E", "Fa, Dial, Right Guard"),
}

# ── 2. GP1 margin index, relative to the HCB average ─────────────────────
MARGIN_INDEX = {
    "Hair: Color": (1.35, "E"), "Hair: Care": (1.20, "E"),
    "Hair: Styling": (1.30, "E"), "Hair: Body": (1.10, "E"),
    "LHC: FCN": (0.85, "E"), "LHC: FCA": (1.05, "E"), "LHC: FFI": (0.95, "E"),
    "LHC: LAD": (1.10, "E"), "LHC: HDW": (0.95, "E"), "LHC: ADW": (1.00, "E"),
    "LHC: HSC": (1.00, "E"), "LHC: TOI": (1.05, "E"), "LHC: IC": (1.05, "E"),
}
MARGIN_REASON = ("Hair colour and styling carry the richest gross margins, heavy-duty detergent "
                 "the thinnest; everything else sits between.")

# ── 3. Regional mix WITHIN each category ─────────────────────────────────
REGION_MIX = {
    "LHC: FCN":      ({"Europe": 0.45, "North America": 0.38, "Asia": 0.03, "High Growth": 0.14}, "E",
                      "Persil in Europe, all and Purex in North America"),
    "LHC: FFI":      ({"Europe": 0.50, "North America": 0.30, "Asia": 0.04, "High Growth": 0.16}, "E",
                      "Vernel and Silan in Europe, Snuggle in North America"),
    "LHC: FCA":      ({"Europe": 0.65, "North America": 0.12, "Asia": 0.05, "High Growth": 0.18}, "E",
                      "Perwoll is a European franchise"),
    "LHC: LAD":      ({"Europe": 0.60, "North America": 0.20, "Asia": 0.05, "High Growth": 0.15}, "E",
                      "Sil and boosters sit mainly on European shelves"),
    "LHC: HDW":      ({"Europe": 0.55, "North America": 0.10, "Asia": 0.10, "High Growth": 0.25}, "E",
                      "Pril travels into the growth markets; almost no US hand-dish shelf"),
    "LHC: ADW":      ({"Europe": 0.75, "North America": 0.12, "Asia": 0.03, "High Growth": 0.10}, "E",
                      "automatic dishwashing is a European category; machine penetration drives it"),
    "LHC: HSC":      ({"Europe": 0.60, "North America": 0.09, "Asia": 0.05, "High Growth": 0.26}, "E",
                      "Bref surface and Biff are European and growth-market brands"),
    "LHC: TOI":      ({"Europe": 0.60, "North America": 0.04, "Asia": 0.05, "High Growth": 0.31}, "E",
                      "the most Europe-and-growth-market weighted home-care line HCB has: Bref WC is core "
                      "in Germany, CEE, Türkiye and MEA, and HCB has essentially no US toilet shelf "
                      "(that is Lysol and Clorox)"),
    "LHC: IC":       ({"Europe": 0.35, "North America": 0.05, "Asia": 0.10, "High Growth": 0.50}, "G",
                      "insect control follows climate, so it sits in the growth markets"),
    "Hair: Color":   ({"Europe": 0.55, "North America": 0.15, "Asia": 0.06, "High Growth": 0.24}, "E",
                      "Schwarzkopf retail colour is European-led with a large growth-market tail"),
    "Hair: Care":    ({"Europe": 0.45, "North America": 0.15, "Asia": 0.12, "High Growth": 0.28}, "E",
                      "Gliss and Schauma reach further into Asia and the growth markets than colour"),
    "Hair: Styling": ({"Europe": 0.55, "North America": 0.18, "Asia": 0.07, "High Growth": 0.20}, "E",
                      "Taft and got2b are European-led with a US presence"),
    "Hair: Body":    ({"Europe": 0.35, "North America": 0.45, "Asia": 0.03, "High Growth": 0.17}, "E",
                      "Dial and Right Guard make body the one North-America-led block"),
}
REGION_REASON = ("Europe and North America dominate because that is where HCB's brands sit. Asia is "
                 "genuinely small for the consumer brands; the group's Asia weight is an Adhesives story.")

# Stamped on every run that uses the estimate; the dashboard shows it with the run.
SOURCE = (
    "ESTIMATE, not Henkel P&L: HCB gross-profit share per category x region, "
    "built from public reporting and category knowledge. Every input is graded "
    "B / E / G; the derivation is in Settings under Model configuration and in "
    "data/parameters/cell_weight_estimate.json. A finance file passed to "
    "run_production.py --cell-weights replaces it."
)


def build():
    cat_sales = {c: v[0] * LHC_SHARE for c, v in LHC_MIX.items()}
    cat_sales.update({c: v[0] * HAIRBODY_SHARE for c, v in HAIRBODY_MIX.items()})
    assert abs(sum(v[0] for v in LHC_MIX.values()) - 1.0) < 1e-9, "LHC mix must sum to 1"
    assert abs(sum(v[0] for v in HAIRBODY_MIX.values()) - 1.0) < 1e-9, "hair/body mix must sum to 1"
    for c in CATEGORIES:
        assert abs(sum(REGION_MIX[c][0].values()) - 1.0) < 1e-9, f"{c} region mix must sum to 1"

    gp = {c: cat_sales[c] * MARGIN_INDEX[c][0] for c in CATEGORIES}
    total = sum(gp.values())
    cells = {c: {r: gp[c] / total * REGION_MIX[c][0][r] for r in REGIONS} for c in CATEGORIES}
    s = sum(v for row in cells.values() for v in row.values())
    cells = {c: {r: round(v / s, 9) for r, v in row.items()} for c, row in cells.items()}
    # absorb the rounding residue in the largest cell so the matrix sums to 1 exactly
    resid = 1.0 - sum(v for row in cells.values() for v in row.values())
    big_c = max(CATEGORIES, key=lambda c: max(cells[c].values()))
    big_r = max(REGIONS, key=lambda r: cells[big_c][r])
    cells[big_c][big_r] = round(cells[big_c][big_r] + resid, 9)
    return cells


def record(cells):
    mix = {}
    for c, (w, g, why) in LHC_MIX.items():
        mix[c] = {"block": "LHC", "share_of_block": w, "grade": g, "note": why}
    for c, (w, g, why) in HAIRBODY_MIX.items():
        mix[c] = {"block": "Hair & Body", "share_of_block": w, "grade": g, "note": why}
    return {
        "generated_by": "scripts/build_cell_weights.py",
        "version": VERSION,
        "source": SOURCE,
        "basis": "gp1_share",
        "is_estimate": True,
        "grade_legend": {
            "B": "business mix that public reporting supports at the level used here",
            "E": "estimate, defensible but unverified",
            "G": "guess, low confidence, carried only because a cell needs a number",
        },
        "inputs": {
            "block_split": {"LHC": LHC_SHARE, "Hair & Body": HAIRBODY_SHARE,
                            "grade": SPLIT_GRADE[0], "note": SPLIT_GRADE[1]},
            "category_mix": mix,
            "margin_index": {c: {"index": v[0], "grade": v[1]} for c, v in MARGIN_INDEX.items()},
            "margin_index_note": MARGIN_REASON,
            "region_mix": {c: {"mix": REGION_MIX[c][0], "grade": REGION_MIX[c][1],
                               "note": REGION_MIX[c][2]} for c in CATEGORIES},
            "region_mix_note": REGION_REASON,
        },
        "cells": cells,
        "marginals": {
            "category": {c: round(sum(cells[c].values()), 9) for c in CATEGORIES},
            "region": {r: round(sum(cells[c][r] for c in CATEGORIES), 9) for r in REGIONS},
        },
    }


def emit_ts(cells, rec):
    """The derivation as a generated TypeScript module for the Config sheet."""
    def pretty(o):
        return json.dumps(o, indent=2, ensure_ascii=False)
    inp = rec["inputs"]
    block_shares = {"LHC": inp["block_split"]["LHC"], "Hair & Body": inp["block_split"]["Hair & Body"]}
    category_mix = {c: {"shareOfBlock": v["share_of_block"], "block": v["block"], "grade": v["grade"],
                        "note": v["note"]}
                    for c, v in inp["category_mix"].items()}
    lines = [
        "/**",
        " * The estimated HCB gross-profit mix and the graded inputs it is built from,",
        " * so the Model configuration page can show why each cell has its share. An",
        " * estimate from public reporting, not Henkel P&L.",
        " *",
        " * Generated by scripts/build_cell_weights.py (record:",
        " * data/parameters/cell_weight_estimate.json); do not edit.",
        " */",
        "",
        "export type Grade = 'B' | 'E' | 'G';",
        "",
        "export interface GradedShare { shareOfBlock: number; block: string; grade: Grade; note: string }",
        "export interface GradedRegionMix { mix: Record<string, number>; grade: Grade; note: string }",
        "",
        f"export const ESTIMATE_VERSION = {json.dumps(rec['version'])};",
        "",
        f"export const ESTIMATE_SOURCE =\n  {json.dumps(rec['source'])};",
        "",
        f"export const GRADE_LEGEND: Record<Grade, string> = {pretty(rec['grade_legend'])} as const;",
        "",
        "/** The default matrix itself: Settings shows the derivation only for a run whose weights are these. */",
        f"export const ESTIMATED_CELL_WEIGHTS: Record<string, Record<string, number>> = {pretty(cells)};",
        "",
        "export const BLOCK_SPLIT = {",
        f"  shares: {pretty(block_shares)},",
        f"  grade: {json.dumps(inp['block_split']['grade'])} as Grade,",
        f"  note: {json.dumps(inp['block_split']['note'])},",
        "} as const;",
        "",
        "/** Each category's share of its block, with the grade and the brands behind it. */",
        f"export const CATEGORY_MIX: Record<string, GradedShare> = {pretty(category_mix)};",
        "",
        "/** GP1 margin index relative to the HCB average. */",
        "export const MARGIN_INDEX: Record<string, { index: number; grade: Grade }> = "
        f"{pretty(inp['margin_index'])};",
        f"export const MARGIN_INDEX_NOTE = {json.dumps(inp['margin_index_note'])};",
        "",
        "/** Regional mix within each category: what makes the matrix non-separable. */",
        f"export const REGION_MIX: Record<string, GradedRegionMix> = {pretty(inp['region_mix'])};",
        f"export const REGION_MIX_NOTE = {json.dumps(inp['region_mix_note'])};",
        "",
        "/** Derived marginals of the estimate, for the summary line. */",
        f"export const ESTIMATE_MARGINALS = {pretty(rec['marginals'])};",
        "",
    ]
    return "\n".join(lines)


def module_text(rec) -> str:
    """prism/cell_weight_estimate.py as the record gives it."""
    cells, marginals = rec["cells"], rec["marginals"]
    width = max(len(c) for c in CATEGORIES) + 3
    cats = [f"{c} {marginals['category'][c] * 100:.1f}" for c in CATEGORIES]
    regs = [f"{r} {marginals['region'][r] * 100:.1f}" for r in REGIONS]
    source = rec["source"]
    source_lines = []
    while source:   # the source text in pieces of at most 74 characters, split after a space
        cut = len(source) if len(source) <= 74 else source.rindex(" ", 0, 74) + 1
        source_lines.append(f"    {json.dumps(source[:cut], ensure_ascii=False)}")
        source = source[cut:]
    lines = [
        '"""The estimated HCB gross-profit mix: each category x region cell\'s share of',
        "HCB gross profit, the roll-up weights the model uses until finance provides",
        "the real shares. An estimate from public reporting and category knowledge,",
        "not Henkel P&L; the record grades every input.",
        "",
        "Generated by scripts/build_cell_weights.py (record:",
        "data/parameters/cell_weight_estimate.json); never edited by hand.",
        "prism/config.py reads these as the model's defaults and explains them.",
        '"""',
        "",
        f"VERSION = {json.dumps(rec['version'])}",
        "",
        "#: Stamped on every run that uses the estimate; the dashboard shows it with the run.",
        "SOURCE = (",
        *source_lines,
        ")",
        "",
        "# Marginals, in percent:",
        *(f"#   {line}" for line in _wrap(["categories"] + cats, 72)),
        *(f"#   {line}" for line in _wrap(["regions"] + regs, 72)),
        "CELL_WEIGHTS = {",
    ]
    for c in CATEGORIES:
        body = ", ".join(f'"{r}": {cells[c][r]:.9f}' for r in REGIONS)
        lines.append(f'    {(chr(34) + c + chr(34) + ":"):<{width}} {{{body}}},')
    lines.append("}")
    return "\n".join(lines) + "\n"


def _wrap(items: list, width: int) -> list:
    """A label and its items ("Hair: Care 13.0") as lines of at most width
    characters, broken only between items."""
    label, *rest = items
    out, line = [], label
    for i, item in enumerate(rest):
        piece = item + ("," if i < len(rest) - 1 else "")
        if len(line) + 1 + len(piece) > width:
            out.append(line)
            line = piece
        else:
            line = f"{line} {piece}"
    return out + [line]


def main(argv: list | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check", action="store_true",
                    help="compare the three committed outputs with this script; write nothing")
    args = ap.parse_args(argv)

    cells = build()
    rec = record(cells)
    outputs = {
        OUT: json.dumps(rec, indent=1, ensure_ascii=False) + "\n",
        OUT_TS: emit_ts(cells, rec),
        OUT_PY: module_text(rec),
    }
    if args.check:
        stale = [str(path.relative_to(REPO)) for path, text in outputs.items()
                 if (path.read_text(encoding="utf-8") if path.exists() else None) != text]
        if stale:
            print("MISMATCH, re-run without --check:\n  " + "\n  ".join(stale))
            return 1
        print("OK: the committed record, TypeScript copy and Python module match the generator")
        return 0

    for path, text in outputs.items():
        path.write_text(text, encoding="utf-8")
        print(f"wrote {path.relative_to(REPO)}")
    total = sum(v for row in cells.values() for v in row.values())
    print("  category shares: " + ", ".join(
        f"{c.split(': ')[1]} {rec['marginals']['category'][c]*100:.1f}" for c in CATEGORIES))
    print("  region shares:   " + ", ".join(
        f"{r} {rec['marginals']['region'][r]*100:.1f}" for r in REGIONS))
    print(f"  sum {total:.12f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
