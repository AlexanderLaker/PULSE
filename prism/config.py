"""Model taxonomy, default parameters and the ModelConfig object.

Everything the engine needs apart from the drivers themselves lives here: the
force, category, value-chain and region taxonomies, the materialisation
curves, the uncertainty tables, the overlap correction, the copula
correlations and the gross-profit cell weights. The numeric blocks that come
from a generator are marked as such; regenerate them rather than editing by
hand. docs/MODEL.md explains the method behind each parameter.
"""

import copy
import math
import re
from dataclasses import dataclass, field, fields
from typing import Optional

# ── Taxonomies ──────────────────────────────────────────────────────────────

FORCES = ["Consumer", "Customer", "Technology", "Government", "Environmental", "Competitive"]

#: The letter of each force in a driver's display code: C-01, K-13, X-15.
FORCE_CODE_LETTERS = {"Consumer": "C", "Customer": "K", "Technology": "T",
                      "Government": "G", "Environmental": "E", "Competitive": "X"}


def display_code(driver_id: str, force: str) -> str:
    """A driver's display code from its id and force: consumer_r01 -> C-01."""
    m = re.search(r"_r(\d{2})$", driver_id)
    if not m:
        raise ValueError(f"cannot derive a display code from id {driver_id!r}")
    return f"{FORCE_CODE_LETTERS[force]}-{m.group(1)}"

# Shelf order. "LHC: HSC" is surface, bathroom, kitchen, floor and glass
# cleaning plus bleach and polishes; "LHC: TOI" is toilet cleaners, rim blocks
# and toilet gels.
CATEGORIES = [
    "Hair: Color", "Hair: Care", "Hair: Styling", "Hair: Body",
    "LHC: FCN", "LHC: FCA", "LHC: FFI", "LHC: LAD",
    "LHC: HDW", "LHC: ADW", "LHC: HSC", "LHC: TOI", "LHC: IC",
]

VC_STEPS = [
    "Raw Materials", "Formulation", "Manufacturing", "Packaging",
    "Supply Chain", "Marketing", "Commercial", "Consumer",
]

REGIONS = ["Europe", "North America", "Asia", "High Growth"]


def vc_epicentre_of(vc_exposure: Optional[dict]) -> Optional[int]:
    """1-based value-chain epicentre stage of a driver, or None if unscored.

    Experts score the value chain as one epicentre stage; the stored eight-step
    0-5 profile is the editor's serialisation of that choice. The epicentre is
    the highest-scoring stage; ties resolve towards the exposure-weighted
    centroid, and an exact tie in distance goes to the earlier stage.

    ``epicentreOf`` in lib/valueChain.ts implements the same rule.
    tests/test_vc_epicentre.py and tests/frontend/vcEpicentre.test.ts pin both
    to one fixture table, so the engine and the interface always agree on a
    driver's stage.
    """
    if not vc_exposure:
        return None
    vs = [float(vc_exposure.get(step) or 0.0) for step in VC_STEPS]
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
    """Name of a driver's epicentre stage (a VC_STEPS entry), or None."""
    stage = vc_epicentre_of(vc_exposure)
    return VC_STEPS[stage - 1] if stage is not None else None


# ── Horizon and materialisation ─────────────────────────────────────────────

DEFAULT_ITERATIONS = 10_000
DEFAULT_BASE_YEAR = 2025

#: The production recipe: every published run (scripts/run_production.py) and
#: the reference run of the PRISM Analysis (scripts/build_driver_analysis.py).
PRODUCTION_SEED = 42
PRODUCTION_CHAINS = 3
PRODUCTION_ITERATIONS = 50_000
DEFAULT_PATH_YEARS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035]

# Default schedules for a driver scored without a peak year or diffusion curve:
# the force's own schedule where one is defined, otherwise the general one.
# Drivers with a peak year and a curve use compute_materialization_schedule.
DEFAULT_MATERIALIZATION = {
    2026: 0.08, 2027: 0.18, 2028: 0.32, 2029: 0.48, 2030: 0.62,
    2031: 0.74, 2032: 0.84, 2033: 0.91, 2034: 0.96, 2035: 1.00,
}
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

