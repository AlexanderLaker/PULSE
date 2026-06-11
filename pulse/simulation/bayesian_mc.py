"""Bayesian Monte Carlo engine with copula-based dependency structure.

Replaces simplistic triangular distributions with:
- Beta-distributed priors that update with evidence (Bayesian hierarchical)
- Gaussian copula for cross-trend dependency (D20 June 2026: the t-copula
  tail layer was deleted — its df dial was inert, <2% band effect)
- Continuous path modeling (annual granularity across the config horizon)

Quantile convention (D21): every percentile in this engine is computed with
``np.percentile`` linear interpolation (the numpy default) — one convention,
engine-wide, including velocity bands and any future band logic.
"""

import logging
from typing import Optional

import numpy as np

# D13 (June 2026, owner decision): exact scipy math is the ONLY math.
# scipy is a hard engine requirement — this module fails loudly at import
# if scipy is absent. The former _scipy_compat numpy-approximation layer
# was deleted; deployed/serverless surfaces never compute (F2: read-only
# over persisted runs), so nothing legitimate imports the engine without
# scipy. There is deliberately no fallback.
try:
    import scipy as _scipy
    from scipy.linalg import cholesky
    from scipy.stats import beta as _beta_dist, norm as _norm_dist
except ImportError as _e:  # pragma: no cover — exercised only in broken envs
    raise ImportError(
        "PRISM engine requires scipy (D13: exact numerics only; the numpy "
        "approximation fallback was removed June 2026). Install scipy, or "
        "use the read-only API service which never imports the engine."
    ) from _e

beta_ppf = _beta_dist.ppf
norm_cdf = _norm_dist.cdf

#: Recorded in every result + persisted run_meta for the audit trail (D13).
NUMERICS_BACKEND = f"scipy {_scipy.__version__} · numpy {np.__version__}"

