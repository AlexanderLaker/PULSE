"""Global configuration for PRISM engine."""

from dataclasses import dataclass, field
from typing import Optional
import json

# ── Force taxonomy ──────────────────────────────────────────────────
FORCES = ["Consumer", "Customer", "Technology", "Government", "Environmental", "Competitive"]

# ── Category taxonomy ───────────────────────────────────────────────
CATEGORIES = [
    "Hair: Color", "Hair: Care", "Hair: Styling", "Hair: Body",
    "LHC: FCN", "LHC: FCA", "LHC: FFI", "LHC: LAD",
    "LHC: HDW", "LHC: ADW", "LHC: HSC", "LHC: IC",
]

# ── Value chain steps ───────────────────────────────────────────────
VC_STEPS = [
    "Raw Materials", "Formulation", "Manufacturing", "Packaging",
    "Supply Chain", "Marketing", "Commercial", "Consumer"
]

# ── Regional taxonomy ──────────────────────────────────────────────
REGIONS = ["Europe", "North America", "Asia", "High Growth"]

# ── Default model parameters ────────────────────────────────────────
# DEFAULT_ATTENUATION is the BASE attenuation before per-force calibration.
# The effective attenuation per force is computed as:
#     eff_att_i = DEFAULT_ATTENUATION × (1 − mean(O[i][j] for j ≠ i))
# where O is the calibrated DEFAULT_FORCE_OVERLAP_MATRIX below. As of v3.1
# the overlap matrix is calibrated (not assumed) — the base stays at 0.5
# but the PER-FORCE attenuation is data-driven. See attenuation_source.
DEFAULT_ATTENUATION = 0.5          # Admin-configurable via PUT /api/v1/config
DEFAULT_ATTENUATION_SOURCE = "calibrated_v3.1_april2026"  # was "assumed"
DEFAULT_NEUTRAL_THRESHOLD = 0.001
DEFAULT_ITERATIONS = 10_000
DEFAULT_BASE_YEAR = 2025
DEFAULT_PATH_YEARS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036]

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
    2035: 0.99,
    2036: 1.00,
}

# Force-specific materialization overrides (legacy — used when trend has no diffusion_curve)
REGULATORY_MATERIALIZATION = {
    2026: 0.05, 2027: 0.15, 2028: 0.40, 2029: 0.60, 2030: 0.75,
    2031: 0.85, 2032: 0.92, 2033: 0.97, 2034: 0.99, 2035: 1.00, 2036: 1.00,
}
TECHNOLOGY_MATERIALIZATION = {
    2026: 0.04, 2027: 0.10, 2028: 0.22, 2029: 0.40, 2030: 0.58,
    2031: 0.72, 2032: 0.83, 2033: 0.91, 2034: 0.96, 2035: 0.99, 2036: 1.00,
}
CONSUMER_MATERIALIZATION = {
    2026: 0.10, 2027: 0.22, 2028: 0.38, 2029: 0.54, 2030: 0.68,
    2031: 0.79, 2032: 0.87, 2033: 0.93, 2034: 0.97, 2035: 0.99, 2036: 1.00,
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
) -> dict[int, float]:
    """
    Compute a year→fraction materialization schedule for a single trend.

    Args:
        peak_year: year when 100% impact materializes (0 = use last path year)
        diffusion_curve: one of VALID_DIFFUSION_CURVES
        path_years: list of years to compute fractions for
        base_year: start year (fraction = 0.0)

    Returns:
        dict mapping each path year to a fraction in [0.0, 1.0]
    """
    import math
    years = path_years or DEFAULT_PATH_YEARS
    py = peak_year if peak_year and peak_year > base_year else years[-1]

    schedule = {}
    for year in years:
        if year >= py:
            schedule[year] = 1.0
            continue
        # t = normalized progress from base_year to peak_year: 0.0 → 1.0
        span = max(py - base_year, 1)
        t = max(0.0, min(1.0, (year - base_year) / span))

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
DEFAULT_FORCE_WEIGHTS = {f: 1.0 / len(FORCES) for f in FORCES}  # Equal: ~16.7%
DEFAULT_VC_WEIGHTS = {s: 1.0 / len(VC_STEPS) for s in VC_STEPS}  # Equal: 12.5%
DEFAULT_REGION_WEIGHTS = {r: 1.0 / len(REGIONS) for r in REGIONS}  # Equal: 25%
DEFAULT_CATEGORY_WEIGHTS = {c: 1.0 / len(CATEGORIES) for c in CATEGORIES}  # Equal: ~8.3%

