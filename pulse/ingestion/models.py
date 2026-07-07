"""Data models for PRISM — Trend and TrendDatabase."""

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
    probability: int = 3                       # 1-5
    start_year: int = 2028
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
    # (The delphi-era fields scorer_count / score_variance / debiasing_applied
    #  were removed 2026-07-07, owner ruling O1 — the Delphi capability itself
    #  was deleted in June 2026 (D10); scripts/migrate_drop_delphi.py drops
    #  the matching legacy columns from existing databases.)
    # % of GP1 affected — what fraction of the category profit pool is
    # realistically exposed to this trend at full materialization.
    # AI-preset, expert-adjustable. Range 0.0 to 1.0 (e.g. 0.15 = 15%).
    # This replaces the implicit assumption that every trend can affect
    # 100% of the pool. A high-materialization trend with gp1_pct_affected=0.15
    # means: "this trend can fully materialize, but even at full force
    # it only touches 15% of the category's GP1."
    # Must be determined by AI analysis — no default value.
    gp1_pct_affected: Optional[float] = None
    # Materialization timing — when does the full impact arrive?
    # peak_year: the year by which 100% of the trend's impact has materialized.
    # 0 = use default (2030). Must be >= base_year and <= 2035.
    peak_year: int = 0
    # Diffusion curve — the temporal shape of how the impact builds up.
    # MECE taxonomy:
    #   "s_curve"       — slow start, rapid middle, plateau (classic adoption)
    #   "linear"        — steady equal increments each year
    #   "front_loaded"  — most impact happens early, then flattens
    #   "back_loaded"   — slow start, accelerates toward the end
    #   "step_function" — minimal impact then sudden jump at peak_year
    diffusion_curve: str = "s_curve"
    # Bayesian posteriors — (alpha, beta) for Beta distribution
    probability_posterior: Optional[tuple] = None
    # AI baseline snapshot (June 2026 multi-expert proposals layer).
    # An immutable dict of the originally-seeded scoreable fields
    # {probability, gp1_pct_affected, peak_year, diffusion_curve,
    #  category_exposure, regional_exposure, vc_exposure} captured at seed
    # time and persisted in the trends.ai_suggestion column. Survives admin
    # edits/endorsements so the "AI suggestion" reference never drifts.
    # None for legacy trends until scripts/backfill_ai_suggestion.py runs.
    ai_suggestion: Optional[dict] = None

    def __post_init__(self):
        direction_sign = 1 if self.direction == "Expansion" else -1
        # Bayesian priors centered on expert score — always recompute from
        # current probability values so sensitivity analysis works
        # (tornado analysis changes these fields and re-calls __post_init__).
        self.probability_posterior = (max(self.probability, 1), max(6 - self.probability, 1))
        # normalized_score aligned with MC engine formula:
        #   MC samples: prob_01 × gp1_pct_affected × direction
        #   Deterministic: E[prob_01] × gp1_pct_affected × direction
        # where E[prob_01] = alpha / (alpha + beta) from the Beta posterior.
        # Economic magnitude is captured by gp1_pct_affected (high-materialization
        # trends get higher gp1_pct assignments).
        a_p, b_p = self.probability_posterior
        prob_mean = a_p / (a_p + b_p)  # Expected probability of materialization
        gp1 = self.gp1_pct_affected if self.gp1_pct_affected is not None else 0.0
        self.normalized_score = prob_mean * gp1 * direction_sign

    @property
    def direction_sign(self) -> int:
        return 1 if self.direction == "Expansion" else -1




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
