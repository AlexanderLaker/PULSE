"""Sobol sensitivity analysis using SALib Saltelli sampling."""
import numpy as np
import logging
from typing import Dict, Any, Optional, List, Callable

logger = logging.getLogger(__name__)


class SobolAnalyzer:
    """
    Global sensitivity analysis using Sobol indices (variance-based).

    Unlike tornado analysis (one-at-a-time perturbations), Sobol captures:
    - S1 (first-order): direct effect of each input on output variance
    - ST (total-order): direct + all interactions involving that input
    - S2 (second-order): pairwise interaction effects

    Answers: "Which forces and trends truly drive the output variance?"
    This reveals which variables matter most when they vary together,
    not just when isolated.

    Uses SALib's Saltelli sampling scheme for efficiency.
    """

    def __init__(self, n_samples: int = 1024):
        """
        Args:
            n_samples: Base sample size for Saltelli sampling.
                       Total evaluations = n_samples * (2*D + 2) where D = number of parameters.
                       Larger = more accurate but slower.
        """
        self.n_samples = n_samples

    def analyze_force_sensitivity(self,
                                   model_func: Callable,
                                   force_names: List[str],
                                   bounds: Optional[Dict[str, tuple]] = None,
                                   ) -> Dict[str, Any]:
        """
        Run Sobol analysis on force weights.

        Args:
            model_func: Function that takes force_weights dict -> portfolio shift scalar
            force_names: List of force names
            bounds: {force_name: (lower, upper)} bounds for each weight

        Returns:
            {
                "first_order": {force: S1 value},
                "first_order_conf": {force: confidence interval},
                "total_order": {force: ST value},
                "total_order_conf": {force: confidence interval},
                "second_order": {"force1×force2": S2 value},
                "ranking": [first-order ranking],
                "n_evaluations": total model evaluations,
                "interpretation": human-readable summary
            }
        """
        try:
            from SALib.sample import saltelli
            from SALib.analyze import sobol
        except ImportError:
            logger.error("SALib not installed. pip install SALib")
            return {"error": "SALib not installed. Run: pip install SALib"}

        D = len(force_names)
        if bounds is None:
            bounds = {f: (0.05, 0.40) for f in force_names}

        problem = {
            'num_vars': D,
            'names': force_names,
            'bounds': [bounds.get(f, (0.05, 0.40)) for f in force_names]
        }

        logger.info(f"Sobol sampling: {D} forces, base samples {self.n_samples}")

        # Generate Saltelli samples
        param_values = saltelli.sample(problem, self.n_samples, calc_second_order=True)

        logger.info(f"Generated {param_values.shape[0]} samples for evaluation")

        # Evaluate model for each sample
        Y = np.zeros(param_values.shape[0])
        for i, params in enumerate(param_values):
            weight_dict = {force_names[j]: params[j] for j in range(D)}
            # Normalize weights to sum to 1
            total = sum(weight_dict.values())
            weight_dict = {k: v/total for k, v in weight_dict.items()}
            try:
                Y[i] = model_func(weight_dict)
            except Exception as e:
                logger.warning(f"Model evaluation failed for sample {i}: {e}")
                Y[i] = 0.0

        logger.info(f"Model evaluations complete. Y range: {Y.min():.6f} to {Y.max():.6f}")

        # Compute Sobol indices
        Si = sobol.analyze(problem, Y, calc_second_order=True)

        # First-order ranking
        first_order_ranking = sorted(
            [(force_names[i], Si['S1'][i]) for i in range(D)],
            key=lambda x: abs(x[1]),
            reverse=True
        )

        result = {
            "first_order": {force_names[i]: float(Si['S1'][i]) for i in range(D)},
            "first_order_conf": {force_names[i]: float(Si['S1_conf'][i]) for i in range(D)},
            "total_order": {force_names[i]: float(Si['ST'][i]) for i in range(D)},
            "total_order_conf": {force_names[i]: float(Si['ST_conf'][i]) for i in range(D)},
            "second_order": {},
            "ranking": [{"force": name, "S1": val, "rank": i+1}
                       for i, (name, val) in enumerate(first_order_ranking)],
            "n_evaluations": len(Y),
            "n_base_samples": self.n_samples,
        }

        # Second-order interactions (only if D is small)
        if D <= 15:
            for i in range(D):
                for j in range(i+1, D):
                    key = f"{force_names[i]}×{force_names[j]}"
                    result["second_order"][key] = float(Si['S2'][i][j])

            # Sort second-order by magnitude
            sorted_s2 = sorted(result["second_order"].items(), key=lambda x: abs(x[1]), reverse=True)
            result["top_interactions"] = [
                {"pair": k, "S2": v} for k, v in sorted_s2[:5]
            ]

        # Interpretation
        top_force = first_order_ranking[0][0] if first_order_ranking else "unknown"
        top_s1 = first_order_ranking[0][1] if first_order_ranking else 0
        result["interpretation"] = (
            f"**{top_force}** is the dominant driver (S1={top_s1:.3f}), accounting for "
            f"{top_s1*100:.1f}% of output variance. "
            f"Total-order index (ST) captures interactions: compare S1 vs ST for interaction strength."
        )

        return result

    def analyze_trend_sensitivity(self,
                                    model_func: Callable,
                                    trend_names: List[str],
                                    score_bounds: tuple = (1, 5),
                                    ) -> Dict[str, Any]:
        """
        Run Sobol analysis on individual trend scores.

        Args:
            model_func: Function that takes {trend_name: score} -> shift scalar
            trend_names: List of trend names to analyze
            score_bounds: (min, max) for trend scores (typically 1-5)

        Returns:
            {
                "first_order": {trend: S1 value},
                "total_order": {trend: ST value},
                "ranking": [top trends by total-order],
                "n_evaluations": total evaluations
            }
        """
        try:
            from SALib.sample import saltelli
            from SALib.analyze import sobol
        except ImportError:
            return {"error": "SALib not installed"}

        D = len(trend_names)
        problem = {
            'num_vars': D,
            'names': trend_names,
            'bounds': [score_bounds for _ in trend_names]
        }

        logger.info(f"Trend Sobol analysis: {D} trends")

        param_values = saltelli.sample(problem, self.n_samples, calc_second_order=(D <= 20))

        Y = np.zeros(param_values.shape[0])
        for i, params in enumerate(param_values):
            score_dict = {trend_names[j]: params[j] for j in range(D)}
            try:
                Y[i] = model_func(score_dict)
            except Exception:
                Y[i] = 0.0

        Si = sobol.analyze(problem, Y, calc_second_order=(D <= 20))

        first_order = {trend_names[i]: float(Si['S1'][i]) for i in range(D)}
        total_order = {trend_names[i]: float(Si['ST'][i]) for i in range(D)}

        # Rank by total order (more comprehensive)
        ranked = sorted(total_order.items(), key=lambda x: abs(x[1]), reverse=True)

        result = {
            "first_order": first_order,
            "total_order": total_order,
            "ranking": [{"trend": name, "S1": first_order[name], "ST": val, "rank": i+1}
                       for i, (name, val) in enumerate(ranked)],
            "n_evaluations": len(Y),
            "top_trends": [name for name, _ in ranked[:5]],
            "interpretation": (
                f"Top 5 most influential trends (by total-order Sobol): "
                f"{', '.join(name for name, _ in ranked[:5])}. "
                f"Total-order > First-order indicates interaction effects."
            )
        }

        return result

    def analyze_category_sensitivity(self,
                                      model_func: Callable,
                                      category_names: List[str],
                                      param_names: List[str],
                                      bounds: Optional[Dict[str, tuple]] = None,
                                      ) -> Dict[str, Any]:
        """
        Sobol sensitivity for a specific category's shift.

        Args:
            model_func: Function(params_dict) -> {category: shift}
            category_names: Which categories to analyze
            param_names: Parameters to vary
            bounds: Parameter bounds

        Returns:
            Per-category Sobol indices
        """
        if bounds is None:
            bounds = {p: (1, 5) for p in param_names}

        result = {}
        for category in category_names:
            # Wrapper that returns shift for this category
            def category_model(params):
                output = model_func(params)
                return output.get(category, 0.0)

            sobol_result = self.analyze_force_sensitivity(
                category_model, param_names, bounds
            )
            result[category] = sobol_result

        return result

    def compute_sobol_indices_dict(self, Si: Dict[str, np.ndarray],
                                     names: List[str]) -> Dict[str, Any]:
        """Convert raw SALib output to simplified dict format."""
        D = len(names)
        return {
            'S1': {names[i]: float(Si['S1'][i]) for i in range(D)},
            'ST': {names[i]: float(Si['ST'][i]) for i in range(D)},
            'S1_conf': {names[i]: float(Si['S1_conf'][i]) for i in range(D)},
            'ST_conf': {names[i]: float(Si['ST_conf'][i]) for i in range(D)},
        }
