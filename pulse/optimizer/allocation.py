"""Resource allocation optimizer — turns shift analysis into investment recommendations.

Given projected pool shifts across 13 categories, optimizes the relative category
investment mix to maximize risk-adjusted pool capture.

CRITICAL: Works entirely in relative terms — "invest X% more in Care vs Color" —
never in absolute €M.
"""

import logging
from typing import Optional

import numpy as np

# Use scipy-compat layer so the optimizer works on Vercel serverless (no scipy)
from pulse.simulation._scipy_compat import minimize

from pulse.config import ModelConfig, CATEGORIES

logger = logging.getLogger(__name__)


class AllocationOptimizer:
    """
    Mean-variance optimization for category investment weights.

    Objective: max Σ(w_c × E[shift_c]) - λ × Σ(w_c² × Var[shift_c])
    Subject to: Σ w_c = 1, w_min ≤ w_c ≤ w_max, turnover ≤ T
    """

    def __init__(self, config: ModelConfig):
        self.config = config

    def optimize(self, shift_matrix: dict,
                 risk_aversion: float = 1.0,
                 min_weight: float = 0.02,
                 max_weight: float = 0.25,
                 current_weights: Optional[dict] = None,
                 max_turnover: float = 0.5,
                 raw_samples: Optional[np.ndarray] = None,
                 category_order: Optional[list] = None) -> dict:
        """
        Compute optimal relative allocation weights.

        Args:
            shift_matrix: {category: {path: {year: {percentile: value}}}}
            risk_aversion: λ parameter (0 = growth only, 2+ = very conservative)
            min_weight: minimum weight per category
            max_weight: maximum weight per category
            current_weights: {category: current_weight} for turnover constraint
            max_turnover: maximum total reallocation allowed
            raw_samples: np.ndarray of shape (iterations, categories, years) from MC.
                When provided, the covariance matrix is computed empirically from
                the final-year cross-section of the MC samples. This replaces the
                old hard-coded "same-prefix = 0.3 correlation" heuristic, which
                was an unjustified guess that bore no relationship to the actual
                joint distribution of the simulated shifts.
            category_order: list of category names matching the axis order of
                raw_samples. Required when raw_samples is provided.

        Returns:
            {
                "weights": {category: weight},
                "expected_return": float,
                "risk": float,
                "sharpe_proxy": float,
                "frontier": [{risk, return, weights}],
                "defense_ranking": [{category, shift, rank}],
                "covariance_source": "mc_samples" | "heuristic_fallback",
            }
        """
        categories = list(shift_matrix.keys())
        n = len(categories)

        if n == 0:
            return {"weights": {}, "error": "No categories in shift matrix"}

        # Extract expected returns (median 2030 shift) and risk (std)
        mu = np.zeros(n)
        sigma = np.zeros(n)

        for i, cat in enumerate(categories):
            cat_data = shift_matrix[cat]
            path = cat_data.get("path", cat_data)
            final_year = max(path.keys()) if path else 2030
            final = path.get(final_year, {})

            if isinstance(final, dict):
                # For expansion categories, higher shift = better
                # For contraction categories, we want to minimize exposure
                mu[i] = final.get("median", final.get("p50", 0.0))
                sigma[i] = final.get("std", abs(final.get("p90", 0) - final.get("p10", 0)) / 3.28)
            else:
                mu[i] = float(final)
                sigma[i] = abs(mu[i]) * 0.3  # Rough estimate

        # CRITICAL FIX: Handle all-same-sign case (all negative or all positive)
        # When all returns have the same sign, mean-variance optimization produces
        # equal weights because there's no "good" vs "bad" to differentiate on.
        # Transform to relative returns so optimizer can identify "least bad" categories.
        all_same_sign = (np.all(mu >= 0) and np.any(mu > 0)) or np.all(mu <= 0)
        mu_relative = mu  # Will be used for optimization if needed

        if all_same_sign:
            # Transform: mu_relative = mu - min(mu)
            # Now worst category = 0, others get positive delta
            mu_relative = mu - mu.min()
            logger.info(f"All-same-sign detected (all {'negative' if np.all(mu <= 0) else 'positive'}). "
                       f"Using relative returns for optimization.")
        else:
            mu_relative = mu

        # Build covariance matrix — prefer empirical covariance from the MC
        # samples (the joint distribution the engine actually simulated).
        # Fall back to a diagonal heuristic only when raw samples are not
        # available (e.g. the engine was run in a mode that did not persist
        # them). The prior behavior was to hand-code correlations based on
        # category name prefixes ("Hair:" vs "LHC:"); that guess was never
        # validated and did not reflect the actual simulation.
        covariance_source = "heuristic_fallback"
        cov = np.diag(sigma ** 2)
        if raw_samples is not None and category_order is not None:
            try:
                # Match covariance ordering to the categories we are optimizing
                order_index = {c: i for i, c in enumerate(category_order)}
                idx = [order_index[c] for c in categories]
                # Cross-section at the final year (axis=2 is time)
                final_slice = raw_samples[:, idx, -1]  # (iterations, n)
                emp_cov = np.cov(final_slice, rowvar=False)
                # Guard against degenerate / non-PD returns
                if emp_cov.shape == (n, n) and np.all(np.isfinite(emp_cov)):
                    # Nudge the diagonal to avoid singular matrices
                    emp_cov = emp_cov + np.eye(n) * 1e-10
                    cov = emp_cov
                    covariance_source = "mc_samples"
            except (KeyError, IndexError, ValueError) as e:
                logger.warning(
                    f"Could not build empirical covariance from MC samples: {e}. "
                    f"Falling back to diagonal heuristic."
                )

        # Optimization
        def neg_utility(w):
            portfolio_return = w @ mu_relative  # Use relative returns if transformed
            portfolio_risk = risk_aversion * (w @ cov @ w)
            return -(portfolio_return - portfolio_risk)

        # Constraints
        constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]

        # Turnover constraint
        if current_weights:
            w_current = np.array([current_weights.get(c, 1.0/n) for c in categories])
            constraints.append({
                "type": "ineq",
                "fun": lambda w: max_turnover - np.sum(np.abs(w - w_current))
            })

        bounds = [(min_weight, max_weight) for _ in range(n)]
        w0 = np.ones(n) / n

        try:
            result = minimize(neg_utility, w0, method="SLSQP",
                              bounds=bounds, constraints=constraints,
                              options={"maxiter": 500})
            optimal_w = result.x
        except Exception as e:
            logger.warning(f"Optimization failed: {e}. Using equal weights.")
            optimal_w = np.ones(n) / n

        # Normalize to ensure sum = 1
        optimal_w = optimal_w / optimal_w.sum()

        weights = {cat: round(float(optimal_w[i]), 4) for i, cat in enumerate(categories)}
        expected_return = float(optimal_w @ mu)
        risk = float(np.sqrt(optimal_w @ cov @ optimal_w))

        # Compute efficient frontier
        frontier = self._compute_frontier(mu, cov, n, min_weight, max_weight, categories)

        # Defense ranking for all-contraction scenarios
        # Ranks categories from "least impacted" to "most impacted"
        # (i.e., from highest to lowest shift, where higher = less bad when negative)
        defense_ranking = [
            {
                "category": cat,
                "shift": round(mu[i], 6),
                "rank": j + 1,
                "weight": weights[cat],
            }
            for j, (i, cat) in enumerate(sorted(enumerate(categories), key=lambda x: mu[x[0]], reverse=True))
        ]

        return {
            "weights": weights,
            "expected_pool_shift": round(expected_return, 6),
            "portfolio_risk": round(risk, 6),
            "sharpe_proxy": round(expected_return / max(risk, 1e-6), 4),
            "risk_aversion_used": risk_aversion,
            "frontier": frontier,
            "defense_ranking": defense_ranking,
            "all_same_sign_scenario": all_same_sign,
            "covariance_source": covariance_source,
        }

    def _compute_frontier(self, mu, cov, n, min_w, max_w, categories,
                           points: int = 10) -> list:
        """Compute efficient frontier by varying risk aversion."""
        frontier = []
        for lam in np.linspace(0.1, 3.0, points):
            def neg_util(w, l=lam):
                return -(w @ mu - l * (w @ cov @ w))

            constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]
            bounds = [(min_w, max_w)] * n

            try:
                result = minimize(neg_util, np.ones(n)/n, method="SLSQP",
                                  bounds=bounds, constraints=constraints)
                w = result.x / result.x.sum()
                ret = float(w @ mu)
                risk = float(np.sqrt(w @ cov @ w))
                weights_dict = {c: round(float(w[i]), 4) for i, c in enumerate(categories)}
                frontier.append({
                    "risk_aversion": round(lam, 2),
                    "expected_return": round(ret, 6),
                    "risk": round(risk, 6),
                    "weights": weights_dict,
                })
            except Exception:
                pass

        return frontier
