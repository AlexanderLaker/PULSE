"""Model taxonomy, default parameters and the ModelConfig object.

Everything the engine needs apart from the drivers themselves lives here: the
force, category, value-chain and region taxonomies, the materialisation
curves, the uncertainty tables, the overlap correction, the copula
correlations and the gross-profit cell weights. Two of them are computed by
a generator and read from the module it writes: the overlap correction
(prism/overlap_correction.py) and the estimated cell weights
(prism/cell_weight_estimate.py). docs/MODEL.md explains the method behind
each parameter.
"""

import copy
import math
import re
from dataclasses import dataclass, field, fields

from prism import cell_weight_estimate, overlap_correction

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

# The value chain in order. A driver names one stage, its epicentre: the stage
# where its impact centres. The value-chain lens assigns the driver's whole
# contribution to it; propagation along the chain is not modelled.
VC_STAGES = [
    "Raw Materials", "Formulation", "Manufacturing", "Packaging",
    "Supply Chain", "Marketing", "Commercial", "Consumer",
]

REGIONS = ["Europe", "North America", "Asia", "High Growth"]


# ── Horizon and materialisation ─────────────────────────────────────────────

DEFAULT_BASE_YEAR = 2025


def first_peak_year(start_year: int) -> int:
    """The earliest peak year a driver can take: the year after its onset, the
    later of the base year and its start year (lib/format.ts firstPeakYear)."""
    return max(DEFAULT_BASE_YEAR, start_year) + 1


#: The production recipe: every published run (scripts/run_production.py) and
#: the reference run of the PRISM Analysis (scripts/build_driver_analysis.py).
#: The size of a run is a parameter of the run, not of the model.
PRODUCTION_SEED = 42
PRODUCTION_CHAINS = 3
PRODUCTION_ITERATIONS = 50_000
#: The run sizes the production run accepts, lowest and highest: at least
#: enough draws for a percentile to mean something; a value outside is a typo.
RUN_ITERATIONS_RANGE = (100, 1_000_000)
RUN_CHAINS_RANGE = (1, 10)

DEFAULT_PATH_YEARS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035]

# Diffusion curves: the shape of the ramp from onset to peak.
VALID_DIFFUSION_CURVES = ["s_curve", "linear", "front_loaded", "back_loaded", "step_function"]


def compute_materialization_schedule(
    peak_year: int,
    diffusion_curve: str,
    start_year: int,
    path_years: list[int] | None = None,
    base_year: int = DEFAULT_BASE_YEAR,
) -> dict[int, float]:
    """Share of a driver's full effect that has materialised in each path year.

    The effect is zero up to and including the onset, the later of
    ``base_year`` and the driver's ``start_year``; it ramps along
    ``diffusion_curve`` and is complete from ``peak_year`` on, which must come
    after the onset (simulation_problems refuses a driver whose peak does not,
    and the engine keeps a jittered peak after it).

    Curves: ``linear``; ``front_loaded`` (square root, fast then flat);
    ``back_loaded`` (quadratic, slow then fast); ``step_function`` (5 percent
    until 80 percent of the way, then a steep linear rise to full);
    ``s_curve`` (a logistic centred halfway, rescaled to run from 0 to 1).
    """
    years = path_years or DEFAULT_PATH_YEARS
    onset = max(int(base_year), int(start_year))
    if peak_year <= onset:
        raise ValueError(f"peak year {peak_year} does not come after the onset {onset}")

    schedule = {}
    for year in years:
        if year >= peak_year:
            schedule[year] = 1.0
            continue
        if year <= onset:
            schedule[year] = 0.0
            continue
        t = (year - onset) / (peak_year - onset)

        if diffusion_curve == "linear":
            frac = t
        elif diffusion_curve == "front_loaded":
            frac = math.sqrt(t)
        elif diffusion_curve == "back_loaded":
            frac = t * t
        elif diffusion_curve == "step_function":
            frac = 0.05 if t < 0.8 else (0.05 + (t - 0.8) / 0.2 * 0.95)
        elif diffusion_curve == "s_curve":
            frac = 1.0 / (1.0 + math.exp(-12 * (t - 0.5)))
            f0 = 1.0 / (1.0 + math.exp(-12 * (0 - 0.5)))
            f1 = 1.0 / (1.0 + math.exp(-12 * (1 - 0.5)))
            frac = (frac - f0) / (f1 - f0)
        else:
            raise ValueError(f"unknown diffusion curve {diffusion_curve!r}")

        schedule[year] = round(max(0.0, min(1.0, frac)), 4)
    return schedule


