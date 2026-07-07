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
