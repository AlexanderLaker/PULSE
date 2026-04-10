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
                           FORCE_MATERIALIZATION_OVERRIDES,
                           compute_materialization_schedule)
from pulse.ingestion.models import TrendDatabase, Trend

logger = logging.getLogger(__name__)


class BayesianMonteCarloEngine:
    """
    Bayesian Monte Carlo with copula dependencies.

    Key differences from v1.2:
    - Beta priors instead of triangular (learnable from data)
    - Copula-based correlation instead of flat ρ (captures tail dependence via force_correlation_matrix)
    - Multiplicative compounding across forces
    - Continuous annual paths instead of 2 discrete points
    """

    def __init__(self, config: ModelConfig):
        self.config = config
        self.rng = np.random.default_rng(seed=42)

    def run(self, db: TrendDatabase, iterations: Optional[int] = None) -> dict:
        """
        Run Bayesian Monte Carlo simulation.

        Args:
            db: TrendDatabase with all trends
            iterations: number of MC iterations (default from config)

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

        # Step 3: Compute shift paths for each category — VECTORIZED across iterations
        shift_samples = self._compute_all_paths_vectorized(
            trends, raw_samples, n_iter, n_cats, n_years
        )

        # Step 4: Compute percentiles and diagnostics
        result = self._compile_results(shift_samples, db)

        logger.info(f"MC complete. Median total shift at 2030: "
                     f"{np.median(shift_samples[:, :, -1].sum(axis=1)):.4f}")

        return result

    def _build_correlation_matrix(self, trends: list) -> np.ndarray:
        """
        Build correlation matrix from force correlation matrix.

        Within-force: Gaussian copula with ρ from config
        Cross-force: ρ from force_correlation_matrix or residual macro correlation
        """
        n = len(trends)
        if n == 0:
            return np.eye(0)

        R = np.eye(n)
        fcm = getattr(self.config, 'force_correlation_matrix', {})

        for i in range(n):
            for j in range(i + 1, n):
                if trends[i].force == trends[j].force:
                    rho = self.config.within_force_rho
                elif fcm:
                    # Use force correlation matrix
                    rho = fcm.get(trends[i].force, {}).get(trends[j].force, DEFAULT_RESIDUAL_CROSS_RHO)
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
        Generate correlated probability samples using t-copula for tail dependence.

        Each trend's probability of materialization is sampled from its Beta
        posterior, correlated across trends via copula structure. The copula
        captures "crisis correlation" — when things go wrong, they go wrong
        together (t-copula with low df = heavy tails).

        Returns: (n_iter, n_trends) array of normalized_score samples
        """
        n_trends = len(trends)
        if n_trends == 0:
            return np.zeros((n_iter, 0))

        # Ensure positive definiteness of R
        eigvals = np.linalg.eigvalsh(R)
        if eigvals.min() < 0:
            R = R + (abs(eigvals.min()) + 0.01) * np.eye(n_trends)
            d = np.sqrt(np.diag(R))
            R = R / np.outer(d, d)

        # Generate correlated uniform samples via t-copula
        df = self.config.t_copula_df
        try:
            L = cholesky(R, lower=True)
        except np.linalg.LinAlgError:
            logger.warning("Correlation matrix not positive definite — repairing via eigenvalue decomposition")
            eigvals, eigvecs = np.linalg.eigh(R)
            eigvals = np.maximum(eigvals, 1e-6)
            R = eigvecs @ np.diag(eigvals) @ eigvecs.T
            L = cholesky(R, lower=True)

        # t-copula: Z ~ N(0, R), chi2 ~ chi2(df), T = Z * sqrt(df/chi2)
        Z = self.rng.standard_normal((n_iter, n_trends))
        Z_correlated = Z @ L.T

        chi2_samples = self.rng.chisquare(df, size=(n_iter, 1))
        T = Z_correlated * np.sqrt(df / chi2_samples)

        # Transform to uniform via t-CDF
        U = t_cdf(T, df=df)
        U = np.clip(U, 0.001, 0.999)

        # Transform uniforms to Beta-distributed probability samples
        samples = np.zeros((n_iter, n_trends))
        for j, trend in enumerate(trends):
            # Probability of materialization: Beta(α, β) → [0, 1]
            # The sole stochastic driver — "how likely does this trend fully play out?"
            a_p, b_p = trend.probability_posterior
            prob_01 = beta_ppf(U[:, j], a_p, b_p)

            # gp1_pct_affected: economic magnitude — "what fraction of the
            # category's GP1 can this trend touch at full materialization?"
            # AI-determined per trend, no default — must be set when trend is created.
            gp1 = trend.gp1_pct_affected
            if gp1 is None or gp1 <= 0:
                logger.warning(f"Trend '{trend.name}' has no gp1_pct_affected set, skipping")
                continue

            # Final score = probability × gp1_pct_affected × direction
            # Clean separation: probability = likelihood, gp1_pct = magnitude
            samples[:, j] = prob_01 * gp1 * trend.direction_sign

        return samples

    def _compute_category_path(self, trends: list, trend_scores: np.ndarray,
                                category: str) -> np.ndarray:
        """
        Compute shift path for a single category in one MC iteration.

        Uses multiplicative compounding with per-trend materialization schedules.
        Each trend has its own peak_year and diffusion_curve, producing a unique
        materialization schedule. Falls back to force-level overrides for legacy trends.
        Returns: array of shifts for each year in path_years
        """
        n_years = len(self.config.path_years)
        year_shifts = np.zeros(n_years)

        # Pre-compute per-trend materialization schedules
        trend_mat_schedules = {}
        for j, trend in enumerate(trends):
            pk = getattr(trend, 'peak_year', 0) or 0
            dc = getattr(trend, 'diffusion_curve', '') or ''
            if pk > 0 and dc:
                # Per-trend curve from config.compute_materialization_schedule
                trend_mat_schedules[j] = compute_materialization_schedule(
                    pk, dc, self.config.path_years, self.config.base_year
                )
            else:
                # Fallback: force-level override or global default
                force_mat = FORCE_MATERIALIZATION_OVERRIDES.get(trend.force, {})
                trend_mat_schedules[j] = {
                    yr: force_mat.get(yr, self.config.materialization.get(yr, 1.0))
                    for yr in self.config.path_years
                }

        # Compute year-by-year shifts with multiplicative compounding
        for y_idx, year in enumerate(self.config.path_years):
            # Build per-force contributions for this year using per-trend materialization
            force_contributions = {}
            for force in FORCES:
                force_weight = self.config.force_weights.get(force, 1.0 / len(FORCES))
                total_score = 0.0

                for j, trend in enumerate(trends):
                    if trend.force != force:
                        continue
                    exposure = trend.category_exposure.get(category, 0)
                    if exposure > 0:
                        exposure_frac = min(exposure, 5) / 5.0  # Bounded 0.0-1.0

                        # Per-trend materialization fraction for this year
                        mat_frac = trend_mat_schedules[j].get(year, 1.0)

                        total_score += trend_scores[j] * exposure_frac * mat_frac

                force_score = total_score
                force_contributions[force] = force_score * force_weight

            # Multiplicative compounding with attenuation (no per-force materialization
            # here — already applied per-trend above)
            product = 1.0
            for force, contribution in force_contributions.items():
                attenuated = contribution * self.config.attenuation
                product *= (1.0 + attenuated)

            year_shifts[y_idx] = product - 1.0

        return year_shifts

    def _compute_all_paths_vectorized(self, trends: list, raw_samples: np.ndarray,
                                         n_iter: int, n_cats: int, n_years: int) -> np.ndarray:
        """
        Vectorized computation of all category × year shifts across all iterations.
        Replaces the O(n_iter × n_cats) Python loop with numpy broadcasting.
        ~50-100x faster than the per-iteration loop.
        """
        categories = self.config.category_names
        n_trends = len(trends)

        if n_trends == 0:
            return np.zeros((n_iter, n_cats, n_years))

        # Pre-compute static arrays (independent of iteration)
        # trend_force_idx[j] = index of trend j's force in FORCES
        force_list = list(FORCES)
        n_forces = len(force_list)
        force_idx_map = {f: i for i, f in enumerate(force_list)}
        trend_force_idx = np.array([force_idx_map.get(t.force, 0) for t in trends])

        # force_weights: (n_forces,)
        fw = np.array([self.config.force_weights.get(f, 1.0 / n_forces) for f in force_list])

        # exposure_matrix: (n_trends, n_cats) — exposure / 5.0, bounded
        exposure_matrix = np.zeros((n_trends, n_cats))
        for j, trend in enumerate(trends):
            for c_idx, cat in enumerate(categories):
                exp = trend.category_exposure.get(cat, 0)
                exposure_matrix[j, c_idx] = min(exp, 5) / 5.0 if exp > 0 else 0.0

        # materialization_matrix: (n_trends, n_years)
        mat_matrix = np.ones((n_trends, n_years))
        for j, trend in enumerate(trends):
            pk = getattr(trend, 'peak_year', 0) or 0
            dc = getattr(trend, 'diffusion_curve', '') or ''
            if pk > 0 and dc:
                sched = compute_materialization_schedule(
                    pk, dc, self.config.path_years, self.config.base_year
                )
            else:
                force_mat = FORCE_MATERIALIZATION_OVERRIDES.get(trend.force, {})
                sched = {
                    yr: force_mat.get(yr, self.config.materialization.get(yr, 1.0))
                    for yr in self.config.path_years
                }
            for y_idx, yr in enumerate(self.config.path_years):
                mat_matrix[j, y_idx] = sched.get(yr, 1.0)

        attenuation = self.config.attenuation

        # --- VECTORIZED CORE ---
        # raw_samples: (n_iter, n_trends) — sampled trend scores
        # effective_scores: (n_iter, n_trends, n_cats, n_years) — but we avoid materializing this
        # Instead: for each year, compute force contributions, then multiplicative compounding

        shift_samples = np.zeros((n_iter, n_cats, n_years))

        for y_idx in range(n_years):
            # mat_y: (n_trends,) — materialization fraction for this year
            mat_y = mat_matrix[:, y_idx]
            # effective per-trend contribution: raw_samples * mat_y
            # shape: (n_iter, n_trends)
            effective = raw_samples * mat_y[np.newaxis, :]

            # For each force, sum contributions across its trends per category
            # force_contribution: (n_iter, n_forces, n_cats)
            force_contrib = np.zeros((n_iter, n_forces, n_cats))
            for f_idx in range(n_forces):
                # mask trends belonging to this force
                mask = trend_force_idx == f_idx
                if not mask.any():
                    continue
                # effective[:, mask]: (n_iter, n_force_trends)
                # exposure_matrix[mask, :]: (n_force_trends, n_cats)
                # result: (n_iter, n_cats) — sum of trend_score * exposure for this force
                force_contrib[:, f_idx, :] = effective[:, mask] @ exposure_matrix[mask, :]

            # Apply force weights
            # Weighted: (n_iter, n_forces, n_cats) * (n_forces, 1)
            weighted = force_contrib * fw[:, np.newaxis]

            # Multiplicative compounding: product over forces of (1 + attenuated)
            attenuated = weighted * attenuation
            # (n_iter, n_forces, n_cats) → product over axis=1 → (n_iter, n_cats)
            product = np.prod(1.0 + attenuated, axis=1)
            shift_samples[:, :, y_idx] = product - 1.0

        return shift_samples

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

            # Direct effects: per-force contribution to total category shift.
            # Compute using same logic as the simulation: normalized_score × exposure × force_weight × region
            # Then scale proportionally so contributions sum to the MC median at 2030.
            raw_force_sums = {}
            for force in FORCES:
                raw_force_sums[force] = 0.0

            trends = db.trends
            for trend in trends:
                exposure = trend.category_exposure.get(cat, 0)
                if exposure > 0:
                    exposure_frac = min(exposure, 5) / 5.0
                    force_weight = self.config.force_weights.get(trend.force, 1.0 / len(FORCES))
                    raw_force_sums[trend.force] += trend.normalized_score * exposure_frac * force_weight

            # Scale to match MC median at 2030 so contributions add up
            raw_total = sum(raw_force_sums.values())
            last_year = self.config.path_years[-1]
            mc_median = path[last_year]["median"]
            scale = mc_median / raw_total if abs(raw_total) > 1e-10 else 1.0

            causal_decomposition[cat] = {
                "direct_effects": {f: float(v * scale) for f, v in raw_force_sums.items()},
            }

        # ── Value Chain Decomposition ──────────────────────────────────
        # VC weights allocate the total category shift across VC steps.
        # For each category, compute how much of the shift lands on each
        # VC step based on trend VC exposures × vc_weights (normalized).
        vc_decomposition = {}
        vc_weights = getattr(self.config, 'vc_weights', {})
        if vc_weights:
            # Build case-insensitive lookup helper
            def _vc_lookup(vc_exp: dict, step: str) -> float:
                v = vc_exp.get(step, None)
                if v is not None:
                    return float(v)
                norm = step.lower().replace(' ', '_')
                for k, val in vc_exp.items():
                    if k.lower().replace(' ', '_') == norm:
                        return float(val)
                return 0.0

            trends = db.trends
            for c_idx, cat in enumerate(self.config.category_names):
                # Compute raw relevance score per VC step for this category
                step_scores = {}
                for step, w in vc_weights.items():
                    raw = 0.0
                    for trend in trends:
                        cat_exp = trend.category_exposure.get(cat, 0)
                        if cat_exp > 0:
                            vc_exp = getattr(trend, 'vc_exposure', {}) or {}
                            v = _vc_lookup(vc_exp, step)
                            raw += abs(trend.normalized_score) * (cat_exp / 5.0) * (v / 5.0) * w
                    step_scores[step] = raw

                # Normalize to proportions summing to 1.0
                total_raw = sum(step_scores.values())
                if total_raw > 0:
                    step_shares = {s: v / total_raw for s, v in step_scores.items()}
                else:
                    n_steps = len(vc_weights)
                    step_shares = {s: 1.0 / n_steps for s in vc_weights}

                # Apply shares to the median 2030 shift for this category
                last_year = self.config.path_years[-1]
                median_shift = shift_matrix[cat]["path"][last_year]["median"]
                vc_decomposition[cat] = {
                    step: float(share * median_shift)
                    for step, share in step_shares.items()
                }

        return {
            "shift_matrix": shift_matrix,
            "convergence": convergence,
            "causal_decomposition": causal_decomposition,
            "vc_decomposition": vc_decomposition,
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
