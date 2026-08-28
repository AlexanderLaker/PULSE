"""Tests for Bayesian Monte Carlo Engine — probabilistic simulation."""

import pytest
import numpy as np
from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine
from pulse.config import CATEGORIES, REGIONS, FORCES
from pulse.ingestion.models import Trend, TrendDatabase


def _single_trend_db(regional, cat="Hair: Color", cat_exp=5, prob=4,
                     gp1=0.10, direction="Contraction", peak_year=2026,
                     curve="linear", start_year=2025):
    t = Trend(id="t1", force="Consumer", direction=direction, gp1_pct_affected=gp1,
              probability=prob, peak_year=peak_year, diffusion_curve=curve,
              start_year=start_year)
    t.category_exposure = {cat: cat_exp}
    t.regional_exposure = dict(zip(REGIONS, regional))
    return TrendDatabase(trends=[t], categories=CATEGORIES, forces=FORCES)


class TestBayesianMCBasics:
    """Test basic Monte Carlo operation."""

    def test_mc_runs_without_error(self, mock_model_config, mock_trends_database):
        """Should complete MC simulation without error."""
        config = mock_model_config
        config = config.copy_with(iterations=100)  # Fast run
        engine = BayesianMonteCarloEngine(config)
        result = engine.run(mock_trends_database)

        assert result is not None
        assert "shift_matrix" in result

    def test_mc_returns_all_categories(self, mock_model_config, mock_trends_database):
        """Should return results for all 13 categories."""
        config = mock_model_config
        config = config.copy_with(iterations=100)
        engine = BayesianMonteCarloEngine(config)
        result = engine.run(mock_trends_database)

        shift_matrix = result["shift_matrix"]
        assert len(shift_matrix) == len(CATEGORIES)
        for cat in CATEGORIES:
            assert cat in shift_matrix

    def test_mc_returns_all_path_years(self, mock_model_config, mock_trends_database):
        """Should return results for all path years."""
        config = mock_model_config
        config = config.copy_with(iterations=100)
        engine = BayesianMonteCarloEngine(config)
        result = engine.run(mock_trends_database)

        shift_matrix = result["shift_matrix"]
        for cat in CATEGORIES:
            assert "path" in shift_matrix[cat]
            for year in config.path_years:
                assert year in shift_matrix[cat]["path"]

    def test_mc_returns_all_percentiles(self, mock_model_config, mock_trends_database):
        """Should return p10, p25, p50, p75, p90 percentiles."""
        config = mock_model_config
        config = config.copy_with(iterations=500)
        engine = BayesianMonteCarloEngine(config)
        result = engine.run(mock_trends_database)

        shift_matrix = result["shift_matrix"]
        percentiles = ["p10", "p25", "p50", "p75", "p90"]

        for cat in CATEGORIES:
            for year in config.path_years:
                year_data = shift_matrix[cat]["path"][year]
                for pctl in percentiles:
                    assert pctl in year_data, f"Missing {pctl} for {cat} {year}"


class TestBayesianMCStatistics:
    """Test statistical properties of MC results."""

    def test_percentile_ordering(self, mock_model_config, mock_trends_database):
        """Should verify p10 < p25 < p50 < p75 < p90."""
        config = mock_model_config
        config = config.copy_with(iterations=500)
        engine = BayesianMonteCarloEngine(config)
        result = engine.run(mock_trends_database)

        shift_matrix = result["shift_matrix"]

        for cat in CATEGORIES:
            for year in config.path_years:
                year_data = shift_matrix[cat]["path"][year]
                p10 = year_data["p10"]
                p25 = year_data["p25"]
                p50 = year_data["p50"]
                p75 = year_data["p75"]
                p90 = year_data["p90"]

                # Should be monotonically increasing
                assert p10 <= p25 <= p50 <= p75 <= p90, \
                    f"{cat} {year}: {p10} <= {p25} <= {p50} <= {p75} <= {p90}"

    def test_standard_deviation_computed(self, mock_model_config, mock_trends_database):
        """Should compute and return standard deviation."""
        config = mock_model_config
        config = config.copy_with(iterations=500)
        engine = BayesianMonteCarloEngine(config)
        result = engine.run(mock_trends_database)

        shift_matrix = result["shift_matrix"]

        for cat in CATEGORIES:
            for year in config.path_years:
                year_data = shift_matrix[cat]["path"][year]
                assert "std" in year_data
                assert year_data["std"] >= 0