# Diffusion curves: the shape of the ramp from onset to peak.
VALID_DIFFUSION_CURVES = ["s_curve", "linear", "front_loaded", "back_loaded", "step_function"]


def compute_materialization_schedule(
    peak_year: int,
    diffusion_curve: str,
    path_years: list[int] | None = None,
    base_year: int = DEFAULT_BASE_YEAR,
    start_year: int | None = None,
) -> dict[int, float]:
    """Share of a driver's full effect that has materialised in each path year.

    The effect is zero up to the onset, ramps along ``diffusion_curve`` and is
    complete from ``peak_year`` on. The onset is the later of ``base_year`` and
    the driver's ``start_year`` (``base_year`` when ``start_year`` is None). A
    peak at or before the onset ramps to the horizon instead.

    Curves: ``linear``; ``front_loaded`` (square root, fast then flat);
    ``back_loaded`` (quadratic, slow then fast); ``step_function`` (5 percent
    until 80 percent of the way, then a jump); ``s_curve`` (a logistic centred
    halfway, rescaled to run from 0 to 1).
    """
    years = path_years or DEFAULT_PATH_YEARS
    onset = base_year if start_year is None else max(int(base_year), int(start_year))
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
            schedule[year] = 0.0
            continue
        span = max(py - onset, 1)
        t = max(0.0, min(1.0, (year - onset) / span))

        if diffusion_curve == "linear":
            frac = t
        elif diffusion_curve == "front_loaded":
            frac = math.sqrt(t)
        elif diffusion_curve == "back_loaded":
            frac = t * t
        elif diffusion_curve == "step_function":
            frac = 0.05 if t < 0.8 else (0.05 + (t - 0.8) / 0.2 * 0.95)
        else:  # s_curve
            frac = 1.0 / (1.0 + math.exp(-12 * (t - 0.5)))
            f0 = 1.0 / (1.0 + math.exp(-12 * (0 - 0.5)))
            f1 = 1.0 / (1.0 + math.exp(-12 * (1 - 0.5)))
            frac = (frac - f0) / (f1 - f0)

        schedule[year] = round(max(0.0, min(1.0, frac)), 4)

    # Every curve is non-decreasing; a schedule that "un-materialises" would
    # make a category shift reverse without cause, so it is refused outright.
    ordered = sorted(schedule)
    for prev_year, curr_year in zip(ordered, ordered[1:]):
        if schedule[curr_year] < schedule[prev_year]:
            raise ValueError(
                f"compute_materialization_schedule produced a non-monotonic schedule for "
                f"diffusion_curve='{diffusion_curve}', peak_year={peak_year}: "
                f"{curr_year} ({schedule[curr_year]}) is below {prev_year} ({schedule[prev_year]})."
            )
    return schedule


# ── Peak-year jitter and the uncertainty score ─────────────────────────────

# Each iteration shifts every driver's peak year by a small integer offset
# drawn from a symmetric triangular distribution, so the timing bands reflect
# "arrives a year earlier or later". This is the width in years for a driver
# without an uncertainty score; 0 switches timing jitter off for every driver.
DEFAULT_PEAK_YEAR_JITTER = 1

# One uncertainty score per driver, 0-5: the dispersion around the modelled
# size and timing of the effect, given its direction. It is neither the
# probability (how likely the effect is at all) nor the display-only
# confidence (how well the present state is evidenced).
#   0 fixed by law or contract, no material dispersion
#   1 size within about +/-25 percent, timing dated or within a year
#   2 well-evidenced mechanism, size within about +/-50 percent, timing 1-2 years
#   3 size could be half or double, or the onset depends on an undated trigger
#   4 size could be near zero or more than double (decisions not yet taken)
#   5 the sign could differ across scenarios, or it may not materialise at all
# It sets the Beta-prior concentration kappa = alpha + beta (the mean stays
# p/6 for every score) and the driver's peak-year jitter width.
UNCERTAINTY_KAPPA = {0: 24, 1: 16, 2: 10, 3: 6, 4: 4, 5: 3}
UNCERTAINTY_PEAK_JITTER = {0: 0, 1: 1, 2: 1, 3: 2, 4: 3, 5: 4}
BETA_PRIOR_FLOOR = 0.5


