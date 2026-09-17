"""Global configuration for PRISM engine."""

from dataclasses import dataclass, field
from typing import Optional
import json

# ── Force taxonomy ──────────────────────────────────────────────────
FORCES = ["Consumer", "Customer", "Technology", "Government", "Environmental", "Competitive"]

# ── Category taxonomy ───────────────────────────────────────────────
# 2.12.0 (owner ruling O13, 2026-09-11): Toilet Care ("LHC: TOI") is its own
# category, split out of Hard-Surface Cleaner. TOI is toilet cleaners, rim
# blocks and balls and toilet gels (WC-Frisch, Bref WC Duo-Aktiv and
# Power-Aktiv); HSC keeps bathroom, kitchen, floor and glass plus bleach and
# polishes (Bref surface, Biff, Sidolin, Danklorix). The two sit next to each
# other so the LHC block still reads in shelf order.
CATEGORIES = [
    "Hair: Color", "Hair: Care", "Hair: Styling", "Hair: Body",
    "LHC: FCN", "LHC: FCA", "LHC: FFI", "LHC: LAD",
    "LHC: HDW", "LHC: ADW", "LHC: HSC", "LHC: TOI", "LHC: IC",
]

# ── Value chain steps ───────────────────────────────────────────────
VC_STEPS = [
    "Raw Materials", "Formulation", "Manufacturing", "Packaging",
    "Supply Chain", "Marketing", "Commercial", "Consumer"
]


def vc_epicentre_of(vc_exposure: Optional[dict]) -> Optional[int]:
    """1-based value-chain epicentre stage of a vc_exposure profile, or None.

    2.9.0 (July 2026 VC-epicentre redesign): experts score the value chain
    as a SINGLE epicentre stage (the Drivers editor's slider); the stored
    8-step 0–5 profile is a serialization format, not eight independent
    judgments. This function is the engine-side twin of ``epicentreOf`` in
    components/dashboard/Trends2.tsx and MUST stay behaviourally identical —
    both are pinned against the same fixture table
    (tests/test_vc_epicentre.py ↔ tests/frontend/vcEpicentre.test.ts):

      • read each VC_STEPS entry case-/snake_case-tolerantly (old payloads
        stored keys like "supply_chain"),
      • None when the profile is missing / empty / all-zero (unscored),
      • otherwise the max-scoring stage; ties resolve toward the
        exposure-weighted centroid (deterministic; first stage wins an
        exact-distance tie, matching the TS `<` comparison).

    Legacy arbitrary profiles (pre-slider expert grids) collapse through the
    same rule, so no data migration is needed and engine and UI can never
    disagree about a trend's stage.
    """
    if not vc_exposure:
        return None
    # Case-/snake_case-insensitive lookup (mirror of the TS readVCExposure).
    norm_map = {str(k).lower().replace(" ", "_"): float(v or 0.0)
                for k, v in vc_exposure.items()}
    vs = [norm_map.get(s.lower().replace(" ", "_"), 0.0) for s in VC_STEPS]
    total = sum(vs)
    if total <= 0:
        return None
    mx = max(vs)
    centroid = sum(v * (i + 1) for i, v in enumerate(vs)) / total
    best: Optional[int] = None
    for i, v in enumerate(vs):
        if v != mx:
            continue
        if best is None or abs(i + 1 - centroid) < abs(best - centroid):
            best = i + 1
    return best


def vc_epicentre_step_of(vc_exposure: Optional[dict]) -> Optional[str]:
    """Canonical VC_STEPS name of a profile's epicentre stage, or None."""
    stage = vc_epicentre_of(vc_exposure)
    return VC_STEPS[stage - 1] if stage is not None else None

# ── Regional taxonomy ──────────────────────────────────────────────
REGIONS = ["Europe", "North America", "Asia", "High Growth"]

# ── Consumer-journey taxonomy (v3.6 journey layer) ──────────────────
# Stage ids are the single source of truth shared with the frontend
# journey content module (data/consumerJourney.ts) and the
# trend_journey_exposure table. Exposure keys are namespaced
# "<journey>:<stage_id>" (e.g. "lhc:add_products", "hair:diagnose").
# The LHC journey is usage-stage (laundry; Home Care journey pending),
# the Hair journey is hybrid (includes pre-purchase decision stages).
# (The consumer-journey stage taxonomy — LHC_JOURNEY_STAGES / HAIR_JOURNEY_STAGES /
# JOURNEY_STAGES / CATEGORY_JOURNEY — was removed 2026-07-07, owner ruling O3,
# together with the quantitative journey_exposure layer. The qualitative journey
# UI keeps its own stage definitions in data/consumerJourney.ts.)

