"""Continuous path modeling — replaces 2 discrete time horizons with annual granularity.

A -5% shift over 4 years gradually is strategically different from -5% in a single
year due to regulatory shock. Path dynamics enable velocity tracking, acceleration
detection, and early-warning triggers.
"""

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

from pulse.config import (ModelConfig, FORCE_MATERIALIZATION_OVERRIDES,
                           DEFAULT_MATERIALIZATION)

logger = logging.getLogger(__name__)


@dataclass
class TriggerCondition:
    """An early-warning trigger that fires when a threshold is breached."""
    category: str
    condition_type: str = "shift_exceeds"  # "shift_exceeds" | "velocity_exceeds"
    threshold: float = -0.02
    target_year: int = 2027
    action_text: str = ""
    status: str = "active"  # "active" | "fired" | "dismissed"

    def evaluate(self, path: dict) -> Optional["TriggerAlert"]:
        if self.status != "active":
            return None

        year_data = path.get(self.target_year)
        if year_data is None:
            return None

        if self.condition_type == "shift_exceeds":
            median_val = year_data.get("median", year_data) if isinstance(year_data, dict) else year_data
            if abs(median_val) >= abs(self.threshold):
                return TriggerAlert(
                    trigger=self,
                    actual_value=median_val,
                    message=f"TRIGGER: {self.category} shift ({median_val:.1%}) "
                            f"exceeds threshold ({self.threshold:.1%}) by {self.target_year}. "
                            f"Action: {self.action_text}"
                )
        return None


@dataclass
class TriggerAlert:
    """A fired early-warning trigger."""
    trigger: TriggerCondition
    actual_value: float
    message: str = ""


class PathAnalyzer:
    """Analyzes continuous shift paths for velocity, acceleration, and triggers."""

    def __init__(self, config: ModelConfig):
        self.config = config
        self.triggers: list[TriggerCondition] = []

    def compute_velocity(self, path: dict) -> dict:
        """Year-over-year rate of change in median shift."""
        years = sorted(path.keys())
        velocity = {}
        for i in range(1, len(years)):
            prev_median = self._extract_median(path[years[i-1]])
            curr_median = self._extract_median(path[years[i]])
            velocity[years[i]] = curr_median - prev_median
        return velocity

    def compute_acceleration(self, velocity: dict) -> dict:
        """Rate of change in velocity (is the shift speeding up or slowing?)."""
        years = sorted(velocity.keys())
        accel = {}
        for i in range(1, len(years)):
            accel[years[i]] = velocity[years[i]] - velocity[years[i-1]]
        return accel

    def classify_path_shape(self, path: dict) -> str:
        """
        Classify the path shape for strategic communication.

        Returns one of:
        - "gradual" — steady linear change
        - "front_loaded" — most change happens early (regulatory shock)
        - "back_loaded" — most change happens late (technology adoption)
        - "step_change" — sudden shift in one year
        - "accelerating" — change is speeding up
        - "decelerating" — change is slowing down
        """
        velocity = self.compute_velocity(path)
        if not velocity:
            return "gradual"

        accel = self.compute_acceleration(velocity)
        vel_values = list(velocity.values())
        accel_values = list(accel.values()) if accel else [0]

        # Detect step change: one year's velocity is >3x the average
        avg_vel = np.mean(np.abs(vel_values))
        if avg_vel > 0:
            max_vel_ratio = max(np.abs(vel_values)) / avg_vel
            if max_vel_ratio > 3:
                return "step_change"

        # Detect front/back loading
        first_half_vel = np.mean(np.abs(vel_values[:len(vel_values)//2]))
        second_half_vel = np.mean(np.abs(vel_values[len(vel_values)//2:]))
        if first_half_vel > 1.5 * second_half_vel:
            return "front_loaded"
        if second_half_vel > 1.5 * first_half_vel:
            return "back_loaded"

        # Detect acceleration
        mean_accel = np.mean(accel_values)
        if mean_accel > 0.001:
            return "accelerating"
        if mean_accel < -0.001:
            return "decelerating"

        return "gradual"

    def add_trigger(self, trigger: TriggerCondition):
        self.triggers.append(trigger)

    def evaluate_triggers(self, category: str, path: dict) -> list:
        """Check all triggers for a category against its path."""
        alerts = []
        for trigger in self.triggers:
            if trigger.category == category:
                alert = trigger.evaluate(path)
                if alert:
                    alerts.append(alert)
                    trigger.status = "fired"
        return alerts

    def get_materialization_schedule(self, force: str) -> dict:
        """Get force-specific materialization curve."""
        if force in FORCE_MATERIALIZATION_OVERRIDES:
            return FORCE_MATERIALIZATION_OVERRIDES[force]
        return dict(self.config.materialization)

    def _extract_median(self, year_data) -> float:
        """Extract median from path year data (handles both dict and float)."""
        if isinstance(year_data, dict):
            return year_data.get("median", year_data.get("p50", 0.0))
        return float(year_data)

    def generate_default_triggers(self, shift_matrix: dict) -> list:
        """Auto-generate sensible triggers based on simulation results."""
        triggers = []
        for cat, data in shift_matrix.items():
            path = data.get("path", data)
            # Get 2030 median shift
            final_year = max(path.keys()) if path else 2030
            final_data = path.get(final_year, {})
            median_2030 = self._extract_median(final_data)

            if abs(median_2030) > 0.02:  # More than 2% total shift
                # Set trigger at 50% of 2030 shift, checked at 2027
                triggers.append(TriggerCondition(
                    category=cat,
                    condition_type="shift_exceeds",
                    threshold=median_2030 * 0.5,
                    target_year=2027,
                    action_text=f"Review {cat} strategy — shift tracking ahead of expectation"
                ))
        self.triggers.extend(triggers)
        return triggers