class TestBayesianMCConvergence:
    """Test Monte Carlo convergence properties."""

    def test_percentile_spread_is_iteration_consistent(self, mock_model_config, mock_trends_database):
        """The P10–P90 band estimates a POPULATION quantity — it must be
        non-degenerate and consistent across iteration counts.

        L29 (July 2026 review): the old assertion here (`spread >= 0`) was
        vacuous, and the old test name ("more iterations narrows spread")
        described a statistical misconception — more samples make the band
        ESTIMATE more precise; they do not narrow the band itself. The real
        invariants: the band is strictly positive (the model is stochastic),
        and the 100- and 500-iteration estimates agree to within loose MC
        noise (a broken `iterations` parameter or a degenerate sampler
        fails this).
        """
        config_100 = mock_model_config.copy_with(iterations=100)
        result_100 = BayesianMonteCarloEngine(config_100).run(mock_trends_database)

        config_500 = mock_model_config.copy_with(iterations=500)
        result_500 = BayesianMonteCarloEngine(config_500).run(mock_trends_database)

        cell_100 = result_100["shift_matrix"]["Hair: Color"]["path"][2030]
        cell_500 = result_500["shift_matrix"]["Hair: Color"]["path"][2030]
        spread_100 = cell_100["p90"] - cell_100["p10"]
        spread_500 = cell_500["p90"] - cell_500["p10"]

        assert spread_100 > 0 and spread_500 > 0, "band must be non-degenerate"
        # Same population quantity, estimated twice — loose 2x agreement band.
        assert 0.5 < spread_500 / spread_100 < 2.0, (spread_100, spread_500)
        # And the iterations parameter must actually thread through.
        assert result_100["iterations"] == 100
        assert result_500["iterations"] == 500

    def test_returns_mc_standard_error(self, mock_model_config, mock_trends_database):
        """F7 (2.10.0): the vacuous i.i.d. split-R̂/ESS 'convergence' block was
        replaced by a per-quantile Monte-Carlo standard error at the terminal
        year. It must be present for every category, in pp, non-negative."""
        config = mock_model_config.copy_with(iterations=500)
        result = BayesianMonteCarloEngine(config).run(mock_trends_database)

        assert "convergence" not in result  # R̂/ESS deleted
        mc_se = result["mc_standard_error"]
        for cat in CATEGORIES:
            assert cat in mc_se
            for k in ("median_se_pp", "p10_se_pp", "p90_se_pp"):
                assert mc_se[cat][k] >= 0.0
            assert mc_se[cat]["method"] == "bootstrap_terminal_year"


class TestBayesianMCCopulaAndDAG:
    """Test copula dependency integration."""

    def test_correlation_matrix_positive_definite(self, mock_model_config, mock_trends_database):
        """Should produce positive definite correlation matrix."""
        engine = BayesianMonteCarloEngine(mock_model_config)
        corr_matrix = engine._build_correlation_matrix(mock_trends_database.trends)

        # Check positive definiteness: all eigenvalues > 0
        eigvals = np.linalg.eigvalsh(corr_matrix)
        assert np.all(eigvals > -1e-6)  # Allow small numerical errors

    def test_correlation_matrix_has_structure(self, mock_model_config, mock_trends_database):
        """Should build correlation matrix respecting force structure."""
        engine = BayesianMonteCarloEngine(mock_model_config)
        corr_matrix = engine._build_correlation_matrix(mock_trends_database.trends)

        # Should be symmetric
        assert np.allclose(corr_matrix, corr_matrix.T)

        # Diagonal should be 1
        assert np.allclose(np.diag(corr_matrix), 1.0)


class TestBayesianMCEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_mc_with_empty_database(self, mock_model_config):
        """Should handle empty database gracefully."""
        from pulse.ingestion.models import TrendDatabase
        empty_db = TrendDatabase(trends=[], categories=CATEGORIES, forces=[])

        config = mock_model_config
        config = config.copy_with(iterations=100)
        engine = BayesianMonteCarloEngine(config)
        result = engine.run(empty_db)

        # Should return structure but with near-zero shifts
        assert "shift_matrix" in result

    def test_mc_with_single_trend(self, mock_model_config, mock_trend):
        """Should handle single trend database."""
        from pulse.ingestion.models import TrendDatabase
        db = TrendDatabase(trends=[mock_trend], categories=CATEGORIES, forces=["Consumer"])

        config = mock_model_config
        config = config.copy_with(iterations=100)
        engine = BayesianMonteCarloEngine(config)
        result = engine.run(db)

        assert "shift_matrix" in result
        for cat in CATEGORIES:
            assert cat in result["shift_matrix"]

    def test_custom_iterations_parameter(self, mock_model_config, mock_trends_database):
        """Should respect custom iterations parameter."""
        config = mock_model_config
        config = config.copy_with(iterations=100)  # Config default

        engine = BayesianMonteCarloEngine(config)

        # Override at runtime
        result_50 = engine.run(mock_trends_database, iterations=50)
        result_200 = engine.run(mock_trends_database, iterations=200)

        # Both should return valid results
        assert "shift_matrix" in result_50
        assert "shift_matrix" in result_200


class TestBayesianMCBayesianPriors:
    """Test Bayesian prior handling in MC."""

    def test_mc_uses_trend_priors(self, mock_model_config, mock_trends_database):
        """Should use the structured-judgment Beta priors from trends.

        F11 (2.10.0): the field was renamed probability_posterior →
        probability_prior (there is no Bayesian update from data — T7). The
        deprecated ``probability_posterior`` property alias must still resolve.
        """
        config = mock_model_config.copy_with(iterations=100)

        for trend in mock_trends_database.trends:
            assert trend.probability_prior is not None
            assert trend.probability_posterior == trend.probability_prior  # alias

        result = BayesianMonteCarloEngine(config).run(mock_trends_database)
        assert "shift_matrix" in result

    def test_raw_samples_available(self, mock_model_config, mock_trends_database):
        """Should return raw MC samples for diagnostics."""
        config = mock_model_config
        config = config.copy_with(iterations=100)
        engine = BayesianMonteCarloEngine(config)
        result = engine.run(mock_trends_database)

        assert "raw_samples" in result
        raw_samples = result["raw_samples"]

        # Should be (iterations, categories, years)
        assert raw_samples.shape[0] == config.iterations
        assert raw_samples.shape[1] == len(CATEGORIES)
        assert raw_samples.shape[2] == len(config.path_years)


class TestJourneyLayerRemoved:
    """O3 (owner ruling 2026-07-07): the quantitative journey layer was
    deleted — the result contract must NOT carry journey_decomposition,
    and Trend must not grow a journey_exposure field back silently."""

    def test_result_has_no_journey_decomposition(self, mock_model_config, mock_trends_database):
        result = BayesianMonteCarloEngine(mock_model_config).run(
            mock_trends_database, iterations=100)
        assert "journey_decomposition" not in result

    def test_trend_has_no_journey_exposure_field(self, mock_trend):
        assert not hasattr(mock_trend, "journey_exposure")