# ── Default model parameters ────────────────────────────────────────
# v3.11 recalibration (September 2026, 51-driver base; owner ruling O11).
# Each value equals what the cross-force overlap matrix below yields for
# that force via the identity
#   eff_att_i = 0.5 × (1 − mean(O[i][j] for j≠i))
# so the runtime engine consumes them directly — there is no base × (1−overlap)
# step anywhere. Same method as v3.1/v3.5 (weighted Jaccard on the category
# exposure vectors, excess over the random-pair baseline J0, force-size
# asymmetry, per-cell mechanism adjustments re-judged for the 51 drivers) —
# on the 13-category taxonomy since 2.12.0 / O13, which is why the split of
# Toilet Care out of Hard-Surface Cleaner forced a recalibration: the overlap
# correction is a function of the category exposure space, not of the drivers
# alone.
# Generated by scripts/compute_attenuation_v3_12.py; the JSON
# data/attenuation_calibration_v3_12.json is the record and the test lock.
#
# Provenance per force (v3.12 — delta vs v3.5 in parens; v3.11 in the last
# column, i.e. the same 51 drivers scored on 12 categories):
#   force            cross-force row mean   eff_att   (Δ v3.5)   v3.11
#   Consumer                  0.026        0.487     (-0.008)    0.487
#   Customer                  0.167        0.417     (+0.016)    0.418
#   Technology                0.176        0.412     (-0.022)    0.415
#   Government                0.108        0.446     (+0.031)    0.446
#   Environmental             0.244        0.378     (-0.040)    0.379
#   Competitive               0.043        0.479     (+0.000)    0.480
#
# Trend-weighted mean across the 51 drivers = 0.4514 (v3.11: 0.4520; v3.5: 0.4523).
# J0 random-pair baseline = 0.4199 over 1,275 pairs (v3.11: 0.4265; v3.5: 0.4525
# over 4,851).
# Source: data/attenuation_calibration_v3_12.json; workbook data/Attenuation_Calibration_v3_12.xlsx.
DEFAULT_PER_FORCE_ATTENUATION = {
    "Consumer":        0.487,
    "Customer":        0.417,
    "Technology":      0.412,
    "Government":      0.446,
    "Environmental":   0.378,
    "Competitive":     0.479,
}
DEFAULT_ATTENUATION_SOURCE = "calibrated_v3.12_september2026"  # valid sources: "calibrated_v3.12_september2026" | "calibrated_v3.11_september2026" (legacy) | "calibrated_v3.5_april2026" (legacy) | "calibrated_v3.1_april2026" (legacy) | "admin_override"
# DEFAULT_NEUTRAL_THRESHOLD deleted (July 2026): defined + validated since v1
# but consumed nowhere in the engine — an inert dial, removed per design
# philosophy #8 (like scalar attenuation v3.2 and t_copula_df D20). Old
# config snapshots carrying it are tolerated by ModelConfig.from_json.
DEFAULT_ITERATIONS = 10_000
DEFAULT_BASE_YEAR = 2025
DEFAULT_PATH_YEARS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035]

# Materialization schedule: S-curve for how much of total impact has materialized
DEFAULT_MATERIALIZATION = {
    2026: 0.08,
    2027: 0.18,
    2028: 0.32,
    2029: 0.48,
    2030: 0.62,
    2031: 0.74,
    2032: 0.84,
    2033: 0.91,
    2034: 0.96,
    2035: 1.00,
}

# Force-specific materialization overrides (legacy — used when trend has no diffusion_curve)
REGULATORY_MATERIALIZATION = {
    2026: 0.05, 2027: 0.15, 2028: 0.40, 2029: 0.60, 2030: 0.75,
    2031: 0.85, 2032: 0.92, 2033: 0.97, 2034: 0.99, 2035: 1.00,
}
TECHNOLOGY_MATERIALIZATION = {
    2026: 0.04, 2027: 0.10, 2028: 0.22, 2029: 0.40, 2030: 0.58,
    2031: 0.72, 2032: 0.83, 2033: 0.91, 2034: 0.98, 2035: 1.00,
}
CONSUMER_MATERIALIZATION = {
    2026: 0.10, 2027: 0.22, 2028: 0.38, 2029: 0.54, 2030: 0.68,
    2031: 0.79, 2032: 0.87, 2033: 0.93, 2034: 0.98, 2035: 1.00,
}

FORCE_MATERIALIZATION_OVERRIDES = {
    "Government": REGULATORY_MATERIALIZATION,
    "Technology": TECHNOLOGY_MATERIALIZATION,
    "Consumer": CONSUMER_MATERIALIZATION,
}

# ── MECE Diffusion Curve Types ──────────────────────────────────────
# Each curve maps a normalized progress (0→1) to a materialization fraction.
VALID_DIFFUSION_CURVES = ["s_curve", "linear", "front_loaded", "back_loaded", "step_function"]