# ── Copula parameters ──────────────────────────────────────────────
DEFAULT_WITHIN_FORCE_RHO = 0.3
DEFAULT_T_COPULA_DF = 8  # Moderate tails; admin-configurable via PUT /api/v1/config (range 2-30)
DEFAULT_RESIDUAL_CROSS_RHO = 0.05

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
    # ── CALIBRATED from 82-trend empirical analysis (April 2026, v3.1) ──
    # Methodology: excess-overlap-above-baseline + force-size asymmetry + mechanism adjustment
    #
    # Step 1 (empirical): Computed mean pairwise weighted Jaccard between each
    #   pair of trends across every cross-force combination in the 82-trend db.
    #   Converted to "excess overlap": max(0, mean_J - J₀) / (1 - J₀) where
    #   J₀ = 0.485 is the random-pair baseline across all trends. This removes
    #   the structural-overlap floor (baseline FMCG scorecell similarity) and
    #   isolates the signal.
    # Step 2 (asymmetry): Multiplied by sqrt(n_j / n_i) capped at 1.5× to
    #   reflect that a narrow force is more likely "covered" by a broad one.
    # Step 3 (mechanism): Additive adjustment ±0.05-0.10 per cell based on
    #   documented FMCG causal couplings (see mechanism notes inline below).
    #
    # Top calibrated couplings (from 0 to 0.432):
    #   Environmental→Government  0.432  (PFAS, PPWR, EUDR, DPP: regulatory+ESG)
    #   Government→Environmental  0.405  (same, reverse direction)
    #   Government→Technology     0.367  (regulation triggers reformulation R&D)
    #   Customer→Government       0.300  (retailer compliance burden scales w/ reg)
    #   Customer→Technology       0.266  (retail media / agentic = customer tech)
    #   Environmental→Technology  0.266  (supply constraints drive bio-chem)
    #   Technology→Government     0.237  (AI Act, DPP digital mandates)
    #   Customer→Government       0.200  (PPWR, CSRD impact retailers)
    #   Technology→Customer       0.183  (digital commerce infrastructure)
    #
    # Consumer and Competitive rows ≈ 0 for most cells because Consumer has 23
    # highly diverse trends (including 6 geo-regional trends that are structurally
    # unlike all other forces) and Competitive has 12 competitor-specific trends
    # that are each mechanistically independent. Only mechanism-coupling floors
    # preserve non-zero values: Consumer→Competitive (0.08) via dupe↔indie, and
    # a handful of small cross-links.
    #
    # See also: attenuation_source = "calibrated_v3.1_april2026"
    # Exported matrix: data/Attenuation_Calibration.xlsx (Cross-Force_Matrix sheet)
    "Consumer":      {"Consumer": 0.0,  "Customer": 0.050, "Technology": 0.000, "Government": 0.000, "Environmental": 0.050, "Competitive": 0.080},
    "Customer":      {"Consumer": 0.000, "Customer": 0.0,  "Technology": 0.266, "Government": 0.300, "Environmental": 0.163, "Competitive": 0.090},
    "Technology":    {"Consumer": 0.000, "Customer": 0.183, "Technology": 0.0,  "Government": 0.237, "Environmental": 0.148, "Competitive": 0.080},
    "Government":    {"Consumer": 0.000, "Customer": 0.200, "Technology": 0.367, "Government": 0.0,  "Environmental": 0.405, "Competitive": 0.000},
    "Environmental": {"Consumer": 0.050, "Customer": 0.118, "Technology": 0.266, "Government": 0.432, "Environmental": 0.0,  "Competitive": 0.000},
    "Competitive":   {"Consumer": 0.050, "Customer": 0.087, "Technology": 0.000, "Government": 0.000, "Environmental": 0.000, "Competitive": 0.0},
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
    # ── CALIBRATED from 82-trend empirical analysis (April 2026, v3.1) ──
    # Methodology: mean pairwise weighted Jaccard over 12-category exposure
    # vectors WITHIN each force, converted to excess-overlap above the
    # 82-trend random-pair baseline J₀ = 0.485, then adjusted ±0.03-0.05
    # for mechanism-cluster density vs. diversity.
    #
    # Empirical signal per force (raw mean J → excess → final):
    #   Government     0.678 → 0.376 → 0.426   [8 of 12 trends from EU Green Deal]
    #   Environmental  0.597 → 0.219 → 0.269   [tight climate→water→palm→energy web]
    #   Technology     0.579 → 0.182 → 0.232   [AI cluster (8) + bio-chem cluster (5)]
    #   Customer       0.566 → 0.157 → 0.157   [channel power cluster + digital cluster]
    #   Consumer       0.387 → 0.000 → 0.100   [23 diverse trends, floor-clamped]
    #   Competitive    0.455 → 0.000 → 0.100   [competitor-specific independent; floor]
    #
    # Rationale for top-of-range Government (0.426):
    #   government_r01-r07 + r10-r12 all stem from European Green Deal: PFAS, micro-
    #   plastics, Omnibus VII/VIII, PPWR, Green Claims, EUDR, DPP, AI Act, biodiv,
    #   textile circularity. Shared regulatory DNA = genuine mechanism redundancy.
    #
    # Rationale for floor-clamped Consumer (0.100):
    #   23 trends span premiumization (r03, r09, r21), sustainability (r04, r13),
    #   demographics (r05, r08, r24), occasions (r07, r14, r15), geographic (r17-
    #   r20), value trading (r01, r06, r11, r22). Mean J = 0.387, same as baseline.
    #   Empirical signal of excess = 0, clamped at 0.10 to preserve light dampening.
    #
    # Rationale for floor-clamped Competitive (0.100):
    #   competitive_r01-r12 are each about a DIFFERENT competitor (Reckitt, P&G,
    #   Unilever, L'Oreal, K-beauty, C-beauty, Chinese brands, Amazon, DTC wave,
    #   NVIDIA partnership, IMEA growth divergence). Genuinely independent
    #   strategies, no mechanism redundancy. Empirical excess = 0.
    #
    # See also: data/Attenuation_Calibration.xlsx (Within-Force_Overlap sheet)
    "Consumer":      0.100,  # was 0.22 | empirical excess 0.00, floor-clamped
    "Customer":      0.157,  # was 0.22 | empirical excess 0.16
    "Technology":    0.232,  # was 0.20 | empirical excess 0.18 + mech +0.05
    "Government":    0.426,  # was 0.35 | empirical excess 0.38 + mech +0.05 (top)
    "Environmental": 0.269,  # was 0.32 | empirical excess 0.22 + mech +0.05
    "Competitive":   0.100,  # was 0.15 | empirical excess 0.00, floor-clamped
}

