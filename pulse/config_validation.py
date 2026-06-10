"""Pydantic v2 models for validating ModelConfig parameters.

Ensures configuration parameters satisfy mathematical constraints:
- Weights sum to 1.0 (with tolerance) — force, VC, region, category layers
- Per-force attenuation values within [0, 1] (one per force)
- Materialization values ascending from 0 to 1
- Positive iterations and valid category counts
- Correlation matrix symmetric, unit-diagonal, PSD at the 6-force level
  (the trend-population spectral gate lives in PUT /config, D1)
- Overlap matrices complete and bounded

D21 (June 2026): every config layer the engine consumes is now validated —
``force_correlation_matrix``, ``force_overlap_matrix``,
``within_force_overlap``, ``category_weights`` and ``region_weights`` had
no validation at all (audit F-23).
"""

from typing import Optional, List, Dict
from pydantic import BaseModel, field_validator, model_validator

from pulse.config import FORCES, CATEGORIES, VC_STEPS, REGIONS


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
    region_weights: Dict[str, float]
    category_names: List[str]
    category_weights: Dict[str, float]
    iterations: int
    within_force_rho: float
    force_correlation_matrix: Dict[str, Dict[str, float]]
    force_overlap_matrix: Dict[str, Dict[str, float]]
    within_force_overlap: Dict[str, float]

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
                f"(got {v}). Default is 10,000"
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

    # D20 (June 2026): validate_t_copula_df removed with the t-copula layer.

    @field_validator("region_weights")
    @classmethod
    def validate_region_weights(cls, v: Dict[str, float]) -> Dict[str, float]:
        """Region weights: all four regions, sum to 1.0, non-negative (D21)."""
        if not v:
            raise ValueError("region_weights cannot be empty")
        provided, required = set(v.keys()), set(REGIONS)
        if required - provided:
            raise ValueError(
                f"region_weights missing regions: {required - provided}. "
                f"Required: {required}"
            )
        if provided - required:
            raise ValueError(
                f"region_weights contains unknown regions: {provided - required}. "
                f"Only these allowed: {required}"
            )
        total = sum(v.values())
        if abs(total - 1.0) > 0.01:
            raise ValueError(
                f"region_weights must sum to 1.0 (got {total:.4f}, tolerance ±0.01)"
            )
        for region, w in v.items():
            if w < 0:
                raise ValueError(f"region_weights['{region}'] is negative ({w})")
        return v

    @field_validator("within_force_overlap")
    @classmethod
    def validate_within_force_overlap(cls, v: Dict[str, float]) -> Dict[str, float]:
        """Within-force overlap: all six forces, each in [0, 0.5] (D21).

        Upper bound 0.5 mirrors the PUT /config gate — at 0.5 a large force's
        summed signal is halved, which is already an aggressive correction.
        """
        provided, required = set(v.keys()), set(FORCES)
        if required - provided:
            raise ValueError(
                f"within_force_overlap missing forces: {required - provided}"
            )
        if provided - required:
            raise ValueError(
                f"within_force_overlap contains unknown forces: {provided - required}"
            )
        for force, val in v.items():
            if not isinstance(val, (int, float)) or not (0.0 <= float(val) <= 0.5):
                raise ValueError(
                    f"within_force_overlap['{force}'] = {val!r} must be a number in [0, 0.5]"
                )
        return v

    @field_validator("force_overlap_matrix")
    @classmethod
    def validate_force_overlap_matrix(cls, v: Dict[str, Dict[str, float]]) -> Dict[str, Dict[str, float]]:
        """Cross-force overlap matrix: 6×6, zero diagonal, off-diagonal in
        [0, 0.45] (D21). Asymmetry is allowed by design — "Government captures
        40% of Environmental's signal" ≠ the reverse."""
        provided, required = set(v.keys()), set(FORCES)
        if required - provided:
            raise ValueError(f"force_overlap_matrix missing rows: {required - provided}")
        if provided - required:
            raise ValueError(f"force_overlap_matrix has unknown rows: {provided - required}")
        for f, row in v.items():
            if set(row.keys()) != required:
                raise ValueError(
                    f"force_overlap_matrix['{f}'] must contain exactly the six forces"
                )
            diag = row.get(f, 0.0)
            if abs(float(diag)) > 1e-9:
                raise ValueError(
                    f"force_overlap_matrix diagonal ({f},{f}) must be 0.0 "
                    f"(within-force overlap is configured separately); got {diag}"
                )
            for g, val in row.items():
                if g == f:
                    continue
                if not isinstance(val, (int, float)) or not (0.0 <= float(val) <= 0.45):
                    raise ValueError(
                        f"force_overlap_matrix ({f},{g}) = {val!r} must be a number in [0, 0.45]"
                    )
        return v

    @field_validator("force_correlation_matrix")
    @classmethod
    def validate_force_correlation_matrix(cls, v: Dict[str, Dict[str, float]]) -> Dict[str, Dict[str, float]]:
        """Force correlation matrix: 6×6, unit diagonal, symmetric,
        off-diagonal in [0, 1], and PSD at the 6-force level (D21/D1).

        The 6×6 PSD check is a necessary condition; the binding spectral
        gate for the full trend-population matrix (within_force_rho +
        cross-force values expanded to N trends) runs in PUT /api/v1/config
        via ``correlation_lambda_min`` because it needs the live trend mix.
        """
        import numpy as np
        provided, required = set(v.keys()), set(FORCES)
        if required - provided:
            raise ValueError(f"force_correlation_matrix missing rows: {required - provided}")
        if provided - required:
            raise ValueError(f"force_correlation_matrix has unknown rows: {provided - required}")
        for f, row in v.items():
            if set(row.keys()) != required:
                raise ValueError(
                    f"force_correlation_matrix['{f}'] must contain exactly the six forces"
                )
            if abs(float(row[f]) - 1.0) > 0.01:
                raise ValueError(
                    f"force_correlation_matrix diagonal ({f},{f}) must be 1.0; got {row[f]}"
                )
            for g, val in row.items():
                if not isinstance(val, (int, float)) or not (0.0 <= float(val) <= 1.0):
                    raise ValueError(
                        f"force_correlation_matrix ({f},{g}) = {val!r} must be a number in [0, 1]"
                    )
        for f in FORCES:
            for g in FORCES:
                if abs(float(v[f][g]) - float(v[g][f])) > 0.001:
                    raise ValueError(
                        f"force_correlation_matrix not symmetric: ({f},{g})={v[f][g]} "
                        f"but ({g},{f})={v[g][f]}"
                    )
        M = np.array([[float(v[f][g]) for g in FORCES] for f in FORCES])
        lam_min = float(np.linalg.eigvalsh(M).min())
        if lam_min < -1e-9:
            raise ValueError(
                f"force_correlation_matrix is not positive semi-definite at the "
                f"6-force level (min eigenvalue {lam_min:.4f}). The engine would "
                f"have to repair it, making configured ≠ effective (audit F-01). "
                f"Lower the cross-force correlations."
            )
        return v

    @model_validator(mode="after")
    def validate_category_weights_against_names(self) -> "ModelConfigValidator":
        """Category weights: one weight per configured category, sum to 1.0,
        non-negative (D21). Cross-field: keys must equal category_names."""
        v = self.category_weights
        if not v:
            raise ValueError("category_weights cannot be empty")
        provided, required = set(v.keys()), set(self.category_names)
        if required - provided:
            raise ValueError(
                f"category_weights missing categories: {required - provided}"
            )
        if provided - required:
            raise ValueError(
                f"category_weights contains unknown categories: {provided - required}"
            )
        total = sum(v.values())
        if abs(total - 1.0) > 0.01:
            raise ValueError(
                f"category_weights must sum to 1.0 (got {total:.4f}, tolerance ±0.01)"
            )
        for cat, w in v.items():
            if w < 0:
                raise ValueError(f"category_weights['{cat}'] is negative ({w})")
        return self

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


def correlation_lambda_min(force_correlation_matrix: dict,
                           within_force_rho: float,
                           trend_forces: list) -> float:
    """Minimum eigenvalue of the trend-level correlation matrix implied by
    (within_force_rho, force_correlation_matrix) for a given trend population.

    D1 / audit F-01 (June 2026): the engine builds an N-trend matrix from
    these settings; if it is not positive semi-definite the engine silently
    repairs it by shrinking ALL correlations (configured != effective).
    Callers (PUT /api/v1/config) reject settings where this returns < 0.
    """
    import numpy as np
    n = len(trend_forces)
    if n == 0:
        return 1.0
    R = np.eye(n)
    for i in range(n):
        fi = trend_forces[i]
        row = force_correlation_matrix.get(fi, {})
        for j in range(i + 1, n):
            if fi == trend_forces[j]:
                r = within_force_rho
            else:
                r = row.get(trend_forces[j], 0.05)
            R[i, j] = R[j, i] = r
    return float(np.linalg.eigvalsh(R).min())