def compute_materialization_schedule(
    peak_year: int,
    diffusion_curve: str,
    path_years: list[int] | None = None,
    base_year: int = DEFAULT_BASE_YEAR,
    start_year: int | None = None,
) -> dict[int, float]:
    """
    Compute a year→fraction materialization schedule for a single trend.

    Args:
        peak_year: year when 100% impact materializes (0 = use last path year)
        diffusion_curve: one of VALID_DIFFUSION_CURVES
        path_years: list of years to compute fractions for
        base_year: global model base year (fraction = 0.0 at/before onset)
        start_year: the trend's onset year — when its impact BEGINS to
            materialize (F11, 2.10.0). Onset = max(base_year, start_year).
            Before onset the fraction is 0.0; the diffusion curve then ramps
            from onset to peak_year. None → onset = base_year (legacy behavior:
            everything ramps from the global base year).

    Returns:
        dict mapping each path year to a fraction in [0.0, 1.0]
    """
    import math
    years = path_years or DEFAULT_PATH_YEARS
    # F11: the impact does not accrue before the trend's start_year. Onset is
    # the later of the global base year and the trend's own start_year.
    onset = base_year if start_year is None else max(int(base_year), int(start_year))
    # Peak must be strictly after onset; otherwise ramp to the horizon (or, if
    # the onset is itself past the horizon, a degenerate onset+1 → all-zero).
    if peak_year and peak_year > onset:
        py = peak_year
    else:
        py = years[-1] if years[-1] > onset else onset + 1

    schedule = {}
    for year in years:
        if year >= py:
            schedule[year] = 1.0
            continue
        if year <= onset:
            # F11: no materialization before the trend comes into effect.
            schedule[year] = 0.0
            continue
        # t = normalized progress from onset (start_year) to peak_year: 0.0 → 1.0
        span = max(py - onset, 1)
        t = max(0.0, min(1.0, (year - onset) / span))

        if diffusion_curve == "linear":
            frac = t
        elif diffusion_curve == "front_loaded":
            # Concave: sqrt curve — fast early, flattens
            frac = math.sqrt(t)
        elif diffusion_curve == "back_loaded":
            # Convex: quadratic — slow early, accelerates
            frac = t * t
        elif diffusion_curve == "step_function":
            # Near-zero until 80% of the way, then jumps
            frac = 0.05 if t < 0.8 else (0.05 + (t - 0.8) / 0.2 * 0.95)
        else:  # s_curve (default)
            # Logistic S-curve centered at t=0.5
            frac = 1.0 / (1.0 + math.exp(-12 * (t - 0.5)))
            # Normalize so frac(0)≈0 and frac(1)≈1
            f0 = 1.0 / (1.0 + math.exp(-12 * (0 - 0.5)))
            f1 = 1.0 / (1.0 + math.exp(-12 * (1 - 0.5)))
            frac = (frac - f0) / (f1 - f0)

        schedule[year] = round(max(0.0, min(1.0, frac)), 4)

    # Defensive monotonicity guarantee. Every supported curve is mathematically
    # non-decreasing across [0, 1], but rounding and any future curve definition
    # could in principle break that — and a non-monotonic materialization
    # schedule would silently produce nonsensical paths (a category "un-shifting"
    # year-over-year). Enforce it at the source.
    sorted_years = sorted(schedule.keys())
    for i in range(1, len(sorted_years)):
        prev_year, curr_year = sorted_years[i - 1], sorted_years[i]
        if schedule[curr_year] < schedule[prev_year]:
            raise ValueError(
                f"compute_materialization_schedule produced a non-monotonic "
                f"schedule for diffusion_curve='{diffusion_curve}', peak_year="
                f"{peak_year}: year {curr_year} ({schedule[curr_year]}) is "
                f"less than year {prev_year} ({schedule[prev_year]}). This is "
                f"a model bug — please report it."
            )

    return schedule

# ── Default weights ─────────────────────────────────────────────────
# DEFAULT_VC_WEIGHTS deleted (2.9.0, July 2026): with the VC lens computed
# as a categorical epicentre partition, a per-step weight has no defensible
# meaning (it would silently re-weight expert stage votes). At its equal
# default it cancelled in the share normalization — an inert dial, removed
# per design philosophy #8 (like neutral_threshold and t_copula_df).
# ModelConfig.from_json tolerates it in old snapshots.
DEFAULT_FORCE_WEIGHTS = {f: 1.0 / len(FORCES) for f in FORCES}  # Equal: ~16.7%

