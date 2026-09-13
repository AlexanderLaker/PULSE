#!/usr/bin/env python3
"""Build the ESTIMATED HCB cell-weight matrix (13 categories x 4 regions).

Owner ruling O14 (2026-09-11): run the model on these estimated gross-profit
shares instead of the equal 1/52 placeholder, and show the derivation on the
Config sheet. This is NOT Henkel P&L. It is built from public reporting and
category knowledge so the model has a realistic mix while the finance figures
are outstanding, and every input carries a grade:

  [B] business mix that public reporting supports at the level used here
  [E] estimate, defensible but unverified
  [G] guess, low confidence, carried only because a cell needs a number

Construction: share = category sales weight x GP1 margin index x that
category's own regional mix, normalised to 1. The regional mix differs BY
category on purpose (North America is laundry and body heavy, auto-dish is a
European category, insect control sits in growth markets, toilet care is a
Europe and growth-market story), so the matrix is NOT the separable outer
product the model used before 2.11.0. That is the whole point: only regional
concentration moves the category numbers.

O6 is unchanged by this. The real shares still arrive as a file outside git:
    python3 scripts/run_50k_prod.py --cell-weights <finance file>
and that file still overrides everything here. What changed is the DEFAULT the
engine falls back to when no file is passed.

Outputs:
  data/cell_weights_estimated_v1.json   the record (and the test lock)
  lib/cellWeightProvenance.ts           the same derivation for the Config sheet
  --emit-python                         the literal for pulse/config.py

`--check` verifies both committed outputs against this script and is run by CI,
so the record, the TypeScript copy and the generator cannot drift apart (F-28).
"""
import argparse
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
OUT = REPO / "data" / "cell_weights_estimated_v1.json"
OUT_TS = REPO / "lib" / "cellWeightProvenance.ts"

VERSION = "estimated_v1_september2026"

# ── 1. Category weight inside HCB, by sales ──────────────────────────────
LHC_SHARE, HAIRBODY_SHARE = 0.62, 0.38
SPLIT_GRADE = ("B", "HCB is roughly 60/40 laundry-and-home-care against hair-and-body; "
                    "the split inside each block is an estimate")

