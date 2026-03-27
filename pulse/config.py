"""Global configuration for PULSE engine."""

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
DEFAULT_ITERATIONS = 10_000
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

# Force-specific materialization overrides
REGULATORY_MATERIALIZATION = {2026: 0.05, 2027: 0.15, 2028: 0.60, 2029: 0.90, 2030: 1.00}
TECHNOLOGY_MATERIALIZATION = {2026: 0.05, 2027: 0.12, 2028: 0.30, 2029: 0.60, 2030: 1.00}
CONSUMER_MATERIALIZATION = {2026: 0.12, 2027: 0.28, 2028: 0.50, 2029: 0.75, 2030: 1.00}

FORCE_MATERIALIZATION_OVERRIDES = {
    "Government": REGULATORY_MATERIALIZATION,
    "Technology": TECHNOLOGY_MATERIALIZATION,
    "Consumer": CONSUMER_MATERIALIZATION,
}

# ── Default weights ─────────────────────────────────────────────────
DEFAULT_FORCE_WEIGHTS = {f: 1.0 / len(FORCES) for f in FORCES}  # Equal: ~16.7%
DEFAULT_VC_WEIGHTS = {s: 1.0 / len(VC_STEPS) for s in VC_STEPS}  # Equal: 12.5%

# ── Copula parameters ──────────────────────────────────────────────
DEFAULT_WITHIN_FORCE_RHO = 0.3
DEFAULT_T_COPULA_DF = 4  # Low df → heavy tails → crisis correlation
DEFAULT_RESIDUAL_CROSS_RHO = 0.05

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
    category_names: list = field(default_factory=lambda: list(CATEGORIES))
    iterations: int = DEFAULT_ITERATIONS
    within_force_rho: float = DEFAULT_WITHIN_FORCE_RHO
    t_copula_df: int = DEFAULT_T_COPULA_DF
    backtesting_accuracy: Optional[float] = None

    def to_json(self) -> str:
        return json.dumps(self.__dict__, default=str)

    @classmethod
    def from_json(cls, s: str) -> "ModelConfig":
        return cls(**json.loads(s))
