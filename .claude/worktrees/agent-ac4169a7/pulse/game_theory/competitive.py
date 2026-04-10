"""Competitive response modeling — simplified game theory layer.

Models how top competitors likely respond to profit pool shifts, and how
those responses create second-order effects on the pool.

All inputs are public intelligence (archetypes, response patterns).
NO competitor financials enter the model.
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

from pulse.config import FORCES, CATEGORIES
from pulse.ingestion.models import CompetitorProfile

logger = logging.getLogger(__name__)

# ── Default competitor profiles (public intelligence only) ──────────

DEFAULT_COMPETITORS = {
    "pg": CompetitorProfile(
        id="pg", name="P&G",
        archetype="premium_defender",
        hair_exposure=0.8, lhc_exposure=0.9,
        response_speed="fast",
        typical_responses={
            "pool_contraction": "defend_with_innovation",
            "price_war": "premiumize_further",
            "regulation": "lobby_and_comply_early",
            "tech_disruption": "fast_follower",
            "private_label_growth": "increase_marketing_spend",
        },
        category_exposure={
            "Hair: Care": 0.9, "Hair: Color": 0.3, "Hair: Styling": 0.5,
            "LHC: FCN": 0.9, "LHC: FCA": 0.7, "LHC: LAD": 0.8,
        }
    ),
    "unilever": CompetitorProfile(
        id="unilever", name="Unilever",
        archetype="sustainability_leader",
        hair_exposure=0.7, lhc_exposure=0.8,
        response_speed="medium",
        typical_responses={
            "pool_contraction": "portfolio_rationalization",
            "price_war": "value_tier_launch",
            "regulation": "lead_compliance",
            "tech_disruption": "acquire",
            "private_label_growth": "sustainability_differentiation",
        },
        category_exposure={
            "Hair: Care": 0.8, "Hair: Color": 0.2, "Hair: Styling": 0.4,
            "LHC: FCN": 0.7, "LHC: FCA": 0.6, "LHC: LAD": 0.9,
        }
    ),
    "reckitt": CompetitorProfile(
        id="reckitt", name="Reckitt",
        archetype="hygiene_specialist",
        hair_exposure=0.1, lhc_exposure=0.9,
        response_speed="medium",
        typical_responses={
            "pool_contraction": "defend_core_categories",
            "price_war": "innovation_premiumization",
            "regulation": "comply_minimum",
            "tech_disruption": "selective_adoption",
            "private_label_growth": "brand_equity_investment",
        },
        category_exposure={
            "LHC: HDW": 0.9, "LHC: ADW": 0.8, "LHC: HSC": 0.9,
            "LHC: FCN": 0.6, "LHC: IC": 0.7,
        }
    ),
    "loreal": CompetitorProfile(
        id="loreal", name="L'Oréal",
        archetype="beauty_innovator",
        hair_exposure=0.9, lhc_exposure=0.3,
        response_speed="fast",
        typical_responses={
            "pool_contraction": "premiumize_further",
            "price_war": "premiumize_further",
            "regulation": "lead_compliance",
            "tech_disruption": "acquire_and_integrate",
            "private_label_growth": "innovation_acceleration",
            "green_squeeze": "sustainability_investment",
        },
        category_exposure={
            "Hair: Color": 0.95, "Hair: Care": 0.85, "Hair: Styling": 0.8,
            "LHC: FCN": 0.6, "LHC: FCA": 0.5, "LHC: LAD": 0.4,
        }
    ),
    "kao": CompetitorProfile(
        id="kao", name="Kao Corporation",
        archetype="technology_leader",
        hair_exposure=0.7, lhc_exposure=0.6,
        response_speed="medium",
        typical_responses={
            "pool_contraction": "technology_differentiation",
            "price_war": "technology_differentiation",
            "regulation": "comply_early",
            "tech_disruption": "lead_innovation",
            "private_label_growth": "defend_with_innovation",
            "green_squeeze": "green_chemistry_investment",
        },
        category_exposure={
            "Hair: Color": 0.7, "Hair: Care": 0.75, "Hair: Styling": 0.6,
            "LHC: FCN": 0.7, "LHC: FCA": 0.65, "LHC: LAD": 0.5,
        }
    ),
    "church_dwight": CompetitorProfile(
        id="church_dwight", name="Church & Dwight",
        archetype="value_optimizer",
        hair_exposure=0.3, lhc_exposure=0.8,
        response_speed="slow",
        typical_responses={
            "pool_contraction": "defend_core_categories",
            "price_war": "defend_core_categories",
            "regulation": "comply_minimum",
            "tech_disruption": "selective_adoption",
            "private_label_growth": "value_tier_defense",
            "green_squeeze": "incremental_green",
        },
        category_exposure={
            "Hair: Care": 0.3, "Hair: Styling": 0.2,
            "LHC: FCN": 0.8, "LHC: FCA": 0.7, "LHC: LAD": 0.9, "LHC: ADW": 0.8,
        }
    ),
}

# ── Response effect on pool (% modifier) ───────────────────────────
# Positive = pool expands, Negative = pool contracts
RESPONSE_POOL_EFFECTS = {
    "defend_with_innovation": 0.005,      # Innovation grows the pool slightly
    "premiumize_further": 0.008,           # Premiumization expands pool
    "lobby_and_comply_early": 0.002,       # Early compliance = less disruption
    "fast_follower": 0.003,                # Adoption grows the category
    "increase_marketing_spend": 0.004,     # Marketing grows primary demand
    "portfolio_rationalization": -0.003,    # Exits can contract the pool
    "value_tier_launch": -0.005,           # Value tiers compress margins
    "lead_compliance": 0.003,              # Sets standards others must follow
    "acquire": 0.002,                      # Consolidation can grow pool
    "sustainability_differentiation": 0.004,
    "defend_core_categories": 0.001,
    "innovation_premiumization": 0.006,
    "comply_minimum": -0.001,
    "selective_adoption": 0.001,
    "brand_equity_investment": 0.003,
    "acquire_and_integrate": 0.003,       # M&A grows pool through integration
    "sustainability_investment": 0.004,    # ESG investment expands market
    "innovation_acceleration": 0.006,      # Fast innovation drives pool growth
    "technology_differentiation": 0.004,   # Tech differentiation attracts premium
    "green_chemistry_investment": 0.003,   # Green tech attracts eco-consumers
    "incremental_green": -0.002,           # Minimal investment lags market
    "value_tier_defense": -0.004,          # Value defense compresses margins
    "comply_early": 0.002,                 # Early compliance reduces disruption
}


class CompetitiveResponseModel:
    """
    Estimates how competitors respond to market dynamics and adjusts pool shifts.

    This is directional modeling, not predictive. Clearly labeled as
    "competitive dynamics adjustment" in outputs.
    """

    def __init__(self, competitors: Optional[dict] = None):
        self.competitors = competitors or dict(DEFAULT_COMPETITORS)

    def estimate_competitive_response(self, trigger: str,
                                       category: str) -> float:
        """
        Estimate the second-order pool effect from competitive responses.

        Returns: additional % shift from competitive dynamics (can be + or -)
        """
        total_effect = 0.0
        total_weight = 0.0

        for comp_id, comp in self.competitors.items():
            exposure = comp.category_exposure.get(category, 0.0)
            if exposure < 0.1:
                continue

            response = comp.typical_responses.get(trigger, "defend_core_categories")
            pool_effect = RESPONSE_POOL_EFFECTS.get(response, 0.0)

            speed_factor = {"fast": 1.0, "medium": 0.7, "slow": 0.4}
            weight = exposure * speed_factor.get(comp.response_speed, 0.7)

            total_effect += pool_effect * weight
            total_weight += weight

        if total_weight > 0:
            return total_effect / total_weight
        return 0.0

    def compute_all_competitive_adjustments(self, force_shocks: dict) -> dict:
        """
        For all categories, compute competitive response adjustments.

        Returns: {category: competitive_adjustment_%}
        """
        trigger = "pool_contraction"  # Default baseline
        adjustments = {}

        for cat in CATEGORIES:
            adj = self.estimate_competitive_response(trigger, cat)
            adjustments[cat] = round(adj, 6)

        return adjustments

    def competitive_equilibrium(self, base_shifts: dict,
                                 max_iterations: int = 10,
                                 tolerance: float = 0.0001) -> dict:
        """
        Iterative equilibrium: competitive responses change the shift,
        which triggers further responses, until stable.

        Returns: equilibrium shift adjustments
        """
        trigger = "pool_contraction"
        adjustments = {cat: 0.0 for cat in CATEGORIES}

        for iteration in range(max_iterations):
            new_adjustments = {}
            for cat in CATEGORIES:
                base = base_shifts.get(cat, {})
                base_val = base.get(2030, base.get("median", 0.0)) if isinstance(base, dict) else base
                effective_shift = base_val + adjustments[cat]

                # Competitive response to the effective shift
                response = self.estimate_competitive_response(trigger, cat)
                # Dampen with each iteration (diminishing reactions)
                damping = 0.5 ** iteration
                new_adjustments[cat] = adjustments[cat] + response * damping

            # Check convergence
            max_change = max(abs(new_adjustments[c] - adjustments[c]) for c in CATEGORIES)
            adjustments = new_adjustments

            if max_change < tolerance:
                logger.info(f"Competitive equilibrium converged in {iteration+1} iterations")
                break

        return {cat: round(v, 6) for cat, v in adjustments.items()}