# ── Force correlation matrix (cross-force correlations for copula) ──────
# Replaces DAG-based correlation for Monte Carlo sampling.
# Diagonal is always 1.0, off-diagonal values from DAG weights × 0.5.
DEFAULT_FORCE_CORRELATIONS = {
    "Consumer": {"Consumer": 1.0, "Customer": 0.25, "Technology": 0.15, "Government": 0.05, "Environmental": 0.20, "Competitive": 0.20},
    "Customer": {"Consumer": 0.25, "Customer": 1.0, "Technology": 0.15, "Government": 0.20, "Environmental": 0.05, "Competitive": 0.25},
    "Technology": {"Consumer": 0.15, "Customer": 0.15, "Technology": 1.0, "Government": 0.30, "Environmental": 0.15, "Competitive": 0.25},
    "Government": {"Consumer": 0.05, "Customer": 0.20, "Technology": 0.30, "Government": 1.0, "Environmental": 0.30, "Competitive": 0.05},
    "Environmental": {"Consumer": 0.20, "Customer": 0.05, "Technology": 0.15, "Government": 0.30, "Environmental": 1.0, "Competitive": 0.05},
    "Competitive": {"Consumer": 0.20, "Customer": 0.25, "Technology": 0.25, "Government": 0.05, "Environmental": 0.05, "Competitive": 1.0},
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
    attenuation: float = DEFAULT_ATTENUATION
    attenuation_source: str = DEFAULT_ATTENUATION_SOURCE  # "assumed" | "calibrated_v3.1_april2026" | "admin_override"
    neutral_threshold: float = DEFAULT_NEUTRAL_THRESHOLD
    base_year: int = DEFAULT_BASE_YEAR
    path_years: list = field(default_factory=lambda: list(DEFAULT_PATH_YEARS))
    materialization: dict = field(default_factory=lambda: dict(DEFAULT_MATERIALIZATION))
    force_weights: dict = field(default_factory=lambda: dict(DEFAULT_FORCE_WEIGHTS))
    vc_weights: dict = field(default_factory=lambda: dict(DEFAULT_VC_WEIGHTS))
    region_weights: dict = field(default_factory=lambda: dict(DEFAULT_REGION_WEIGHTS))
    category_names: list = field(default_factory=lambda: list(CATEGORIES))
    category_weights: dict = field(default_factory=lambda: dict(DEFAULT_CATEGORY_WEIGHTS))
    iterations: int = DEFAULT_ITERATIONS
    within_force_rho: float = DEFAULT_WITHIN_FORCE_RHO
    t_copula_df: int = DEFAULT_T_COPULA_DF
    force_correlation_matrix: dict = field(default_factory=lambda: dict(DEFAULT_FORCE_CORRELATIONS))
    force_overlap_matrix: dict = field(default_factory=lambda: dict(DEFAULT_FORCE_OVERLAP_MATRIX))
    within_force_overlap: dict = field(default_factory=lambda: dict(DEFAULT_WITHIN_FORCE_OVERLAP))

    def to_json(self) -> str:
        return json.dumps(self.__dict__, default=str)

    @classmethod
    def from_json(cls, s: str) -> "ModelConfig":
        return cls(**json.loads(s))

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
        return ModelConfig(**values)
