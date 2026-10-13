"""Checks of a production run's model configuration and size.

``validate_model_config`` checks every parameter the engine consumes: complete
force, category and region coverage, weights and shares that sum to one,
attenuation and overlap values inside their bounds, and a symmetric,
unit-diagonal, positive definite force correlation matrix.
``validate_run_size`` checks the iterations and chains.
``correlation_lambda_min`` adds the check that only the loaded driver mix can
answer: whether the driver-level correlation matrix built from the settings
is positive definite (its smallest eigenvalue above POSITIVE_DEFINITE_FLOOR),
so the engine never has to weaken the configured correlations to repair it.
"""
import numpy as np

from prism.config import (CATEGORIES, FORCES, POSITIVE_DEFINITE_FLOOR, REGIONS, RUN_CHAINS_RANGE,
                          RUN_ITERATIONS_RANGE, ModelConfig, build_driver_correlation_matrix)
from prism.numbers import finite_number

SUM_TOLERANCE = 0.01


def _key_problems(name: str, provided, required) -> list:
    """The missing and the unknown entries of a map that must name exactly ``required``."""
    provided, required = set(provided), set(required)
    out = []
    if required - provided:
        out.append(f"{name} is missing {sorted(required - provided)}")
    if provided - required:
        out.append(f"{name} has unknown entries {sorted(provided - required)}")
    return out


def _bounded_map_problems(name: str, values: dict, required, low: float, high: float) -> list:
    out = _key_problems(name, values, required)
    out += [f"{name}['{key}'] = {value} is outside [{low}, {high}]" for key, value in values.items()
            if not finite_number(value) or not low <= value <= high]
    return out


def _correlation_problems(matrix: dict) -> list:
    out = _key_problems("force_correlation_matrix", matrix, FORCES)
    for f, row in matrix.items():
        out += _key_problems(f"force_correlation_matrix['{f}']", row, FORCES)
    if out:
        return out
    out += [f"force_correlation_matrix ({f},{g}) = {matrix[f][g]} is outside [0, 1]" for f in FORCES for g in FORCES
            if not finite_number(matrix[f][g]) or not 0.0 <= matrix[f][g] <= 1.0]
    if out:
        return out
    for i, f in enumerate(FORCES):
        if abs(matrix[f][f] - 1.0) > 0.01:
            out.append(f"force_correlation_matrix diagonal ({f},{f}) must be 1.0")
        out += [f"force_correlation_matrix is not symmetric at ({f},{g})" for g in FORCES[i + 1:]
                if abs(matrix[f][g] - matrix[g][f]) > 0.001]
    if out:
        return out
    lam_min = float(np.linalg.eigvalsh(np.array([[matrix[f][g] for g in FORCES] for f in FORCES])).min())
    if lam_min <= POSITIVE_DEFINITE_FLOOR:
        out.append(f"force_correlation_matrix is not positive definite (minimum eigenvalue {lam_min:.4f}); "
                   "lower the cross-force correlations")
    return out


def _cell_weight_problems(weights: dict) -> list:
    out = _key_problems("cell_weights", weights, CATEGORIES)
    total = 0.0
    for cat, row in weights.items():
        out += _key_problems(f"cell_weights['{cat}']", row, REGIONS)
        for region, w in row.items():
            if not finite_number(w) or w < 0:
                out.append(f"cell_weights['{cat}']['{region}'] must be a non-negative number")
            else:
                total += w
    if not out and abs(total - 1.0) > SUM_TOLERANCE:
        out.append(f"cell_weights must sum to 1.0 over all cells (got {total:.4f})")
    return out


def model_config_problems(config: ModelConfig) -> list:
    """Every problem with the parameters the engine consumes; empty when there is none."""
    problems = _bounded_map_problems("per_force_attenuation", config.per_force_attenuation, FORCES, 0.0, 1.0)
    problems += _bounded_map_problems("within_force_overlap", config.within_force_overlap, FORCES, 0.0, 0.5)
    problems += [f"{name} must not be empty" for name in ("overlap_correction_source", "cell_weights_source")
                 if not str(getattr(config, name)).strip()]
    years = list(config.path_years)
    if len(years) < 2 or years != sorted(years) or len(set(years)) != len(years):
        problems.append(f"path_years must be at least two ascending, distinct years (got {years})")
    if not isinstance(config.peak_year_jitter, bool):
        problems.append("peak_year_jitter must be true or false")
    weights = config.force_weights
    problems += _key_problems("force_weights", weights, FORCES)
    if not all(finite_number(w) and w >= 0 for w in weights.values()):
        problems.append("force_weights must be non-negative numbers")
    elif abs(sum(weights.values()) - 1.0) > SUM_TOLERANCE:
        problems.append(f"force_weights must sum to 1.0 (got {sum(weights.values()):.4f})")
    if not finite_number(config.within_force_rho) or not 0.0 <= config.within_force_rho <= 1.0:
        problems.append(f"within_force_rho must be in [0, 1] (got {config.within_force_rho})")
    problems += _correlation_problems(config.force_correlation_matrix)
    problems += _cell_weight_problems(config.cell_weights)
    return problems


def validate_model_config(config: ModelConfig) -> None:
    """Raise ValueError listing every problem if ``config`` is invalid."""
    problems = model_config_problems(config)
    if problems:
        raise ValueError(f"invalid model configuration: {'; '.join(problems)}")


def validate_run_size(iterations: int, chains: int) -> None:
    """Raise ValueError unless the iterations per chain and the chains lie in
    RUN_ITERATIONS_RANGE and RUN_CHAINS_RANGE."""
    problems = []
    for name, value, (low, high) in (("iterations", iterations, RUN_ITERATIONS_RANGE),
                                     ("chains", chains, RUN_CHAINS_RANGE)):
        if not low <= value <= high:
            problems.append(f"{name} must be between {low:,} and {high:,} (got {value:,})")
    if problems:
        raise ValueError(f"invalid run size: {'; '.join(problems)}")


def correlation_lambda_min(force_correlation_matrix: dict,
                           within_force_rho: float,
                           driver_forces: list) -> float:
    """Minimum eigenvalue of the driver-level correlation matrix for a driver mix.

    A value at or below POSITIVE_DEFINITE_FLOOR means the settings give no positive definite
    correlation matrix for these drivers; the engine would then have to shrink
    every correlation to repair it, so the configured dependence would not be
    the one simulated.
    """
    if len(driver_forces) == 0:
        return 1.0
    r = build_driver_correlation_matrix(driver_forces, within_force_rho, force_correlation_matrix)
    return float(np.linalg.eigvalsh(r).min())
