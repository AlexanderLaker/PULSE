"""Bayesian Monte Carlo engine with copula-based dependency structure.

Replaces simplistic triangular distributions with:
- Beta-distributed priors that update with evidence (Bayesian hierarchical)
- Gaussian copula with t-copula tails for dependency (captures crisis correlation)
- Continuous path modeling (annual granularity 2026-2030)
"""

import logging
from typing import Optional

import numpy as np
from pulse.simulation._scipy_compat import cholesky, beta_ppf, t_cdf

from pulse.config import (ModelConfig, FORCES, DEFAULT_WITHIN_FORCE_RHO,
                           DEFAULT_T_COPULA_DF, DEFAULT_RESIDUAL_CROSS_RHO,
                           FORCE_MATERIALIZATION_OVERRIDES)
from pulse.ingestion.models import TrendDatabase, Trend
from pulse.causal.dag import CausalDAG

logger = logging.getLogger(__name__)


class BayesianMonteCarloEngine:
    """
    Bayesian Monte Carlo with copula dependencies and causal propagation.

    Key differences from v1.2:
    - Beta priors instead of triangular (learnable from data)
    - Copula-based correlation instead of flat ρ (captures tail dependence)
    - Causal DAG propagation instead of independent force combination
    - Continuous annual paths instead of 2 discrete points
    """

    def __init__(self, config: ModelConfig, causal_dag: Optional[CausalDAG] = None):
        self.config = config
        self.dag = causal_dag
        self.rng = np.random.default_rng(seed=42)

    def run(self, db: TrendDatabase, iterations: Optional[int] = None,
            scenario_overrides: Optional[dict] = None) -> dict:
        """
        Run Bayesian Monte Carlo simulation.

        Args:
            db: TrendDatabase with all trends
            iterations: number of MC iterations (default from config)
            scenario_overrides: {force: shock_magnitude} for scenario analysis

        Returns:
            dict with structure:
            {
                "shift_matrix": {category: {year: {percentile: value}}},
                "force_decomposition": {category: {force: contribution}},
                "causal_decomposition": {category: {path: contribution}},
                "convergence": {category: {"r_hat": float, "ess": int}},
                "raw_samples": np.ndarray  # (iterations, categories, years)
            }
        """
        n_iter = iterations or self.config.iterations
        n_cats = len(self.config.category_names)
        n_years = len(self.config.path_years)
        trends = db.trends

        logger.info(f"Running Bayesian MC: {n_iter} iterations, "
                     f"{len(trends)} trends, {n_cats} categories, {n_years} years")

        # Step 1: Build correlation matrix from causal DAG
        corr_matrix = self._build_correlation_matrix(trends)

        # Step 2: Generate correlated samples using copula
        raw_samples = self._generate_copula_samples(trends, corr_matrix, n_iter)

        # Step 3: Compute shift paths for each category per iteration
        shift_samples = np.zeros((n_iter, n_cats, n_years))

        for it in range(n_iter):
            # For each iteration, compute category shifts
            for c_idx, cat in enumerate(self.config.category_names):
                shift_samples[it, c_idx, :] = self._compute_category_path(
                    trends, raw_samples[it], cat, scenario_overrides
                )

        # Step 4: Compute percentiles and diagnostics
        result = self._compile_results(shift_samples, db)

        logger.info(f"MC complete. Median total shift at 2030: "
                     f"{np.median(shift_samples[:, :, -1].sum(axis=1)):.4f}")

        return result

    def _build_correlation_matrix(self, trends: list) -> np.ndarray:
        """
        Build correlation matrix from causal DAG structure.

        Within-force: Gaussian copula with ρ from config
        Cross-force with causal link: ρ derived from DAG weight
        Cross-force without link: residual macro correlation
        """
        n = len(trends)
        if n == 0:
            return np.eye(0)

        R = np.eye(n)

        for i in range(n):
            for j in range(i + 1, n):
                if trends[i].force == trends[j].force:
                    rho = self.config.within_force_rho
                elif self.dag:
                    # Causal DAG-informed correlation
                    dag_weight = self.dag.get_propagation_weight(
                        trends[i].force, trends[j].force
                    )
                    rho = max(dag_weight * 0.5, DEFAULT_RESIDUAL_CROSS_RHO)
                else:
                    rho = DEFAULT_RESIDUAL_CROSS_RHO

                R[i, j] = rho
                R[j, i] = rho

        # Ensure positive definiteness
        eigvals = np.linalg.eigvalsh(R)
        if eigvals.min() < 0:
            R += (abs(eigvals.min()) + 0.01) * np.eye(n)
            # Re-normalize diagonal
            d = np.sqrt(np.diag(R))
            R = R / np.outer(d, d)

        return R

    def _generate_copula_samples(self, trends: list, R: np.ndarray,
                                  n_iter: int) -> np.ndarray:
        """
        Generate correlated samples using t-copula for tail dependence.

        Each trend gets (impact_sample, probability_sample) from its Beta posterior,
        both correlated via copula structure. Impact and probability are sampled
        from a 2*N dimensional copula: first N dimensions for impact,
        second N dimensions for probability.

        Returns: (n_iter, n_trends) array of normalized_score samples
        """
        n_trends = len(trends)
        if n_trends == 0:
            return np.zeros((n_iter, 0))

        # Build extended correlation matrix: 2N x 2N for impact + probability
        # Block diagonal structure with within-force correlation
        R_extended = np.zeros((2 * n_trends, 2 * n_trends))

        # Impact block (top-left)
        R_extended[:n_trends, :n_trends] = R

        # Probability block (bottom-right)
        R_extended[n_trends:, n_trends:] = R

        # Off-diagonal blocks: correlation between impact and probability within trend
        # Same trend impact-probability correlation (~0.3-0.4)
        within_trend_corr = 0.35
        for j in range(n_trends):
            R_extended[j, n_trends + j] = within_trend_corr
            R_extended[n_trends + j, j] = within_trend_corr

        # Ensure positive definiteness
        eigvals = np.linalg.eigvalsh(R_extended)
        if eigvals.min() < 0:
            R_extended += (abs(eigvals.min()) + 0.01) * np.eye(2 * n_trends)
            # Re-normalize
            d = np.sqrt(np.diag(R_extended))
            R_extended = R_extended / np.outer(d, d)

        # Generate correlated uniform samples via t-copula
        df = self.config.t_copula_df
        try:
            L = cholesky(R_extended, lower=True)
        except np.linalg.LinAlgError:
            # Fallback: make positive definite
            eigvals, eigvecs = np.linalg.eigh(R_extended)
            eigvals = np.maximum(eigvals, 1e-6)
            R_extended = eigvecs @ np.diag(eigvals) @ eigvecs.T
            L = cholesky(R_extended, lower=True)

        # t-copula: Z ~ N(0, R_extended), chi2 ~ chi2(df), T = Z * sqrt(df/chi2)
        Z = self.rng.standard_normal((n_iter, 2 * n_trends))
        Z_correlated = Z @ L.T

        chi2_samples = self.rng.chisquare(df, size=(n_iter, 1))
        T = Z_correlated * np.sqrt(df / chi2_samples)

        # Transform to uniform via t-CDF
        U = t_cdf(T, df=df)
        U = np.clip(U, 0.001, 0.999)  # Avoid boundary issues

        # Transform uniforms to Beta-distributed impact/probability samples
        samples = np.zeros((n_iter, n_trends))
        for j, trend in enumerate(trends):
            # Impact: Beta(α, β) → scale to [1, 5]
            a_i, b_i = trend.impact_posterior
            impact_01 = beta_ppf(U[:, j], a_i, b_i)
            impact_scaled = 1 + impact_01 * 4  # [1, 5]

            # Probability: use correlated copula dimension (second half of U)
            a_p, b_p = trend.probability_posterior
            prob_01 = beta_ppf(U[:, n_trends + j], a_p, b_p)
            prob_scaled = 1 + prob_01 * 4  # [1, 5]

            # Direction flip: small probability that trend reverses
            flip_prob = 0.02  # 2% chance of direction reversal
            flip_mask = self.rng.random(n_iter) < flip_prob
            direction_signs = np.full(n_iter, trend.direction_sign)
            direction_signs[flip_mask] *= -1

            # Normalized score = (impact * probability * direction) / 25 × gp1_pct_affected
            # gp1_pct_affected caps the maximum economic impact of this trend
            samples[:, j] = (impact_scaled * prob_scaled * direction_signs) / 25.0 * trend.gp1_pct_affected

        return samples

    def _compute_category_path(self, trends: list, trend_scores: np.ndarray,
                                category: str,
                                scenario_overrides: Optional[dict] = None) -> np.ndarray:
        """
        Compute shift path for a single category in one MC iteration.

        Uses multiplicative compounding with causal propagation that respects lag structure.
        Returns: array of shifts for each year in path_years
        """
        n_years = len(self.config.path_years)
        year_shifts = np.zeros(n_years)

        # Compute per-force contribution for the base (no-lag) year
        base_force_contributions = {}
        for force in FORCES:
            force_weight = self.config.force_weights.get(force, 1.0 / len(FORCES))
            total_score = 0.0
            count = 0

            for j, trend in enumerate(trends):
                if trend.force != force:
                    continue
                exposure = trend.category_exposure.get(category, 0)
                if exposure > 0:
                    exposure_frac = exposure / 5.0

                    # Region weighting: scale contribution by how much of the
                    # trend's regional exposure overlaps with configured region weights.
                    # If a trend only affects "North America" (exposure=5) and NA weight=25%,
                    # then region_factor ~ 0.25. If all regions equally exposed, factor ~ 1.0.
                    region_weights = getattr(self.config, 'region_weights', {})
                    regional_exp = getattr(trend, 'regional_exposure', {}) or {}
                    if regional_exp and region_weights:
                        weighted_sum = 0.0
                        total_possible = 0.0
                        for region, r_weight in region_weights.items():
                            r_exp = regional_exp.get(region, 0)
                            weighted_sum += (r_exp / 5.0) * r_weight
                            total_possible += r_weight
                        region_factor = weighted_sum / max(total_possible, 1e-6)
                    else:
                        region_factor = 1.0  # No regional data → full impact

                    # VC weighting: scale by weighted avg of trend's VC exposures
                    vc_weights = getattr(self.config, 'vc_weights', {})
                    vc_exp = getattr(trend, 'vc_exposure', {}) or {}
                    if vc_exp and vc_weights:
                        vc_sum = 0.0
                        vc_total_w = 0.0
                        for step, w in vc_weights.items():
                            v_exp = vc_exp.get(step, 0)
                            vc_sum += (v_exp / 5.0) * w
                            vc_total_w += w
                        vc_factor = vc_sum / max(vc_total_w, 1e-6)
                    else:
                        vc_factor = 1.0  # No VC data → full impact

                    total_score += trend_scores[j] * exposure_frac * region_factor * vc_factor
                    count += 1

            avg_score = total_score / max(count, 1)

            # Apply scenario override if present
            if scenario_overrides and force in scenario_overrides:
                avg_score += scenario_overrides[force]

            base_force_contributions[force] = avg_score * force_weight

        # Compute year-by-year shifts with lag-aware causal propagation
        for y_idx, year in enumerate(self.config.path_years):
            # Start with base contributions for this year
            force_contributions = dict(base_force_contributions)

            # Add lagged causal propagation if DAG available
            if self.dag:
                propagated = {}
                for force, contrib in force_contributions.items():
                    if abs(contrib) > 0.001:
                        # Propagate with lag awareness: only include edges whose
                        # lag allows them to affect this year
                        for edge in self.dag.edges:
                            if edge.source_force == force and edge.lag_years == 0:
                                # Same-year propagation
                                target = edge.target_force
                                amount = contrib * edge.propagation_weight
                                propagated[target] = propagated.get(target, 0) + amount
                            elif edge.source_force == force and edge.lag_years > 0 and y_idx >= edge.lag_years:
                                # Lagged propagation: only apply if we're far enough in the path
                                target = edge.target_force
                                # Use the contribution from lag years ago
                                source_idx = y_idx - edge.lag_years
                                if source_idx >= 0:
                                    amount = contrib * edge.propagation_weight
                                    propagated[target] = propagated.get(target, 0) + amount

                for target, extra in propagated.items():
                    force_contributions[target] = force_contributions.get(target, 0) + extra

            # Multiplicative compounding with attenuation
            product = 1.0
            for contribution in force_contributions.values():
                attenuated = contribution * self.config.attenuation
                product *= (1.0 + attenuated)
            total_shift = product - 1.0

            # Apply materialization schedule
            mat_frac = self.config.materialization.get(year, 1.0)
            year_shifts[y_idx] = total_shift * mat_frac

        return year_shifts

    def _compile_results(self, samples: np.ndarray, db: TrendDatabase) -> dict:
        """Compute percentiles, convergence diagnostics, decompositions."""
        n_iter, n_cats, n_years = samples.shape
        percentiles = [10, 25, 50, 75, 90]

        shift_matrix = {}
        convergence = {}
        causal_decomposition = {}

        for c_idx, cat in enumerate(self.config.category_names):
            cat_data = samples[:, c_idx, :]

            path = {}
            for y_idx, year in enumerate(self.config.path_years):
                year_samples = cat_data[:, y_idx]
                path[year] = {
                    f"p{p}": float(np.percentile(year_samples, p))
                    for p in percentiles
                }
                path[year]["median"] = path[year]["p50"]
                path[year]["mean"] = float(np.mean(year_samples))
                path[year]["std"] = float(np.std(year_samples))

            # Velocity: year-over-year change in median
            velocity = {}
            years = self.config.path_years
            for i in range(1, len(years)):
                velocity[years[i]] = path[years[i]]["median"] - path[years[i-1]]["median"]

            shift_matrix[cat] = {
                "path": path,
                "velocity": velocity,
            }

            # Convergence diagnostic: split-chain R̂ approximation
            half = n_iter // 2
            chain1_mean = np.mean(cat_data[:half, -1])
            chain2_mean = np.mean(cat_data[half:, -1])
            within_var = (np.var(cat_data[:half, -1]) + np.var(cat_data[half:, -1])) / 2
            between_var = ((chain1_mean - chain2_mean) ** 2) / 2
            total_var = within_var + between_var
            r_hat = np.sqrt(total_var / max(within_var, 1e-10))

            convergence[cat] = {
                "r_hat": float(r_hat),
                "ess": int(n_iter / max(1, 1 + 2 * self._autocorr(cat_data[:, -1]))),
                "converged": r_hat < 1.05,
            }

            # Basic causal decomposition: attribute to direct vs propagated effects
            # Direct effects: immediate force impacts
            # Propagated effects: impacts from causal propagation
            direct_effects = {}
            propagated_effects = {}

            # Sum force contributions (direct)
            for force in FORCES:
                direct_effects[force] = 0.0
                propagated_effects[force] = 0.0

            # Simplified decomposition: attribute shifts by force presence
            trends = db.trends
            for trend in trends:
                exposure = trend.category_exposure.get(cat, 0)
                if exposure > 0:
                    direct_effects[trend.force] += trend.normalized_score * (exposure / 5.0)

            # Propagated effects from causal links
            if self.dag:
                for edge in self.dag.edges:
                    source_force = edge.source_force
                    target_force = edge.target_force
                    if direct_effects[source_force] != 0:
                        propagated_amount = direct_effects[source_force] * edge.propagation_weight
                        propagated_effects[target_force] += propagated_amount

            causal_decomposition[cat] = {
                "direct_effects": {f: float(v) for f, v in direct_effects.items()},
                "propagated_effects": {f: float(v) for f, v in propagated_effects.items()},
            }

        return {
            "shift_matrix": shift_matrix,
            "convergence": convergence,
            "causal_decomposition": causal_decomposition,
            "raw_samples": samples,
            "iterations": n_iter,
            "model_type": "bayesian_copula",
        }

    def _autocorr(self, x: np.ndarray, lag: int = 1) -> float:
        """Simple lag-1 autocorrelation for ESS estimate."""
        n = len(x)
        if n < lag + 2:
            return 0.0
        mean = np.mean(x)
        c0 = np.sum((x - mean) ** 2) / n
        c1 = np.sum((x[lag:] - mean) * (x[:-lag] - mean)) / n
        return c1 / max(c0, 1e-10)
