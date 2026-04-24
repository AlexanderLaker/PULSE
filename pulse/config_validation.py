"""Pydantic v2 models for validating ModelConfig parameters.

Ensures configuration parameters satisfy mathematical constraints:
- Weights sum to 1.0 (with tolerance)
- Per-force attenuation values within [0, 1] (one per force)
- Materialization values ascending from 0 to 1
- Positive iterations and valid category counts
"""

from typing import Optional, List, Dict
from pydantic import BaseModel, field_validator, model_validator

from pulse.config import FORCES, CATEGORIES, VC_STEPS


class MaterializationSchedule(BaseModel):
    """Validates materialization schedule is monotonically increasing."""
    schedule: Dict[int, float]

    @field_validator("schedule")
    @classmethod
    def validate_monotonic_increasing(cls, v: Dict[int, float]) -> Dict[int, float]:
        """Ensure values are between 0-1 and monotonically increasing by year."""
        if not v:
            raise ValueError("Materialization schedule cannot be empty")

        years = sorted(v.keys())
        values = [v[year] for year in years]

        # Check each value is between 0 and 1
        for year, val in v.items():
            if not (0.0 <= val <= 1.0):
                raise ValueError(
                    f"Materialization value for year {year} ({val}) must be between 0 and 1"
                )

        # Check monotonically increasing
        for i in range(1, len(values)):
            if values[i] < values[i - 1]:
                raise ValueError(
                    f"Materialization schedule must be monotonically increasing. "
                    f"Year {years[i]} value {values[i]} < previous {values[i-1]}"
                )

        return v


class WeightDict(BaseModel):
    """Validates a weight dictionary sums to ~1.0 (tolerance ±0.01)."""
    weights: Dict[str, float]
    label: str = "weights"

    @field_validator("weights")
    @classmethod
    def validate_sum_to_one(cls, v: Dict[str, float]) -> Dict[str, float]:
        """Ensure weights sum to approximately 1.0 with tolerance."""
        if not v:
            raise ValueError(f"Weights dictionary cannot be empty")

        total = sum(v.values())
        tolerance = 0.01

        if abs(total - 1.0) > tolerance:
            raise ValueError(
                f"Weights must sum to 1.0 (got {total:.4f}, tolerance ±{tolerance}). "
                f"Normalize your weights: divide each by {total:.4f}"
            )

        # All weights should be non-negative
        for key, val in v.items():
            if val < 0:
                raise ValueError(f"Weight '{key}' is negative ({val}). All weights must be >= 0")

        return v