LHC_MIX = {
    "LHC: FCN": (0.48, "B", "heavy-duty detergents: Persil, Weisser Riese, Spee, all, Purex"),
    "LHC: FFI": (0.12, "E", "finishers: Vernel, Silan, Snuggle"),
    "LHC: ADW": (0.11, "E", "Somat"),
    "LHC: HSC": (0.07, "E", "surface, bathroom, kitchen, glass, bleach, polishes: Bref surface, Biff, Sidolin, Danklorix"),
    "LHC: TOI": (0.04, "E", "toilet care (O13): WC-Frisch, Bref WC Duo-Aktiv and Power-Aktiv. Roughly a third "
                            "of the old HSC block: rim blocks are a large, high-turnover franchise in Europe "
                            "and the growth markets"),
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
                      "in Germany, CEE, Turkiye and MEA, and HCB has essentially no US toilet shelf "
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

CATEGORIES = ["Hair: Color", "Hair: Care", "Hair: Styling", "Hair: Body",
              "LHC: FCN", "LHC: FCA", "LHC: FFI", "LHC: LAD",
              "LHC: HDW", "LHC: ADW", "LHC: HSC", "LHC: TOI", "LHC: IC"]
REGIONS = ["Europe", "North America", "Asia", "High Growth"]

# Kept under 400 characters: cell_weights_source round-trips through
# PUT /api/v1/config, whose schema caps the field at 400 (test_api locks it).
SOURCE = (
    "ESTIMATE, not Henkel P&L: HCB gross-profit share per category x region, "
    "built 2026-09-11 from public reporting and category knowledge (owner "
    "ruling O14). Every input is graded B / E / G; the grades and the whole "
    "derivation are on the Config sheet, the record is "
    "data/cell_weights_estimated_v1.json. The finance figures override this "
    "via run_50k_prod.py --cell-weights FILE."
)
assert len(SOURCE) <= 400, f"source is {len(SOURCE)} chars, the API caps it at 400"


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
    def j(o, indent=2):
        return json.dumps(o, indent=indent, ensure_ascii=False).replace("\n", "\n" + " " * 0)
    inp = rec["inputs"]
    lines = [
        "/**",
        " * cellWeightProvenance.ts — GENERATED, do not edit by hand.",
        " *",
        " * Source of truth: scripts/build_estimated_cell_weights.py",
        " * Record:          data/cell_weights_estimated_v1.json",
        " * Regenerate:      python3 scripts/build_estimated_cell_weights.py",
        " * CI gate:         python3 scripts/build_estimated_cell_weights.py --check",
        " *",
        " * The estimated HCB gross-profit mix the engine defaults to since 2.12.0",
        " * (owner ruling O14) and the graded inputs it is built from, so the Config",
        " * sheet can show WHY each cell has the share it has. This is an estimate",
        " * from public reporting, not Henkel P&L.",
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
        f"export const GRADE_LEGEND: Record<Grade, string> = {j(rec['grade_legend'])} as const;",
        "",
        "/** The default matrix itself, for detecting whether the live grid is still the estimate. */",
        f"export const ESTIMATED_CELL_WEIGHTS: Record<string, Record<string, number>> = {j(cells)};",
        "",
        "export const BLOCK_SPLIT = {",
        f"  shares: {j({'LHC': inp['block_split']['LHC'], 'Hair & Body': inp['block_split']['Hair & Body']}, 2)},",
        f"  grade: {json.dumps(inp['block_split']['grade'])} as Grade,",
        f"  note: {json.dumps(inp['block_split']['note'])},",
        "} as const;",
        "",
        "/** Each category's share of its block, with the grade and the brands behind it. */",
        f"export const CATEGORY_MIX: Record<string, GradedShare> = {json.dumps({c: {'shareOfBlock': v['share_of_block'], 'block': v['block'], 'grade': v['grade'], 'note': v['note']} for c, v in inp['category_mix'].items()}, indent=2, ensure_ascii=False)};",
        "",
        "/** GP1 margin index relative to the HCB average. */",
        f"export const MARGIN_INDEX: Record<string, {{ index: number; grade: Grade }}> = {json.dumps(inp['margin_index'], indent=2, ensure_ascii=False)};",
        f"export const MARGIN_INDEX_NOTE = {json.dumps(inp['margin_index_note'])};",
        "",
        "/** Regional mix WITHIN each category — this is what makes the matrix non-separable. */",
        f"export const REGION_MIX: Record<string, GradedRegionMix> = {json.dumps(inp['region_mix'], indent=2, ensure_ascii=False)};",
        f"export const REGION_MIX_NOTE = {json.dumps(inp['region_mix_note'])};",
        "",
        "/** Derived marginals of the estimate, for the summary line. */",
        f"export const ESTIMATE_MARGINALS = {j(rec['marginals'])};",
        "",
    ]
    return "\n".join(lines)


def emit_python(cells):
    w = max(len(c) for c in CATEGORIES) + 3
    out = ["DEFAULT_CELL_WEIGHTS = {"]
    for c in CATEGORIES:
        body = ", ".join(f'"{r}": {cells[c][r]:.9f}' for r in REGIONS)
        out.append(f'    {(chr(34) + c + chr(34) + ":"):<{w}} {{{body}}},')
    out.append("}")
    return "\n".join(out)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--emit-python", action="store_true",
                    help="print the literal for pulse/config.py instead of writing the record")
    ap.add_argument("--check", action="store_true",
                    help="verify the committed record matches this script; exit 1 if not")
    a = ap.parse_args()

    cells = build()
    if a.emit_python:
        print(emit_python(cells)); raise SystemExit(0)

    rec = record(cells)
    text = json.dumps(rec, indent=1, ensure_ascii=False) + "\n"
    ts = emit_ts(cells, rec)
    if a.check:
        bad = []
        if (OUT.read_text(encoding="utf-8") if OUT.exists() else "") != text:
            bad.append(str(OUT))
        if (OUT_TS.read_text(encoding="utf-8") if OUT_TS.exists() else "") != ts:
            bad.append(str(OUT_TS))
        if bad:
            print("MISMATCH, re-run without --check:\n  " + "\n  ".join(bad))
            raise SystemExit(1)
        print("OK: committed record and TypeScript copy match the generator"); raise SystemExit(0)

    OUT.write_text(text, encoding="utf-8")
    OUT_TS.write_text(ts, encoding="utf-8")
    print(f"wrote {OUT_TS}")
    total = sum(v for row in cells.values() for v in row.values())
    print(f"wrote {OUT}")
    print("  category shares: " + ", ".join(
        f"{c.split(': ')[1]} {rec['marginals']['category'][c]*100:.1f}" for c in CATEGORIES))
    print("  region shares:   " + ", ".join(
        f"{r} {rec['marginals']['region'][r]*100:.1f}" for r in REGIONS))
    print(f"  sum {total:.12f}")
