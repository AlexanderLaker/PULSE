"""Sensitivity analysis — tornado, breakeven, causal path, attenuation sensitivity."""

import logging
from typing import Optional

import numpy as np

from pulse.config import ModelConfig, FORCES
from pulse.ingestion.models import TrendDatabase

logger = logging.getLogger(__name__)


class SensitivityEngine:
    """Interactive sensitivity analysis for the shift model."""

    def __init__(self, config: ModelConfig):
        self.config = config

    def tornado_analysis(self, db: TrendDatabase, category: Optional[str] = None) -> list:
        """
        Which individual trends have the highest leverage on total/category shift?

        For each trend, set it to max exposure (prob=5, gp1_pct=1.0) and
        min exposure (prob=1, gp1_pct=0.02), measure the change in output.
        Sorted by range.

        Returns: list of {trend_id, trend_name, force, low, high, range, base}
        """
        raise NotImplementedError("SensitivityEngine requires implementation with BayesianMonteCarloEngine")

        # If category specified, focus on that; otherwise total
        def _get_metric(result):
            if category:
                return result.get(category, {}).get(2030, 0.0)
            else:
                return np.mean([v.get(2030, 0.0) for v in result.values()])

        base_val = _get_metric(base_result)
        sensitivities = []

        for trend in db.trends:
            # Save originals
            orig_prob = trend.probability
            orig_gp1 = trend.gp1_pct_affected

            # Low case: minimized probability and gp1 exposure
            trend.probability = 1
            trend.gp1_pct_affected = 0.02
            trend.__post_init__()
            low_result = self.det_engine.run(db)
            low_val = _get_metric(low_result)

            # High case: maximized probability and gp1 exposure
            trend.probability = 5
            trend.gp1_pct_affected = 1.0
            trend.__post_init__()
            high_result = self.det_engine.run(db)
            high_val = _get_metric(high_result)

            # Restore
            trend.probability = orig_prob
            trend.gp1_pct_affected = orig_gp1
            trend.__post_init__()

            swing = abs(high_val - low_val)
            sensitivities.append({
                "trend_id": trend.id,
                "trend_name": trend.name,
                "force": trend.force,
                "direction": trend.direction,
                "low": round(low_val, 6),
                "high": round(high_val, 6),
                "range": round(swing, 6),
                "base": round(base_val, 6),
            })

        sensitivities.sort(key=lambda x: x["range"], reverse=True)
        return sensitivities

    def breakeven_analysis(self, db: TrendDatabase, category: str) -> dict:
        """
        What score changes would make a category's shift neutral (0%)?

        Returns: {trend_id: required_score_change} for most impactful trends
        """
        raise NotImplementedError("SensitivityEngine requires implementation with BayesianMonteCarloEngine")
        current_shift = base_result.get(category, {}).get(2030, 0.0)

        if abs(current_shift) < 0.001:
            return {"already_neutral": True, "current_shift": current_shift}

        # Find which trends could neutralize the shift
        tornado = self.tornado_analysis(db, category)
        breakevens = {}

        for t_info in tornado[:10]:  # Top 10 most impactful
            trend = db.get_trend_by_id(t_info["trend_id"])
            if trend is None:
                continue

            # Binary search for the probability that makes shift ≈ 0
            orig_prob = trend.probability
            for test_prob in range(1, 6):
                trend.probability = test_prob
                trend.__post_init__()
                test_result = self.det_engine.run(db)
                test_shift = test_result.get(category, {}).get(2030, 0.0)
                if abs(test_shift) < abs(current_shift) * 0.5:
                    breakevens[trend.id] = {
                        "trend_name": trend.name,
                        "current_probability": orig_prob,
                        "required_probability": test_prob,
                        "resulting_shift": round(test_shift, 6),
                    }
                    break

            trend.probability = orig_prob
            trend.__post_init__()

        return {
            "category": category,
            "current_shift": round(current_shift, 6),
            "breakeven_changes": breakevens,
        }

    def force_elimination(self, db: TrendDatabase) -> dict:
        """
        What happens if we remove an entire force?
        Shows which force contributes most to the overall shift.
        """
        raise NotImplementedError("SensitivityEngine requires implementation with BayesianMonteCarloEngine")
        eliminations = {}

        for force in FORCES:
            # Temporarily zero out this force's weight
            orig_weight = self.config.force_weights.get(force, 0)
            self.config.force_weights[force] = 0.0

            # Redistribute weight to remaining forces
            remaining = [f for f in FORCES if f != force]
            extra = orig_weight / len(remaining)
            for f in remaining:
                self.config.force_weights[f] += extra

            result = self.det_engine.run(db)

            # Restore weights
            self.config.force_weights[force] = orig_weight
            for f in remaining:
                self.config.force_weights[f] -= extra

            eliminations[force] = {}
            for cat in self.config.category_names:
                base_val = base_result.get(cat, {}).get(2030, 0.0)
                elim_val = result.get(cat, {}).get(2030, 0.0)
                eliminations[force][cat] = {
                    "base": round(base_val, 6),
                    "without_force": round(elim_val, 6),
                    "force_contribution": round(base_val - elim_val, 6),
                }

        return eliminations

    def weight_sensitivity(self, db: TrendDatabase,
                           force: str, weight_range: tuple = (0.05, 0.40)) -> list:
        """How does changing a force's weight affect results?"""
        orig_weights = dict(self.config.force_weights)
        results = []

        for test_weight in np.arange(weight_range[0], weight_range[1] + 0.01, 0.05):
            # Set test weight, redistribute remainder
            self.config.force_weights[force] = test_weight
            remaining = [f for f in FORCES if f != force]
            remainder = 1.0 - test_weight
            for f in remaining:
                self.config.force_weights[f] = remainder / len(remaining)

            result = self.det_engine.run(db)
            avg_shift = np.mean([v.get(2030, 0.0) for v in result.values()])
            results.append({
                "weight": round(test_weight, 2),
                "avg_shift": round(avg_shift, 6),
            })

        # Restore
        self.config.force_weights = orig_weights
        return results

    def attenuation_sensitivity(self, db: TrendDatabase,
                                atten_range: tuple = (0.2, 0.9)) -> list:
        """How does changing the attenuation factor affect results?"""
        orig_atten = self.config.attenuation
        results = []

        for test_atten in np.arange(atten_range[0], atten_range[1] + 0.01, 0.1):
            self.config.attenuation = test_atten
            result = self.det_engine.run(db)
            avg_shift = np.mean([v.get(2030, 0.0) for v in result.values()])
            results.append({
                "attenuation": round(test_atten, 2),
                "avg_shift": round(avg_shift, 6),
            })

        self.config.attenuation = orig_atten
        return results

    def causal_path_sensitivity(self, db: TrendDatabase) -> dict:
        """Which DAG edges matter most? Test by removing each edge."""
        if not self.dag:
            return {"error": "No causal DAG configured"}

        raise NotImplementedError("SensitivityEngine requires implementation with BayesianMonteCarloEngine")  # DAG doesn't affect deterministic directly
        # This analysis is more meaningful with MC, but we approximate
        edge_importance = []
        for edge in self.dag.edges:
            edge_importance.append({
                "from": edge.source_force,
                "to": edge.target_force,
                "weight": edge.propagation_weight,
                "lag": edge.lag_years,
                "mechanism": edge.mechanism,
                "importance": edge.propagation_weight,  # Simplified: weight as proxy
            })

        edge_importance.sort(key=lambda x: x["importance"], reverse=True)
        return {"edges": edge_importance}