# ── Peak-year jitter and the uncertainty score ─────────────────────────────

# Each iteration shifts every driver's peak year by a small integer offset
# drawn from a symmetric triangular distribution, so the timing bands reflect
# "arrives a year earlier or later". The width comes from the driver's
# uncertainty score (UNCERTAINTY_PEAK_JITTER); ModelConfig.peak_year_jitter
# switches the jitter off for every driver.

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


def beta_prior_for(probability: int, uncertainty: int) -> tuple:
    """(alpha, beta) of a driver's Beta prior on the materialisation probability.

    The prior is structured judgment set from the 1-5 probability score; it is
    never updated from data. Its mean is p/6, and its concentration
    alpha + beta follows the uncertainty score (UNCERTAINTY_KAPPA): score 3
    gives (p, 6 - p). A score outside its scale raises ValueError.
    """
    if probability not in (1, 2, 3, 4, 5) or uncertainty not in UNCERTAINTY_KAPPA:
        raise ValueError(f"probability {probability!r} or uncertainty {uncertainty!r} is outside its scale")
    kappa = float(UNCERTAINTY_KAPPA[int(uncertainty)])
    alpha = max(BETA_PRIOR_FLOOR, kappa * int(probability) / 6.0)
    beta = max(BETA_PRIOR_FLOOR, kappa - alpha)
    return (alpha, beta)


def peak_jitter_for(uncertainty: int, jitter_on: bool) -> int:
    """A driver's peak-year jitter width in years: the width its uncertainty
    score sets (UNCERTAINTY_PEAK_JITTER), or 0 with the jitter switched off
    (ModelConfig.peak_year_jitter)."""
    return UNCERTAINTY_PEAK_JITTER[int(uncertainty)] if jitter_on else 0


# ── Force weights ───────────────────────────────────────────────────────────

DEFAULT_FORCE_WEIGHTS = {f: 1.0 / len(FORCES) for f in FORCES}


# ── Overlap correction ──────────────────────────────────────────────────────
# A structured-judgment correction for mechanisms that two drivers or two
# forces share (a packaging levy is both a Government and an Environmental
# matter). It is derived from the drivers' category exposure vectors: weighted
# Jaccard similarity, excess over the random-pair baseline, a force-size
# asymmetry across forces, and per-pair mechanism adjustments with written
# reasons. scripts/compute_overlap_correction.py computes it from the driver
# base and writes the record, data/parameters/overlap_correction.json, and
# prism/overlap_correction.py, which these defaults read.
#
# Per force, the engine multiplies the force's summed contribution in a cell
# by its attenuation, 0.5 x (1 - the mean of the force's row in the
# cross-force matrix over the five other forces), before the forces compound.
# Within a force, same-force contributions are dampened by
# 1 - overlap x (n_eff - 1) / n_eff, with n_eff the magnitude-weighted
# effective number of contributing drivers in the cell.

DEFAULT_ATTENUATION_SOURCE = overlap_correction.VERSION
DEFAULT_PER_FORCE_ATTENUATION = overlap_correction.PER_FORCE_ATTENUATION
DEFAULT_WITHIN_FORCE_OVERLAP = overlap_correction.WITHIN_FORCE_OVERLAP
# O[i][j]: the share of force i's signal already carried by force j (not
# symmetric by design). It is the derivation input of the attenuation above;
# the engine reads only the attenuation. The dashboard's configuration sheet
# shows it as the attenuation's provenance.
DEFAULT_FORCE_OVERLAP_MATRIX = overlap_correction.FORCE_OVERLAP_MATRIX


# ── Copula correlations ─────────────────────────────────────────────────────
# Correlations of the latent Gaussian variables behind the drivers'
# probability draws: DEFAULT_WITHIN_FORCE_RHO for two drivers of the same
# force, the force-pair value across forces. They are restricted to [0, 1];
# the model has no negative dependence. The defaults are positive definite as
# entered on the current driver base (minimum eigenvalue about +0.41), so the
# engine's repair step never runs on them; run_production.py re-checks the
# loaded driver mix before every run.

