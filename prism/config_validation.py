"""Validation of a ModelConfig before it drives a production run.

``validate_model_config`` checks every parameter the engine consumes: complete
force and category coverage, weights and shares that sum to one, attenuation
and overlap values inside their bounds, a symmetric, unit-diagonal,
positive-semidefinite force correlation matrix, and a monotonic default
materialisation schedule. ``correlation_lambda_min`` adds the check that only
the loaded driver mix can answer: whether the driver-level correlation matrix
built from the settings is positive semidefinite, so the engine never has to
weaken the configured correlations to repair it.
"""

from typing import Dict, List

import numpy as np
from pydantic import BaseModel, ValidationError, field_validator, model_validator

from prism.config import FORCES, REGIONS, ModelConfig, build_driver_correlation_matrix

SUM_TOLERANCE = 0.01


def _require_keys(name: str, provided, required) -> None:
    provided, required = set(provided), set(required)
    if required - provided:
        raise ValueError(f"{name} is missing {sorted(required - provided)}")
    if provided - required:
        raise ValueError(f"{name} has unknown entries {sorted(provided - required)}")


class ModelConfigValidator(BaseModel):
    per_force_attenuation: Dict[str, float]
    attenuation_source: str
    base_year: int
    path_years: List[int]
    materialization: Dict[int, float]
    force_weights: Dict[str, float]
    cell_weights: Dict[str, Dict[str, float]]
    cell_weights_source: str
    category_names: List[str]
    iterations: int
    peak_year_jitter: int
    within_force_rho: float
    force_correlation_matrix: Dict[str, Dict[str, float]]
    force_overlap_matrix: Dict[str, Dict[str, float]]
    within_force_overlap: Dict[str, float]

    @field_validator("per_force_attenuation")
    @classmethod
    def _attenuation(cls, v):
        _require_keys("per_force_attenuation", v, FORCES)
        for force, val in v.items():
            if not 0.0 <= float(val) <= 1.0:
                raise ValueError(f"per_force_attenuation['{force}'] = {val} is outside [0, 1]")
        return v

    @field_validator("attenuation_source", "cell_weights_source")
    @classmethod
    def _provenance_label(cls, v):
        if not v.strip():
            raise ValueError("provenance labels must not be empty")
        return v

    @field_validator("base_year")
    @classmethod
    def _base_year(cls, v):
        if not 2020 <= v <= 2030:
            raise ValueError(f"base_year must be between 2020 and 2030 (got {v})")
        return v

    @field_validator("path_years")
    @classmethod
    def _path_years(cls, v):
        if len(v) < 2 or v != sorted(v) or len(set(v)) != len(v):
            raise ValueError(f"path_years must be at least two ascending, distinct years (got {v})")
        return v

    @field_validator("force_weights")
    @classmethod
    def _force_weights(cls, v):
        _require_keys("force_weights", v, FORCES)
        if any(w < 0 for w in v.values()):
            raise ValueError("force_weights must be non-negative")
        total = sum(v.values())
        if abs(total - 1.0) > SUM_TOLERANCE:
            raise ValueError(f"force_weights must sum to 1.0 (got {total:.4f})")
        return v

    @field_validator("category_names")
    @classmethod
    def _category_names(cls, v):
        if not v or any(not isinstance(n, str) or not n.strip() for n in v):
            raise ValueError("category_names must be a non-empty list of names")
        return v

    @field_validator("iterations")
    @classmethod
    def _iterations(cls, v):
        if not 100 <= v <= 1_000_000:
            raise ValueError(f"iterations must be between 100 and 1,000,000 (got {v})")
        return v

    @field_validator("peak_year_jitter")
    @classmethod
    def _peak_year_jitter(cls, v):
        if not 0 <= v <= 5:
            raise ValueError(f"peak_year_jitter must be between 0 and 5 years (got {v})")
        return v

    @field_validator("within_force_rho")
    @classmethod
    def _within_force_rho(cls, v):
        if not 0.0 <= v <= 1.0:
            raise ValueError(f"within_force_rho must be in [0, 1] (got {v})")
        return v

    @field_validator("within_force_overlap")
    @classmethod
    def _within_force_overlap(cls, v):
        _require_keys("within_force_overlap", v, FORCES)
        for force, val in v.items():
            if not 0.0 <= float(val) <= 0.5:
                raise ValueError(f"within_force_overlap['{force}'] = {val} is outside [0, 0.5]")
        return v

    @field_validator("force_overlap_matrix")
    @classmethod
    def _force_overlap_matrix(cls, v):
        _require_keys("force_overlap_matrix", v, FORCES)
        for f, row in v.items():
            _require_keys(f"force_overlap_matrix['{f}']", row, FORCES)
            if abs(float(row[f])) > 1e-9:
                raise ValueError(f"force_overlap_matrix diagonal ({f},{f}) must be 0.0")
            for g, val in row.items():
                if g != f and not 0.0 <= float(val) <= 0.45:
                    raise ValueError(f"force_overlap_matrix ({f},{g}) = {val} is outside [0, 0.45]")
        return v

    @field_validator("force_correlation_matrix")
    @classmethod
    def _force_correlation_matrix(cls, v):
        _require_keys("force_correlation_matrix", v, FORCES)
        for f, row in v.items():
            _require_keys(f"force_correlation_matrix['{f}']", row, FORCES)
            if abs(float(row[f]) - 1.0) > 0.01:
                raise ValueError(f"force_correlation_matrix diagonal ({f},{f}) must be 1.0")
            for g, val in row.items():
                if not 0.0 <= float(val) <= 1.0:
                    raise ValueError(f"force_correlation_matrix ({f},{g}) = {val} is outside [0, 1]")
        for f in FORCES:
            for g in FORCES:
                if abs(float(v[f][g]) - float(v[g][f])) > 0.001:
                    raise ValueError(f"force_correlation_matrix is not symmetric at ({f},{g})")
        m = np.array([[float(v[f][g]) for g in FORCES] for f in FORCES])
        lam_min = float(np.linalg.eigvalsh(m).min())
        if lam_min < -1e-9:
            raise ValueError(
                f"force_correlation_matrix is not positive semidefinite (minimum eigenvalue "
                f"{lam_min:.4f}); lower the cross-force correlations")
        return v

    @model_validator(mode="after")
    def _cell_weights(self):
        v = self.cell_weights
        _require_keys("cell_weights", v, self.category_names)
        total = 0.0
        for cat, row in v.items():
            _require_keys(f"cell_weights['{cat}']", row, REGIONS)
            for region, w in row.items():
                if w != w or w < 0:
                    raise ValueError(f"cell_weights['{cat}']['{region}'] must be a non-negative number")
                total += float(w)
        if total <= 0 or abs(total - 1.0) > SUM_TOLERANCE:
            raise ValueError(f"cell_weights must sum to 1.0 over all cells (got {total:.4f})")
        return self

    @model_validator(mode="after")
    def _materialization(self):
        years = sorted(self.materialization)
        values = [self.materialization[y] for y in years]
        if not values or any(not 0.0 <= x <= 1.0 for x in values):
            raise ValueError("materialization values must lie in [0, 1]")
        if any(b < a for a, b in zip(values, values[1:])):
            raise ValueError("materialization must not decrease from one year to the next")
        return self