# ── Cell weights = each (category, region) cell's share of HCB gross profit ──
# 2.11.0 (owner rulings of 3 and 10 September 2026, DECISION_LOG Part H, O6):
# the 52 composite cells (13 categories × 4 regions) are rolled up to the
# category and portfolio numbers with the relevant part of the HCB P&L that
# actually sits in each category × region combination — a 13 × 4 matrix of
# gross-profit SHARES (non-negative, sum 1). This replaces the two separable
# vectors 2.10.0 used (config.region_weights = the Henkel Group FY2025 sales
# split applied to every category, then equal config.category_weights).
#
#   category shift[c]  = Σ_r W[c][r] · cell_shift[c][r] / Σ_r W[c][r]
#   portfolio shift    = Σ_c Σ_r W[c][r] · cell_shift[c][r]
#
# A separable matrix W[c][r] = category_weight[c] · region_weight[r]
# reproduces the 2.10.0 numbers exactly (regression-locked in
# tests/test_bayesian_mc.py). Until the actual figures are loaded the matrix
# is the ESTIMATED HCB mix of O14, which is deliberately NOT separable: every
# category carries its own regional mix, so the category numbers move when the
# mix does. The flat 1/52 grid it replaced is still available as
# EQUAL_CELL_WEIGHTS, and is itself an assumption rather than a neutral one:
# it puts a quarter of the pool in each region. HCB's
# presence in a cell enters the model ONLY through this matrix: the exposure
# scores stay mechanism-only, and a cell where HCB has no business carries a
# zero share, which silences its mechanism score in the roll-up (O9).
#
# The actual shares reach the production run as a FILE
# (scripts/run_50k_prod.py --cell-weights FILE, JSON; absolute gross-profit
# figures are normalised to shares before the engine is constructed and are
# never persisted — design philosophy #5, PRISM never sees absolute figures).
# The Config sheet edits the same object for the in-memory API state and
# shows the marginals read-only. region_weights / category_weights are now
# DERIVED from this matrix (ModelConfig.__post_init__): region_weights[r] =
# Σ_c W[c][r], category_weights[c] = Σ_r W[c][r]. They are no longer inputs.
#
# 2.12.0 (owner ruling O14, 2026-09-11): the default is no longer the equal
# placeholder. It is an ESTIMATE of the HCB gross-profit mix, built from public
# reporting and category knowledge, because a flat 1/52 grid is itself a strong
# and wrong assumption: it puts a quarter of the pool in each region while HCB's
# gross profit is roughly half European, and Europe is the most exposed region.
# The estimate is NOT Henkel P&L and never claims to be; every input carries a
# grade (B / E / G) in the record below, the Config sheet renders those grades,
# and the source string says so on every run that uses it.
#
# O6 is unchanged: the real shares still arrive as a file kept outside git
# (run_50k_prod.py --cell-weights FILE), and that file still overrides this.
# What changed is only the fallback when no file is passed.
#
# Generated by scripts/build_estimated_cell_weights.py; the JSON
# data/cell_weights_estimated_v1.json is the record and the test lock. Rewrite
# the comment, the record and the constants in one edit if this is ever
# regenerated (F-28).
#
# Marginals: categories Colour 17.1, Care 13.0, Styling 7.1, Body 8.0,
# FCN 24.1, FCA 4.3, FFI 6.7, LAD 2.6, HDW 3.4, ADW 6.5, HSC 4.1, TOI 2.5,
# IC 0.6 percent; regions Europe 51.4, North America 23.2, Asia 5.6,
# High Growth 19.8 percent.
DEFAULT_CELL_WEIGHTS = {
    "Hair: Color":   {"Europe": 0.094047313, "North America": 0.025649267, "Asia": 0.010259707, "High Growth": 0.041038827},
    "Hair: Care":    {"Europe": 0.058626896, "North America": 0.019542299, "Asia": 0.015633839, "High Growth": 0.036478958},
    "Hair: Styling": {"Europe": 0.038813177, "North America": 0.012702494, "Asia": 0.004939859, "High Growth": 0.014113882},
    "Hair: Body":    {"Europe": 0.027865870, "North America": 0.035827548, "Asia": 0.002388503, "High Growth": 0.013534851},
    "LHC: FCN":      {"Europe": 0.108408331, "North America": 0.091544813, "Asia": 0.007227222, "High Growth": 0.033727036},
    "LHC: FCA":      {"Europe": 0.028209194, "North America": 0.005207851, "Asia": 0.002169938, "High Growth": 0.007811777},
    "LHC: FFI":      {"Europe": 0.033656181, "North America": 0.020193709, "Asia": 0.002692495, "High Growth": 0.010769978},
    "LHC: LAD":      {"Europe": 0.015588126, "North America": 0.005196042, "Asia": 0.001299011, "High Growth": 0.003897032},
    "LHC: HDW":      {"Europe": 0.018510900, "North America": 0.003365618, "Asia": 0.003365618, "High Growth": 0.008414045},
    "LHC: ADW":      {"Europe": 0.048712894, "North America": 0.007794063, "Asia": 0.001948516, "High Growth": 0.006495053},
    "LHC: HSC":      {"Europe": 0.024799291, "North America": 0.003719894, "Asia": 0.002066608, "High Growth": 0.010746360},
    "LHC: TOI":      {"Europe": 0.014879575, "North America": 0.000991972, "Asia": 0.001239965, "High Growth": 0.007687780},
    "LHC: IC":       {"Europe": 0.002169938, "North America": 0.000309991, "Asia": 0.000619982, "High Growth": 0.003099911},
}
# Verbatim the record's own "source" (locked by tests/test_cell_weights.py),
# and under the 400-character cap that PUT /api/v1/config enforces.
DEFAULT_CELL_WEIGHTS_SOURCE = (
    "ESTIMATE, not Henkel P&L: HCB gross-profit share per category x region, "
    "built 2026-09-11 from public reporting and category knowledge (owner "
    "ruling O14). Every input is graded B / E / G; the grades and the whole "
    "derivation are on the Config sheet, the record is "
    "data/cell_weights_estimated_v1.json. The finance figures override this "
    "via run_50k_prod.py --cell-weights FILE."
)

# The neutral basis, kept as a named constant so it stays selectable from the
# Config sheet and so the pre-O14 numbers remain reproducible under test.
EQUAL_CELL_WEIGHTS = {
    c: {r: 1.0 / (len(CATEGORIES) * len(REGIONS)) for r in REGIONS} for c in CATEGORIES
}
EQUAL_CELL_WEIGHTS_SOURCE = (
    "Equal placeholder: each of the 52 category x region cells = 1/52 of the "
    "HCB gross-profit pool (owner decision 2026-09-03/10, extended to 13 "
    "categories by O13, superseded as the default by O14). This carries no "
    "view on where HCB's gross profit sits, which is itself an assumption: it "
    "weights every region equally."
)
# DEFAULT_REGION_WEIGHTS / DEFAULT_CATEGORY_WEIGHTS deleted (2.11.0): the
# Henkel Group FY2025 regional sales split (Europe 0.38 / North America 0.26 /
# Asia 0.17 / High Growth 0.19) that 2.10.0 used as a documented proxy is
# retired by owner decision (equal cells until actuals); its provenance is
# recorded in DECISION_LOG Part H. ModelConfig.from_json still reads old
# snapshots that carry only the two vectors and rebuilds the matrix as their
# outer product, so pre-2.11 semantics are preserved exactly for old runs.


def cell_weights_outer(region_weights: dict, category_weights: dict) -> dict:
    """Build a separable 13 × 4 cell-weight matrix from two marginal vectors.

    Used to read pre-2.11 config snapshots (which carried only
    ``region_weights`` and ``category_weights``) and by the regression tests
    that lock the 2.10.0 numbers. Both vectors are normalised first so a
    slightly-off snapshot still yields a matrix that sums to 1.
    """
    rw = {r: float(region_weights.get(r, 0.0)) for r in REGIONS}
    cw = {c: float(category_weights.get(c, 0.0)) for c in CATEGORIES}
    rs, cs = sum(rw.values()), sum(cw.values())
    if rs <= 0:
        rw = {r: 1.0 / len(REGIONS) for r in REGIONS}; rs = 1.0
    if cs <= 0:
        cw = {c: 1.0 / len(CATEGORIES) for c in CATEGORIES}; cs = 1.0
    return {c: {r: (cw[c] / cs) * (rw[r] / rs) for r in REGIONS} for c in CATEGORIES}


