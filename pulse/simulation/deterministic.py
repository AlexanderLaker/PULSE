"""Deterministic engine — replicates V12 multiplicative compounding exactly.

This is the trust anchor: users verify PULSE matches their Excel before
trusting the probabilistic outputs.

V12 formula: GP1_shift% = Π(1 + F_i% × attenuation) - 1
Where F_i% is each force's contribution to a category.
"""

import logging
from typing import Optional

import numpy as np

from pulse.config import ModelConfig, FORCES, FORCE_MATERIALIZATION_OVERRIDES, compute_materialization_schedule
from pulse.ingestion.models import TrendDatabase

logger = logging.getLogger(__name__)


class DeterministicEngine:
    """Replicates V12 Excel logic for trust validation."""

    def __init__(self, config: ModelConfig):
        self.config = config

    def run(self, db: TrendDatabase) -> dict:
        """
        Run deterministic calculation with per-trend materialization.

        Each trend uses its own peak_year + diffusion_curve to compute
        a materialization schedule. Falls back to force-level overrides
        for legacy trends without these fields.

        Returns:
            dict: {category: {year: shift_pct}} — percentage shifts
        """
        results = {}

        # Pre-compute per-trend materialization schedules
        trend_mat_schedules = {}
        for trend in db.trends:
            pk = getattr(trend, 'peak_year', 0) or 0
            dc = getattr(trend, 'diffusion_curve', '') or ''
            if pk > 0 and dc:
                trend_mat_schedules[trend.id] = compute_materialization_schedule(
                    pk, dc, self.config.path_years, self.config.base_year
                )
            else:
                force_mat = FORCE_MATERIALIZATION_OVERRIDES.get(trend.force, {})
                trend_mat_schedules[trend.id] = {
                    yr: force_mat.get(yr, self.config.materialization.get(yr, 1.0))
                    for yr in self.config.path_years
                }

        for cat in self.config.category_names:
            # Compute per-year shifts with per-trend materialization
            year_shifts = {}
            for year in self.config.path_years:
                # Build per-force contributions for this year
                force_contributions = {}
                for force in FORCES:
                    force_trends = db.get_trends_by_force(force)
                    force_weight = self.config.force_weights.get(force, 1.0 / len(FORCES))

                    total_score = 0.0
                    for trend in force_trends:
                        exposure = trend.category_exposure.get(cat, 0)
                        if exposure > 0:
                            exposure_frac = exposure / 5.0

                            # Region weighting (dampened soft modifier) — same as MC engine
                            region_weights = getattr(self.config, 'region_weights', {})
                            regional_exp = getattr(trend, 'regional_exposure', {}) or {}
                            if regional_exp and region_weights:
                                weighted_sum = 0.0
                                total_possible = 0.0
                                for region, r_weight in region_weights.items():
                                    r_exp = regional_exp.get(region, 0)
                                    weighted_sum += (r_exp / 5.0) * r_weight
                                    total_possible += r_weight
                                raw_region = weighted_sum / max(total_possible, 1e-6)
                                region_factor = 1.0 - 0.5 * (1.0 - raw_region)
                            else:
                                region_factor = 1.0

                            # Per-trend materialization fraction
                            mat_frac = trend_mat_schedules[trend.id].get(year, 1.0)

                            total_score += trend.normalized_score * exposure_frac * region_factor * mat_frac

                    force_contributions[force] = total_score * force_weight

                # Multiplicative compounding with attenuation
                product = 1.0
                for force, contribution in force_contributions.items():
                    attenuated = contribution * self.config.attenuation
                    product *= (1.0 + attenuated)

                year_shifts[year] = product - 1.0

            results[cat] = year_shifts

        return results

    def compute_force_scorecard(self, db: TrendDatabase) -> dict:
        """
        Compute weighted score per force (across all categories).
        Returns: {force: weighted_score}
        """
        scorecard = {}
        for force in FORCES:
            trends = db.get_trends_by_force(force)
            total = sum(t.normalized_score for t in trends)
            weight = self.config.force_weights.get(force, 1.0 / len(FORCES))
            scorecard[force] = total * weight
        return scorecard

    def compute_vc_scorecard(self, db: TrendDatabase) -> dict:
        """
        Compute weighted score per value chain step.
        Returns: {vc_step: weighted_score}
        """
        from pulse.config import VC_STEPS
        scorecard = {}
        for step in VC_STEPS:
            total = 0.0
            count = 0
            for trend in db.trends:
                exposure = trend.vc_exposure.get(step, 0)
                if exposure > 0:
                    total += trend.normalized_score * (exposure / 5.0)
                    count += 1
            vc_weight = self.config.vc_weights.get(step, 1.0 / len(VC_STEPS))
            scorecard[step] = total * vc_weight
        return scorecard

    def validate_against_v12(self, db: TrendDatabase, v12_values: dict,
                              tolerance: float = 0.0001) -> dict:
        """
        Compare PULSE deterministic output against V12 Dashboard values.

        Args:
            v12_values: {category: shift_pct} from V12 Dashboard
            tolerance: maximum acceptable difference (default 0.01pp)

        Returns:
            dict with pass/fail per category and overall result
        """
        pulse_results = self.run(db)
        report = {"passed": True, "details": {}}

        for cat in self.config.category_names:
            if cat not in v12_values:
                continue

            # Compare at the 2030 horizon (V12's long-term)
            pulse_val = pulse_results.get(cat, {}).get(2030, 0.0)
            v12_val = v12_values[cat]
            diff = abs(pulse_val - v12_val)
            passed = diff <= tolerance

            report["details"][cat] = {
                "pulse": round(pulse_val, 6),
                "v12": round(v12_val, 6),
                "diff": round(diff, 6),
                "passed": passed
            }
            if not passed:
                report["passed"] = False
                logger.warning(f"V12 parity FAIL: {cat} — PULSE={pulse_val:.4f} vs V12={v12_val:.4f}")

        return report