class TestF1RegionalShiftMath:
    """F1 (2.10.0): the shift math is 3D (category × region × year) and rolls
    up to the category level by region GP1-share weights."""

    def _cfg(self, mock_model_config):
        return mock_model_config.copy_with(iterations=4000, peak_year_jitter=0)

    def test_region_weights_used_sum_to_one(self, mock_model_config, mock_trends_database):
        r = BayesianMonteCarloEngine(self._cfg(mock_model_config)).run(mock_trends_database)
        rw = r["region_weights_used"]
        assert set(rw.keys()) == set(REGIONS)
        assert sum(rw.values()) == pytest.approx(1.0, abs=1e-9)

    def test_regional_shift_matrix_present_and_shaped(self, mock_model_config, mock_trends_database):
        r = BayesianMonteCarloEngine(self._cfg(mock_model_config)).run(mock_trends_database)
        rsm = r["regional_shift_matrix"]
        for cat in CATEGORIES:
            assert set(rsm[cat].keys()) == set(REGIONS)
            for region in REGIONS:
                assert 2030 in rsm[cat][region]["path"]

    def test_global_trend_reproduces_across_regions(self, mock_model_config):
        """A globally-present trend (region exposure full everywhere) moves
        every region's cell identically, and the category roll-up equals that
        common value (Σ_r weight_r · x = x). This is the 'global trend
        reproduces the 2D number' property."""
        cfg = self._cfg(mock_model_config)
        r = BayesianMonteCarloEngine(cfg).run(_single_trend_db([5, 5, 5, 5]))
        rsm = r["regional_shift_matrix"]["Hair: Color"]
        med = {reg: rsm[reg]["path"][2030]["median"] for reg in REGIONS}
        # all regional cells identical for a global trend
        for reg in REGIONS:
            assert med[reg] == pytest.approx(med["Europe"], rel=1e-9)
        cat_med = r["shift_matrix"]["Hair: Color"]["path"][2030]["median"]
        assert cat_med == pytest.approx(med["Europe"], rel=1e-9)

    def test_region_concentrated_trend_scales_by_weight(self, mock_model_config):
        """A Europe-only trend hits only Europe's cell; the category shift is
        EXACTLY Europe's GP1 weight × Europe's regional shift (per-iteration
        linear scaling ⇒ the identity holds for the median too)."""
        cfg = self._cfg(mock_model_config)
        r = BayesianMonteCarloEngine(cfg).run(_single_trend_db([5, 0, 0, 0]))
        rsm = r["regional_shift_matrix"]["Hair: Color"]
        eu_med = rsm["Europe"]["path"][2030]["median"]
        assert rsm["Asia"]["path"][2030]["median"] == pytest.approx(0.0, abs=1e-12)
        rw_eu = r["region_weights_used"]["Europe"]
        cat_med = r["shift_matrix"]["Hair: Color"]["path"][2030]["median"]
        assert cat_med == pytest.approx(rw_eu * eu_med, rel=1e-9)

    def test_only_scored_category_moves(self, mock_model_config):
        """Category bucketing: a trend scored on only Hair: Color moves only
        that category; all others are exactly 0."""
        cfg = self._cfg(mock_model_config)
        r = BayesianMonteCarloEngine(cfg).run(_single_trend_db([5, 3, 2, 2]))
        sm = r["shift_matrix"]
        assert sm["Hair: Color"]["path"][2030]["median"] != 0.0
        for cat in CATEGORIES:
            if cat != "Hair: Color":
                assert sm[cat]["path"][2030]["median"] == pytest.approx(0.0, abs=1e-12)

    def test_regionless_trend_emits_coverage_event(self, mock_model_config):
        """A trend with no regional exposure is treated as globally present
        and surfaces a regional_exposure_coverage integrity event."""
        cfg = self._cfg(mock_model_config)
        r = BayesianMonteCarloEngine(cfg).run(_single_trend_db([0, 0, 0, 0]))
        evs = [e for e in r["integrity_events"] if e["type"] == "regional_exposure_coverage"]
        assert len(evs) == 1 and evs[0]["severity"] == "warning"


class TestF2Monotonicity:
    """F2 (2.10.0): magnitude-weighted n_eff dampening restores monotonicity —
    adding a negligible favourable trend must not worsen the outlook."""

    def test_tiny_tailwind_does_not_worsen(self, mock_model_config):
        cfg = mock_model_config.copy_with(iterations=20000, peak_year_jitter=0)
        big = Trend(id="big", force="Consumer", direction="Expansion", gp1_pct_affected=0.20,
                    probability=4, peak_year=2028, diffusion_curve="s_curve", start_year=2025)
        big.category_exposure = {"Hair: Color": 5}; big.regional_exposure = dict(zip(REGIONS, [5,5,5,5]))
        db1 = TrendDatabase(trends=[big], categories=CATEGORIES, forces=FORCES)
        tiny = Trend(id="tiny", force="Consumer", direction="Expansion", gp1_pct_affected=0.005,
                     probability=5, peak_year=2028, diffusion_curve="s_curve", start_year=2025)
        tiny.category_exposure = {"Hair: Color": 1}; tiny.regional_exposure = dict(zip(REGIONS, [5,5,5,5]))
        db2 = TrendDatabase(trends=[big, tiny], categories=CATEGORIES, forces=FORCES)
        m1 = BayesianMonteCarloEngine(cfg, seed=42).run(db1)["shift_matrix"]["Hair: Color"]["path"][2030]["median"]
        m2 = BayesianMonteCarloEngine(cfg, seed=42).run(db2)["shift_matrix"]["Hair: Color"]["path"][2030]["median"]
        # both are expansion (positive); adding a tailwind must not reduce it.
        assert m2 >= m1 - 1e-9, (m1, m2)