def cell_weight_marginals(cell_weights: dict) -> tuple:
    """(region_weights, category_weights) marginals of a cell-weight matrix.

    Column sums give the region shares, row sums the category shares. No
    normalisation is applied here: the validator enforces the sum-to-one
    constraint, and the engine normalises defensively."""
    rw = {r: float(sum(float((cell_weights.get(c) or {}).get(r, 0.0)) for c in CATEGORIES)) for r in REGIONS}
    cw = {c: float(sum(float((cell_weights.get(c) or {}).get(r, 0.0)) for r in REGIONS)) for c in CATEGORIES}
    return rw, cw

# ── Peak-year timing jitter (2.10.0, F4) ────────────────────────────
# Timing uncertainty: each iteration perturbs every trend's peak_year by a
# small integer offset (triangular, symmetric) so the velocity/timing bands
# carry real "it arrives a year earlier/later" content instead of measuring
# only the spread of a fixed schedule shape (audit F4 — the 2026↔2030 paths
# were correlated 0.993, i.e. one draw drove the whole path). 0 disables.
# Default ±1 year: offsets {-1, 0, +1} with triangular weights {0.25, 0.5, 0.25}.
DEFAULT_PEAK_YEAR_JITTER = 1

# ── Uncertainty score per trend (2.11.0, owner ruling O7) ───────────────
# One score per trend on a 0–5 scale: the dispersion around the modelled
# SIZE and TIMING of the effect, given its direction. It is not probability
# (how likely the effect is at all) and not the display-only Confidence
# (how well the present state is evidenced). Scale, as scored in the
# September 2026 review:
#   0 fixed by law or contract, no material dispersion
#   1 size within about ±25 %, timing dated or within a year
#   2 well-evidenced mechanism, size within about ±50 %, timing 1–2 years
#   3 size could be half or double, or the onset depends on an undated trigger
#   4 size could be near zero or more than double (decisions not yet taken:
#     fee schedules, court rulings, platform strategies, commodity paths)
#   5 the sign of the effect could differ across scenarios, or it may not
#     materialise inside the horizon at all
# Two engine uses, both per trend and both inert when the score is absent:
#   • Beta-prior concentration κ = α + β (2.10.0 ran every trend at κ = 6):
#     α = κ·p/6, β = κ − α, floored at 0.5. The MEAN stays p/6 for every
#     score (the published score→prior table 1→0.17 … 5→0.83 is unchanged),
#     only the spread of the probability draws follows the score.
#   • Peak-year jitter width in years (2.10.0 used one global ±1 for all).
UNCERTAINTY_KAPPA = {0: 24, 1: 16, 2: 10, 3: 6, 4: 4, 5: 3}
UNCERTAINTY_PEAK_JITTER = {0: 0, 1: 1, 2: 1, 3: 2, 4: 3, 5: 4}
LEGACY_BETA_CONCENTRATION = 6  # α + β for a trend without an uncertainty score (2.10.0 behaviour)
BETA_PRIOR_FLOOR = 0.5


def beta_prior_for(probability: int, uncertainty=None) -> tuple:
    """(α, β) of a trend's structured-judgment Beta prior.

    ``uncertainty`` None (no score) → the 2.10.0 prior (p, 6 − p) exactly.
    With a score, the concentration follows UNCERTAINTY_KAPPA; the mean is
    p/6 in every case (the 0.5 floors never bind for p in 1..5 and κ ≥ 3).
    """
    if uncertainty is None:
        # The 2.10.0 formula verbatim (no upper clamp), so dirty out-of-range
        # data yields the same prior as before.
        p0 = max(1, int(probability))
        return (p0, max(6 - p0, 1))
    p = max(1, min(5, int(probability)))
    u = max(0, min(5, int(uncertainty)))
    kappa = float(UNCERTAINTY_KAPPA[u])
    alpha = max(BETA_PRIOR_FLOOR, kappa * p / 6.0)
    beta = max(BETA_PRIOR_FLOOR, kappa - alpha)
    return (alpha, beta)


def peak_jitter_for(uncertainty, global_jitter: int) -> int:
    """Per-trend peak-year jitter width in years.

    ``config.peak_year_jitter`` keeps its 2.10.0 meaning as the engine-wide
    switch: 0 disables timing jitter for EVERY trend (the golden fixture and
    the magnitude-only diagnostics rely on that). When it is on (> 0), a
    scored trend takes its width from UNCERTAINTY_PEAK_JITTER and an
    unscored trend takes the global width, exactly as in 2.10.0.
    """
    g = int(global_jitter or 0)
    if g <= 0:
        return 0
    if uncertainty is None:
        return g
    return int(UNCERTAINTY_PEAK_JITTER[max(0, min(5, int(uncertainty)))])

# ── Copula parameters ──────────────────────────────────────────────
# D20 (June 2026): DEFAULT_T_COPULA_DF deleted with the t-copula tail layer.
# Post-D1 re-test showed the df dial inert (<2% portfolio band effect across
# df 4 → ∞); the engine runs a Gaussian copula. See
# audit/strategy-review/verification/v8_d20_tcopula_df_out.txt.
DEFAULT_WITHIN_FORCE_RHO = 0.3
DEFAULT_RESIDUAL_CROSS_RHO = 0.05