DEFAULT_WITHIN_FORCE_RHO = 0.3

# Rows and columns in FORCES order: Consumer, Customer, Technology, Government,
# Environmental, Competitive.
_FORCE_CORRELATION_ROWS = (
    (1.0,  0.18, 0.11, 0.04, 0.15, 0.15),
    (0.18, 1.0,  0.11, 0.15, 0.04, 0.18),
    (0.11, 0.11, 1.0,  0.22, 0.11, 0.18),
    (0.04, 0.15, 0.22, 1.0,  0.22, 0.04),
    (0.15, 0.04, 0.11, 0.22, 1.0,  0.04),
    (0.15, 0.18, 0.18, 0.04, 0.04, 1.0),
)
DEFAULT_FORCE_CORRELATIONS = {force: dict(zip(FORCES, row)) for force, row in zip(FORCES, _FORCE_CORRELATION_ROWS)}


def build_driver_correlation_matrix(driver_forces, within_force_rho, force_correlation_matrix):
    """Driver-level N x N correlation matrix, without any repair.

    ``driver_forces`` lists the force of each driver. Same-force pairs take
    ``within_force_rho``; cross-force pairs take the force-pair value of
    ``force_correlation_matrix``, which names every pair of forces. The engine
    and the spectral check in config_validation both build the matrix here, so
    they cannot disagree.
    """
    import numpy as np
    n = len(driver_forces)
    if n == 0:
        return np.eye(0)
    R = np.eye(n)
    for i in range(n):
        fi = driver_forces[i]
        for j in range(i + 1, n):
            fj = driver_forces[j]
            R[i, j] = R[j, i] = within_force_rho if fi == fj else force_correlation_matrix[fi][fj]
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
# scripts/build_cell_weights.py builds it from its graded inputs and writes
# the record, data/parameters/cell_weight_estimate.json, and
# prism/cell_weight_estimate.py, which these defaults read.
DEFAULT_CELL_WEIGHTS = cell_weight_estimate.CELL_WEIGHTS
DEFAULT_CELL_WEIGHTS_SOURCE = cell_weight_estimate.SOURCE
#: How DEFAULT_CELL_WEIGHTS_SOURCE opens. A run whose weights source opens with
#: it ran on the estimate; the production run refuses a finance file whose
#: label does, so the dashboard can tell the two apart (lib/cellWeights.ts).
ESTIMATE_SOURCE_PREFIX = "ESTIMATE, not Henkel P&L"


def cell_weight_marginals(cell_weights: dict) -> tuple:
    """(region_weights, category_weights): column and row sums of a cell matrix."""
    rw = {r: float(sum(float((cell_weights.get(c) or {}).get(r, 0.0)) for c in CATEGORIES)) for r in REGIONS}
    cw = {c: float(sum(float((cell_weights.get(c) or {}).get(r, 0.0)) for r in REGIONS)) for c in CATEGORIES}
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
    force_weights: dict = field(default_factory=lambda: dict(DEFAULT_FORCE_WEIGHTS))
    cell_weights: dict = field(default_factory=_default_cell_weights)
    cell_weights_source: str = DEFAULT_CELL_WEIGHTS_SOURCE
    #: The per-iteration peak-year jitter; off, every driver peaks in its own
    #: peak year (the golden pins run that way).
    peak_year_jitter: bool = True
    within_force_rho: float = DEFAULT_WITHIN_FORCE_RHO
    force_correlation_matrix: dict = field(default_factory=lambda: copy.deepcopy(DEFAULT_FORCE_CORRELATIONS))
    within_force_overlap: dict = field(default_factory=lambda: dict(DEFAULT_WITHIN_FORCE_OVERLAP))
    region_weights: dict = field(init=False)
    category_weights: dict = field(init=False)

    def __post_init__(self):
        cw = {str(c): {str(r): float(v) for r, v in (row or {}).items()}
              for c, row in (self.cell_weights or {}).items()}
        rw, catw = cell_weight_marginals(cw)
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
