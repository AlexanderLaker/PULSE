/**
 * cellWeightProvenance.ts — GENERATED, do not edit by hand.
 *
 * Source of truth: scripts/build_estimated_cell_weights.py
 * Record:          data/cell_weights_estimated_v1.json
 * Regenerate:      python3 scripts/build_estimated_cell_weights.py
 * CI gate:         python3 scripts/build_estimated_cell_weights.py --check
 *
 * The estimated HCB gross-profit mix the engine defaults to since 2.12.0
 * (owner ruling O14) and the graded inputs it is built from, so the Config
 * sheet can show WHY each cell has the share it has. This is an estimate
 * from public reporting, not Henkel P&L.
 */

export type Grade = 'B' | 'E' | 'G';

export interface GradedShare { shareOfBlock: number; block: string; grade: Grade; note: string }
export interface GradedRegionMix { mix: Record<string, number>; grade: Grade; note: string }

export const ESTIMATE_VERSION = "estimated_v1_september2026";

export const ESTIMATE_SOURCE =
  "ESTIMATE, not Henkel P&L: HCB gross-profit share per category x region, built 2026-09-11 from public reporting and category knowledge (owner ruling O14). Every input is graded B / E / G; the grades and the whole derivation are on the Config sheet, the record is data/cell_weights_estimated_v1.json. The finance figures override this via run_50k_prod.py --cell-weights FILE.";

export const GRADE_LEGEND: Record<Grade, string> = {
  "B": "business mix that public reporting supports at the level used here",
  "E": "estimate, defensible but unverified",
  "G": "guess, low confidence, carried only because a cell needs a number"
} as const;

/** The default matrix itself, for detecting whether the live grid is still the estimate. */
export const ESTIMATED_CELL_WEIGHTS: Record<string, Record<string, number>> = {
  "Hair: Color": {
    "Europe": 0.094047313,
    "North America": 0.025649267,
    "Asia": 0.010259707,
    "High Growth": 0.041038827
  },
  "Hair: Care": {
    "Europe": 0.058626896,
    "North America": 0.019542299,
    "Asia": 0.015633839,
    "High Growth": 0.036478958
  },
  "Hair: Styling": {
    "Europe": 0.038813177,
    "North America": 0.012702494,
    "Asia": 0.004939859,
    "High Growth": 0.014113882
  },
  "Hair: Body": {
    "Europe": 0.02786587,
    "North America": 0.035827548,
    "Asia": 0.002388503,
    "High Growth": 0.013534851
  },
  "LHC: FCN": {
    "Europe": 0.108408331,
    "North America": 0.091544813,
    "Asia": 0.007227222,
    "High Growth": 0.033727036
  },
  "LHC: FCA": {
    "Europe": 0.028209194,
    "North America": 0.005207851,
    "Asia": 0.002169938,
    "High Growth": 0.007811777
  },
  "LHC: FFI": {
    "Europe": 0.033656181,
    "North America": 0.020193709,
    "Asia": 0.002692495,
    "High Growth": 0.010769978
  },
  "LHC: LAD": {
    "Europe": 0.015588126,
    "North America": 0.005196042,
    "Asia": 0.001299011,
    "High Growth": 0.003897032
  },
  "LHC: HDW": {
    "Europe": 0.0185109,
    "North America": 0.003365618,
    "Asia": 0.003365618,
    "High Growth": 0.008414045
  },
  "LHC: ADW": {
    "Europe": 0.048712894,
    "North America": 0.007794063,
    "Asia": 0.001948516,
    "High Growth": 0.006495053
  },
  "LHC: HSC": {
    "Europe": 0.024799291,
    "North America": 0.003719894,
    "Asia": 0.002066608,
    "High Growth": 0.01074636
  },
  "LHC: TOI": {
    "Europe": 0.014879575,
    "North America": 0.000991972,
    "Asia": 0.001239965,
    "High Growth": 0.00768778
  },
  "LHC: IC": {
    "Europe": 0.002169938,
    "North America": 0.000309991,
    "Asia": 0.000619982,
    "High Growth": 0.003099911
  }
};

export const BLOCK_SPLIT = {
  shares: {
  "LHC": 0.62,
  "Hair & Body": 0.38
},
  grade: "B" as Grade,
  note: "HCB is roughly 60/40 laundry-and-home-care against hair-and-body; the split inside each block is an estimate",
} as const;

