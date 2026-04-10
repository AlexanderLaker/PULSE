"""Reverse stress testing — find conditions that cause target outcomes."""
import numpy as np
try:
    from scipy.optimize import differential_evolution
except ImportError:
    differential_evolution = None
from typing import Dict, Any, Optional, List, Callable
import logging

logger = logging.getLogger(__name__)


class ReverseStressTester:
    """
    Inverse analysis: instead of "what happens if X?", asks "what would need
    to happen for outcome Y?"

    Uses global optimization (differential evolution) to find the minimum
    perturbation of input parameters that produces a target adverse outcome.

    Example: "What combination of force score changes would cause Hair:Color
    to contract by more than 10%?"

    This reveals:
    1. How fragile/robust each category is (how much stress needed to break?)
    2. Which parameter combinations are dangerous (multi-factor conditions)
    3. Most efficient ways to achieve a target portfolio shift
    """

    def __init__(self, max_iterations: int = 300, tolerance: float = 1e-7,
                 optimization_seed: int = 42):
        """
        Args:
            max_iterations: Max iterations for differential evolution
            tolerance: Convergence tolerance
            optimization_seed: Seed for reproducibility
        """
        self.max_iterations = max_iterations
        self.tolerance = tolerance
        self.seed = optimization_seed

    def find_stress_configuration(self,
                              model_func: Callable,
                              target_category: str,
                              target_shift: float,
                              param_names: List[str],
                              param_bounds: Optional[Dict[str, tuple]] = None,
                              current_values: Optional[Dict[str, float]] = None,
                              ) -> Dict[str, Any]:
        """
        Find the minimum parameter perturbation that achieves target shift.

        Objective: minimize perturbation distance while achieving the target.
        This shows "how much do we need to change inputs to get this outcome?"

        Args:
            model_func: Function(param_dict) -> {category: shift}
            target_category: Category to stress test
            target_shift: Target shift to achieve (e.g., -0.10 for -10%)
            param_names: Parameters to perturb (e.g., trend impact/probability scores)
            param_bounds: {param: (lower, upper)} bounds
            current_values: Current parameter values (baseline)

        Returns:
            {
                "target_category": str,
                "target_shift": float,
                "achieved_shift": float,
                "target_reached": bool,
                "stress_parameters": {param: new_value},
                "parameter_changes": {param: delta},
                "top_drivers": [{param, change, from, to}],
                "total_perturbation": float,  # Euclidean distance from baseline
                "optimization_success": bool,
                "interpretation": str,
            }
        """
        if param_bounds is None:
            param_bounds = {p: (1, 5) for p in param_names}
        if current_values is None:
            current_values = {p: 3.0 for p in param_names}

        bounds_list = [param_bounds.get(p, (1, 5)) for p in param_names]
        current_array = np.array([current_values.get(p, 3.0) for p in param_names])
        norm_factors = np.array([b[1] - b[0] for b in bounds_list])

        def objective(x):
            """Minimize: distance from baseline + penalty for missing target."""
            param_dict = {param_names[i]: x[i] for i in range(len(param_names))}

            try:
                result = model_func(param_dict)
                actual_shift = result.get(target_category, 0.0)
            except Exception as e:
                logger.warning(f"Model evaluation failed: {e}")
                return 1e9  # Large penalty for failed evaluations

            # Penalty if target not reached
            target_penalty = 0
            if target_shift < 0:
                # For negative target, penalty if we haven't gone that negative
                target_penalty = max(0, actual_shift - target_shift) * 1000
            else:
                # For positive target, penalty if we haven't gone that positive
                target_penalty = max(0, target_shift - actual_shift) * 1000

            # Distance from current values (normalized)
            normalized_delta = (x - current_array) / norm_factors
            perturbation_cost = np.sum(normalized_delta ** 2)

            return perturbation_cost + target_penalty

        try:
            logger.info(f"Reverse stress: finding scenario for {target_category} = {target_shift:+.1%}")

            result = differential_evolution(
                objective,
                bounds=bounds_list,
                maxiter=self.max_iterations,
                tol=self.tolerance,
                seed=self.seed,
                polish=True,
                atol=1e-8,
            )

            # Extract the stress scenario
            stress_params = {param_names[i]: float(result.x[i]) for i in range(len(param_names))}
            changes = {p: stress_params[p] - current_values.get(p, 3.0) for p in param_names}

            # Evaluate the stress scenario
            stress_result = model_func(stress_params)
            achieved_shift = stress_result.get(target_category, 0.0)

            # Rank changes by magnitude
            ranked_changes = sorted(changes.items(), key=lambda x: abs(x[1]), reverse=True)

            # Total perturbation distance
            perturbation_dist = np.sqrt(sum(
                ((stress_params[p] - current_values.get(p, 3.0)) / (param_bounds.get(p, (1,5))[1] - param_bounds.get(p, (1,5))[0]))**2
                for p in param_names
            ))

            # Check if target was reached
            target_reached = False
            if target_shift < 0:
                target_reached = achieved_shift <= target_shift * 0.99  # 1% tolerance
            else:
                target_reached = achieved_shift >= target_shift * 0.99

            return {
                "target_category": target_category,
                "target_shift": float(target_shift),
                "achieved_shift": float(achieved_shift),
                "shift_error": float(achieved_shift - target_shift),
                "target_reached": target_reached,
                "stress_parameters": stress_params,
                "parameter_changes": dict(ranked_changes),
                "top_drivers": [
                    {
                        "param": p,
                        "change": float(c),
                        "from": float(current_values.get(p, 3.0)),
                        "to": float(stress_params[p]),
                        "pct_change": float((c / current_values.get(p, 3.0)) * 100) if current_values.get(p, 3.0) != 0 else 0
                    }
                    for p, c in ranked_changes[:5] if abs(c) > 0.01
                ],
                "total_perturbation": float(perturbation_dist),
                "optimization_success": result.success,
                "optimization_message": result.message,
                "n_evaluations": result.nfev,
                "interpretation": (
                    f"To achieve {target_category} = {target_shift:+.1%}, "
                    f"change {ranked_changes[0][0]} by {ranked_changes[0][1]:+.2f}. "
                    f"Total perturbation: {perturbation_dist:.3f}. "
                    f"{'SUCCESS' if target_reached else 'PARTIAL: target not fully reached'}"
                )
            }

        except Exception as e:
            logger.error(f"Reverse stress test failed: {e}")
            return {
                "error": str(e),
                "target_category": target_category,
                "target_shift": target_shift,
            }

    def find_multi_category_stress(self,
                                    model_func: Callable,
                                    targets: Dict[str, float],
                                    param_names: List[str],
                                    param_bounds: Optional[Dict[str, tuple]] = None,
                                    current_values: Optional[Dict[str, float]] = None,
                                    ) -> Dict[str, Any]:
        """
        Find scenario where multiple categories simultaneously hit targets.

        Use case: "Find a scenario where Color and Care both contract by 5%."

        Args:
            model_func: Function(param_dict) -> {category: shift}
            targets: {category: target_shift} for multiple categories
            param_names: Parameters to perturb
            param_bounds: Parameter bounds

        Returns:
            Multi-category stress scenario with convergence metrics
        """
        if param_bounds is None:
            param_bounds = {p: (1, 5) for p in param_names}
        if current_values is None:
            current_values = {p: 3.0 for p in param_names}

        bounds_list = [param_bounds.get(p, (1, 5)) for p in param_names]
        current_array = np.array([current_values.get(p, 3.0) for p in param_names])

        def objective(x):
            param_dict = {param_names[i]: x[i] for i in range(len(param_names))}
            try:
                result = model_func(param_dict)
            except Exception:
                return 1e9

            # Sum of penalties across all target categories
            shift_penalty = 0
            for cat, target in targets.items():
                actual = result.get(cat, 0.0)
                if target < 0:
                    shift_penalty += max(0, actual - target) ** 2 * 1000
                else:
                    shift_penalty += max(0, target - actual) ** 2 * 1000

            perturbation_cost = np.sum(((x - current_array) / np.array([b[1]-b[0] for b in bounds_list]))**2)
            return perturbation_cost + shift_penalty

        try:
            logger.info(f"Multi-category reverse stress: {list(targets.keys())}")

            result = differential_evolution(
                objective, bounds=bounds_list,
                maxiter=self.max_iterations, tol=self.tolerance,
                seed=self.seed, polish=True,
            )

            stress_params = {param_names[i]: float(result.x[i]) for i in range(len(param_names))}
            stress_result = model_func(stress_params)

            achieved = {cat: float(stress_result.get(cat, 0.0)) for cat in targets}
            errors = {cat: abs(achieved[cat] - targets[cat]) for cat in targets}

            # Check if all targets were reached
            all_reached = all(
                (targets[c] < 0 and achieved[c] <= targets[c] * 0.99) or
                (targets[c] >= 0 and achieved[c] >= targets[c] * 0.99)
                for c in targets
            )

            return {
                "targets": targets,
                "achieved_shifts": achieved,
                "errors": errors,
                "max_error": float(max(errors.values())),
                "all_targets_reached": all_reached,
                "stress_parameters": stress_params,
                "parameter_changes": {p: stress_params[p] - current_values.get(p, 3.0) for p in param_names},
                "optimization_success": result.success,
                "n_evaluations": result.nfev,
            }
        except Exception as e:
            logger.error(f"Multi-category reverse stress failed: {e}")
            return {"error": str(e), "targets": targets}

    def sensitivity_to_target(self,
                               model_func: Callable,
                               target_category: str,
                               target_range: List[float],
                               param_names: List[str],
                               param_bounds: Optional[Dict[str, tuple]] = None,
                               ) -> Dict[str, Any]:
        """
        How does the minimum perturbation change as the target varies?

        Answers: "How much harder is it to achieve -10% vs -5%?"

        Args:
            model_func: Model function
            target_category: Category to analyze
            target_range: List of target shifts to test
            param_names: Parameters to perturb
            param_bounds: Parameter bounds

        Returns:
            Sensitivity curve: target shift → minimum perturbation required
        """
        results = []

        for target in target_range:
            stress_result = self.find_stress_scenario(
                model_func, target_category, target, param_names, param_bounds
            )

            if "total_perturbation" in stress_result:
                results.append({
                    "target_shift": float(target),
                    "achieved_shift": stress_result.get("achieved_shift", 0),
                    "min_perturbation": stress_result["total_perturbation"],
                    "feasible": stress_result["target_reached"],
                })

        return {
            "category": target_category,
            "sensitivity_curve": results,
            "easiest_target": min([r for r in results if r["feasible"]], key=lambda x: x["min_perturbation"])
                              if any(r["feasible"] for r in results) else None,
        }

    def generate_reverse_stress_report(self, results: List[Dict[str, Any]]) -> str:
        """Generate a human-readable reverse stress test report."""
        lines = ["# Reverse Stress Testing Report\n"]
        lines.append("*Finding minimum parameter perturbations to achieve adverse outcomes*\n")

        for i, r in enumerate(results, 1):
            if "error" in r:
                lines.append(f"## Scenario {i}: Error")
                lines.append(f"```\n{r['error']}\n```")
                continue

            cat = r.get("target_category", "Portfolio")
            target = r.get("target_shift", 0)
            achieved = r.get("achieved_shift", 0)
            reached = r.get("target_reached", False)

            lines.append(f"## Scenario {i}: {cat} Target = {target:+.1%}")
            lines.append(f"**Status:** {'✓ ACHIEVED' if reached else '✗ NOT REACHED'} (actual: {achieved:+.1%})")
            lines.append(f"**Perturbation Distance:** {r.get('total_perturbation', 0):.3f}")
            lines.append("")

            if "top_drivers" in r and r["top_drivers"]:
                lines.append("**Key Parameter Changes:**")
                for d in r["top_drivers"]:
                    lines.append(
                        f"- {d['param']}: {d['from']:.1f} → {d['to']:.1f} "
                        f"(Δ{d['change']:+.2f}, {d['pct_change']:+.0f}%)"
                    )
                lines.append("")

        return "\n".join(lines)
