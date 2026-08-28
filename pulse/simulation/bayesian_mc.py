"""Bayesian Monte Carlo engine with copula-based dependency structure.

Replaces simplistic triangular distributions with:
- Beta-distributed priors per trend (T7, June 2026 honesty note: the Beta
  shape is set deterministically from the analyst's 1–5 probability score —
  these are STRUCTURED-JUDGMENT priors that quantify magnitude uncertainty;
  there is no Bayesian prior→data→posterior update anywhere in the engine,
  so do not describe this as "learning from data")
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
                           DEFAULT_WITHIN_FORCE_RHO,
                           DEFAULT_RESIDUAL_CROSS_RHO,
                           build_trend_correlation_matrix,
                           FORCE_MATERIALIZATION_OVERRIDES,
                           compute_materialization_schedule,
                           DEFAULT_FORCE_OVERLAP_MATRIX,
                           DEFAULT_WITHIN_FORCE_OVERLAP,
                           vc_epicentre_step_of)
from pulse.ingestion.models import TrendDatabase, Trend

logger = logging.getLogger(__name__)


class BayesianMonteCarloEngine:
    """
    Bayesian Monte Carlo with copula dependencies.

    Key differences from v1.2:
    - Beta priors instead of triangular (shape from the analyst 1–5 score;
      structured judgment, NOT learned/updated from data — see module docstring)
    - Copula-based cross-trend dependency instead of flat ρ (a Gaussian
      copula over force_correlation_matrix — L14 honesty note: a Gaussian
      copula has NO tail dependence; do not claim otherwise)
    - Multiplicative compounding across forces
    - Continuous annual paths instead of 2 discrete points
    """

    # Model semver + engine identity. Bumped whenever the result contract changes.
    # 2.10.0 — July 2026 mathematical review remediation (owner-directed,
    #         2026-07-13; review PRISM_Model_Review_2026-07-11). Numbers move —
    #         golden pins regenerated in the same commit, 50k re-run required.
    #         F1: the shift math is now REGIONAL — a 3D (category × region ×
    #         year) tensor. Each trend's contribution to a (category, region)
    #         cell is weighted by BOTH category_exposure/5 AND
    #         regional_exposure/5, so a regionally-concentrated trend now hits
    #         only its regions' slice of the pool (previously every trend was
    #         treated as global). Category/portfolio numbers are the region-
    #         GP1-weighted roll-up (config.region_weights); a globally-present
    #         trend reproduces the old 2D number exactly, so only regional
    #         concentration moves the numbers. New `regional_shift_matrix` in
    #         the result; the Region lens is now shift-based, not attribution-
    #         only. F2: within-force overlap dampening uses the magnitude-
    #         weighted effective number n_eff = (Σm)²/Σm² (participation ratio)
    #         instead of a raw count — restores monotonicity (adding a tiny
    #         trend no longer worsens the outlook). F4: per-iteration peak-year
    #         jitter (±1yr triangular) gives velocity/timing bands real content.
    #         F7: the 3 chains are POOLED for the published percentiles (√3
    #         noise cut); the vacuous i.i.d. R̂/ESS block is replaced by a
    #         per-quantile Monte-Carlo standard error (mc_standard_error).
    #         F9: force_attribution.direct_effects deleted (dormant, unstable
    #         near cancellation). F10: totals.grand deleted (raw sum of medians,
    #         unused, 12× the headline). F11: start_year now gates materialization
    #         onset; probability_posterior renamed probability_prior.
    # 2.9.0 — July 2026 VC-epicentre attribution (owner-directed, 2026-07-10):
    #         the value-chain lens is now a categorical EPICENTRE PARTITION,
    #         structurally parallel to the force lens. Experts score the VC as
    #         one epicentre stage per trend (July 2026 Trends-editor redesign);
    #         the old share math smeared each trend across steps through the
    #         editor's 5/3/1 serialization kernel × vc_weights — a UI constant
    #         laundered into pseudo-measured attribution. Now each trend's
    #         contribution (|normalized_score| × cat_exposure/5) is assigned
    #         wholly to vc_epicentre_step_of(vc_exposure); vc_weights is
    #         deleted end-to-end (inert at equal defaults, meaningless over
    #         categorical votes); unscored trends and uniform-fallback
    #         categories emit integrity events instead of failing silently;
    #         results carry vc_attribution_basis="epicentre". Shift-matrix
    #         numbers are UNTOUCHED (VC never fed the shift math) — golden
    #         shift/portfolio pins unchanged; decompositions.vc /
    #         vc_decomposition values move.
    # 2.8.1 — July 2026 handover review (owner-approved batch, 2026-07-06):
    #         C2 deterministic trend load order (ORDER BY id — reproducibility
    #         was silently order-dependent); M1 missing gp1_pct_affected now
    #         hard-fails instead of silently becoming 10%; L3 copula uniforms
    #         clipped at float-safety (1e-12) instead of 0.001 (the old clip
    #         biased std/mean inward); L4 compounding factors floored at 0
    #         (−100% shift) with an integrity event counting affected
    #         iterations; seed_stability re-added to the multichain result
    #         (owner re-ruling of T18); master seed persisted alongside chain
    #         seeds. Golden pins regenerated in the same commit.
    # 2.8.0 — v3.7 June 2026 (second ruling round, D12–D21): Gaussian copula
    #         replaces the inert t-copula (D20); scipy-only exact numerics with
    #         numerics_backend in the result contract (D13); analytics suite
    #         deleted (D14 + Sobol rider); input-drift integrity event (D19);
    #         full config-layer validation (D21).
    # 2.7.0 — v3.6 June 2026: PSD-valid default correlations (D1); allocation
    #         removed from result contract (D4).
    MODEL_VERSION = "2.10.0"
    ENGINE_NAME = "bayesian_copula"

    def __init__(self, config: ModelConfig, seed: int = 42):
        self.config = config
        self.seed = seed
        self.rng = np.random.default_rng(seed=seed)
        # Integrity events: anything the engine had to repair or coerce at runtime
        # is appended here and surfaced in the result dict for the Integrity drawer.
        self._integrity_events: list[dict] = []
        # L4 floor guard counter — cells where a compounding factor hit ≤ 0.
        self._floored_factor_cells: int = 0
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

        2.10.0 (F1): the shift math is REGIONAL. Internally the engine solves
        a 3D tensor over composite (category × region) cells, then rolls the
        regional shifts up to the category level with the region GP1-share
        weights (config.region_weights). The category-level `shift_matrix`
        keeps its shape; a NEW `regional_shift_matrix` carries the full 3D
        detail. A globally-present trend reproduces the pre-2.10 category
        number exactly — only regionally-concentrated trends move it.

        Returns:
            dict with structure:
            {
                "shift_matrix": {category: {"path"/"velocity": ...}},      # region roll-up
                "regional_shift_matrix": {category: {region: {"path": ...}}},  # F1 3D
                "region_weights_used": {region: weight},
                "vc_decomposition": {category: {vc_step: contribution}},
                "vc_attribution_basis": "epicentre",
                "mc_standard_error": {category: {median_se_pp, p10_se_pp, ...}},  # F7
                "raw_samples": np.ndarray,  # (iterations, categories, years) — region roll-up
                "model_version": str, "engine_name": str,
                "seed": int, "integrity_events": list[dict],
            }
        """
        n_iter = iterations or self.config.iterations
        n_cats = len(self.config.category_names)
        n_years = len(self.config.path_years)
        trends = db.trends

        logger.info(f"Running Bayesian MC: {n_iter} iterations, "
                     f"{len(trends)} trends, {n_cats} categories, "
                     f"{len(REGIONS)} regions, {n_years} years")

        # Steps 1–3 → regional (3D) samples + the region-weighted category roll-up.
        category_samples, regional_samples = self._simulate_samples(db, n_iter)

        # Step 4: category-level percentiles + diagnostics (interior unchanged).
        result = self._compile_results(category_samples, db)

        # F1: attach the 3D regional matrix and the weights actually applied.
        result["regional_shift_matrix"] = self._build_regional_matrix(regional_samples)
        rw = self._region_weight_vector()
        result["region_weights_used"] = {r: float(rw[i]) for i, r in enumerate(REGIONS)}

        logger.info(f"MC complete. Median portfolio shift at {self.config.path_years[-1]}: "
                     f"{np.median(category_samples[:, :, -1].mean(axis=1)):.4f}")

        return result

    def _region_weight_vector(self) -> np.ndarray:
        """Normalized region GP1-share weights aligned to REGIONS (F1 roll-up).

        These are each region's share of the pool (config.region_weights,
        default = the documented Henkel Group 2025 split proxy). They roll the
        per-region relative shifts up to the category/portfolio level:
        ``category_shift = Σ_r region_weight_r · regional_shift_r``. Falls back
        to equal weights if unset.
        """
        rw_cfg = getattr(self.config, "region_weights", None) or {}
        w = np.array([float(rw_cfg.get(r, 0.0)) for r in REGIONS])
        if w.sum() <= 0:
            return np.full(len(REGIONS), 1.0 / len(REGIONS))
        return w / w.sum()

    def _simulate_samples(self, db: TrendDatabase, n_iter: int):
        """Steps 1–3: copula draw → 3D (category×region) shift cells → roll-up.

        Returns ``(category_samples, regional_samples)``:
          - regional_samples: (n_iter, n_cats, n_regions, n_years) — the 3D shift
          - category_samples: (n_iter, n_cats, n_years) — region-GP1-weighted
            roll-up of the regional shifts (what the existing category views read)
        """
        n_cats = len(self.config.category_names)
        n_regions = len(REGIONS)
        n_years = len(self.config.path_years)
        trends = db.trends

        corr_matrix = self._build_correlation_matrix(trends)
        raw_samples = self._generate_copula_samples(trends, corr_matrix, n_iter)
        # 3D shift over the n_cats × n_regions composite cells (F1).
        cell_samples = self._compute_all_paths_vectorized(
            trends, raw_samples, n_iter, n_cats, n_regions, n_years
        )
        # Cell index is c * n_regions + r, so the reshape splits cleanly.
        regional_samples = cell_samples.reshape(n_iter, n_cats, n_regions, n_years)
        rw = self._region_weight_vector()
        category_samples = np.tensordot(regional_samples, rw, axes=([2], [0]))
        return category_samples, regional_samples

    def _build_regional_matrix(self, regional_samples: np.ndarray) -> dict:
        """Per-(category, region) percentile paths from the 3D samples (F1).

        Same per-cell shape as `shift_matrix` entries (path percentiles +
        velocity), so the frontend region drill-down can reuse the cell
        renderer. regional_samples: (n_iter, n_cats, n_regions, n_years).
        """
        percentiles = [10, 25, 50, 75, 90]
        cats = self.config.category_names
        years = self.config.path_years
        out: dict = {}
        for c_idx, cat in enumerate(cats):
            out[cat] = {}
            for r_idx, region in enumerate(REGIONS):
                series = regional_samples[:, c_idx, r_idx, :]  # (n_iter, n_years)
                path = {}
                for y_idx, year in enumerate(years):
                    ys = series[:, y_idx]
                    cell = {f"p{p}": float(np.percentile(ys, p)) for p in percentiles}
                    cell["median"] = cell["p50"]
                    cell["mean"] = float(np.mean(ys))
                    cell["std"] = float(np.std(ys))
                    path[int(year)] = cell
                velocity = {}
                for i in range(1, len(years)):
                    deltas = series[:, i] - series[:, i - 1]
                    velocity[int(years[i])] = {
                        "median": float(np.percentile(deltas, 50)),
                        "p10": float(np.percentile(deltas, 10)),
                        "p90": float(np.percentile(deltas, 90)),
                    }
                out[cat][region] = {"path": path, "velocity": velocity}
        return out

    def _build_correlation_matrix(self, trends: list) -> np.ndarray:
        """
        Build correlation matrix from force correlation matrix.

        Within-force: Gaussian copula with ρ from config
        Cross-force: ρ from force_correlation_matrix or residual macro correlation
        """
        n = len(trends)
        if n == 0:
            return np.eye(0)

        # T16 (June 2026): single source of truth for the raw matrix — shared
        # with the config validator's spectral gate so they cannot drift.
        R = build_trend_correlation_matrix(
            [t.force for t in trends],
            self.config.within_force_rho,
            getattr(self.config, 'force_correlation_matrix', {}),
        )

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

        # L2 (July 2026 review): the redundant SILENT PSD repair that used to
        # sit here was removed. _build_correlation_matrix() has already
        # repaired R (with an integrity event) before this method is called;
        # any residual numerical failure is caught by the audited
        # eigenvalue-clip fallback around the Cholesky below. One repair path
        # per failure mode, each one visible in the integrity log.

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
        # L3 (July 2026 review): clip at float-safety only. The old
        # [0.001, 0.999] clip truncated every marginal beyond the copula's
        # ±3.09σ, biasing std/mean inward on all 99 trends. beta_ppf is
        # well-defined on the open interval; 1e-12 only guards the exact
        # 0.0/1.0 values norm_cdf can emit for |z| ≳ 8σ.
        U = np.clip(U, 1e-12, 1.0 - 1e-12)

        # Transform uniforms to Beta-distributed probability samples
        samples = np.zeros((n_iter, n_trends))
        for j, trend in enumerate(trends):
            # Probability of materialization: Beta(α, β) → [0, 1]
            # The sole stochastic driver — "how likely does this trend fully play out?"
            a_p, b_p = trend.probability_prior
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

    def _compute_all_paths_vectorized(self, trends: list, raw_samples: np.ndarray,
                                       n_iter: int, n_cats: int, n_regions: int,
                                       n_years: int) -> np.ndarray:
        """
        Vectorized shift computation over the n_cats × n_regions composite cells
        (F1, 2.10.0). Each composite cell (category c, region r) has index
        ``c * n_regions + r`` and combined exposure ``(cat_exp/5) × (region_exp/5)``
        — so a trend hits a cell to the extent it is exposed to that category
        AND present in that region. The existing force-compounding machinery
        runs unchanged on the cells; the caller reshapes/rolls up.

        Also carries F2 (magnitude-weighted n_eff dampening), F4 (per-iteration
        peak-year jitter) and F11 (start_year materialization onset).

        Returns: (n_iter, n_cells, n_years) with n_cells = n_cats × n_regions.
        """
        categories = self.config.category_names
        n_trends = len(trends)
        n_cells = n_cats * n_regions

        if n_trends == 0:
            return np.zeros((n_iter, n_cells, n_years))

        force_list = list(FORCES)
        n_forces = len(force_list)
        force_idx_map = {f: i for i, f in enumerate(force_list)}
        trend_force_idx = np.array([force_idx_map.get(t.force, 0) for t in trends])
        fw = np.array([self.config.force_weights.get(f, 1.0 / n_forces) for f in force_list])

        # --- F1: per-trend regional weight (region_exposure/5), global fallback ---
        region_weight = np.zeros((n_trends, n_regions))
        regionless: list = []
        for j, trend in enumerate(trends):
            reg_map = getattr(trend, 'regional_exposure', None) or {}
            vals = np.array([min(float(reg_map.get(r, 0.0)), 5.0) / 5.0 for r in REGIONS])
            if vals.sum() <= 0:
                # A trend with no regional exposure is treated as globally
                # present (equal across regions) so it is not silently dropped;
                # the integrity event below makes that assumption visible.
                vals = np.ones(n_regions)
                regionless.append(trend.id)
            region_weight[j, :] = vals

        # --- F1: composite cell exposure (n_trends, n_cells) ---
        # cell (c, r) at column c*n_regions + r; exposure = (cat/5)·(region/5).
        exposure_matrix = np.zeros((n_trends, n_cells))
        for j, trend in enumerate(trends):
            for c_idx, cat in enumerate(categories):
                exp = trend.category_exposure.get(cat, 0)
                ce = min(exp, 5) / 5.0 if exp > 0 else 0.0
                if ce <= 0:
                    continue
                base = c_idx * n_regions
                for r_idx in range(n_regions):
                    exposure_matrix[j, base + r_idx] = ce * region_weight[j, r_idx]

        if regionless:
            self._integrity_events.append({
                "type": "regional_exposure_coverage",
                "severity": "warning",
                "message": (
                    f"{len(regionless)} trend(s) carry no regional exposure and "
                    f"were treated as globally present (equal across regions) in "
                    f"the 3D shift math — score their regions in the Trends "
                    f"editor: " + ", ".join(regionless[:10])
                    + ("…" if len(regionless) > 10 else "")
                ),
                "detail": {"count": len(regionless), "trend_ids": regionless[:50]},
            })

        # --- F4/F11: per-trend materialization schedules with peak-year jitter ---
        # sched_table[j, k, y] = materialization of trend j at year y when its
        # peak_year is shifted by offsets[k]; start_year gates the onset (F11).
        jitter = int(getattr(self.config, "peak_year_jitter", 0) or 0)
        offsets = list(range(-jitter, jitter + 1)) if jitter > 0 else [0]
        n_off = len(offsets)
        if n_off == 1:
            off_probs = np.array([1.0])
        else:
            # Symmetric triangular weights: ∝ (jitter + 1 − |offset|).
            raw_w = np.array([jitter + 1 - abs(o) for o in offsets], dtype=float)
            off_probs = raw_w / raw_w.sum()

        path_years = self.config.path_years
        sched_table = np.ones((n_trends, n_off, n_years))
        for j, trend in enumerate(trends):
            base_pk = getattr(trend, 'peak_year', 0) or 0
            dc = getattr(trend, 'diffusion_curve', '') or ''
            sy = getattr(trend, 'start_year', None)
            onset = self.config.base_year if sy is None else max(int(self.config.base_year), int(sy))
            for k, off in enumerate(offsets):
                if base_pk > 0 and dc:
                    sched = compute_materialization_schedule(
                        base_pk + off, dc, path_years, self.config.base_year,
                        start_year=sy,
                    )
                else:
                    # Legacy fallback (force/default global schedule), still
                    # gated by start_year so F11 holds for these trends too.
                    force_mat = FORCE_MATERIALIZATION_OVERRIDES.get(trend.force, {})
                    sched = {
                        yr: (force_mat.get(yr, self.config.materialization.get(yr, 1.0))
                             if yr > onset else 0.0)
                        for yr in path_years
                    }
                for y_idx, yr in enumerate(path_years):
                    sched_table[j, k, y_idx] = sched.get(yr, 1.0)

        # Draw a peak-year offset per (iteration, trend) — reproducible under seed.
        if n_off > 1:
            offset_idx = self.rng.choice(n_off, size=(n_iter, n_trends), p=off_probs)
        else:
            offset_idx = np.zeros((n_iter, n_trends), dtype=np.intp)
        trend_arange = np.arange(n_trends)

        # --- Per-force effective attenuation (n_forces,) ---
        eff_att = np.array([self._effective_attenuation[f] for f in force_list])

        # --- F2: magnitude-weighted within-force dampening (per force, per cell) ---
        # Replaces the count-based 1 − ov·(n−1)/n. The effective number is the
        # participation ratio n_eff = (Σ m)² / Σ m² over the force's trends'
        # DETERMINISTIC mean |contribution| m = |normalized_score|·cell_exposure
        # (deterministic → preserves the vectorized shape + reproducibility).
        # n_eff = count for equal contributions, → 1 as one trend dominates, and
        # is essentially unchanged by a negligible trend — so adding a tiny trend
        # no longer re-scales an entire force (audit F2 monotonicity fix).
        wf_overlap = getattr(self.config, 'within_force_overlap', {})
        abs_score = np.array([abs(float(getattr(t, 'normalized_score', 0.0))) for t in trends])
        contrib = abs_score[:, np.newaxis] * exposure_matrix  # (n_trends, n_cells)
        wf_dampen = np.ones((n_forces, n_cells))
        for f_idx, force in enumerate(force_list):
            mask = trend_force_idx == f_idx
            if not mask.any():
                continue
            ov = wf_overlap.get(force, 0.0)
            if ov <= 0:
                continue
            M = contrib[mask, :]                 # (n_force_trends, n_cells)
            s1 = M.sum(axis=0)                    # Σ m
            s2 = (M * M).sum(axis=0)             # Σ m²
            n_eff = np.where(s2 > 0.0, (s1 * s1) / np.where(s2 > 0.0, s2, 1.0), 0.0)
            # Guard the denominator: np.where evaluates BOTH branches, so divide
            # on a floored n_eff to avoid a spurious 0-division warning for cells
            # with no active trend (n_eff = 0 → dampen = 1.0, the True-branch
            # value is discarded). Same pattern as the F-25 count-based guard.
            n_eff_safe = np.maximum(n_eff, 1.0)
            dampen = np.where(n_eff > 1.0, 1.0 - ov * (n_eff - 1.0) / n_eff_safe, 1.0)
            wf_dampen[f_idx, :] = np.clip(dampen, 0.1, 1.0)

        # --- VECTORIZED CORE (over composite cells) ---
        shift_samples = np.zeros((n_iter, n_cells, n_years))
        for y_idx in range(n_years):
            # F4: per-(iteration, trend) materialization for this year via the
            # drawn peak-year offset. Shape (n_iter, n_trends).
            mat_y = sched_table[trend_arange[np.newaxis, :], offset_idx, y_idx]
            effective = raw_samples * mat_y  # (n_iter, n_trends)

            force_contrib = np.zeros((n_iter, n_forces, n_cells))
            for f_idx in range(n_forces):
                mask = trend_force_idx == f_idx
                if not mask.any():
                    continue
                # (n_iter, n_force_trends) @ (n_force_trends, n_cells) → (n_iter, n_cells)
                raw_sum = effective[:, mask] @ exposure_matrix[mask, :]
                force_contrib[:, f_idx, :] = raw_sum * wf_dampen[f_idx, :][np.newaxis, :]

            weighted = force_contrib * fw[:, np.newaxis]
            attenuated = weighted * eff_att[:, np.newaxis]
            # L4: floor each compounding factor at 0 (−100% is the lower bound of
            # a relative pool shift); count the affected cells for the audit log.
            factors = 1.0 + attenuated
            n_floored = int((factors <= 0.0).sum())
            if n_floored > 0:
                self._floored_factor_cells += n_floored
                factors = np.maximum(factors, 0.0)
            product = np.prod(factors, axis=1)  # (n_iter, n_cells)
            shift_samples[:, :, y_idx] = product - 1.0

        if self._floored_factor_cells > 0:
            self._integrity_events.append({
                "type": "compounding_floor",
                "severity": "warning",
                "message": (
                    f"{self._floored_factor_cells} (iteration × force × "
                    f"category×region × year) compounding factors were ≤ 0 (a "
                    f"single force wiping >100% of a cell's pool) and were "
                    f"floored at −100%. If this count is material relative to "
                    f"iterations, review trend magnitudes/attenuation."
                ),
            })

        return shift_samples

    def _compile_results(self, samples: np.ndarray, db: TrendDatabase) -> dict:
        """Compute percentiles, per-quantile Monte-Carlo standard error, and
        the Force / Value-chain / Region attribution lenses.

        ``samples`` is the region-GP1-weighted category roll-up
        (n_iter, n_cats, n_years) — see run()/_simulate_samples (F1).
        """
        n_iter, n_cats, n_years = samples.shape
        percentiles = [10, 25, 50, 75, 90]

        shift_matrix = {}

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

            # (F9, 2.10.0: the force_attribution.direct_effects block was deleted
            #  here — a dormant, numerically-unstable signed attribution scaled to
            #  the MC median that no consumer read and that blew up ±1,000× near
            #  cancellation. The shipped Force lens is decompositions.force below,
            #  computed on |score| shares. F7: the vacuous single-chain split-R̂/
            #  ESS block was also deleted — R̂≈1 on i.i.d. draws by construction;
            #  the honest diagnostic is the per-quantile MC standard error,
            #  computed once after this loop.)

        # F7: per-category Monte-Carlo standard error of the published quantiles.
        mc_standard_error = self._mc_standard_error(samples)

        # ── Value-chain EPICENTRE shares (2.9.0) ────────────────────────
        # Computed ONCE and consumed by BOTH the terminal-year back-compat
        # block below and the per-year decompositions.vc (single source).
        #
        # July 2026 VC redesign: experts score the value chain as ONE
        # epicentre stage per trend (the stored 8-step 0–5 profile is a
        # serialization format — the Trends editor writes a canonical 5/3/1
        # falloff around the picked stage). The former share math
        # (exposure-profile × vc_weights smear) therefore laundered a UI
        # kernel constant into pseudo-measured cross-step attribution. The
        # lens is now a hard categorical partition, exactly parallel to the
        # force lens: each trend's relevance — |normalized_score| ×
        # (category exposure / 5) — is assigned WHOLLY to its epicentre
        # stage (pulse.config.vc_epicentre_step_of, the engine-side twin of
        # the frontend's epicentreOf). Propagation up/downstream the chain
        # is deliberately NOT modelled: under D16 ceteris paribus that is a
        # market/management-response story, not a trend property.
        trends = db.trends
        trend_epicentre = {
            t.id: vc_epicentre_step_of(getattr(t, 'vc_exposure', None) or {})
            for t in trends
        }
        unscored_vc = sorted(tid for tid, s in trend_epicentre.items() if s is None)

        vc_shares: dict = {}
        vc_fallback_cats: list = []
        for cat in self.config.category_names:
            vsum = {s: 0.0 for s in VC_STEPS}
            for trend in trends:
                cat_exp = trend.category_exposure.get(cat, 0)
                step = trend_epicentre.get(trend.id)
                if cat_exp > 0 and step is not None:
                    vsum[step] += abs(trend.normalized_score) * (min(cat_exp, 5) / 5.0)
            vtot = sum(vsum.values())
            if vtot > 0:
                vc_shares[cat] = {s: v / vtot for s, v in vsum.items()}
            else:
                # Degenerate guard ONLY: no contributing trend carries a VC
                # epicentre. Uniform shares keep the lens exhaustive (the
                # Σ-over-steps == MC-median identity that PPA2 anchors row
                # totals on), and the integrity event below makes the
                # fabricated flatness visible instead of silent. Never fires
                # on the seeded 99-trend base — every stored profile
                # resolves to an epicentre.
                vc_shares[cat] = {s: 1.0 / len(VC_STEPS) for s in VC_STEPS}
                vc_fallback_cats.append(cat)

        if unscored_vc:
            self._integrity_events.append({
                "type": "vc_epicentre_coverage",
                "severity": "warning",
                "message": (
                    f"{len(unscored_vc)} trend(s) carry no value-chain "
                    f"epicentre (empty/unscored VC profile) — the VC "
                    f"attribution lens is computed on the scored subset "
                    f"while these trends still drive the shift numbers. "
                    f"Score them in the Trends editor: "
                    + ", ".join(unscored_vc[:10])
                    + ("…" if len(unscored_vc) > 10 else "")
                ),
                "detail": {"count": len(unscored_vc),
                           "unscored_trend_ids": unscored_vc[:50]},
            })
        if vc_fallback_cats:
            self._integrity_events.append({
                "type": "vc_attribution_fallback",
                "severity": "warning",
                "message": (
                    f"{len(vc_fallback_cats)} categor"
                    f"{'y' if len(vc_fallback_cats) == 1 else 'ies'} had no "
                    f"epicentre-scored contributing trend — the VC lens shows "
                    f"a uniform 1/8 spread there (structural fallback, not "
                    f"expert judgment): " + ", ".join(vc_fallback_cats)
                ),
                "detail": {"categories": list(vc_fallback_cats)},
            })

        # ── Value Chain Decomposition (terminal-year, back-compat) ─────
        # The same epicentre shares applied to the terminal-year median;
        # kept because the persisted-run contract and GET /simulation carry
        # this key alongside decompositions.vc (which holds every year).
        vc_decomposition = {}
        last_year = self.config.path_years[-1]
        for cat in self.config.category_names:
            median_shift = shift_matrix[cat]["path"][last_year]["median"]
            vc_decomposition[cat] = {
                step: float(share * median_shift)
                for step, share in vc_shares[cat].items()
            }

        # (O3, owner ruling 2026-07-07: the consumer-journey decomposition —
        #  the quantitative journey lens introduced as v3.6 block 8 — was
        #  removed together with the never-activated `journey_exposure`
        #  score layer it depended on. The qualitative journey overlay
        #  (tiles, Strategist Reads, trend evidence cards) is unaffected.
        #  Removal is contract-symmetric with the June addition, which was
        #  ruled additive with no MODEL_VERSION bump: shift numbers and
        #  golden pins are untouched.)

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

        # Build the force/region share structures ONCE (shares are
        # exposure-weighted and do not depend on year — the year-dependent
        # magnitude enters via mc_median[c][y]). The VC shares were computed
        # above as the epicentre partition (2.9.0) and are reused here —
        # one share computation per lens, engine-wide.
        force_shares: dict = {}
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

            # (VC shares: epicentre partition, computed once above — 2.9.0.)

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
        for year in years:
            yi = int(year)
            for cat in cats:
                for f in FORCES:
                    by_force_totals[yi][f] += force_decomp[yi][cat][f]
                for s in VC_STEPS:
                    by_vc_totals[yi][s] += vc_decomp[yi][cat][s]
                for r in REGIONS:
                    by_region_totals[yi][r] += region_decomp[yi][cat][r]

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
            # (F10, 2.10.0: totals.grand deleted — it was a raw SUM of the 12
            #  category medians, ≈12× the headline, unused, and "sum of medians
            #  ≠ median of sum". The portfolio band below is the real portfolio
            #  quantity, computed per-iteration.)
            # Joint portfolio percentiles (category-weighted mean per
            # iteration). The headline band reads THIS, not an average of
            # per-category bands.
            "portfolio":      portfolio_path,
        }

        return {
            "shift_matrix": shift_matrix,
            # F7: per-quantile Monte-Carlo standard error replaces the vacuous
            # i.i.d. split-R̂/ESS "convergence" block (R̂≈1 by construction).
            "mc_standard_error": mc_standard_error,
            "vc_decomposition": vc_decomposition,
            "decompositions": decompositions,
            "totals": totals,
            "raw_samples": samples,
            "iterations": n_iter,
            "model_type": "bayesian_copula",
            "model_version": self.MODEL_VERSION,
            "engine_name": self.ENGINE_NAME,
            "numerics_backend": NUMERICS_BACKEND,
            # 2.9.0: how the VC lens was computed. "epicentre" = categorical
            # partition by vc_epicentre_step_of; pre-2.9 runs carry no tag
            # (the dashboard labels those "profile-weighted, pre-2.9").
            "vc_attribution_basis": "epicentre",
            "seed": self.seed,
            "integrity_events": list(self._integrity_events),
        }

    def _mc_standard_error(self, samples: np.ndarray, n_boot: int = 200) -> dict:
        """F7: per-quantile Monte-Carlo standard error at the terminal year.

        Honest replacement for the i.i.d.-vacuous split-R̂/ESS: this is the
        sampling noise of THIS run's published percentiles at the configured
        iteration count (bootstrap; ≈0.001 pp at 50k, two orders below the
        0.1 pp display precision — and √3 smaller once the 3 chains are pooled).
        It measures MC noise only, never model error. Reproducible sub-RNG so
        the reported SE is itself deterministic.
        """
        n_iter, n_cats, n_years = samples.shape
        last = n_years - 1
        terminal_year = int(self.config.path_years[-1])
        rng = np.random.default_rng(20260713)
        out: dict = {}
        for c_idx, cat in enumerate(self.config.category_names):
            col = samples[:, c_idx, last]
            meds = np.empty(n_boot); p10s = np.empty(n_boot); p90s = np.empty(n_boot)
            for b in range(n_boot):
                r = col[rng.integers(0, n_iter, n_iter)]
                meds[b] = np.percentile(r, 50)
                p10s[b] = np.percentile(r, 10)
                p90s[b] = np.percentile(r, 90)
            out[cat] = {
                "median_se_pp": float(np.std(meds) * 100.0),
                "p10_se_pp": float(np.std(p10s) * 100.0),
                "p90_se_pp": float(np.std(p90s) * 100.0),
                "terminal_year": terminal_year,
                "n": int(n_iter),
                "method": "bootstrap_terminal_year",
            }
        return out

    def run_multichain(self, db: TrendDatabase,
                        n_chains: int = 3,
                        iterations: Optional[int] = None,
                        seeds: Optional[list] = None) -> dict:
        """
        Run ``n_chains`` independent simulations from different seeds and
        POOL them for the published percentiles (F7, 2.10.0).

        F7: the old code ran 3 chains but published only the last chain's
        percentiles and threw the other 2/3 of the samples away, keeping a
        vacuous split-R̂/ESS block (R̂≈1 on i.i.d. draws by construction). Now
        the chains are concatenated and the published shift_matrix / totals /
        regional matrix / decompositions / MC standard error are all computed
        on the POOLED sample (√3 noise reduction for free). Seed stability
        keeps its per-chain terminal-year portfolio medians unchanged.
        """
        if n_chains < 1:
            raise ValueError("n_chains must be >= 1")
        if seeds is None:
            # Deterministic, distinct seed sequence derived from self.seed
            seeds = [int(self.seed) + i * 1000003 for i in range(n_chains)]
        if len(seeds) != n_chains:
            raise ValueError("len(seeds) must equal n_chains")

        # This method compiles the pooled result on SELF, which appends VC
        # integrity events to self._integrity_events. Reset the parent's
        # accumulators so a reused engine instance (e.g. .run() then
        # .run_multichain()) cannot double-count events.
        self._integrity_events = []
        self._floored_factor_cells = 0

        per_chain_cat = []   # list of (n_iter, n_cats, n_years)
        per_chain_reg = []   # list of (n_iter, n_cats, n_regions, n_years)
        chain_engines = []
        for s in seeds:
            engine = BayesianMonteCarloEngine(self.config, seed=s)
            cat_s, reg_s = engine._simulate_samples(db, iterations or self.config.iterations)
            per_chain_cat.append(cat_s)
            per_chain_reg.append(reg_s)
            chain_engines.append(engine)

        last_idx = per_chain_cat[0].shape[2] - 1
        terminal_year = int(self.config.path_years[-1])

        # Per-chain PORTFOLIO median at the terminal year (seed stability) —
        # the SAME category-weighted quantity the headline reads, computed per
        # chain BEFORE pooling so the spread reflects independent seeds.
        cw = getattr(self.config, "category_weights", None) or {}
        w = np.array([float(cw.get(c, 0.0)) for c in self.config.category_names])
        w = (w / w.sum()) if w.sum() > 0 else np.full(
            len(self.config.category_names), 1.0 / len(self.config.category_names))
        per_chain_portfolio_medians = [
            float(np.median(per_chain_cat[i][:, :, last_idx] @ w)) for i in range(n_chains)
        ]

        # F7: POOL the chains, then compile the published views once on the
        # full sample (this is what cuts the MC noise by √n_chains).
        pooled_cat = np.concatenate(per_chain_cat, axis=0)
        pooled_reg = np.concatenate(per_chain_reg, axis=0)
        result = self._compile_results(pooled_cat, db)   # self.integrity = [vc coverage]
        result["regional_shift_matrix"] = self._build_regional_matrix(pooled_reg)
        rw = self._region_weight_vector()
        result["region_weights_used"] = {r: float(rw[i]) for i, r in enumerate(REGIONS)}

        # Integrity events: the vc-coverage events come from self._compile_results
        # above; the data-driven correlation/cholesky/regional/floor events are
        # identical every chain — take chain 0's as representative and prepend.
        result["integrity_events"] = (
            list(chain_engines[0]._integrity_events) + list(result.get("integrity_events", []))
        )

        result["n_chains"] = n_chains
        # L8: the MASTER seed reproduces the run; chain seeds are derived.
        result["seed"] = int(self.seed)
        result["master_seed"] = int(self.seed)
        result["chain_seeds"] = [int(s) for s in seeds]
        result["chain_summaries"] = [
            {"seed": int(seeds[i]), "terminal_year": terminal_year,
             "median_terminal": per_chain_portfolio_medians[i]}
            for i in range(n_chains)
        ]

        # Seed stability (M2): spread of the terminal-year portfolio median
        # across independently-seeded chains. MC sampling noise only — cannot
        # detect model error; ≈0 pp expected at 50k × 3.
        spread_pp = (max(per_chain_portfolio_medians) -
                     min(per_chain_portfolio_medians)) * 100.0
        result["seed_stability"] = {
            "metric": "terminal_year_portfolio_median",
            "terminal_year": terminal_year,
            "per_chain_medians": per_chain_portfolio_medians,
            "spread_pp": float(spread_pp),
            "n_chains": n_chains,
            "iterations_per_chain": int(per_chain_cat[0].shape[0]),
            "pooled_iterations": int(pooled_cat.shape[0]),
        }
        return result

