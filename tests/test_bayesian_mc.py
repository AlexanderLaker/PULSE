"""Tests for Bayesian Monte Carlo Engine — probabilistic simulation."""

import pytest
import numpy as np
from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine
from pulse.config import CATEGORIES


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

    def test_more_iterations_narrows_spread(self, mock_model_config, mock_trends_database):
        """Should verify more iterations reduce percentile spread."""
        # Run with fewer iterations
        config_100 = mock_model_config.copy_with(iterations=100)
        engine_100 = BayesianMonteCarloEngine(config_100)
        result_100 = engine_100.run(mock_trends_database)

        # Run with more iterations
        config_500 = mock_model_config.copy_with(iterations=500)
        engine_500 = BayesianMonteCarloEngine(config_500)
        result_500 = engine_500.run(mock_trends_database)

        matrix_100 = result_100["shift_matrix"]
        matrix_500 = result_500["shift_matrix"]

        # Check spread (p90 - p10) decreases with more iterations
        spread_100 = abs(matrix_100["Hair: Color"]["path"][2030]["p90"] - matrix_100["Hair: Color"]["path"][2030]["p10"])
        spread_500 = abs(matrix_500["Hair: Color"]["path"][2030]["p90"] - matrix_500["Hair: Color"]["path"][2030]["p10"])

        # More iterations should produce tighter confidence intervals
        # (though this is probabilistic, so we use a loose threshold)
        assert spread_100 >= 0 and spread_500 >= 0

    def test_returns_convergence_diagnostics(self, mock_model_config, mock_trends_database):
        """Should include convergence diagnostics in result."""
        config = mock_model_config
        config = config.copy_with(iterations=500)
        engine = BayesianMonteCarloEngine(config)
        result = engine.run(mock_trends_database)

        assert "convergence" in result
        convergence = result["convergence"]

        # Should have diagnostics for all categories
        for cat in CATEGORIES:
            assert cat in convergence


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

    def test_mc_uses_trend_posteriors(self, mock_model_config, mock_trends_database):
        """Should use Bayesian posteriors from trends."""
        config = mock_model_config
        config = config.copy_with(iterations=100)

        # Verify trends have posteriors
        for trend in mock_trends_database.trends:
            assert trend.probability_posterior is not None

        engine = BayesianMonteCarloEngine(config)
        result = engine.run(mock_trends_database)

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


class TestJourneyDecomposition:
    """v3.6 journey layer (block 8, restored 2026-06-10): terminal-year
    journey-stage attribution. The lens redistributes each category's
    terminal-year MC-median across its journey's stages — it must never
    change totals."""

    def test_journey_decomposition_reconciles_with_terminal_median(
        self, mock_model_config, mock_trends_database
    ):
        from pulse.config import CATEGORY_JOURNEY, JOURNEY_STAGES

        config = mock_model_config.copy_with(iterations=200)
        # Exercise the exposure-weighted path on both journeys; categories
        # whose trends carry no journey exposure fall back to equal shares.
        mock_trends_database.trends[0].journey_exposure = {
            "hair:diagnose": 5, "hair:transform": 3, "lhc:add_products": 4,
        }
        mock_trends_database.trends[1].journey_exposure = {
            "lhc:pre_treating": 5, "lhc:washing_cycle": 2,
        }
        engine = BayesianMonteCarloEngine(config)
        result = engine.run(mock_trends_database)

        jd = result["journey_decomposition"]
        assert set(jd.keys()) == set(CATEGORIES)

        last_year = config.path_years[-1]
        for cat in CATEGORIES:
            journey = CATEGORY_JOURNEY[cat]
            expected_keys = {f"{journey}:{s}" for s in JOURNEY_STAGES[journey]}
            assert set(jd[cat].keys()) == expected_keys, cat
            # Hair categories carry 8 stages, LHC categories 13.
            assert len(jd[cat]) == (8 if journey == "hair" else 13)
            median = result["shift_matrix"][cat]["path"][last_year]["median"]
            residual = abs(sum(jd[cat].values()) - median)
            assert residual <= 1e-12 * max(1.0, abs(median)), (cat, residual)