def beta_prior_for(probability: int, uncertainty=None) -> tuple:
    """(alpha, beta) of a driver's Beta prior on the materialisation probability.

    The prior is structured judgment set from the 1-5 probability score; it is
    never updated from data. Its mean is p/6. With an uncertainty score the
    concentration follows UNCERTAINTY_KAPPA; without one it is 6, which gives
    (p, 6 - p).
    """
    if uncertainty is None:
        p0 = max(1, int(probability))
        return (p0, max(6 - p0, 1))
    p = max(1, min(5, int(probability)))
    u = max(0, min(5, int(uncertainty)))
    kappa = float(UNCERTAINTY_KAPPA[u])
    alpha = max(BETA_PRIOR_FLOOR, kappa * p / 6.0)
    beta = max(BETA_PRIOR_FLOOR, kappa - alpha)
    return (alpha, beta)


def peak_jitter_for(uncertainty, global_jitter: int) -> int:
    """A driver's peak-year jitter width in years.

    ``global_jitter`` (ModelConfig.peak_year_jitter) is the engine-wide switch:
    0 disables timing jitter for every driver. When it is on, a scored driver
    takes its width from UNCERTAINTY_PEAK_JITTER and an unscored driver takes
    ``global_jitter``.
    """
    g = int(global_jitter or 0)
    if g <= 0:
        return 0
    if uncertainty is None:
        return g
    return int(UNCERTAINTY_PEAK_JITTER[max(0, min(5, int(uncertainty)))])


# ── Force weights ───────────────────────────────────────────────────────────

DEFAULT_FORCE_WEIGHTS = {f: 1.0 / len(FORCES) for f in FORCES}


# ── Overlap correction ──────────────────────────────────────────────────────
# A structured-judgment correction for mechanisms that two drivers or two
# forces share (a packaging levy is both a Government and an Environmental
# matter). It is derived from the drivers' category exposure vectors: weighted
# Jaccard similarity, excess over the random-pair baseline, a force-size
# asymmetry across forces, and per-pair mechanism adjustments with written
# reasons. The record is data/calibration/attenuation.json, written by
# scripts/compute_attenuation.py, which also prints the three blocks below;
# tests/test_calibration.py holds these constants to that record.
#
# Per force, the engine multiplies the force's compounded contribution by its
# attenuation, 0.5 x (1 - the mean of the force's row in the cross-force
# matrix over the five other forces). Within a force, same-force contributions are dampened by
# 1 - overlap x (n_eff - 1) / n_eff, with n_eff the magnitude-weighted
# effective number of contributing drivers in the cell.

DEFAULT_ATTENUATION_SOURCE = "overlap-correction-2026-09"

DEFAULT_PER_FORCE_ATTENUATION = {
    "Consumer":        0.487,
    "Customer":        0.417,
    "Technology":      0.412,
    "Government":      0.446,
    "Environmental":   0.378,
    "Competitive":     0.479,
}

DEFAULT_WITHIN_FORCE_OVERLAP = {
    "Consumer":        0.100,
    "Customer":        0.221,
    "Technology":      0.384,
    "Government":      0.123,
    "Environmental":   0.401,
    "Competitive":     0.100,
}

# O[i][j]: the share of force i's signal already carried by force j (not
# symmetric by design). It is the derivation input of the attenuation above,
# 0.5 x (1 - the mean of the force's row over the five other forces); the
# engine reads only the attenuation.
# The dashboard's configuration sheet shows it as the attenuation's provenance.
DEFAULT_FORCE_OVERLAP_MATRIX = {
    "Consumer": {"Consumer": 0.000, "Customer": 0.050, "Technology": 0.000, "Government": 0.030, "Environmental": 0.000, "Competitive": 0.050},
    "Customer": {"Consumer": 0.050, "Customer": 0.000, "Technology": 0.245, "Government": 0.206, "Environmental": 0.223, "Competitive": 0.110},
    "Technology": {"Consumer": 0.000, "Customer": 0.272, "Technology": 0.000, "Government": 0.232, "Environmental": 0.345, "Competitive": 0.030},
    "Government": {"Consumer": 0.030, "Customer": 0.153, "Technology": 0.159, "Government": 0.000, "Environmental": 0.200, "Competitive": 0.000},
    "Environmental": {"Consumer": 0.000, "Customer": 0.367, "Technology": 0.450, "Government": 0.405, "Environmental": 0.000, "Competitive": 0.000},
    "Competitive": {"Consumer": 0.050, "Customer": 0.133, "Technology": 0.030, "Government": 0.000, "Environmental": 0.000, "Competitive": 0.000},
}


