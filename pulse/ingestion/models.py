"""Data models for PULSE — Trend, CausalEdge, CompetitorProfile."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class Trend:
    """A single strategic trend with scoring metadata."""
    id: str                                    # e.g. "consumer_01"
    force: str                                 # e.g. "Consumer"
    sub_category: str = ""                     # e.g. "Trends"
    name: str = ""
    description: str = ""
    direction: str = "Expansion"               # "Expansion" | "Contraction"
    impact: int = 3                            # 1-5
    probability: int = 3                       # 1-5
    start_year: int = 2028
    weighted_score: float = 0.0
    normalized_score: float = 0.0
    strategic_implication: str = ""
    category_exposure: dict = field(default_factory=dict)  # {cat: 0-5}
    vc_exposure: dict = field(default_factory=dict)        # {vc_step: 0-5}
    regional_exposure: dict = field(default_factory=dict)  # {region: 0-5}
    data_source: str = ""
    source_type: str = ""
    confidence: str = "Medium"
    last_updated: datetime = field(default_factory=datetime.now)
    ai_suggested: bool = False
    user_override: bool = False
    # Delphi metadata
    scorer_count: int = 1
    score_variance: float = 0.0
    debiasing_applied: bool = False
    # % of GP1 affected — what fraction of the category profit pool is
    # realistically exposed to this trend at full materialization.
    # AI-preset, expert-adjustable. Range 0.0 to 1.0 (e.g. 0.15 = 15%).
    # This replaces the implicit assumption that every trend can affect
    # 100% of the pool. A 5/5 impact trend with gp1_pct_affected=0.15
    # means: "this is a maximum-severity trend, but even at full force
    # it only touches 15% of the category's GP1."
    gp1_pct_affected: float = 0.10  # default 10% — conservative baseline
    # Bayesian posteriors — (alpha, beta) for Beta distribution
    impact_posterior: Optional[tuple] = None
    probability_posterior: Optional[tuple] = None

    def __post_init__(self):
        direction_sign = 1 if self.direction == "Expansion" else -1
        self.weighted_score = self.impact * self.probability * direction_sign
        # Bayesian priors centered on expert score — always recompute from
        # current impact/probability values so sensitivity analysis works
        # (tornado analysis changes these fields and re-calls __post_init__).
        self.impact_posterior = (max(self.impact, 1), max(6 - self.impact, 1))
        self.probability_posterior = (max(self.probability, 1), max(6 - self.probability, 1))
        # normalized_score aligned with MC engine formula:
        #   MC samples: prob_01 × gp1_pct_affected × direction
        #   Deterministic: E[prob_01] × gp1_pct_affected × direction
        # where E[prob_01] = alpha / (alpha + beta) from the Beta posterior.
        # Impact is NOT a separate multiplier — it is already reflected in
        # gp1_pct_affected (high-impact trends get higher gp1_pct assignments).
        a_p, b_p = self.probability_posterior
        prob_mean = a_p / (a_p + b_p)  # Expected probability of materialization
        self.normalized_score = prob_mean * self.gp1_pct_affected * direction_sign

    @property
    def direction_sign(self) -> int:
        return 1 if self.direction == "Expansion" else -1

    @property
    def abs_score(self) -> float:
        return abs(self.weighted_score)


@dataclass
class CausalEdge:
    """A directed edge in the causal DAG between forces."""
    source_force: str
    target_force: str
    propagation_weight: float = 0.3       # 0.0 to 1.0
    lag_years: int = 0                     # 0, 1, or 2
    mechanism: str = ""
    evidence_strength: str = "Moderate"    # "Strong" | "Moderate" | "Weak"
    calibrated_from_backtest: bool = False

    def __post_init__(self):
        self.propagation_weight = max(0.0, min(1.0, self.propagation_weight))
        self.lag_years = max(0, min(2, self.lag_years))


@dataclass
class CompetitorProfile:
    """Public competitive intelligence profile (no financials)."""
    id: str
    name: str
    archetype: str = "balanced"           # "premium_defender" | "sustainability_leader" etc.
    hair_exposure: float = 0.5
    lhc_exposure: float = 0.5
    response_speed: str = "medium"        # "fast" | "medium" | "slow"
    typical_responses: dict = field(default_factory=dict)
    category_exposure: dict = field(default_factory=dict)


@dataclass
class TrendDatabase:
    """Container for all ingested trends and metadata."""
    trends: list = field(default_factory=list)       # List[Trend]
    categories: list = field(default_factory=list)    # Category names
    forces: list = field(default_factory=list)        # Force names
    source_file: str = ""
    ingestion_date: datetime = field(default_factory=datetime.now)
    financial_data_detected: bool = False

    @property
    def trend_count(self) -> int:
        return len(self.trends)

    def get_trends_by_force(self, force: str) -> list:
        return [t for t in self.trends if t.force == force]

    def get_trends_by_category(self, category: str) -> list:
        return [t for t in self.trends if t.category_exposure.get(category, 0) > 0]

    def get_trend_by_id(self, trend_id: str) -> Optional[Trend]:
        for t in self.trends:
            if t.id == trend_id:
                return t
        return None