class TestF4PeakYearJitter:
    """F4 (2.10.0): per-iteration peak-year jitter gives velocity bands real
    timing content; off by config, deterministic under seed."""

    def _db(self):
        t = Trend(id="j", force="Consumer", direction="Contraction", gp1_pct_affected=0.20,
                  probability=4, peak_year=2028, diffusion_curve="s_curve", start_year=2025)
        t.category_exposure = {"Hair: Color": 5}; t.regional_exposure = dict(zip(REGIONS, [5,5,5,5]))
        return TrendDatabase(trends=[t], categories=CATEGORIES, forces=FORCES)

    def test_jitter_widens_velocity_band(self, mock_model_config):
        base = mock_model_config.copy_with(iterations=20000)
        v0 = BayesianMonteCarloEngine(base.copy_with(peak_year_jitter=0), seed=7).run(self._db())
        v1 = BayesianMonteCarloEngine(base.copy_with(peak_year_jitter=1), seed=7).run(self._db())
        w0 = (v0["shift_matrix"]["Hair: Color"]["velocity"][2029]["p90"]
              - v0["shift_matrix"]["Hair: Color"]["velocity"][2029]["p10"])
        w1 = (v1["shift_matrix"]["Hair: Color"]["velocity"][2029]["p90"]
              - v1["shift_matrix"]["Hair: Color"]["velocity"][2029]["p10"])
        assert w1 > w0

    def test_jitter_reproducible_under_seed(self, mock_model_config):
        cfg = mock_model_config.copy_with(iterations=3000, peak_year_jitter=1)
        r1 = BayesianMonteCarloEngine(cfg, seed=11).run(self._db())
        r2 = BayesianMonteCarloEngine(cfg, seed=11).run(self._db())
        assert (r1["shift_matrix"]["Hair: Color"]["path"][2030]["median"]
                == r2["shift_matrix"]["Hair: Color"]["path"][2030]["median"])


class TestF7ChainPooling:
    """F7 (2.10.0): the 3 chains are pooled for the published percentiles and
    an MC standard error replaces the vacuous R̂/ESS block."""

    def test_pooled_iterations_and_mc_se(self, mock_model_config, mock_trends_database):
        e = BayesianMonteCarloEngine(mock_model_config.copy_with(peak_year_jitter=0), seed=42)
        r = e.run_multichain(mock_trends_database, n_chains=3, iterations=400)
        assert r["seed_stability"]["pooled_iterations"] == 1200
        assert "mc_standard_error" in r and "convergence" not in r
        assert "regional_shift_matrix" in r


class TestF11StartYear:
    """F11 (2.10.0): start_year gates the materialization onset."""

    def test_no_materialization_before_start_year(self, mock_model_config):
        cfg = mock_model_config.copy_with(iterations=2000, peak_year_jitter=0)
        db = _single_trend_db([5, 5, 5, 5], prob=5, gp1=0.20, direction="Contraction",
                              peak_year=2030, curve="linear", start_year=2028)
        p = BayesianMonteCarloEngine(cfg, seed=1).run(db)["shift_matrix"]["Hair: Color"]["path"]
        assert p[2026]["median"] == pytest.approx(0.0, abs=1e-12)
        assert p[2027]["median"] == pytest.approx(0.0, abs=1e-12)
        assert p[2028]["median"] == pytest.approx(0.0, abs=1e-12)  # onset year: 0
        assert p[2030]["median"] < 0.0  # ramped in by the terminal year


class TestF11TriggerSign:
    """F11 (2.10.0): the early-warning trigger comparison is signed — a
    positive overshoot must not fire a contraction (negative-threshold)
    trigger, and vice-versa (was `abs(median) >= abs(threshold)`)."""

    def test_positive_shift_does_not_fire_contraction_trigger(self):
        from pulse.simulation.paths import TriggerCondition
        trig = TriggerCondition(category="Hair: Color", threshold=-0.02, target_year=2030)
        # A +5% shift must NOT breach a −2% contraction threshold.
        assert trig.evaluate({2030: {"median": 0.05}}) is None
        # A −3% shift breaches it.
        assert trig.evaluate({2030: {"median": -0.03}}) is not None

    def test_expansion_threshold_is_directional(self):
        from pulse.simulation.paths import TriggerCondition
        trig = TriggerCondition(category="Hair: Color", threshold=0.02, target_year=2030)
        assert trig.evaluate({2030: {"median": -0.05}}) is None   # negative doesn't fire
        assert trig.evaluate({2030: {"median": 0.03}}) is not None