/** Each category's share of its block, with the grade and the brands behind it. */
export const CATEGORY_MIX: Record<string, GradedShare> = {
  "LHC: FCN": {
    "shareOfBlock": 0.48,
    "block": "LHC",
    "grade": "B",
    "note": "heavy-duty detergents: Persil, Weisser Riese, Spee, all, Purex"
  },
  "LHC: FFI": {
    "shareOfBlock": 0.12,
    "block": "LHC",
    "grade": "E",
    "note": "finishers: Vernel, Silan, Snuggle"
  },
  "LHC: ADW": {
    "shareOfBlock": 0.11,
    "block": "LHC",
    "grade": "E",
    "note": "Somat"
  },
  "LHC: HSC": {
    "shareOfBlock": 0.07,
    "block": "LHC",
    "grade": "E",
    "note": "surface, bathroom, kitchen, glass, bleach, polishes: Bref surface, Biff, Sidolin, Danklorix"
  },
  "LHC: TOI": {
    "shareOfBlock": 0.04,
    "block": "LHC",
    "grade": "E",
    "note": "toilet care (O13): WC-Frisch, Bref WC Duo-Aktiv and Power-Aktiv. Roughly a third of the old HSC block: rim blocks are a large, high-turnover franchise in Europe and the growth markets"
  },
  "LHC: FCA": {
    "shareOfBlock": 0.07,
    "block": "LHC",
    "grade": "E",
    "note": "specialty fabric care: Perwoll"
  },
  "LHC: HDW": {
    "shareOfBlock": 0.06,
    "block": "LHC",
    "grade": "E",
    "note": "Pril"
  },
  "LHC: LAD": {
    "shareOfBlock": 0.04,
    "block": "LHC",
    "grade": "E",
    "note": "additives and stain removal: Sil, boosters"
  },
  "LHC: IC": {
    "shareOfBlock": 0.01,
    "block": "LHC",
    "grade": "G",
    "note": "insect control, a small line for HCB"
  },
  "Hair: Color": {
    "shareOfBlock": 0.35,
    "block": "Hair & Body",
    "grade": "B",
    "note": "Palette, Syoss, Live, plus professional colour"
  },
  "Hair: Care": {
    "shareOfBlock": 0.3,
    "block": "Hair & Body",
    "grade": "B",
    "note": "Gliss, Schauma, Syoss, professional care"
  },
  "Hair: Styling": {
    "shareOfBlock": 0.15,
    "block": "Hair & Body",
    "grade": "E",
    "note": "Taft, got2b, Osis"
  },
  "Hair: Body": {
    "shareOfBlock": 0.2,
    "block": "Hair & Body",
    "grade": "E",
    "note": "Fa, Dial, Right Guard"
  }
};

/** GP1 margin index relative to the HCB average. */
export const MARGIN_INDEX: Record<string, { index: number; grade: Grade }> = {
  "Hair: Color": {
    "index": 1.35,
    "grade": "E"
  },
  "Hair: Care": {
    "index": 1.2,
    "grade": "E"
  },
  "Hair: Styling": {
    "index": 1.3,
    "grade": "E"
  },
  "Hair: Body": {
    "index": 1.1,
    "grade": "E"
  },
  "LHC: FCN": {
    "index": 0.85,
    "grade": "E"
  },
  "LHC: FCA": {
    "index": 1.05,
    "grade": "E"
  },
  "LHC: FFI": {
    "index": 0.95,
    "grade": "E"
  },
  "LHC: LAD": {
    "index": 1.1,
    "grade": "E"
  },
  "LHC: HDW": {
    "index": 0.95,
    "grade": "E"
  },
  "LHC: ADW": {
    "index": 1.0,
    "grade": "E"
  },
  "LHC: HSC": {
    "index": 1.0,
    "grade": "E"
  },
  "LHC: TOI": {
    "index": 1.05,
    "grade": "E"
  },
  "LHC: IC": {
    "index": 1.05,
    "grade": "E"
  }
};
export const MARGIN_INDEX_NOTE = "Hair colour and styling carry the richest gross margins, heavy-duty detergent the thinnest; everything else sits between.";

