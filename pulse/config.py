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

# ── Sheet names to read / skip ──────────────────────────────────────
FORCE_SHEETS = {
    "Consumer": "1_Consumer",
    "Customer": "2_Customer",
    "Technology": "3_Technology",
    "Government": "4_Government",
    "Environmental": "5_Environment",
    "Competitive": "6_Competitive",
}
SKIP_SHEETS = {"Input", "Financials_Input", "Cover", "Dashboard", "Sensitivity",
               "Profit Pool Comparison", "Profit Pool Map", "Financial Overview"}

# ── Default model parameters ────────────────────────────────────────
DEFAULT_ATTENUATION = 0.5          # Will be overridden by backtesting if available
DEFAULT_NEUTRAL_THRESHOLD = 0.001
DEFAULT_ITERATIONS = 5_000  # 5k default: ~10s on Vercel. Increase to 50k for final runs locally.
DEFAULT_BASE_YEAR = 2025
DEFAULT_PATH_YEARS = [2026, 2027, 2028, 2029, 2030]

# Materialization schedule: S-curve for how much of total impact has materialized
DEFAULT_MATERIALIZATION = {
    2026: 0.10,
    2027: 0.25,
    2028: 0.50,
    2029: 0.75,
    2030: 1.00,
}

# Force-specific materialization overrides (legacy — used when trend has no diffusion_curve)
REGULATORY_MATERIALIZATION = {2026: 0.05, 2027: 0.15, 2028: 0.60, 2029: 0.90, 2030: 1.00}
TECHNOLOGY_MATERIALIZATION = {2026: 0.05, 2027: 0.12, 2028: 0.30, 2029: 0.60, 2030: 1.00}
CONSUMER_MATERIALIZATION = {2026: 0.12, 2027: 0.28, 2028: 0.50, 2029: 0.75, 2030: 1.00}

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

    return schedule

# ── Default weights ─────────────────────────────────────────────────
DEFAULT_FORCE_WEIGHTS = {f: 1.0 / len(FORCES) for f in FORCES}  # Equal: ~16.7%
DEFAULT_VC_WEIGHTS = {s: 1.0 / len(VC_STEPS) for s in VC_STEPS}  # Equal: 12.5%
DEFAULT_REGION_WEIGHTS = {r: 1.0 / len(REGIONS) for r in REGIONS}  # Equal: 25%
DEFAULT_CATEGORY_WEIGHTS = {c: 1.0 / len(CATEGORIES) for c in CATEGORIES}  # Equal: ~8.3%

# ── Copula parameters ──────────────────────────────────────────────
DEFAULT_WITHIN_FORCE_RHO = 0.3
DEFAULT_T_COPULA_DF = 4  # Low df → heavy tails → crisis correlation
DEFAULT_RESIDUAL_CROSS_RHO = 0.05

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

# ── Financial data firewall patterns ───────────────────────────────
FINANCIAL_KEYWORDS = {"NES", "GP1", "GP2", "revenue", "sales", "profit",
                      "EBIT", "EBITDA", "margin", "turnover", "net income"}
FINANCIAL_CURRENCY_PATTERNS = [r"€\s*\d+", r"EUR\s+\d+", r"\d+[.,]\d+\s*M",
                               r"\d+[.,]\d+\s*€", r"\$\s*\d+"]
MAX_FINANCIAL_VALUE = 50  # Values > 50 in descriptions flagged as potential financials


@dataclass
class ModelConfig:
    """Complete model configuration snapshot."""
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
    backtesting_accuracy: Optional[float] = None

    def to_json(self) -> str:
        return json.dumps(self.__dict__, default=str)

    @classmethod
    def from_json(cls, s: str) -> "ModelConfig":
        return cls(**json.loads(s))
