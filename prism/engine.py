"""Monte Carlo engine: Beta priors, a Gaussian copula and regional compounding.

Each iteration draws every driver's materialisation probability from its Beta
prior, correlated across drivers through a Gaussian copula, and turns it into
a signed score (probability x GP1 share x direction). The scores are spread
over the 52 composite cells (13 categories x 4 regions) by category and
regional exposure, materialised year by year along each driver's schedule,
summed per force with the within-force overlap correction, weighted,
attenuated, and compounded multiplicatively across forces. The cell shifts
roll up to categories and to the portfolio with the gross-profit cell weights.

The Beta priors are structured judgment set from the 1-5 scores; nothing in
the engine updates them from data. A Gaussian copula has no tail dependence.

Every percentile uses ``np.percentile`` with linear interpolation.

scipy is a hard requirement: the engine computes with exact numerics or not
at all. The read-only API runtime does not install scipy and never imports
this module.
"""

import logging
from typing import Optional

import numpy as np
import scipy as _scipy
from scipy.linalg import cholesky
from scipy.stats import beta as _beta_dist, norm as _norm_dist

from prism.config import (CATEGORIES, FORCES, REGIONS, VC_STEPS, ModelConfig, build_driver_correlation_matrix,
                          compute_materialization_schedule, peak_jitter_for)
from prism.drivers import DriverSet, InvalidDriversError, simulation_problems

beta_ppf = _beta_dist.ppf
norm_cdf = _norm_dist.cdf

#: The exact numerics behind a result, recorded with every run for the audit trail.
NUMERICS_BACKEND = f"scipy {_scipy.__version__} · numpy {np.__version__}"

logger = logging.getLogger(__name__)


def distribution(values: np.ndarray) -> dict:
    """P10, P25, median, P75, P90, mean and standard deviation of a sample."""
    return {
        "p10": float(np.percentile(values, 10)),
        "p25": float(np.percentile(values, 25)),
        "median": float(np.percentile(values, 50)),
        "p75": float(np.percentile(values, 75)),
        "p90": float(np.percentile(values, 90)),
        "mean": float(np.mean(values)),
        "std": float(np.std(values)),
    }


#: Seed of the bootstrap behind mc_standard_error, fixed so the reported
#: standard errors of a run are reproducible (any fixed value would do;
#: changing it moves the reported errors, not the shifts).
MC_SE_BOOTSTRAP_SEED = 20260713


def region_presence(driver) -> np.ndarray:
    """A driver's weight in each region (REGIONS order): regional exposure / 5."""
    return np.array([driver.regional_exposure[r] / 5.0 for r in REGIONS])


def exposure_matrix(drivers: list) -> np.ndarray:
    """How strongly each driver reaches each composite cell, (drivers, cells).

    Cell (c, r) has index ``c * len(REGIONS) + r``; a driver reaches it with
    (category exposure / 5) x (regional exposure / 5). A driver with no
    exposure in a category or a region reaches none of its cells.
    """
    n = len(drivers)
    category = np.array([[d.category_exposure[c] / 5.0 for c in CATEGORIES] for d in drivers]).reshape(n, -1)
    region = np.array([region_presence(d) for d in drivers]).reshape(n, len(REGIONS))
    return (category[:, :, np.newaxis] * region[:, np.newaxis, :]).reshape(n, len(CATEGORIES) * len(REGIONS))


def floor_event(count: int) -> dict:
    """The integrity event for compounding factors floored at -100 percent."""
    return {
        "type": "compounding_floor",
        "severity": "warning",
        "message": (
            f"{count} compounding factors (iteration x force x cell x year) were at or below zero, "
            f"a single force removing more than a cell's whole pool, and were floored at -100%. If "
            f"the count is material relative to the iterations, review the driver magnitudes and "
            f"attenuation."
        ),
        "detail": {"count": int(count)},
    }