# ── Copula correlations ─────────────────────────────────────────────────────
# Correlations of the latent Gaussian variables behind the drivers'
# probability draws: DEFAULT_WITHIN_FORCE_RHO for two drivers of the same
# force, the force-pair value across forces. They are restricted to [0, 1];
# the model has no negative dependence. The defaults are positive definite as
# entered on the current driver base (minimum eigenvalue about +0.41), so the
# engine's repair step never runs on them; run_production.py re-checks the
# loaded driver mix before every run.

DEFAULT_WITHIN_FORCE_RHO = 0.3
DEFAULT_RESIDUAL_CROSS_RHO = 0.05

DEFAULT_FORCE_CORRELATIONS = {
    "Consumer":      {"Consumer": 1.0,  "Customer": 0.18, "Technology": 0.11, "Government": 0.04, "Environmental": 0.15, "Competitive": 0.15},
    "Customer":      {"Consumer": 0.18, "Customer": 1.0,  "Technology": 0.11, "Government": 0.15, "Environmental": 0.04, "Competitive": 0.18},
    "Technology":    {"Consumer": 0.11, "Customer": 0.11, "Technology": 1.0,  "Government": 0.22, "Environmental": 0.11, "Competitive": 0.18},
    "Government":    {"Consumer": 0.04, "Customer": 0.15, "Technology": 0.22, "Government": 1.0,  "Environmental": 0.22, "Competitive": 0.04},
    "Environmental": {"Consumer": 0.15, "Customer": 0.04, "Technology": 0.11, "Government": 0.22, "Environmental": 1.0,  "Competitive": 0.04},
    "Competitive":   {"Consumer": 0.15, "Customer": 0.18, "Technology": 0.18, "Government": 0.04, "Environmental": 0.04, "Competitive": 1.0},
}


def build_driver_correlation_matrix(driver_forces, within_force_rho, force_correlation_matrix):
    """Driver-level N x N correlation matrix, without any repair.

    ``driver_forces`` lists the force of each driver. Same-force pairs take
    ``within_force_rho``; cross-force pairs take the configured force-pair
    value, or DEFAULT_RESIDUAL_CROSS_RHO for a pair the matrix does not name.
    The engine and the spectral check in config_validation both build the
    matrix here, so they cannot disagree.
    """
    import numpy as np
    n = len(driver_forces)
    if n == 0:
        return np.eye(0)
    R = np.eye(n)
    fcm = force_correlation_matrix or {}
    for i in range(n):
        fi = driver_forces[i]
        row = fcm.get(fi, {})
        for j in range(i + 1, n):
            if fi == driver_forces[j]:
                rho = within_force_rho
            else:
                rho = row.get(driver_forces[j], DEFAULT_RESIDUAL_CROSS_RHO)
            R[i, j] = R[j, i] = rho
    return R


# ── Cell weights ────────────────────────────────────────────────────────────
# The 52 composite cells (13 categories x 4 regions) roll up to the category
# and portfolio numbers with each cell's share of HCB gross profit W[c][r]
# (non-negative, summing to 1):
#
#   category shift[c] = sum_r W[c][r] * cell shift[c][r] / sum_r W[c][r]
#   portfolio shift   = sum_c sum_r W[c][r] * cell shift[c][r]
#
# HCB's presence in a cell enters the model only through W; the exposure
# scores describe the mechanism alone. A cell where HCB has no business
# carries a zero share and so contributes nothing.
#
# The default is an ESTIMATE of the HCB gross-profit mix built from public
# reporting and category knowledge, not Henkel P&L. Every input carries a
# grade (B public reporting supports it, E defensible but unverified, G
# low-confidence guess). The estimate is deliberately not separable: each
# category has its own regional mix. The finance shares replace it at run
# time (run_production.py --cell-weights FILE); absolute figures in that file
# are normalised to shares before the engine sees them and are never stored.
#
# Generated by scripts/build_cell_weights.py (record:
# data/calibration/cell_weights_estimate.json); tests/test_cell_weights.py
# holds the literal and the source text to the record.
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
DEFAULT_CELL_WEIGHTS_SOURCE = (
    "ESTIMATE, not Henkel P&L: HCB gross-profit share per category x region, "
    "built from public reporting and category knowledge. Every input is graded "
    "B / E / G; the derivation is in Settings under Model configuration and in "
    "data/calibration/cell_weights_estimate.json. A finance file passed to "
    "run_production.py --cell-weights replaces it."
)
#: How DEFAULT_CELL_WEIGHTS_SOURCE opens. A run whose weights source opens with
#: it ran on the estimate; the production run refuses a finance file whose
#: label does, so the dashboard can tell the two apart (lib/cellWeights.ts).
ESTIMATE_SOURCE_PREFIX = "ESTIMATE, not Henkel P&L"