class ModelConfigValidator(BaseModel):
    """Comprehensive validation of ModelConfig parameters."""

    region: str
    aggregation_method: str
    per_force_attenuation: Dict[str, float]
    attenuation_source: str
    neutral_threshold: float
    base_year: int
    path_years: List[int]
    materialization: Dict[int, float]
    force_weights: Dict[str, float]
    vc_weights: Dict[str, float]
    category_names: List[str]
    iterations: int
    within_force_rho: float
    t_copula_df: int

    @field_validator("per_force_attenuation")
    @classmethod
    def validate_per_force_attenuation(cls, v: Dict[str, float]) -> Dict[str, float]:
        """Per-force attenuation must contain all six forces with values in [0, 1].

        v3.2: the legacy flat scalar ``attenuation`` was removed. The engine
        now consumes one calibrated value per force directly. Source-of-truth
        is data/Attenuation_Calibration.xlsx (Cross-Force_Matrix sheet),
        seeded into ``DEFAULT_PER_FORCE_ATTENUATION``.
        """
        if not v:
            raise ValueError("per_force_attenuation cannot be empty")

        provided = set(v.keys())
        required = set(FORCES)
        missing = required - provided
        if missing:
            raise ValueError(
                f"per_force_attenuation missing forces: {missing}. "
                f"All six forces required: {required}"
            )
        extra = provided - required
        if extra:
            raise ValueError(
                f"per_force_attenuation contains unknown forces: {extra}. "
                f"Only these allowed: {required}"
            )

        for force, val in v.items():
            if not isinstance(val, (int, float)):
                raise ValueError(
                    f"per_force_attenuation['{force}'] must be a number (got {type(val).__name__})"
                )
            if not (0.0 <= float(val) <= 1.0):
                raise ValueError(
                    f"per_force_attenuation['{force}'] = {val} is outside [0, 1]"
                )
        return v

    @field_validator("attenuation_source")
    @classmethod
    def validate_attenuation_source(cls, v: str) -> str:
        """Attenuation source must be v3.5 / v3.1 (legacy) / admin_override."""
        if v not in ("calibrated_v3.5_april2026", "calibrated_v3.1_april2026", "admin_override"):
            raise ValueError(
                f"attenuation_source must be one of ('calibrated_v3.5_april2026', "
                f"'calibrated_v3.1_april2026' (legacy), 'admin_override'). Got '{v}'"
            )
        return v

    @field_validator("neutral_threshold")
    @classmethod
    def validate_neutral_threshold(cls, v: float) -> float:
        """Neutral threshold should be small positive number."""
        if v < 0 or v > 0.01:
            raise ValueError(
                f"neutral_threshold should be between 0 and 0.01 (got {v}). "
                f"Default is 0.001"
            )
        return v

    @field_validator("base_year")
    @classmethod
    def validate_base_year(cls, v: int) -> int:
        """Base year should be recent and reasonable."""
        if v < 2020 or v > 2030:
            raise ValueError(
                f"base_year should be between 2020-2030 (got {v})"
            )
        return v

    @field_validator("path_years")
    @classmethod
    def validate_path_years(cls, v: List[int]) -> List[int]:
        """Path years must be sorted, in future, and at least 2 points."""
        if len(v) < 2:
            raise ValueError(
                f"path_years must have at least 2 points (got {len(v)})"
            )

        if v != sorted(v):
            raise ValueError(
                f"path_years must be sorted in ascending order (got {v})"
            )

        # All years should be >= base_year (2025)
        for year in v:
            if year < 2025:
                raise ValueError(
                    f"path_years must all be >= 2025 (got {year})"
                )

        return v

    @field_validator("force_weights")
    @classmethod
    def validate_force_weights(cls, v: Dict[str, float]) -> Dict[str, float]:
        """Force weights must sum to 1.0 and include all forces."""
        if not v:
            raise ValueError("force_weights cannot be empty")

        # Check all forces present
        provided_forces = set(v.keys())
        required_forces = set(FORCES)
        missing = required_forces - provided_forces
        if missing:
            raise ValueError(
                f"force_weights missing these forces: {missing}. "
                f"Required: {required_forces}"
            )

        # Check for extra forces
        extra = provided_forces - required_forces
        if extra:
            raise ValueError(
                f"force_weights contains unexpected forces: {extra}. "
                f"Only these allowed: {required_forces}"
            )

        # Validate sum
        total = sum(v.values())
        tolerance = 0.01
        if abs(total - 1.0) > tolerance:
            raise ValueError(
                f"force_weights must sum to 1.0 (got {total:.4f}, tolerance ±{tolerance}). "
                f"Normalize: {{{', '.join(f'{k}: {val/total:.4f}' for k, val in v.items())}}}"
            )

        # All weights non-negative
        for force, weight in v.items():
            if weight < 0:
                raise ValueError(
                    f"force_weights['{force}'] is negative ({weight}). "
                    f"All weights must be >= 0"
                )

        return v

    @field_validator("vc_weights")
    @classmethod
    def validate_vc_weights(cls, v: Dict[str, float]) -> Dict[str, float]:
        """VC weights must sum to 1.0 and include all value chain steps."""
        if not v:
            raise ValueError("vc_weights cannot be empty")

        # Check all VC steps present
        provided_steps = set(v.keys())
        required_steps = set(VC_STEPS)
        missing = required_steps - provided_steps
        if missing:
            raise ValueError(
                f"vc_weights missing these value chain steps: {missing}. "
                f"Required: {required_steps}"
            )

        # Check for extra steps
        extra = provided_steps - required_steps
        if extra:
            raise ValueError(
                f"vc_weights contains unexpected steps: {extra}. "
                f"Only these allowed: {required_steps}"
            )

        # Validate sum
        total = sum(v.values())
        tolerance = 0.01
        if abs(total - 1.0) > tolerance:
            raise ValueError(
                f"vc_weights must sum to 1.0 (got {total:.4f}, tolerance ±{tolerance}). "
                f"Normalize: {{{', '.join(f'{k}: {val/total:.4f}' for k, val in v.items())}}}"
            )

        # All weights non-negative
        for step, weight in v.items():
            if weight < 0:
                raise ValueError(
                    f"vc_weights['{step}'] is negative ({weight}). "
                    f"All weights must be >= 0"
                )

        return v

    @field_validator("category_names")
    @classmethod
    def validate_category_names(cls, v: List[str]) -> List[str]:
        """Category names must be non-empty strings."""
        if not v:
            raise ValueError("category_names cannot be empty")

        for i, name in enumerate(v):
            if not isinstance(name, str) or not name.strip():
                raise ValueError(
                    f"category_names[{i}] is empty or not a string (got {repr(name)})"
                )

        return v

    @field_validator("iterations")
    @classmethod
    def validate_iterations(cls, v: int) -> int:
        """Iterations must be at least 100 for meaningful sampling."""
        if v < 100:
            raise ValueError(
                f"iterations must be >= 100 for meaningful Bayesian sampling "
                f"(got {v}). Default is 50,000"
            )

        if v > 1_000_000:
            raise ValueError(
                f"iterations seems excessive ({v}). "
                f"Typical range: 1,000-50,000"
            )

        return v

    @field_validator("within_force_rho")
    @classmethod
    def validate_within_force_rho(cls, v: float) -> float:
        """Within-force correlation must be in [0, 1]."""
        if not (0.0 <= v <= 1.0):
            raise ValueError(
                f"within_force_rho must be in [0, 1] (got {v}). "
                f"Default is 0.3 (moderate correlation within a force)"
            )
        return v

    @field_validator("t_copula_df")
    @classmethod
    def validate_t_copula_df(cls, v: int) -> int:
        """T-copula degrees of freedom must be > 0, typically 2-10."""
        if v <= 0:
            raise ValueError(
                f"t_copula_df must be > 0 (got {v}). "
                f"Default is 4 (heavy tails for crisis correlation)"
            )

        if v > 100:
            raise ValueError(
                f"t_copula_df is very high ({v}). "
                f"High df ≈ Gaussian copula (light tails). Typical: 2-10"
            )

        return v

    @model_validator(mode="after")
    def validate_materialization_schedule(self) -> "ModelConfigValidator":
        """Validate materialization schedule is monotonically increasing."""
        if not self.materialization:
            raise ValueError("materialization schedule cannot be empty")

        years = sorted(self.materialization.keys())
        values = [self.materialization[year] for year in years]

        # Check each value is between 0 and 1
        for year, val in self.materialization.items():
            if not (0.0 <= val <= 1.0):
                raise ValueError(
                    f"materialization[{year}] = {val} is outside [0, 1]"
                )

        # Check monotonically increasing
        for i in range(1, len(values)):
            if values[i] < values[i - 1]:
                raise ValueError(
                    f"materialization must be monotonically increasing "
                    f"(year {years[i]} value {values[i]} < previous {values[i-1]})"
                )

        return self


def validate_model_config(config_dict: dict) -> ModelConfigValidator:
    """
    Validate a configuration dictionary against all constraints.

    Args:
        config_dict: Dictionary with ModelConfig parameters

    Returns:
        ModelConfigValidator instance (validated)

    Raises:
        pydantic.ValidationError: If any constraint is violated

    Example:
        >>> from pulse.config import ModelConfig
        >>> config = ModelConfig()
        >>> validated = validate_model_config(config.__dict__)
    """
    return ModelConfigValidator(**config_dict)
