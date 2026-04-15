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
DEFAULT_ATTENUATION = 0.5          # Admin-configurable via PUT /api/v1/config
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
    # ── Calibrated from 61-trend review (April 2026) ──
    # Each cell O[i][j] = fraction of force i's signal already captured by force j.
    # Asymmetric: "Government captures 40% of Environmental" ≠ reverse.
    #
    # Key overlap clusters identified:
    #   Gov↔Env (0.40/0.38): PFAS↔palm oil, PPWR↔EPR, EUDR↔palm, tariffs↔nearshoring
    #   Consumer↔Comp (0.25/0.20): PL=competitor, Gen Z dupe=indie brands, C-beauty=Chinese brands
    #   Gov→Tech (0.25): 5 of 9 Gov trends directly trigger Tech responses (reformulation R&D)
    #   Consumer↔Cust (0.20/0.25): PL↔discount, cost-of-living↔channel shift, dupe↔TikTok
    #   Tech↔Comp (0.20/0.25): AI formulation = L'Oreal tech-beauty = competitive weapon
    #   Env→Tech (0.15): palm oil→bio-chemistry, water scarcity→concentrated formats
    "Consumer":      {"Consumer": 0.0, "Customer": 0.20, "Technology": 0.10, "Government": 0.10, "Environmental": 0.20, "Competitive": 0.25},
    "Customer":      {"Consumer": 0.25, "Customer": 0.0, "Technology": 0.10, "Government": 0.10, "Environmental": 0.05, "Competitive": 0.25},
    "Technology":    {"Consumer": 0.10, "Customer": 0.10, "Technology": 0.0, "Government": 0.15, "Environmental": 0.15, "Competitive": 0.20},
    "Government":    {"Consumer": 0.10, "Customer": 0.15, "Technology": 0.25, "Government": 0.0, "Environmental": 0.40, "Competitive": 0.05},
    "Environmental": {"Consumer": 0.25, "Customer": 0.05, "Technology": 0.15, "Government": 0.38, "Environmental": 0.0, "Competitive": 0.05},
    "Competitive":   {"Consumer": 0.20, "Customer": 0.20, "Technology": 0.25, "Government": 0.05, "Environmental": 0.05, "Competitive": 0.0},
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
    # ── Calibrated from 61-trend pair analysis (April 2026) ──
    # Each value = fraction of mechanism overlap among trends within the same force.
    # Higher = more trends measure the same underlying phenomenon.
    #
    # Consumer 0.22: C-01 PL↔C-06 Cost-of-Living (trading down), C-03 Premium↔C-09
    #   Fragrance Premium, C-04 Conscious↔C-13 Refill, C-11 Dupe↔C-01 PL.
    #   But 6 regional trends (C-16 to C-18) are geographically independent → dilutes.
    # Government 0.35: G-01/G-02/G-03 are EU chemical reg cluster (Green Deal),
    #   G-08/G-09 nearly identical (tariffs, different geographies), G-04/G-05/G-07
    #   sustainability compliance cluster. Highest within-force overlap.
    # Environmental 0.32: E-01 Palm↔E-06 Nearshoring (supply chain), E-03 Carbon↔E-04
    #   EPR (compliance costs), E-02 Water↔E-05 Climate (climate-driven),
    #   E-06↔E-07 (European manufacturing cost). Tightly interconnected.
    # Technology 0.20: T-01/T-05/T-07/T-09/T-10 form heavy AI cluster (5 of 10 trends).
    #   T-06 Retail Media↔T-09 Gen AI overlap. Higher than initial estimate.
    # Customer 0.22: K-01 Discount↔K-03 Consolidation (retailer power), K-02/K-04/K-05/K-06
    #   digital channel cluster, K-08 US Retail Media overlaps both.
    # Competitive 0.15: Competitor-specific trends (Reckitt, Unilever, P&G, L'Oreal)
    #   are genuinely independent strategies. X-04 DTC↔X-05 Chinese brands moderate.
    "Consumer": 0.22,
    "Customer": 0.22,
    "Technology": 0.20,
    "Government": 0.35,
    "Environmental": 0.32,
    "Competitive": 0.15,
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
    attenuation_source: str = "assumed"  # "assumed" | "backtested"
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