/** Regional mix WITHIN each category — this is what makes the matrix non-separable. */
export const REGION_MIX: Record<string, GradedRegionMix> = {
  "Hair: Color": {
    "mix": {
      "Europe": 0.55,
      "North America": 0.15,
      "Asia": 0.06,
      "High Growth": 0.24
    },
    "grade": "E",
    "note": "Schwarzkopf retail colour is European-led with a large growth-market tail"
  },
  "Hair: Care": {
    "mix": {
      "Europe": 0.45,
      "North America": 0.15,
      "Asia": 0.12,
      "High Growth": 0.28
    },
    "grade": "E",
    "note": "Gliss and Schauma reach further into Asia and the growth markets than colour"
  },
  "Hair: Styling": {
    "mix": {
      "Europe": 0.55,
      "North America": 0.18,
      "Asia": 0.07,
      "High Growth": 0.2
    },
    "grade": "E",
    "note": "Taft and got2b are European-led with a US presence"
  },
  "Hair: Body": {
    "mix": {
      "Europe": 0.35,
      "North America": 0.45,
      "Asia": 0.03,
      "High Growth": 0.17
    },
    "grade": "E",
    "note": "Dial and Right Guard make body the one North-America-led block"
  },
  "LHC: FCN": {
    "mix": {
      "Europe": 0.45,
      "North America": 0.38,
      "Asia": 0.03,
      "High Growth": 0.14
    },
    "grade": "E",
    "note": "Persil in Europe, all and Purex in North America"
  },
  "LHC: FCA": {
    "mix": {
      "Europe": 0.65,
      "North America": 0.12,
      "Asia": 0.05,
      "High Growth": 0.18
    },
    "grade": "E",
    "note": "Perwoll is a European franchise"
  },
  "LHC: FFI": {
    "mix": {
      "Europe": 0.5,
      "North America": 0.3,
      "Asia": 0.04,
      "High Growth": 0.16
    },
    "grade": "E",
    "note": "Vernel and Silan in Europe, Snuggle in North America"
  },
  "LHC: LAD": {
    "mix": {
      "Europe": 0.6,
      "North America": 0.2,
      "Asia": 0.05,
      "High Growth": 0.15
    },
    "grade": "E",
    "note": "Sil and boosters sit mainly on European shelves"
  },
  "LHC: HDW": {
    "mix": {
      "Europe": 0.55,
      "North America": 0.1,
      "Asia": 0.1,
      "High Growth": 0.25
    },
    "grade": "E",
    "note": "Pril travels into the growth markets; almost no US hand-dish shelf"
  },
  "LHC: ADW": {
    "mix": {
      "Europe": 0.75,
      "North America": 0.12,
      "Asia": 0.03,
      "High Growth": 0.1
    },
    "grade": "E",
    "note": "automatic dishwashing is a European category; machine penetration drives it"
  },
  "LHC: HSC": {
    "mix": {
      "Europe": 0.6,
      "North America": 0.09,
      "Asia": 0.05,
      "High Growth": 0.26
    },
    "grade": "E",
    "note": "Bref surface and Biff are European and growth-market brands"
  },
  "LHC: TOI": {
    "mix": {
      "Europe": 0.6,
      "North America": 0.04,
      "Asia": 0.05,
      "High Growth": 0.31
    },
    "grade": "E",
    "note": "the most Europe-and-growth-market weighted home-care line HCB has: Bref WC is core in Germany, CEE, Turkiye and MEA, and HCB has essentially no US toilet shelf (that is Lysol and Clorox)"
  },
  "LHC: IC": {
    "mix": {
      "Europe": 0.35,
      "North America": 0.05,
      "Asia": 0.1,
      "High Growth": 0.5
    },
    "grade": "G",
    "note": "insect control follows climate, so it sits in the growth markets"
  }
};
export const REGION_MIX_NOTE = "Europe and North America dominate because that is where HCB's brands sit. Asia is genuinely small for the consumer brands; the group's Asia weight is an Adhesives story.";

/** Derived marginals of the estimate, for the summary line. */
export const ESTIMATE_MARGINALS = {
  "category": {
    "Hair: Color": 0.170995114,
    "Hair: Care": 0.130281992,
    "Hair: Styling": 0.070569412,
    "Hair: Body": 0.079616772,
    "LHC: FCN": 0.240907402,
    "LHC: FCA": 0.04339876,
    "LHC: FFI": 0.067312363,
    "LHC: LAD": 0.025980211,
    "LHC: HDW": 0.033656181,
    "LHC: ADW": 0.064950526,
    "LHC: HSC": 0.041332153,
    "LHC: TOI": 0.024799292,
    "LHC: IC": 0.006199822
  },
  "region": {
    "Europe": 0.514287686,
    "North America": 0.232045561,
    "Asia": 0.055851263,
    "High Growth": 0.19781549
  }
};
