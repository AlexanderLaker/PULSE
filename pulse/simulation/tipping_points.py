"""Tipping point detection for profit pool shift paths."""
import numpy as np
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)


class TippingPointDetector:
    """
    Detects structural inflection points in continuous shift paths where
    the rate of change accelerates significantly — indicating a tipping point
    or regime shift in the profit pool.

    Methods:
    1. Second-derivative analysis: d²shift/dt² exceeds threshold → acceleration point
    2. Sign reversal: shift crosses zero → fundamental direction change
    3. Threshold breach: shift crosses user-defined business thresholds
    4. Regime change: statistical shift in path behavior (future enhancement)

    Use cases:
    - Detect when a contraction accelerates (early warning)
    - Find when expansion turns to contraction
    - Identify when a category hits critical business thresholds
    """

    def __init__(self, acceleration_threshold: float = 0.005,
                 regime_window: int = 2):
        """
        Args:
            acceleration_threshold: Minimum |d²shift/dt²| to flag as tipping point
            regime_window: Years to look back for regime detection
        """
        self.acceleration_threshold = acceleration_threshold
        self.regime_window = regime_window

    def detect_from_path(self, path: Dict[int, float],
                          category: str = "") -> List[Dict[str, Any]]:
        """
        Detect tipping points in a single category's shift path.

        Args:
            path: {year: shift_value} continuous path (e.g., {2026: -0.01, 2027: -0.025, ...})
            category: Category name for labeling

        Returns:
            List of tipping point events (sorted by year)
        """
        years = sorted(path.keys())
        values = [path[y] for y in years]

        if len(years) < 3:
            logger.warning(f"Path has <3 points, skipping tipping point detection for {category}")
            return []

        tipping_points = []

        # First derivative (velocity) — rate of change.
        # NOTE: Local list-based computation (not the dict-based helper in
        # ``pulse.simulation.paths.PathAnalyzer.compute_velocity``). We need
        # index-addressable sequences here for inflection-point detection via
        # ``acceleration[i]`` lookups against ``years[i+2]``, so keeping the
        # scalar-list shape is intentional and faster than dict lookups.
        velocity = []
        for i in range(1, len(values)):
            velocity.append(values[i] - values[i-1])

        # Second derivative (acceleration) — rate of change in rate of change
        acceleration = []
        for i in range(1, len(velocity)):
            acceleration.append(velocity[i] - velocity[i-1])

        # ─── Acceleration tipping points ───
        for i, accel in enumerate(acceleration):
            year = years[i + 2]  # acceleration starts at 3rd year
            if abs(accel) >= self.acceleration_threshold:
                # Determine severity
                if abs(accel) >= 2 * self.acceleration_threshold:
                    severity = "critical"
                    severity_value = 2
                elif abs(accel) >= 1.5 * self.acceleration_threshold:
                    severity = "high"
                    severity_value = 1
                else:
                    severity = "medium"
                    severity_value = 0

                direction = "worsening_contraction" if accel < 0 and velocity[i] < 0 else \
                           "accelerating_contraction" if accel < 0 else \
                           "accelerating_expansion"

                tipping_points.append({
                    "type": "acceleration",
                    "category": category,
                    "year": year,
                    "acceleration": float(accel),
                    "velocity_before": float(velocity[i]),
                    "velocity_after": float(velocity[i+1] if i+1 < len(velocity) else velocity[i]),
                    "shift_at_point": float(values[i+2]),
                    "severity": severity,
                    "severity_value": severity_value,
                    "direction": direction,
                    "description": f"{category} ({year}): {direction} detected "
                                  f"(accel={accel:+.4f}, vel={velocity[i]:+.4f})",
                })

        # ─── Sign reversals (expansion ↔ contraction) ───
        for i in range(1, len(values)):
            if values[i-1] * values[i] < 0:  # sign change
                tipping_points.append({
                    "type": "sign_reversal",
                    "category": category,
                    "year": years[i],
                    "from_value": float(values[i-1]),
                    "to_value": float(values[i]),
                    "severity": "high",
                    "severity_value": 1,
                    "direction": "contraction_to_expansion" if values[i] > 0 else "expansion_to_contraction",
                    "description": f"{category} ({years[i]}): Structural reversal "
                                  f"({values[i-1]:+.4f} → {values[i]:+.4f})",
                })

        # ─── Inflection point: max rate of change ───
        if len(velocity) > 0:
            max_vel_idx = np.argmax(np.abs(velocity))
            year_at_max_vel = years[max_vel_idx + 1]
            tipping_points.append({
                "type": "inflection",
                "category": category,
                "year": year_at_max_vel,
                "velocity_at_inflection": float(velocity[max_vel_idx]),
                "severity": "medium",
                "severity_value": 0,
                "description": f"{category} ({year_at_max_vel}): Maximum rate of change "
                              f"({velocity[max_vel_idx]:+.4f} per year)",
            })

        return tipping_points

    def detect_all_categories(self, shift_matrix: Dict[str, Dict[int, float]]) -> Dict[str, Any]:
        """
        Detect tipping points across all categories.

        Args:
            shift_matrix: {category: {year: median_shift}} from Bayesian MC

        Returns:
            All tipping points grouped by category and ranked by severity
        """
        all_points = []
        by_category = {}

        for cat, path in shift_matrix.items():
            points = self.detect_from_path(path, cat)
            all_points.extend(points)
            if points:
                by_category[cat] = points

        # Rank by severity and absolute value
        all_points.sort(key=lambda x: (
            -x.get("severity_value", 0),  # Higher severity first
            -abs(x.get("acceleration", x.get("velocity_at_inflection", 0)))  # Larger magnitude
        ))

        # Identify systemic tipping points (many categories tipping same year)
        year_counts = {}
        for p in all_points:
            year_counts[p["year"]] = year_counts.get(p["year"], 0) + 1

        # Years when 3+ categories have tipping points
        systemic_years = {y: c for y, c in year_counts.items() if c >= 3}

        return {
            "tipping_points": all_points,
            "by_category": by_category,
            "systemic_years": systemic_years,
            "total_detected": len(all_points),
            "critical_count": sum(1 for p in all_points if p.get("severity") == "critical"),
            "high_count": sum(1 for p in all_points if p.get("severity") == "high"),
            "medium_count": sum(1 for p in all_points if p.get("severity") == "medium"),
        }

    def detect_threshold_breach(self, path: Dict[int, float],
                                 thresholds: List[Dict[str, Any]],
                                 category: str = "") -> List[Dict[str, Any]]:
        """
        Check if path crosses user-defined business thresholds.

        Args:
            path: {year: shift_value}
            thresholds: List of threshold definitions:
                [{"level": -0.05, "label": "Critical contraction", "action": "..."}]
            category: Category name

        Returns:
            List of threshold breach events (year when threshold is crossed)
        """
        breaches = []
        years = sorted(path.keys())

        for threshold in thresholds:
            level = threshold.get("level", -0.05)
            label = threshold.get("label", f"Threshold {level:+.1%}")
            action = threshold.get("action", "Review strategy")

            for i, year in enumerate(years):
                if i == 0:
                    continue

                prev_val = path[years[i-1]]
                curr_val = path[year]

                # Check if threshold was crossed (either direction)
                threshold_crossed = False
                cross_direction = None

                if prev_val > level >= curr_val:
                    # Crossed downward (moving into worse territory)
                    threshold_crossed = True
                    cross_direction = "downward"
                elif prev_val < level <= curr_val:
                    # Crossed upward (moving into better territory)
                    threshold_crossed = True
                    cross_direction = "upward"

                if threshold_crossed:
                    # Severity based on how far into the breach
                    breach_magnitude = abs(curr_val - level)
                    if breach_magnitude >= 0.05:
                        severity = "critical"
                    elif breach_magnitude >= 0.02:
                        severity = "high"
                    else:
                        severity = "medium"

                    breaches.append({
                        "type": "threshold_breach",
                        "category": category,
                        "year": year,
                        "threshold_level": float(level),
                        "threshold_label": label,
                        "recommended_action": action,
                        "shift_at_breach": float(curr_val),
                        "breach_magnitude": float(breach_magnitude),
                        "cross_direction": cross_direction,
                        "severity": severity,
                        "description": f"{category} crossed {label} in {year} "
                                      f"({prev_val:+.2%} → {curr_val:+.2%})",
                    })

        return breaches

    def generate_tipping_point_report(self, detection_result: Dict[str, Any]) -> str:
        """Generate a human-readable tipping point report."""
        lines = ["# Tipping Point Detection Report\n"]

        total = detection_result.get("total_detected", 0)
        lines.append(f"**Total tipping points detected:** {total}")
        lines.append(f"**Critical severity:** {detection_result.get('critical_count', 0)}")
        lines.append(f"**High severity:** {detection_result.get('high_count', 0)}")
        lines.append(f"**Medium severity:** {detection_result.get('medium_count', 0)}")
        lines.append("")

        systemic = detection_result.get("systemic_years", {})
        if systemic:
            lines.append("## Systemic Tipping Years (3+ categories simultaneously)\n")
            for year in sorted(systemic.keys()):
                count = systemic[year]
                lines.append(f"**{year}:** {count} categories")
            lines.append("")

        points = detection_result.get("tipping_points", [])
        if points:
            lines.append("## Top Tipping Points (by severity)\n")
            for i, tp in enumerate(points[:10], 1):
                lines.append(f"{i}. {tp.get('description', 'Unknown event')}")

        return "\n".join(lines)