from pulse.config import (ModelConfig, FORCES, REGIONS, VC_STEPS,
                           JOURNEY_STAGES, CATEGORY_JOURNEY,
                           DEFAULT_WITHIN_FORCE_RHO,
                           DEFAULT_RESIDUAL_CROSS_RHO,
                           FORCE_MATERIALIZATION_OVERRIDES,
                           compute_materialization_schedule,
                           DEFAULT_FORCE_OVERLAP_MATRIX,
                           DEFAULT_WITHIN_FORCE_OVERLAP)
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

    # Model semver + engine identity. Bumped whenever the result contract changes.
    # 2.8.0 — v3.7 June 2026 (second ruling round, D12–D21): Gaussian copula
    #         replaces the inert t-copula (D20); scipy-only exact numerics with
    #         numerics_backend in the result contract (D13); analytics suite
    #         deleted (D14 + Sobol rider); input-drift integrity event (D19);
    #         full config-layer validation (D21).
    # 2.7.0 — v3.6 June 2026: PSD-valid default correlations (D1); allocation
    #         removed from result contract (D4).
    MODEL_VERSION = "2.8.0"
    ENGINE_NAME = "bayesian_copula"

    def __init__(self, config: ModelConfig, seed: int = 42):
        self.config = config
        self.seed = seed
        self.rng = np.random.default_rng(seed=seed)
        # Integrity events: anything the engine had to repair or coerce at runtime
        # is appended here and surfaced in the result dict for the Integrity drawer.
        self._integrity_events: list[dict] = []
        # Pre-compute per-force effective attenuation from overlap matrix
        self._effective_attenuation = self._compute_effective_attenuation()

    def _compute_effective_attenuation(self) -> dict:
        """
        Return per-force effective attenuation directly from configuration.

        v3.2 (April 2026): the legacy ``base × (1 − mean_overlap)`` indirection
        has been removed. The engine now consumes ``config.per_force_attenuation``
        — six calibrated values (one per force) sourced from
        data/Attenuation_Calibration_v3_4.xlsx (Cross-Force sheet, 99-trend
        Bain review). There is no flat 0.5 default and no scalar fallback.

        Returns: dict {force_name: effective_attenuation}

        Raises: KeyError if any of the six forces is missing from the config
                (validated upstream by ModelConfigValidator).
        """
        per_force = dict(self.config.per_force_attenuation)
        # Defensive: fail loudly if any force is missing.
        missing = [f for f in FORCES if f not in per_force]
        if missing:
            raise KeyError(
                f"per_force_attenuation missing forces: {missing}. "
                f"All six forces required: {FORCES}"
            )
        logger.info(
            "Per-force attenuation (calibrated, source=%s): %s",
            getattr(self.config, "attenuation_source", "calibrated_v3.5_april2026"),
            ", ".join(f"{f}={per_force[f]:.3f}" for f in FORCES),
        )
        return per_force

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
                "force_attribution": {category: {"direct_effects": {force: contribution}}},
                "vc_decomposition": {category: {vc_step: contribution}},
                "journey_decomposition": {category: {"<journey>:<stage_id>": contribution}},
                "convergence": {category: {"r_hat": float, "ess": int}},
                "raw_samples": np.ndarray,  # (iterations, categories, years)
                "model_version": str, "engine_name": str,
                "seed": int, "integrity_events": list[dict],
            }
        """
        n_iter = iterations or self.config.iterations
        n_cats = len(self.config.category_names)
        n_years = len(self.config.path_years)
        trends = db.trends

        logger.info(f"Running Bayesian MC: {n_iter} iterations, "
                     f"{len(trends)} trends, {n_cats} categories, {n_years} years")

        # Step 1: Build correlation matrix (within-force and residual cross-force)
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
            self._integrity_events.append({
                "type": "correlation_pd_repair",
                "severity": "warning",
                "message": f"Correlation matrix was not positive-definite "
                           f"(min eigenvalue={eigvals.min():.4f}); repaired via "
                           f"diagonal shift + renormalization.",
            })
            R += (abs(eigvals.min()) + 0.01) * np.eye(n)
            # Re-normalize diagonal
            d = np.sqrt(np.diag(R))
            R = R / np.outer(d, d)

        return R

    def _generate_copula_samples(self, trends: list, R: np.ndarray,
                                  n_iter: int) -> np.ndarray:
        """
        Generate correlated probability samples via a Gaussian copula.

        Each trend's probability of materialization is sampled from its Beta
        posterior, correlated across trends via the copula structure.

        D20 (June 2026, owner decision): the former t-copula tail layer was
        deleted. Post-D1 re-test (verification/v8_d20_tcopula_df_out.txt)
        showed the df dial inert — portfolio P10–P90 band width moved <2%
        across df 4 → ∞ on PSD-valid defaults (one-signed bounded marginals
        and cross-category averaging wash the tail mixing out). Marketed
        complexity with no observable output effect is deleted, not kept:
        the Gaussian copula is what the engine honestly runs.

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

        # Generate correlated uniform samples via Gaussian copula
        try:
            L = cholesky(R, lower=True)
        except (np.linalg.LinAlgError, ValueError):
            self._integrity_events.append({
                "type": "cholesky_repair",
                "severity": "warning",
                "message": "Cholesky decomposition failed; correlation matrix "
                           "repaired via eigenvalue clipping (min eigenvalue "
                           "clipped to 1e-6).",
            })
            logger.warning("Correlation matrix not positive definite — repairing via eigenvalue decomposition")
            eigvals, eigvecs = np.linalg.eigh(R)
            eigvals = np.maximum(eigvals, 1e-6)
            R = eigvecs @ np.diag(eigvals) @ eigvecs.T
            L = cholesky(R, lower=True)

        # Gaussian copula: Z ~ N(0, R); U = Φ(Z)  (D20: t-copula deleted)
        Z = self.rng.standard_normal((n_iter, n_trends))
        Z_correlated = Z @ L.T

        U = norm_cdf(Z_correlated)
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
            # HARD FAIL (B3): a missing or invalid gp1_pct_affected silently
            # dropped the trend from the simulation and degraded the correlation
            # structure. We now refuse to run so the data-quality issue is visible.
            gp1 = trend.gp1_pct_affected
            if gp1 is None or gp1 <= 0 or gp1 > 1.0:
                raise ValueError(
                    f"Trend '{trend.id}' ({trend.name}) has invalid "
                    f"gp1_pct_affected={gp1!r}. Every trend must carry a "
                    f"gp1_pct_affected in (0.0, 1.0] before the simulation "
                    f"can be run. Fix the trend at ingestion time."
                )

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

        # Within-force overlap config
        wf_overlap = getattr(self.config, 'within_force_overlap', {})

        # Compute year-by-year shifts with multiplicative compounding
        for y_idx, year in enumerate(self.config.path_years):
            # Build per-force contributions for this year using per-trend materialization
            force_contributions = {}
            for force in FORCES:
                force_weight = self.config.force_weights.get(force, 1.0 / len(FORCES))
                total_score = 0.0
                n_active = 0  # Trends with non-zero exposure for this category

                for j, trend in enumerate(trends):
                    if trend.force != force:
                        continue
                    exposure = trend.category_exposure.get(category, 0)
                    if exposure > 0:
                        exposure_frac = min(exposure, 5) / 5.0  # Bounded 0.0-1.0

                        # Per-trend materialization fraction for this year
                        mat_frac = trend_mat_schedules[j].get(year, 1.0)

                        total_score += trend_scores[j] * exposure_frac * mat_frac
                        n_active += 1

                # Within-force overlap dampening: reduce sum when multiple
                # trends in the same force capture overlapping mechanisms.
                # Formula: dampened = raw × (1 - overlap × (n-1)/n)
                # With 1 trend: no dampening. With many: approaches (1 - overlap).
                wf = wf_overlap.get(force, 0.0)
                if n_active > 1 and wf > 0:
                    dampen = 1.0 - wf * (n_active - 1) / n_active
                    total_score *= dampen

                force_score = total_score
                force_contributions[force] = force_score * force_weight

            # Multiplicative compounding with calibrated per-force attenuation.
            # No scalar fallback: missing force → loud KeyError (validated upstream).
            product = 1.0
            for force, contribution in force_contributions.items():
                eff_att = self._effective_attenuation[force]
                attenuated = contribution * eff_att
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

        # --- Calibrated per-force attenuation (no scalar default) ---
        # Per-force effective attenuation: (n_forces,)
        eff_att = np.array([self._effective_attenuation[f] for f in force_list])

        # Within-force overlap: pre-compute per (force, category) dampening factors.
        # n_active[f][c] = number of trends in force f with non-zero exposure to category c
        # dampen[f][c] = 1 - overlap × (n_active - 1) / n_active
        wf_overlap = getattr(self.config, 'within_force_overlap', {})
        wf_dampen = np.ones((n_forces, n_cats))
        for f_idx, force in enumerate(force_list):
            mask = trend_force_idx == f_idx
            if not mask.any():
                continue
            wf = wf_overlap.get(force, 0.0)
            if wf <= 0:
                continue
            # Count active trends per category for this force
            # exposure_matrix[mask, :] > 0 → (n_force_trends, n_cats) boolean
            n_active_per_cat = (exposure_matrix[mask, :] > 0).sum(axis=0)  # (n_cats,)
            # dampening: 1 - overlap × (n-1)/n, clipped to avoid negative.
            # F-25/D21: divide on a guarded denominator — np.where evaluates
            # both branches, so a category with zero active trends used to
            # emit a spurious divide-by-zero RuntimeWarning here.
            n_safe = np.maximum(n_active_per_cat, 1)
            dampen = np.where(
                n_active_per_cat > 1,
                1.0 - wf * (n_active_per_cat - 1) / n_safe,
                1.0
            )
            wf_dampen[f_idx, :] = np.clip(dampen, 0.1, 1.0)

        # --- VECTORIZED CORE ---
        # raw_samples: (n_iter, n_trends) — sampled trend scores
        # For each year: compute force contributions with within-force dampening,
        # then multiplicative compounding with overlap-aware per-force attenuation.

        shift_samples = np.zeros((n_iter, n_cats, n_years))

        for y_idx in range(n_years):
            # mat_y: (n_trends,) — materialization fraction for this year
            mat_y = mat_matrix[:, y_idx]
            # effective per-trend contribution: raw_samples * mat_y
            # shape: (n_iter, n_trends)
            effective = raw_samples * mat_y[np.newaxis, :]

            # For each force, sum contributions across its trends per category
            # then apply within-force overlap dampening
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
                raw_sum = effective[:, mask] @ exposure_matrix[mask, :]
                # Within-force overlap dampening per category
                force_contrib[:, f_idx, :] = raw_sum * wf_dampen[f_idx, :][np.newaxis, :]

            # Apply force weights
            # Weighted: (n_iter, n_forces, n_cats) * (n_forces, 1)
            weighted = force_contrib * fw[:, np.newaxis]

            # Multiplicative compounding with overlap-aware per-force attenuation
            # eff_att: (n_forces,) → broadcast to (1, n_forces, 1)
            attenuated = weighted * eff_att[:, np.newaxis]
            # (n_iter, n_forces, n_cats) → product over axis=1 → (n_iter, n_cats)
            product = np.prod(1.0 + attenuated, axis=1)
            shift_samples[:, :, y_idx] = product - 1.0

        return shift_samples

    def _compile_results(self, samples: np.ndarray, db: TrendDatabase) -> dict:
        """Compute percentiles, convergence diagnostics, force attribution."""
        n_iter, n_cats, n_years = samples.shape
        percentiles = [10, 25, 50, 75, 90]

        shift_matrix = {}
        convergence = {}
        # NOTE: what used to be called "causal_decomposition" was never actually
        # causal — it is a static force attribution scaled to match the MC median.
        # Since the Causal DAG module and scenario engine have been removed,
        # we are honest about what this is: a force-level attribution.
        force_attribution = {}

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

            # D5: Velocity computed PER ITERATION first, then percentiled.
            # The old code subtracted the median of year t from the median
            # of year t-1, which conflates two different distributions and
            # hides how fast individual simulation paths are actually moving.
            # The correct quantity for early-warning triggers is the
            # distribution of year-over-year deltas across the full sample.
            years = self.config.path_years
            velocity = {}
            for i in range(1, len(years)):
                # Per-iteration delta between adjacent years (shape: n_iter)
                deltas = cat_data[:, i] - cat_data[:, i - 1]
                velocity[years[i]] = {
                    "median": float(np.percentile(deltas, 50)),
                    "p10": float(np.percentile(deltas, 10)),
                    "p25": float(np.percentile(deltas, 25)),
                    "p75": float(np.percentile(deltas, 75)),
                    "p90": float(np.percentile(deltas, 90)),
                    "mean": float(np.mean(deltas)),
                    "std": float(np.std(deltas)),
                }

            shift_matrix[cat] = {
                "path": path,
                "velocity": velocity,
            }

            # Convergence diagnostic: single-chain split-R̂ approximation.
            # A5: This is the ONE-CHAIN fallback — calling run_multichain()
            # yields proper multi-chain split-R̂ + integrated-autocorrelation
            # ESS across independent seeds. We still report this here so
            # the single-chain path has a convergence block, but we flag
            # it explicitly so nothing downstream presents it as rigorous.
            cat_chain = cat_data[:, -1]
            r_hat = self._split_rhat([cat_chain])
            convergence[cat] = {
                "r_hat": float(r_hat) if np.isfinite(r_hat) else 1.0,
                "ess": self._effective_sample_size(cat_chain),
                "converged": bool(np.isfinite(r_hat) and r_hat < 1.05),
                "n_chains": 1,
                "method": "single_chain_split_rhat_approximate",
            }

            # Direct effects: per-force contribution to total category shift.
            # Compute using same logic as the simulation: normalized_score × exposure × force_weight
            # Then scale proportionally so contributions sum to the MC median at the terminal year.
            # This is the TERMINAL-YEAR attribution — for per-year attribution see
            # `decompositions.force` in the returned dict below.
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

            # Scale to match MC median at terminal year so contributions add up
            raw_total = sum(raw_force_sums.values())
            last_year = self.config.path_years[-1]
            mc_median = path[last_year]["median"]
            scale = mc_median / raw_total if abs(raw_total) > 1e-10 else 1.0

            force_attribution[cat] = {
                "direct_effects": {f: float(v * scale) for f, v in raw_force_sums.items()},
            }

        # ── Value Chain Decomposition (terminal-year, back-compat) ─────
        # VC weights allocate the total category shift across VC steps.
        # For each category, compute how much of the shift lands on each
        # VC step based on trend VC exposures × vc_weights (normalized).
        vc_decomposition = {}
        vc_weights = getattr(self.config, 'vc_weights', {})

        # Build case-insensitive lookup helper (shared with per-year path below)
        def _vc_lookup(vc_exp: dict, step: str) -> float:
            v = vc_exp.get(step, None)
            if v is not None:
                return float(v)
            norm = step.lower().replace(' ', '_')
            for k, val in vc_exp.items():
                if k.lower().replace(' ', '_') == norm:
                    return float(val)
            return 0.0

        if vc_weights:
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

                # Apply shares to the median terminal-year shift for this category
                last_year = self.config.path_years[-1]
                median_shift = shift_matrix[cat]["path"][last_year]["median"]
                vc_decomposition[cat] = {
                    step: float(share * median_shift)
                    for step, share in step_shares.items()
                }

        # ── Consumer-journey decomposition (terminal-year, v3.6) ────────
        # Redistributes each category's terminal-year MC-median across the
        # stages of ITS journey (Hair categories → hair journey, 8 stages;
        # LHC categories → laundry journey, 13 stages) using exposure-
        # weighted shares — the same construction as vc_decomposition.
        # Stage keys stay namespaced ("lhc:add_products"). Because shares
        # are normalized to 1.0 before scaling, per-category stage sums
        # reconcile with the terminal-year median by construction — the
        # journey lens redistributes, it never changes totals.
        journey_decomposition = {}
        journey_trends = db.trends
        journey_last_year = self.config.path_years[-1]
        for cat in self.config.category_names:
            journey = CATEGORY_JOURNEY.get(cat, "lhc")
            stage_keys = [f"{journey}:{s}" for s in JOURNEY_STAGES[journey]]
            stage_scores = {k: 0.0 for k in stage_keys}
            for trend in journey_trends:
                cat_exp = trend.category_exposure.get(cat, 0)
                if cat_exp <= 0:
                    continue
                j_exp = getattr(trend, 'journey_exposure', {}) or {}
                for k in stage_keys:
                    v = float(j_exp.get(k, 0) or 0)
                    if v > 0:
                        stage_scores[k] += abs(trend.normalized_score) * (cat_exp / 5.0) * (v / 5.0)
            stage_total = sum(stage_scores.values())
            if stage_total > 0:
                stage_shares = {k: v / stage_total for k, v in stage_scores.items()}
            else:
                stage_shares = {k: 1.0 / len(stage_keys) for k in stage_keys}
            cat_median_shift = shift_matrix[cat]["path"][journey_last_year]["median"]
            journey_decomposition[cat] = {
                k: float(share * cat_median_shift)
                for k, share in stage_shares.items()
            }

        # ═══════════════════════════════════════════════════════════════
        # PER-YEAR DECOMPOSITIONS (Force / VC / Region)
        # ═══════════════════════════════════════════════════════════════
        # All three lenses decompose the SAME MC-median category shift for
        # each (cat, year), so by construction:
        #   sum over force  of force_decomp[y][c][f]  ==  mc_median[c][y]
        #   sum over vc_step of vc_decomp[y][c][s]    ==  mc_median[c][y]
        #   sum over region  of region_decomp[y][c][r] ==  mc_median[c][y]
        # Row totals (per category, per year) are identical across lenses.
        # Column totals (summed across categories) are unique per lens but
        # share the same grand total per year.
        trends = db.trends
        cats = list(self.config.category_names)
        years = list(self.config.path_years)
        region_weights = getattr(self.config, 'region_weights', None) or {r: 1.0 / len(REGIONS) for r in REGIONS}

        # Build the three per-category share structures ONCE (shares are
        # exposure-weighted and do not depend on year — the year-dependent
        # magnitude enters via mc_median[c][y]).
        force_shares: dict = {}
        vc_shares: dict = {}
        region_shares: dict = {}

        for cat in cats:
            # Force shares (exposure × force_weight × |score|)
            fsum = {f: 0.0 for f in FORCES}
            for trend in trends:
                cat_exp = trend.category_exposure.get(cat, 0)
                if cat_exp > 0:
                    fw = self.config.force_weights.get(trend.force, 1.0 / len(FORCES))
                    fsum[trend.force] += abs(trend.normalized_score) * (cat_exp / 5.0) * fw
            ftot = sum(fsum.values())
            if ftot > 0:
                force_shares[cat] = {f: v / ftot for f, v in fsum.items()}
            else:
                force_shares[cat] = {f: 1.0 / len(FORCES) for f in FORCES}

            # VC shares (exposure × vc_weight × |score|)
            vsum = {s: 0.0 for s in VC_STEPS}
            for step in VC_STEPS:
                w = vc_weights.get(step, 1.0 / len(VC_STEPS)) if vc_weights else 1.0 / len(VC_STEPS)
                for trend in trends:
                    cat_exp = trend.category_exposure.get(cat, 0)
                    if cat_exp > 0:
                        vc_exp = getattr(trend, 'vc_exposure', {}) or {}
                        v = _vc_lookup(vc_exp, step)
                        vsum[step] += abs(trend.normalized_score) * (cat_exp / 5.0) * (v / 5.0) * w
            vtot = sum(vsum.values())
            if vtot > 0:
                vc_shares[cat] = {s: v / vtot for s, v in vsum.items()}
            else:
                vc_shares[cat] = {s: 1.0 / len(VC_STEPS) for s in VC_STEPS}

            # Region shares (exposure × region_weight × |score|)
            rsum = {r: 0.0 for r in REGIONS}
            for region in REGIONS:
                rw = region_weights.get(region, 1.0 / len(REGIONS))
                for trend in trends:
                    cat_exp = trend.category_exposure.get(cat, 0)
                    if cat_exp > 0:
                        reg_exp_map = getattr(trend, 'regional_exposure', {}) or {}
                        r_exp = float(reg_exp_map.get(region, 0.0))
                        rsum[region] += abs(trend.normalized_score) * (cat_exp / 5.0) * (r_exp / 5.0) * rw
            rtot = sum(rsum.values())
            if rtot > 0:
                region_shares[cat] = {r: v / rtot for r, v in rsum.items()}
            else:
                # Fallback — if no trend carries regional_exposure, use equal weights
                region_shares[cat] = {r: 1.0 / len(REGIONS) for r in REGIONS}

        # Now materialize the per-year decompositions keyed by year → cat → dim
        force_decomp = {int(y): {} for y in years}
        vc_decomp = {int(y): {} for y in years}
        region_decomp = {int(y): {} for y in years}

        for year in years:
            yi = int(year)
            for cat in cats:
                median_cy = float(shift_matrix[cat]["path"][year]["median"])
                force_decomp[yi][cat] = {
                    f: float(force_shares[cat][f] * median_cy) for f in FORCES
                }
                vc_decomp[yi][cat] = {
                    s: float(vc_shares[cat][s] * median_cy) for s in VC_STEPS
                }
                region_decomp[yi][cat] = {
                    r: float(region_shares[cat][r] * median_cy) for r in REGIONS
                }

        # ── Totals ─────────────────────────────────────────────────────
        # Row totals: per-category MC median at each year (identical across lenses).
        category_path_totals: dict = {
            cat: {
                int(y): float(shift_matrix[cat]["path"][y]["median"]) for y in years
            }
            for cat in cats
        }
        # Column totals: aggregate across categories, per (dim, year).
        by_force_totals: dict = {int(y): {f: 0.0 for f in FORCES} for y in years}
        by_vc_totals: dict = {int(y): {s: 0.0 for s in VC_STEPS} for y in years}
        by_region_totals: dict = {int(y): {r: 0.0 for r in REGIONS} for y in years}
        grand_totals: dict = {int(y): 0.0 for y in years}
        for year in years:
            yi = int(year)
            for cat in cats:
                for f in FORCES:
                    by_force_totals[yi][f] += force_decomp[yi][cat][f]
                for s in VC_STEPS:
                    by_vc_totals[yi][s] += vc_decomp[yi][cat][s]
                for r in REGIONS:
                    by_region_totals[yi][r] += region_decomp[yi][cat][r]
                grand_totals[yi] += category_path_totals[cat][yi]

        decompositions = {
            "force":  force_decomp,   # year → cat → force  → shift
            "vc":     vc_decomp,      # year → cat → vc     → shift
            "region": region_decomp,  # year → cat → region → shift
            "dimensions": {
                "forces":    list(FORCES),
                "vc_steps":  list(VC_STEPS),
                "regions":   list(REGIONS),
                "categories": cats,
                "years":     [int(y) for y in years],
            },
        }
        # ── Joint portfolio band (D3 / audit F-16) ──────────────────────
        # True joint percentiles of the category-weighted portfolio shift,
        # computed per iteration from the raw samples. NOT the category-
        # weighted average of per-category bands — that construction is
        # narrower than the truth by construction and was exactly the
        # honesty failure F-16 flagged. Weights: config.category_weights
        # (normalized), falling back to equal weights.
        cw = getattr(self.config, "category_weights", None) or {}
        w = np.array([float(cw.get(c, 0.0)) for c in self.config.category_names])
        if w.sum() <= 0:
            w = np.full(n_cats, 1.0 / n_cats)
        else:
            w = w / w.sum()
        port = np.tensordot(samples, w, axes=([1], [0]))  # (n_iter, n_years)
        portfolio_path = {}
        for y_idx, year in enumerate(self.config.path_years):
            ys = port[:, y_idx]
            cell = {f"p{p}": float(np.percentile(ys, p)) for p in percentiles}
            cell["median"] = cell["p50"]
            cell["mean"] = float(np.mean(ys))
            cell["std"] = float(np.std(ys))
            portfolio_path[int(year)] = cell

        totals = {
            "category_path":  category_path_totals,  # row totals
            "by_force":       by_force_totals,       # column totals (Force lens)
            "by_vc":          by_vc_totals,          # column totals (VC lens)
            "by_region":      by_region_totals,      # column totals (Region lens)
            "grand":          grand_totals,          # cross-category grand total
            # Joint portfolio percentiles (category-weighted mean per
            # iteration). The headline band reads THIS, not an average of
            # per-category bands.
            "portfolio":      portfolio_path,
        }

        return {
            "shift_matrix": shift_matrix,
            "convergence": convergence,
            "force_attribution": force_attribution,
            "vc_decomposition": vc_decomposition,
            "journey_decomposition": journey_decomposition,
            "decompositions": decompositions,
            "totals": totals,
            "raw_samples": samples,
            "iterations": n_iter,
            "model_type": "bayesian_copula",
            "model_version": self.MODEL_VERSION,
            "engine_name": self.ENGINE_NAME,
            "numerics_backend": NUMERICS_BACKEND,
            "seed": self.seed,
            "integrity_events": list(self._integrity_events),
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

    # ── A5: Multi-chain convergence diagnostics ─────────────────────
    # The old split-in-half R̂ (one chain cut into two halves) can look
    # converged even when the chain is stuck — the two halves share the
    # same RNG and can be consistently wrong in the same way. Proper
    # multi-chain split-R̂ (Vehtari et al. 2021) runs ≥2 independent
    # chains from different seeds and compares between- vs. within-chain
    # variance. Plus ESS is computed from integrated autocorrelation
    # time (sum of positive autocorrelations) rather than just lag-1.

    @staticmethod
    def _split_rhat(chains: list) -> float:
        """
        Compute split-R̂ across ≥1 independent chains (Vehtari et al. 2021).

        Each chain is split in half (Vehtari's "split-chain" convention);
        those 2*m half-chains are then compared via the standard B/W/σ̂²
        formula. Needs ≥2 independent chains for the result to be
        informative — with a single chain we fall back to the old
        split-in-half behaviour but the caller should flag the result.

        chains: list of 1D np.ndarrays, one per chain, each of length n.
        returns: float R̂ (1.0 = perfect mixing, >1.05 = not converged).
        """
        if not chains:
            return float("nan")
        # Truncate to equal length
        n_min = min(len(c) for c in chains)
        if n_min < 4:
            return float("nan")
        # Split each chain in half → 2m half-chains of length n_min//2
        half = n_min // 2
        split = []
        for c in chains:
            arr = np.asarray(c)[:n_min]
            split.append(arr[:half])
            split.append(arr[half:2 * half])
        split = np.array(split)  # shape (2m, half)
        m, n = split.shape
        chain_means = split.mean(axis=1)
        chain_vars = split.var(axis=1, ddof=1)
        # Between-chain variance B
        B = n * chain_means.var(ddof=1) if m > 1 else 0.0
        # Within-chain variance W
        W = chain_vars.mean()
        if W <= 0:
            return 1.0
        # Variance estimate
        var_hat = ((n - 1) / n) * W + B / n
        return float(np.sqrt(var_hat / W))

    @staticmethod
    def _effective_sample_size(chain: np.ndarray, max_lag: int = 200) -> int:
        """
        ESS via integrated autocorrelation time (Geyer's initial positive
        sequence). Sums autocorrelations up to the first non-positive one,
        which is the standard way to avoid summing noise in the tail.
        """
        x = np.asarray(chain, dtype=float)
        n = len(x)
        if n < 4:
            return n
        x = x - x.mean()
        var = np.dot(x, x) / n
        if var <= 0:
            return n
        max_lag = min(max_lag, n - 1)
        tau = 1.0
        for lag in range(1, max_lag + 1):
            rho = np.dot(x[:-lag], x[lag:]) / (n * var)
            if rho <= 0:
                break
            tau += 2.0 * rho
        return int(max(1, n / max(tau, 1.0)))

    def run_multichain(self, db: TrendDatabase,
                        n_chains: int = 3,
                        iterations: Optional[int] = None,
                        seeds: Optional[list] = None) -> dict:
        """
        A5: Run ``n_chains`` independent simulations from different seeds
        and compute proper multi-chain split-R̂ + integrated-autocorrelation
        ESS across them. Returns the last chain's full result enriched with
        a ``convergence`` dict whose R̂/ESS are computed across chains and
        a ``chain_summaries`` list for audit.
        """
        if n_chains < 1:
            raise ValueError("n_chains must be >= 1")
        if seeds is None:
            # Deterministic, distinct seed sequence derived from self.seed
            seeds = [int(self.seed) + i * 1000003 for i in range(n_chains)]
        if len(seeds) != n_chains:
            raise ValueError("len(seeds) must equal n_chains")

        chain_results = []
        per_chain_samples = []  # list of (n_iter, n_cats, n_years) arrays
        for i, s in enumerate(seeds):
            engine = BayesianMonteCarloEngine(self.config, seed=s)
            r = engine.run(db, iterations=iterations)
            chain_results.append(r)
            per_chain_samples.append(r["raw_samples"])

        # Stack and compute proper multi-chain convergence on the
        # final-year category samples (the quantity users actually read).
        last_idx = per_chain_samples[0].shape[2] - 1
        convergence = {}
        for c_idx, cat in enumerate(self.config.category_names):
            cat_chains = [s[:, c_idx, last_idx] for s in per_chain_samples]
            r_hat = self._split_rhat(cat_chains)
            ess_total = sum(self._effective_sample_size(c) for c in cat_chains)
            convergence[cat] = {
                "r_hat": float(r_hat),
                "ess": int(ess_total),
                "converged": bool(np.isfinite(r_hat) and r_hat < 1.05),
                "n_chains": n_chains,
                "method": "multi_chain_split_rhat",
            }

        # Use the last chain's full result as the canonical output but
        # replace its convergence block with the cross-chain one.
        result = dict(chain_results[-1])
        result["convergence"] = convergence
        result["n_chains"] = n_chains
        result["chain_seeds"] = [int(s) for s in seeds]
        result["chain_summaries"] = [
            {"seed": int(seeds[i]),
             "median_2030": float(np.median(per_chain_samples[i][:, :, last_idx].sum(axis=1)))}
            for i in range(n_chains)
        ]

        # ── Seed stability (D3 / audit F-13) ────────────────────────────
        # R̂ on i.i.d. Monte-Carlo draws is ≈1.0 by construction and reads
        # as theater to a quant. The honest, defensible quantity is how
        # much the headline moves across independently-seeded chains —
        # report that spread directly so the UI can show "seed stability"
        # instead of an MCMC badge.
        cw = getattr(self.config, "category_weights", None) or {}
        w = np.array([float(cw.get(c, 0.0)) for c in self.config.category_names])
        w = (w / w.sum()) if w.sum() > 0 else np.full(len(self.config.category_names), 1.0 / len(self.config.category_names))
        chain_headlines = []
        max_cat_spread = 0.0
        per_cat_medians = np.array([
            [float(np.median(s[:, c_idx, last_idx])) for c_idx in range(s.shape[1])]
            for s in per_chain_samples
        ])  # (n_chains, n_cats)
        chain_headlines = per_cat_medians @ w  # (n_chains,)
        max_cat_spread = float((per_cat_medians.max(axis=0) - per_cat_medians.min(axis=0)).max())
        result["seed_stability"] = {
            "n_chains": int(n_chains),
            "chain_seeds": [int(s) for s in seeds],
            "headline_median_spread": float(chain_headlines.max() - chain_headlines.min()),
            "max_category_median_spread": max_cat_spread,
        }
        return result

    # ── F3: Attenuation sensitivity band ────────────────────────────
    # The attenuation factor is the single largest lever in the model
    # (it dampens every force contribution before compounding). Rather
    # than quote a single headline, we re-run the engine at ±30 % of
    # the configured attenuation and attach the band to the result
    # so the dashboard + exports can show the headline as a range.
    def attenuation_sensitivity_band(
        self,
        db: TrendDatabase,
        base_result: dict,
        pct: float = 0.30,
        iterations: Optional[int] = None,
    ) -> dict:
        """
        Re-run the simulation at attenuation × (1 ± pct) and return a
        band dict keyed by category with ``low`` / ``base`` / ``high``
        median-2030 shifts plus a portfolio-level headline band.

        Labels are in **attenuation-space**: ``low`` = attenuation × (1 - pct),
        ``high`` = attenuation × (1 + pct). Because the compounding formula
        is Π(1 + score × attenuation), a *higher* attenuation amplifies
        whatever directional signal the trends carry — so ``high`` will
        typically produce the larger |headline shift|. The UI should label
        this as "attenuation flex band", not "best/worst case".

        Inner runs are capped (default 2000 iters or config iters,
        whichever is smaller) to keep the sensitivity step cheap.
        """
        if not (0.0 < pct < 1.0):
            raise ValueError("pct must be in (0, 1)")
        inner_iters = iterations if iterations is not None else min(self.config.iterations, 2000)

        # v3.2: there is no scalar base attenuation. Flex each calibrated
        # per-force value uniformly by ±pct, clipped to [0, 1].
        base_per_force = dict(self.config.per_force_attenuation)
        base_mean = float(np.mean(list(base_per_force.values())))

        def _scale(d: dict, factor: float) -> dict:
            return {f: float(np.clip(v * factor, 0.0, 1.0)) for f, v in d.items()}

        per_force_low = _scale(base_per_force, 1.0 - pct)
        per_force_high = _scale(base_per_force, 1.0 + pct)

        def _run_with_pfa(pfa: dict) -> dict:
            cfg = self.config.copy_with(
                per_force_attenuation=pfa,
                attenuation_source="admin_override",
            )
            return BayesianMonteCarloEngine(cfg, seed=self.seed).run(db, iterations=inner_iters)

        low_res = _run_with_pfa(per_force_low)
        high_res = _run_with_pfa(per_force_high)

        last_year = self.config.path_years[-1]

        def _headline(res: dict) -> float:
            sm = res.get("shift_matrix", {})
            meds = []
            for _, cat_data in sm.items():
                path = cat_data.get("path", {})
                y = path.get(last_year, {})
                if isinstance(y, dict):
                    meds.append(y.get("median", 0.0))
            return float(np.mean(meds)) if meds else 0.0

        base_headline = _headline(base_result)
        low_headline = _headline(low_res)
        high_headline = _headline(high_res)

        per_cat = {}
        for cat in self.config.category_names:
            def _m(res):
                y = res.get("shift_matrix", {}).get(cat, {}).get("path", {}).get(last_year, {})
                return float(y.get("median", 0.0)) if isinstance(y, dict) else 0.0
            per_cat[cat] = {
                "low": _m(low_res),
                "base": _m(base_result),
                "high": _m(high_res),
            }

        return {
            "pct": pct,
            "attenuation_base_mean": base_mean,
            "per_force_attenuation_base": base_per_force,
            "per_force_attenuation_low": per_force_low,
            "per_force_attenuation_high": per_force_high,
            "headline": {
                "base": base_headline,
                "low": low_headline,
                "high": high_headline,
                "range": abs(low_headline - high_headline),
            },
            "by_category": per_cat,
            "inner_iterations": inner_iters,
            "note": (
                "Band shows headline shift when each calibrated per-force "
                f"attenuation is uniformly flexed by ±{int(pct*100)}% "
                "(clipped to [0, 1]). 'low' = pfa × (1-pct), "
                "'high' = pfa × (1+pct)."
            ),
        }