def validate_model_config(config: ModelConfig) -> None:
    """Raise ValueError with a readable list of problems if ``config`` is invalid."""
    try:
        ModelConfigValidator(
            per_force_attenuation=dict(config.per_force_attenuation),
            attenuation_source=config.attenuation_source,
            base_year=config.base_year,
            path_years=list(config.path_years),
            materialization=dict(config.materialization),
            force_weights=dict(config.force_weights),
            cell_weights={c: dict(r) for c, r in config.cell_weights.items()},
            cell_weights_source=config.cell_weights_source,
            category_names=list(config.category_names),
            iterations=config.iterations,
            peak_year_jitter=config.peak_year_jitter,
            within_force_rho=config.within_force_rho,
            force_correlation_matrix=dict(config.force_correlation_matrix),
            force_overlap_matrix=dict(config.force_overlap_matrix),
            within_force_overlap=dict(config.within_force_overlap),
        )
    except ValidationError as err:
        problems = "; ".join(e["msg"] for e in err.errors(include_url=False))
        raise ValueError(f"invalid model configuration: {problems}") from None


def correlation_lambda_min(force_correlation_matrix: dict,
                           within_force_rho: float,
                           driver_forces: list) -> float:
    """Minimum eigenvalue of the driver-level correlation matrix for a driver mix.

    A negative value means the settings describe no valid correlation matrix
    for these drivers; the engine would then have to shrink every correlation
    to repair it, so the configured dependence would not be the one simulated.
    """
    if len(driver_forces) == 0:
        return 1.0
    r = build_driver_correlation_matrix(driver_forces, within_force_rho, force_correlation_matrix)
    return float(np.linalg.eigvalsh(r).min())