def build_trend_correlation_matrix(trend_forces, within_force_rho, force_correlation_matrix):
    """Raw N×N trend-level correlation matrix (NO positive-definite repair).

    Single source of truth (T16, June 2026) for the matrix implied by
    (within_force_rho, force_correlation_matrix) over a trend population given
    by ``trend_forces`` (a list of force names, one per trend). Same-force pairs
    take ``within_force_rho``; cross-force pairs take the configured pairwise
    value or ``DEFAULT_RESIDUAL_CROSS_RHO``.

    Used by BOTH the engine (``_build_correlation_matrix``, which then applies
    PSD repair) and the config validator's spectral gate
    (``correlation_lambda_min``) so the two can never drift apart.
    """
    import numpy as np
    n = len(trend_forces)
    if n == 0:
        return np.eye(0)
    R = np.eye(n)
    fcm = force_correlation_matrix or {}
    for i in range(n):
        fi = trend_forces[i]
        row = fcm.get(fi, {})
        for j in range(i + 1, n):
            if fi == trend_forces[j]:
                rho = within_force_rho
            else:
                rho = row.get(trend_forces[j], DEFAULT_RESIDUAL_CROSS_RHO)
            R[i, j] = R[j, i] = rho
    return R

# ── Force Overlap Matrix (replaces flat attenuation) ────────────────
# Cross-force mechanism overlap: O[i][j] = fraction of force i's signal
# that is already captured by force j. Asymmetric — "Government captures
# 40% of Environmental's signal" ≠ "Environmental captures 40% of
# Government's signal."
#
# Purpose: When compounding forces multiplicatively, forces that share
# underlying mechanisms (e.g., PFAS regulation = both Government AND
# Environmental) double-count impact. The overlap matrix replaces the
# blunt 0.5 flat attenuation with a principled per-force dampening.
#
# Effective attenuation per force i:
#   eff_att_i = base_attenuation × (1 - mean(O[i][j] for j ≠ i))
#
# Example: Government overlaps 40% with Environmental, 20% with Technology,
#   15% with Customer, 10% with Consumer, 5% with Competitive →
#   mean overlap = 0.18 → eff_att = 0.5 × (1 - 0.18) = 0.41
#
# Rationale per pair (FMCG/Henkel context):
#   Gov ↔ Env 0.40/0.35: PFAS ban, DPP, PPWR are both regulatory AND
#     environmental; strongest overlap in the model
#   Consumer ↔ Env 0.20/0.25: sustainability preference = consumer behavior
#     AND environmental pressure; moderate overlap
#   Consumer ↔ Competitive 0.20/0.15: consumer shifts drive competitive
#     repositioning; cause-and-effect, not same mechanism
#   Gov ↔ Tech 0.20/0.15: regulation triggers reformulation R&D; distinct
#     mechanisms but linked spending
#   Customer ↔ Competitive 0.25/0.20: channel power and competitive dynamics
#     intertwined (PL, discounter strategy)
#   Tech ↔ Competitive 0.15/0.20: tech creates competitive gaps; moderate
#   Consumer ↔ Customer 0.15/0.20: consumer demand shapes channel; moderate
#   Other pairs: ≤0.10 (largely independent mechanisms)

DEFAULT_FORCE_OVERLAP_MATRIX = {
    "Consumer": {"Consumer": 0.000, "Customer": 0.050, "Technology": 0.000, "Government": 0.030, "Environmental": 0.000, "Competitive": 0.050},
    "Customer": {"Consumer": 0.050, "Customer": 0.000, "Technology": 0.245, "Government": 0.206, "Environmental": 0.223, "Competitive": 0.110},
    "Technology": {"Consumer": 0.000, "Customer": 0.272, "Technology": 0.000, "Government": 0.232, "Environmental": 0.345, "Competitive": 0.030},
    "Government": {"Consumer": 0.030, "Customer": 0.153, "Technology": 0.159, "Government": 0.000, "Environmental": 0.200, "Competitive": 0.000},
    "Environmental": {"Consumer": 0.000, "Customer": 0.367, "Technology": 0.450, "Government": 0.405, "Environmental": 0.000, "Competitive": 0.000},
    "Competitive": {"Consumer": 0.050, "Customer": 0.133, "Technology": 0.030, "Government": 0.000, "Environmental": 0.000, "Competitive": 0.000},
}

# ── Within-Force Overlap ───────────────────────────────────────────
# How much do trends WITHIN the same force overlap in mechanism?
# When 15 Consumer trends score a category, many capture overlapping
# phenomena (clean beauty ≈ conscious consumption ≈ premiumization).
# The within-force overlap dampens the sum of trend scores within a
# force to avoid over-counting.
#
# Applied as: dampened_sum = raw_sum × (1 - overlap × (n_active - 1) / n_active)
# Where n_active = number of trends with non-zero exposure for that category.
#
# Example: Consumer has 15 trends, 8 expose Hair Color, overlap = 0.25
#   dampening = 1 - 0.25 × (8-1)/8 = 1 - 0.219 = 0.781
#   So the raw sum is reduced by ~22%
#
# Rationale:
#   Consumer 0.25: many trends overlap (clean beauty, sustainability pref,
#     premiumization, silver economy all share "willingness to pay more")
#   Government 0.30: EU legislative push creates correlated regulatory trends
#     (PFAS, DPP, PPWR, Green Claims all stem from European Green Deal)
#   Environmental 0.30: interconnected (PFAS, water stress, climate, circular
#     economy all stem from planetary boundaries framework)
#   Technology 0.15: more distinct mechanisms (biotech ≠ AI ≠ concentrated)
#   Customer 0.20: channel trends moderately overlap (discounter growth,
#     PL penetration, retail media all about retailer power)
#   Competitive 0.15: competitor-specific trends are more independent