def cell_weight_marginals(cell_weights: dict, categories=None) -> tuple:
    """(region_weights, category_weights): column and row sums of a cell matrix.

    ``categories`` defaults to CATEGORIES.
    """
    cats = list(CATEGORIES if categories is None else categories)
    rw = {r: float(sum(float((cell_weights.get(c) or {}).get(r, 0.0)) for c in cats)) for r in REGIONS}
    cw = {c: float(sum(float((cell_weights.get(c) or {}).get(r, 0.0)) for r in REGIONS)) for c in cats}
    return rw, cw


# ── ModelConfig ─────────────────────────────────────────────────────────────

def _default_cell_weights() -> dict:
    return {c: dict(row) for c, row in DEFAULT_CELL_WEIGHTS.items()}


@dataclass(frozen=True)
class ModelConfig:
    """The complete, immutable parameter set of one simulation.

    Instances never change after construction; derive a variant with
    ``copy_with(**overrides)``. ``region_weights`` and ``category_weights`` are
    derived from ``cell_weights`` (column and row sums) and cannot be passed in.
    """
    per_force_attenuation: dict = field(default_factory=lambda: dict(DEFAULT_PER_FORCE_ATTENUATION))
    attenuation_source: str = DEFAULT_ATTENUATION_SOURCE
    base_year: int = DEFAULT_BASE_YEAR
    path_years: list = field(default_factory=lambda: list(DEFAULT_PATH_YEARS))
    materialization: dict = field(default_factory=lambda: dict(DEFAULT_MATERIALIZATION))
    force_weights: dict = field(default_factory=lambda: dict(DEFAULT_FORCE_WEIGHTS))
    cell_weights: dict = field(default_factory=_default_cell_weights)
    cell_weights_source: str = DEFAULT_CELL_WEIGHTS_SOURCE
    category_names: list = field(default_factory=lambda: list(CATEGORIES))
    iterations: int = DEFAULT_ITERATIONS
    peak_year_jitter: int = DEFAULT_PEAK_YEAR_JITTER
    within_force_rho: float = DEFAULT_WITHIN_FORCE_RHO
    force_correlation_matrix: dict = field(default_factory=lambda: copy.deepcopy(DEFAULT_FORCE_CORRELATIONS))
    within_force_overlap: dict = field(default_factory=lambda: dict(DEFAULT_WITHIN_FORCE_OVERLAP))
    region_weights: dict = field(init=False)
    category_weights: dict = field(init=False)

    def __post_init__(self):
        cw = {str(c): {str(r): float(v) for r, v in (row or {}).items()}
              for c, row in (self.cell_weights or {}).items()}
        rw, catw = cell_weight_marginals(cw, self.category_names)
        object.__setattr__(self, "cell_weights", cw)
        object.__setattr__(self, "region_weights", rw)
        object.__setattr__(self, "category_weights", catw)

    def copy_with(self, **overrides) -> "ModelConfig":
        """A new ModelConfig with the given fields replaced (others deep-copied)."""
        values = {}
        for f in fields(self):
            if not f.init:
                continue
            if f.name in overrides:
                values[f.name] = overrides.pop(f.name)
            else:
                values[f.name] = copy.deepcopy(getattr(self, f.name))
        if overrides:
            raise TypeError(f"copy_with: unknown or derived fields {sorted(overrides)}")
        return ModelConfig(**values)