class MonteCarloEngine:
    """Simulates the relative shift of every category and cell over the horizon.

    ``run`` and ``run_multichain`` produce a result. The other public members
    (the attenuation by force, the cell-weight matrices, the correlation
    matrix, the copula sampler, the peak-year schedule and draws and the
    within-force dampening), like the module's exposure_matrix, are the
    engine's own arithmetic, which prism/attribution.py reuses so that its
    decomposition of a result is exact; the underscored ones are internal.
    """

    #: Version of the model. A change to any number it produces means a new
    #: version, regenerated golden pins in the same commit, and a new production
    #: run. A result key the dashboard needs is listed in prism/api/runs.py,
    #: which refuses to serve a run without it.
    MODEL_VERSION = "2.12.0"
    ENGINE_NAME = "beta_copula"

    def __init__(self, config: ModelConfig, seed: int = 42):
        self.config = config
        self.seed = seed
        self.rng = np.random.default_rng(seed=seed)
        # Anything the engine had to repair, assume or clip at runtime; returned
        # with the result and shown next to the run.
        self._integrity_events: list[dict] = []
        self._floored_factor_cells: int = 0
        self.attenuation = self._attenuation_by_force()

    def _attenuation_by_force(self) -> dict:
        """Per-force attenuation from the configuration; all six forces required."""
        per_force = dict(self.config.per_force_attenuation)
        missing = [f for f in FORCES if f not in per_force]
        if missing:
            raise KeyError(f"per_force_attenuation missing forces: {missing}. All six forces required: {FORCES}")
        logger.debug("Per-force attenuation (source=%s): %s", self.config.attenuation_source,
                    ", ".join(f"{f}={per_force[f]:.3f}" for f in FORCES))
        return per_force

    def run(self, db: DriverSet, iterations: Optional[int] = None) -> dict:
        """Run one chain and compile the result.

        The result carries ``shift_matrix`` (per category: percentile ``path``
        by year and per-iteration ``velocity`` bands), ``regional_shift_matrix``
        (the same per category x region), ``decompositions`` and ``totals`` (the
        force, value-chain and region attribution lenses and the joint portfolio
        band), ``mc_standard_error``, the weights actually applied
        (``cell_weights_used``, ``category_weights_used``,
        ``region_weights_used``, ``cell_weights_source``), ``integrity_events``,
        ``raw_samples`` (iterations x categories x years) and the engine
        identity (``model_version``, ``engine_name``, ``numerics_backend``,
        ``seed``, ``iterations``).
        """
        n_iter = iterations or self.config.iterations
        logger.info("Running Monte Carlo: %d iterations, %d drivers, %d categories, %d regions, %d years",
                    n_iter, len(db.drivers), len(CATEGORIES), len(REGIONS),
                    len(self.config.path_years))

        category_samples, regional_samples = self._simulate_samples(db, n_iter)
        if self._floored_factor_cells:
            self._integrity_events.append(floor_event(self._floored_factor_cells))
        result = self._compile_results(category_samples, db)
        result["regional_shift_matrix"] = self._build_regional_matrix(regional_samples)
        result.update(self._weights_used())

        terminal = int(self.config.path_years[-1])
        logger.info("Median portfolio shift at %d: %.4f", terminal, result["totals"]["portfolio"][terminal]["median"])
        return result

    # ── Cell weights ────────────────────────────────────────────────────────

    def cell_weight_matrix(self) -> np.ndarray:
        """Gross-profit share matrix W, (categories x regions), normalised to sum 1.

        The configuration names a non-negative share for every category and
        region (config_validation checks it); a matrix without any positive
        share raises ValueError.
        """
        cw = self.config.cell_weights
        W = np.array([[float(cw[cat][region]) for region in REGIONS] for cat in CATEGORIES])
        total = W.sum()
        if total <= 0:
            raise ValueError("the cell weights hold no positive share")
        return W / total

    def row_normalized_cell_weights(self) -> np.ndarray:
        """Each row of W divided by its sum: a category's regional weights.

        A category with no gross profit in any region is averaged with equal
        weights and reported; it carries weight 0 in the portfolio anyway.
        """
        W = self.cell_weight_matrix()
        rows = W.sum(axis=1)
        Wn = np.zeros_like(W)
        zero_rows = []
        for c_idx in range(W.shape[0]):
            if rows[c_idx] > 0:
                Wn[c_idx, :] = W[c_idx, :] / rows[c_idx]
            else:
                Wn[c_idx, :] = 1.0 / W.shape[1]
                zero_rows.append(CATEGORIES[c_idx])
        if zero_rows and not any(e.get("type") == "cell_weight_zero_row" for e in self._integrity_events):
            one = len(zero_rows) == 1
            self._integrity_events.append({
                "type": "cell_weight_zero_row",
                "severity": "warning",
                "message": (
                    f"{len(zero_rows)} categor{'y' if one else 'ies'} carr{'ies' if one else 'y'} a zero "
                    f"gross-profit share in every region: the category shift shown is the equal-weight "
                    f"average of its cells and the category has weight 0 in the portfolio: "
                    + ", ".join(zero_rows)
                ),
                "detail": {"categories": list(zero_rows)},
            })
        return Wn

    def _category_weight_vector(self) -> np.ndarray:
        """Portfolio weight of each category: the row sums of W."""
        return self.cell_weight_matrix().sum(axis=1)

    def _weights_used(self) -> dict:
        """The weights the run actually applied, as returned with the result."""
        W = self.cell_weight_matrix()
        cats = CATEGORIES
        return {
            "cell_weights_used": {
                cat: {r: float(W[c_idx, r_idx]) for r_idx, r in enumerate(REGIONS)}
                for c_idx, cat in enumerate(cats)
            },
            "category_weights_used": {cat: float(W[c_idx, :].sum()) for c_idx, cat in enumerate(cats)},
            "region_weights_used": {r: float(W[:, r_idx].sum()) for r_idx, r in enumerate(REGIONS)},
            "cell_weights_source": str(self.config.cell_weights_source),
        }

    # ── Sampling ────────────────────────────────────────────────────────────

    def _simulate_samples(self, db: DriverSet, n_iter: int):
        """Draw and compound one chain.

        Returns ``(category_samples, regional_samples)``: the cell shifts as
        (iterations, categories, regions, years) and their gross-profit-weighted
        category roll-up as (iterations, categories, years).
        """
        n_cats = len(CATEGORIES)
        n_regions = len(REGIONS)
        n_years = len(self.config.path_years)
        drivers = db.drivers
        problems = simulation_problems(drivers)
        if problems:
            raise InvalidDriversError(problems)

        corr_matrix = self.build_correlation_matrix(drivers)
        raw_samples = self.generate_copula_samples(drivers, corr_matrix, n_iter)
        cell_samples = self._compute_all_paths_vectorized(
            drivers, raw_samples, n_iter, n_cats, n_regions, n_years
        )
        # Cell index is c * n_regions + r, so the reshape splits cleanly.
        regional_samples = cell_samples.reshape(n_iter, n_cats, n_regions, n_years)
        Wn = self.row_normalized_cell_weights()
        category_samples = np.einsum("icry,cr->icy", regional_samples, Wn)
        return category_samples, regional_samples

    def _build_regional_matrix(self, regional_samples: np.ndarray) -> dict:
        """Percentile paths and velocity bands per (category, region)."""
        cats = CATEGORIES
        years = self.config.path_years
        out: dict = {}
        for c_idx, cat in enumerate(cats):
            out[cat] = {}
            for r_idx, region in enumerate(REGIONS):
                series = regional_samples[:, c_idx, r_idx, :]
                path = {}
                for y_idx, year in enumerate(years):
                    path[int(year)] = distribution(series[:, y_idx])
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

    def build_correlation_matrix(self, drivers: list) -> np.ndarray:
        """Driver-level correlation matrix, repaired (and reported) if not positive definite."""
        n = len(drivers)
        if n == 0:
            return np.eye(0)
        R = build_driver_correlation_matrix(
            [d.force for d in drivers], self.config.within_force_rho, self.config.force_correlation_matrix,
        )
        eigvals = np.linalg.eigvalsh(R)
        if eigvals.min() < 0:
            self._integrity_events.append({
                "type": "correlation_pd_repair",
                "severity": "warning",
                "message": f"The correlation matrix was not positive definite (minimum "
                           f"eigenvalue {eigvals.min():.4f}); it was repaired by a diagonal "
                           f"shift and renormalisation, which weakens every correlation.",
            })
            R += (abs(eigvals.min()) + 0.01) * np.eye(n)
            d = np.sqrt(np.diag(R))
            R = R / np.outer(d, d)
        return R

    def generate_copula_samples(self, drivers: list, R: np.ndarray, n_iter: int) -> np.ndarray:
        """Correlated signed scores, (iterations, drivers).

        Z ~ N(0, R), U = Phi(Z), probability = BetaInv(U; alpha, beta), and the
        score is probability x gp1_pct_affected x direction. Uniforms are
        clipped only at float safety, so the Beta tails are not truncated.
        """
        n_drivers = len(drivers)
        if n_drivers == 0:
            return np.zeros((n_iter, 0))

        try:
            L = cholesky(R, lower=True)
        except (np.linalg.LinAlgError, ValueError):
            self._integrity_events.append({
                "type": "cholesky_repair",
                "severity": "warning",
                "message": "The Cholesky decomposition failed; the correlation matrix was "
                           "repaired by clipping its eigenvalues at 1e-6.",
            })
            logger.warning("Correlation matrix not positive definite; repairing via eigenvalue clipping")
            eigvals, eigvecs = np.linalg.eigh(R)
            eigvals = np.maximum(eigvals, 1e-6)
            R = eigvecs @ np.diag(eigvals) @ eigvecs.T
            L = cholesky(R, lower=True)

        Z = self.rng.standard_normal((n_iter, n_drivers))
        Z_correlated = Z @ L.T
        U = norm_cdf(Z_correlated)
        U = np.clip(U, 1e-12, 1.0 - 1e-12)

        samples = np.zeros((n_iter, n_drivers))
        for j, driver in enumerate(drivers):
            a_p, b_p = driver.probability_prior
            prob_01 = beta_ppf(U[:, j], a_p, b_p)
            samples[:, j] = prob_01 * driver.gp1_pct_affected * driver.direction_sign
        return samples

    def peak_schedule_table(self, drivers: list) -> tuple:
        """Materialisation schedules over each driver's peak-year offsets.

        Returns ``(sched_table, offsets, off_probs_by_driver)``:
        ``sched_table[j, k, y]`` is driver j's materialisation in path year y
        when its peak moves by ``offsets[k]``; ``off_probs_by_driver[j]`` is
        driver j's symmetric triangular distribution over the offsets (all mass
        at 0 when its width is 0). A jittered peak never falls on or before the
        onset: it saturates at the year after onset.
        """
        n_drivers = len(drivers)
        n_years = len(self.config.path_years)
        driver_jitter = [peak_jitter_for(d.uncertainty, self.config.peak_year_jitter) for d in drivers]
        jitter = max(driver_jitter) if driver_jitter else 0
        offsets = list(range(-jitter, jitter + 1)) if jitter > 0 else [0]
        n_off = len(offsets)
        off_probs_by_driver = np.zeros((n_drivers, n_off))
        for j, jt in enumerate(driver_jitter):
            if jt <= 0:
                off_probs_by_driver[j, offsets.index(0)] = 1.0
            else:
                raw_w = np.array([max(0, jt + 1 - abs(o)) if abs(o) <= jt else 0 for o in offsets], dtype=float)
                off_probs_by_driver[j, :] = raw_w / raw_w.sum()

        path_years = self.config.path_years
        sched_table = np.ones((n_drivers, n_off, n_years))
        for j, driver in enumerate(drivers):
            onset = max(int(self.config.base_year), int(driver.start_year))
            for k, off in enumerate(offsets):
                pk = max(int(driver.peak_year) + off, onset + 1)
                sched = compute_materialization_schedule(pk, driver.diffusion_curve, driver.start_year,
                                                         path_years, self.config.base_year)
                for y_idx, yr in enumerate(path_years):
                    sched_table[j, k, y_idx] = sched[yr]
        return sched_table, offsets, off_probs_by_driver

    def draw_peak_offsets(self, off_probs_by_driver: np.ndarray, n_iter: int) -> np.ndarray:
        """Peak-year offset index per (iteration, driver), by inverse-CDF sampling.

        One uniform per (iteration, driver) against the driver's own CDF row.
        For drivers that share one distribution this is the same draw as
        ``rng.choice(n_off, size, p)``. No randomness is consumed when there is
        a single offset.
        """
        n_drivers, n_off = off_probs_by_driver.shape
        if n_off > 1:
            cdf = np.cumsum(off_probs_by_driver, axis=1)
            cdf = cdf / cdf[:, -1:]
            u = self.rng.random((n_iter, n_drivers))
            offset_idx = (u[:, :, None] >= cdf[None, :, :]).sum(axis=2)
            return np.minimum(offset_idx, n_off - 1).astype(np.intp)
        return np.zeros((n_iter, n_drivers), dtype=np.intp)

    def within_force_dampening(self, drivers: list, exposure: np.ndarray) -> tuple:
        """``(dampening, n_eff)``, each (forces, cells): the within-force overlap
        correction and the effective number of each force's drivers per cell.

        n_eff = (sum m)^2 / sum m^2 is the participation ratio of the force's
        deterministic mean contributions m = |normalized_score| x exposure. It
        equals the count for equal contributions, tends to 1 as one driver
        dominates, and barely moves when a negligible driver is added, so
        adding a small driver can never make a force's total smaller. The
        dampening is 1 - overlap x (n_eff - 1) / n_eff where n_eff > 1, else 1,
        floored at 0.1. ``exposure`` is exposure_matrix(drivers).
        """
        n_forces, n_cells = len(FORCES), exposure.shape[1]
        driver_force_idx = np.array([FORCES.index(d.force) for d in drivers])
        abs_score = np.array([abs(float(d.normalized_score)) for d in drivers])
        contrib = abs_score[:, np.newaxis] * exposure
        dampening = np.ones((n_forces, n_cells))
        n_eff_all = np.zeros((n_forces, n_cells))
        for f_idx, force in enumerate(FORCES):
            mask = driver_force_idx == f_idx
            if not mask.any():
                continue
            M = contrib[mask, :]
            s1 = M.sum(axis=0)
            s2 = (M * M).sum(axis=0)
            n_eff = np.where(s2 > 0.0, (s1 * s1) / np.where(s2 > 0.0, s2, 1.0), 0.0)
            n_eff_all[f_idx, :] = n_eff
            ov = self.config.within_force_overlap[force]
            if ov <= 0:
                continue
            # np.where evaluates both branches; dividing by a floored n_eff keeps
            # empty cells (n_eff = 0, dampening 1.0) free of division warnings.
            n_eff_safe = np.maximum(n_eff, 1.0)
            dampen = np.where(n_eff > 1.0, 1.0 - ov * (n_eff - 1.0) / n_eff_safe, 1.0)
            dampening[f_idx, :] = np.clip(dampen, 0.1, 1.0)
        return dampening, n_eff_all

    def _compute_all_paths_vectorized(self, drivers: list, raw_samples: np.ndarray,
                                      n_iter: int, n_cats: int, n_regions: int,
                                      n_years: int) -> np.ndarray:
        """Shift of every composite cell, (iterations, cells, years).

        Cell (c, r) has index ``c * n_regions + r``. A driver reaches it with
        exposure ``(category exposure / 5) x (regional exposure / 5)``. Per year
        and force: the materialised scores are summed over the force's drivers,
        dampened for within-force overlap, weighted and attenuated; the forces
        then compound multiplicatively, each factor floored at zero (a cell
        cannot lose more than its whole pool).
        """
        n_drivers = len(drivers)
        n_cells = n_cats * n_regions
        if n_drivers == 0:
            return np.zeros((n_iter, n_cells, n_years))

        n_forces = len(FORCES)
        driver_force_idx = np.array([FORCES.index(d.force) for d in drivers])
        fw = np.array([self.config.force_weights[f] for f in FORCES])

        exposure = exposure_matrix(drivers)
        sched_table, offsets, off_probs_by_driver = self.peak_schedule_table(drivers)
        offset_idx = self.draw_peak_offsets(off_probs_by_driver, n_iter)
        driver_arange = np.arange(n_drivers)

        attenuation = np.array([self.attenuation[f] for f in FORCES])
        wf_dampen = self.within_force_dampening(drivers, exposure)[0]

        shift_samples = np.zeros((n_iter, n_cells, n_years))
        for y_idx in range(n_years):
            mat_y = sched_table[driver_arange[np.newaxis, :], offset_idx, y_idx]
            effective = raw_samples * mat_y

            force_contrib = np.zeros((n_iter, n_forces, n_cells))
            for f_idx in range(n_forces):
                mask = driver_force_idx == f_idx
                if not mask.any():
                    continue
                raw_sum = effective[:, mask] @ exposure[mask, :]
                force_contrib[:, f_idx, :] = raw_sum * wf_dampen[f_idx, :][np.newaxis, :]

            weighted = force_contrib * fw[:, np.newaxis]
            attenuated = weighted * attenuation[:, np.newaxis]
            factors = 1.0 + attenuated
            n_floored = int((factors <= 0.0).sum())
            if n_floored > 0:
                self._floored_factor_cells += n_floored
                factors = np.maximum(factors, 0.0)
            product = np.prod(factors, axis=1)
            shift_samples[:, :, y_idx] = product - 1.0
        return shift_samples

    # ── Results ─────────────────────────────────────────────────────────────

    def _compile_results(self, samples: np.ndarray, db: DriverSet) -> dict:
        """Percentiles, velocity, Monte Carlo standard error and the three lenses.

        ``samples`` is the category roll-up, (iterations, categories, years).
        """
        n_iter, n_cats, n_years = samples.shape
        years = self.config.path_years
        shift_matrix = {}

        for c_idx, cat in enumerate(CATEGORIES):
            cat_data = samples[:, c_idx, :]
            path = {}
            for y_idx, year in enumerate(years):
                path[year] = distribution(cat_data[:, y_idx])

            # Velocity is the distribution of each iteration's year-on-year
            # change, not the difference of two medians.
            velocity = {}
            for i in range(1, len(years)):
                velocity[years[i]] = distribution(cat_data[:, i] - cat_data[:, i - 1])
            shift_matrix[cat] = {"path": path, "velocity": velocity}

        mc_standard_error = self._mc_standard_error(samples)

        # ── Attribution lenses ──────────────────────────────────────────────
        # Each lens splits the Monte Carlo median of a category and year into
        # shares, so every lens adds up to the same row total. They are
        # attributions of one simulated number, not separate simulations.
        #
        # Value chain: each driver's relevance, |normalized_score| x category
        # exposure / 5, goes wholly to its epicentre stage. Propagation along
        # the chain is not modelled.
        # A category no driver reaches has a median of exactly zero; its
        # shares are zero too, so every lens still adds up to the row total.
        def shares(sums: dict) -> dict:
            total = sum(sums.values())
            return {k: (v / total if total > 0 else 0.0) for k, v in sums.items()}

        drivers = db.drivers
        cats = list(CATEGORIES)
        # Region lens: each (category, region) cell weighted by its own share
        # of the category's gross profit.
        Wn_lens = self.row_normalized_cell_weights()
        presences = [region_presence(d) for d in drivers]
        vc_shares: dict = {}
        force_shares: dict = {}
        region_shares: dict = {}
        for c_idx, cat in enumerate(cats):
            vsum = {s: 0.0 for s in VC_STEPS}
            fsum = {f: 0.0 for f in FORCES}
            rsum = {r: 0.0 for r in REGIONS}
            for j, driver in enumerate(drivers):
                cat_exp = driver.category_exposure[cat]
                if cat_exp == 0:
                    continue
                relevance = abs(driver.normalized_score) * (cat_exp / 5.0)
                vsum[driver.vc_epicentre] += relevance
                fsum[driver.force] += relevance * self.config.force_weights[driver.force]
                for r_idx, region in enumerate(REGIONS):
                    rsum[region] += relevance * float(presences[j][r_idx]) * float(Wn_lens[c_idx, r_idx])
            vc_shares[cat] = shares(vsum)
            force_shares[cat] = shares(fsum)
            region_shares[cat] = shares(rsum)

        force_decomp = {int(y): {} for y in years}
        vc_decomp = {int(y): {} for y in years}
        region_decomp = {int(y): {} for y in years}
        for year in years:
            yi = int(year)
            for cat in cats:
                median_cy = float(shift_matrix[cat]["path"][year]["median"])
                force_decomp[yi][cat] = {f: float(force_shares[cat][f] * median_cy) for f in FORCES}
                vc_decomp[yi][cat] = {s: float(vc_shares[cat][s] * median_cy) for s in VC_STEPS}
                region_decomp[yi][cat] = {r: float(region_shares[cat][r] * median_cy) for r in REGIONS}

        decompositions = {
            "force": force_decomp,    # year -> category -> force  -> shift
            "vc": vc_decomp,          # year -> category -> step   -> shift
            "region": region_decomp,  # year -> category -> region -> shift
            "dimensions": {
                "forces": list(FORCES),
                "vc_steps": list(VC_STEPS),
                "regions": list(REGIONS),
                "categories": cats,
                "years": [int(y) for y in years],
            },
        }

        # The portfolio band is the joint percentile of the per-iteration
        # portfolio shift (category shifts weighted by their gross-profit
        # shares). An average of the category bands would ignore how the
        # categories partly offset one another and come out too wide.
        w = self._category_weight_vector()
        w = w / w.sum()
        port = np.tensordot(samples, w, axes=([1], [0]))
        portfolio_path = {}
        for y_idx, year in enumerate(years):
            portfolio_path[int(year)] = distribution(port[:, y_idx])

        # A lens's column totals are category-weighted averages of the lens
        # values (lib/shiftMatrix.ts computes them where they are shown).
        totals = {
            # category -> year -> median: the row total of every lens
            "category_path": {cat: {int(y): float(shift_matrix[cat]["path"][y]["median"]) for y in years}
                              for cat in cats},
            "portfolio": portfolio_path,  # the headline band
        }

        return {
            "shift_matrix": shift_matrix,
            "mc_standard_error": mc_standard_error,
            "decompositions": decompositions,
            "totals": totals,
            "raw_samples": samples,
            "iterations": n_iter,
            "model_version": self.MODEL_VERSION,
            "engine_name": self.ENGINE_NAME,
            "numerics_backend": NUMERICS_BACKEND,
            "seed": self.seed,
            "integrity_events": list(self._integrity_events),
        }

    def _mc_standard_error(self, samples: np.ndarray, n_boot: int = 200) -> dict:
        """Bootstrap standard error of the terminal-year median, P10 and P90, in pp.

        This is the sampling noise of the published percentiles at the run's
        iteration count (about 0.001 pp at 3 x 50,000, far below the 0.1 pp
        display precision). It measures Monte Carlo noise only, never model
        error. A fixed sub-generator keeps the reported value reproducible.
        """
        n_iter, n_cats, n_years = samples.shape
        last = n_years - 1
        terminal_year = int(self.config.path_years[-1])
        rng = np.random.default_rng(MC_SE_BOOTSTRAP_SEED)
        out: dict = {}
        for c_idx, cat in enumerate(CATEGORIES):
            col = samples[:, c_idx, last]
            meds = np.empty(n_boot)
            p10s = np.empty(n_boot)
            p90s = np.empty(n_boot)
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

    def run_multichain(self, db: DriverSet, n_chains: int = 3,
                       iterations: Optional[int] = None, seeds: Optional[list] = None) -> dict:
        """Run ``n_chains`` independently seeded chains and pool them.

        The published percentiles, lenses and standard errors come from the
        pooled sample. ``seed_stability`` reports the spread of the per-chain
        terminal-year portfolio medians, which is Monte Carlo noise only.
        Chain seeds derive from the master seed, so the master seed alone
        reproduces the run.
        """
        if n_chains < 1:
            raise ValueError("n_chains must be >= 1")
        if seeds is None:
            seeds = [int(self.seed) + i * 1000003 for i in range(n_chains)]
        if len(seeds) != n_chains:
            raise ValueError("len(seeds) must equal n_chains")

        # The pooled result is compiled on this instance; start from a clean
        # event list so a reused engine cannot report an event twice.
        self._integrity_events = []
        self._floored_factor_cells = 0

        per_chain_cat = []
        per_chain_reg = []
        chain_engines = []
        for s in seeds:
            engine = MonteCarloEngine(self.config, seed=s)
            cat_s, reg_s = engine._simulate_samples(db, iterations or self.config.iterations)
            per_chain_cat.append(cat_s)
            per_chain_reg.append(reg_s)
            chain_engines.append(engine)

        last_idx = per_chain_cat[0].shape[2] - 1
        terminal_year = int(self.config.path_years[-1])

        # Per-chain portfolio median at the terminal year, before pooling.
        w = self._category_weight_vector()
        w = w / w.sum()
        per_chain_portfolio_medians = [
            float(np.median(per_chain_cat[i][:, :, last_idx] @ w)) for i in range(n_chains)
        ]

        pooled_cat = np.concatenate(per_chain_cat, axis=0)
        pooled_reg = np.concatenate(per_chain_reg, axis=0)
        result = self._compile_results(pooled_cat, db)
        result["regional_shift_matrix"] = self._build_regional_matrix(pooled_reg)
        result.update(self._weights_used())

        # The input-driven events (a correlation repair, a zero cell-weight row)
        # are the same in every chain: report chain 0's once. Floored factors
        # depend on the draws, so their count is summed over the chains. The
        # pooled compilation adds its own zero-row event only where chain 0 has
        # not already reported one.
        merged = list(chain_engines[0]._integrity_events)
        floored = sum(engine._floored_factor_cells for engine in chain_engines)
        if floored:
            merged.append(floor_event(floored))
        seen = {e.get("type") for e in merged}
        for e in result.get("integrity_events", []):
            if e.get("type") == "cell_weight_zero_row" and e.get("type") in seen:
                continue
            merged.append(e)
        result["integrity_events"] = merged

        result["n_chains"] = n_chains
        result["seed"] = int(self.seed)
        result["chain_seeds"] = [int(s) for s in seeds]
        spread_pp = (max(per_chain_portfolio_medians) - min(per_chain_portfolio_medians)) * 100.0
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