DEFAULT_WITHIN_FORCE_OVERLAP = {
    "Consumer":        0.100,
    "Customer":        0.221,
    "Technology":      0.384,
    "Government":      0.123,
    "Environmental":   0.401,
    "Competitive":     0.100,
}

# ── Force correlation matrix (cross-force correlations for copula) ──────
# v3.6 RECALIBRATION (June 2026, audit finding F-01): the previous matrix
# (off-diagonals 0.05-0.30, "DAG weights × 0.5") was NOT positive semi-
# definite once expanded to the 99-trend population with within-force
# rho = 0.3 (min eigenvalue -1.68). The engine silently repaired it on every
# run, rescaling ALL correlations to ~0.37x their configured values — so the
# configured dependence was never the effective dependence.
# Fix: the same relative coupling structure scaled by 0.73 (the largest
# uniform scale keeping the implied 99-trend matrix comfortably PSD,
# min eigenvalue ~0.14). These values are now valid AS ENTERED: the engine's
# PSD repair no longer fires on defaults, and PUT /api/v1/config rejects
# settings that would make the implied matrix invalid (spectral gate).
# 2.11.0 (O11): re-checked on the 51-driver population — the implied 51×51
# matrix has min eigenvalue +0.41 (a wider margin than the 99-trend +0.14
# because the force mix is less Consumer-heavy), so the matrix is kept
# unchanged; scripts/compute_attenuation_v3_12.py records the value
# (correlation_lambda_min_51) and the CLI pre-flight gate (F6) re-checks the
# loaded mix on every production run.
DEFAULT_FORCE_CORRELATIONS = {
    "Consumer":      {"Consumer": 1.0,  "Customer": 0.18, "Technology": 0.11, "Government": 0.04, "Environmental": 0.15, "Competitive": 0.15},
    "Customer":      {"Consumer": 0.18, "Customer": 1.0,  "Technology": 0.11, "Government": 0.15, "Environmental": 0.04, "Competitive": 0.18},
    "Technology":    {"Consumer": 0.11, "Customer": 0.11, "Technology": 1.0,  "Government": 0.22, "Environmental": 0.11, "Competitive": 0.18},
    "Government":    {"Consumer": 0.04, "Customer": 0.15, "Technology": 0.22, "Government": 1.0,  "Environmental": 0.22, "Competitive": 0.04},
    "Environmental": {"Consumer": 0.15, "Customer": 0.04, "Technology": 0.11, "Government": 0.22, "Environmental": 1.0,  "Competitive": 0.04},
    "Competitive":   {"Consumer": 0.15, "Customer": 0.18, "Technology": 0.18, "Government": 0.04, "Environmental": 0.04, "Competitive": 1.0},
}

@dataclass(frozen=True)
class ModelConfig:
    """Complete model configuration snapshot.

    B4: frozen=True. Instances are immutable. Any caller that wants to
    "change" a parameter must build a new instance via ``copy_with(**overrides)``.
    This eliminates the race condition where, e.g., sensitivity sweeps
    mutated ``self.config.attenuation`` mid-run while another request
    was reading it. It also keeps every simulation run tied to a single,
    hashable config identity which is useful for caching and audit.
    """
    region: str = "Global"
    aggregation_method: str = "Multiplicative"
    # v3.2: scalar ``attenuation`` removed. The engine consumes a per-force
    # dict directly. Source-of-truth is data/Attenuation_Calibration.xlsx.
    per_force_attenuation: dict = field(default_factory=lambda: dict(DEFAULT_PER_FORCE_ATTENUATION))
    attenuation_source: str = DEFAULT_ATTENUATION_SOURCE  # "calibrated_v3.5_april2026" | "calibrated_v3.1_april2026" (legacy) | "admin_override"
    base_year: int = DEFAULT_BASE_YEAR
    path_years: list = field(default_factory=lambda: list(DEFAULT_PATH_YEARS))
    materialization: dict = field(default_factory=lambda: dict(DEFAULT_MATERIALIZATION))
    force_weights: dict = field(default_factory=lambda: dict(DEFAULT_FORCE_WEIGHTS))
    # vc_weights deleted (2.9.0): the VC lens is an epicentre partition —
    # see DEFAULT_VC_WEIGHTS tombstone above. from_json drops the old key.
    #
    # 2.11.0 (O6): cell_weights is THE roll-up input — {category: {region:
    # share}}, 13 × 4, sum 1. region_weights and category_weights are DERIVED
    # marginals, recomputed in __post_init__; they are accepted as inputs only
    # in the legacy form (no cell_weights given → outer product), so pre-2.11
    # snapshots and old callers keep their exact semantics. Passing both a
    # matrix and inconsistent marginals is rejected.
    cell_weights: Optional[dict] = None
    cell_weights_source: str = DEFAULT_CELL_WEIGHTS_SOURCE
    region_weights: Optional[dict] = None    # derived (read-only) since 2.11.0
    category_names: list = field(default_factory=lambda: list(CATEGORIES))
    category_weights: Optional[dict] = None  # derived (read-only) since 2.11.0
    iterations: int = DEFAULT_ITERATIONS
    # F4 (2.10.0): per-iteration peak-year jitter magnitude in years (0 = off).
    peak_year_jitter: int = DEFAULT_PEAK_YEAR_JITTER
    within_force_rho: float = DEFAULT_WITHIN_FORCE_RHO
    force_correlation_matrix: dict = field(default_factory=lambda: dict(DEFAULT_FORCE_CORRELATIONS))
    force_overlap_matrix: dict = field(default_factory=lambda: dict(DEFAULT_FORCE_OVERLAP_MATRIX))
    within_force_overlap: dict = field(default_factory=lambda: dict(DEFAULT_WITHIN_FORCE_OVERLAP))

    def __post_init__(self):
        """Resolve the cell-weight matrix and its derived marginals (2.11.0).

        Three constructions are accepted:
          • cell_weights given → region/category weights are derived from it
            (any marginals also passed must agree within 1e-6, else
            ValueError — the two vectors are no longer independent inputs);
          • no cell_weights but marginals given (pre-2.11 snapshot, legacy
            caller) → the separable outer product, which reproduces the
            2.10.0 roll-up exactly;
          • nothing given → DEFAULT_CELL_WEIGHTS (the O14 estimated HCB mix).
        The dataclass is frozen, so the resolved values are written with
        object.__setattr__ once, here.
        """
        cw = self.cell_weights
        if not cw:
            if self.region_weights or self.category_weights:
                cw = cell_weights_outer(
                    self.region_weights or {r: 1.0 / len(REGIONS) for r in REGIONS},
                    self.category_weights or {c: 1.0 / len(CATEGORIES) for c in CATEGORIES},
                )
            else:
                cw = {c: dict(v) for c, v in DEFAULT_CELL_WEIGHTS.items()}
        else:
            cw = {str(c): {str(r): float(v) for r, v in (row or {}).items()} for c, row in cw.items()}
        rw, catw = cell_weight_marginals(cw)
        for given, derived, name in ((self.region_weights, rw, "region_weights"),
                                     (self.category_weights, catw, "category_weights")):
            if given:
                for k, v in derived.items():
                    if abs(float(given.get(k, 0.0)) - v) > 1e-6:
                        raise ValueError(
                            f"{name} are derived from cell_weights since 2.11.0 and the "
                            f"supplied value for '{k}' ({given.get(k)}) does not match the "
                            f"matrix marginal ({v:.6f}). Pass cell_weights only."
                        )
        object.__setattr__(self, "cell_weights", cw)
        object.__setattr__(self, "region_weights", rw)
        object.__setattr__(self, "category_weights", catw)

    def to_json(self) -> str:
        return json.dumps(self.__dict__, default=str)

    @classmethod
    def from_json(cls, s: str) -> "ModelConfig":
        """Reconstruct from a JSON snapshot, tolerating retired fields.

        Older config snapshots may carry fields the model no longer has
        (e.g. ``t_copula_df``, deleted in D20, the v3.2-retired scalar
        ``attenuation``, ``neutral_threshold``, deleted July 2026 as
        engine-inert, or ``vc_weights``, deleted in 2.9.0 with the VC
        epicentre partition). Unknown keys are dropped rather than crashing.
        Pre-2.11 snapshots carry ``region_weights``/``category_weights`` but
        no ``cell_weights``; __post_init__ rebuilds the matrix as their outer
        product so the old roll-up semantics are preserved.
        """
        from dataclasses import fields as _fields
        data = json.loads(s)
        known = {f.name for f in _fields(cls)}
        kwargs = {k: v for k, v in data.items() if k in known}
        if kwargs.get("cell_weights"):
            # A 2.11+ snapshot: the marginals it carries are derived values —
            # drop them so a rounding difference cannot trip the consistency check.
            kwargs.pop("region_weights", None)
            kwargs.pop("category_weights", None)
        return cls(**kwargs)

    def copy_with(self, **overrides) -> "ModelConfig":
        """Return a new ModelConfig with the given fields replaced.

        Use this instead of mutating in place. Deep-copies dict/list fields
        that aren't in ``overrides`` so modifying the returned instance's
        mutable members does not bleed back into the original.
        """
        from dataclasses import fields as _fields
        import copy as _copy
        values = {}
        for f in _fields(self):
            if f.name in overrides:
                values[f.name] = overrides[f.name]
            else:
                v = getattr(self, f.name)
                if isinstance(v, (dict, list)):
                    values[f.name] = _copy.deepcopy(v)
                else:
                    values[f.name] = v
        # 2.11.0: the marginals are derived. Overriding the matrix (or, in the
        # legacy form, one of the vectors) must not carry the stale derived
        # values into the new instance, where they would fail the consistency
        # check in __post_init__.
        if "cell_weights" in overrides:
            if "region_weights" in overrides or "category_weights" in overrides:
                raise ValueError(
                    "copy_with: pass either cell_weights (the matrix) or region_weights / "
                    "category_weights (the legacy separable vectors), not both — the "
                    "marginals are derived from the matrix since 2.11.0.")
            values["region_weights"] = None
            values["category_weights"] = None
        elif "region_weights" in overrides or "category_weights" in overrides:
            # Legacy form: the matrix is rebuilt as the outer product of the
            # (possibly new) region vector and the (possibly new) category
            # vector — the separable 2.10.0 semantics, by request.
            values["cell_weights"] = None
        return ModelConfig(**values)
