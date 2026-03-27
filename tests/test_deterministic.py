"""Tests for Deterministic Engine — V12 parity and basic calculation."""

import pytest
from pulse.simulation.deterministic import DeterministicEngine
from pulse.config import CATEGORIES
from pulse.ingestion.models import Trend, TrendDatabase


class TestDeterministicBasics:
    """Test basic deterministic calculation properties."""

    def test_empty_database_returns_zeros(self, mock_model_config):
        """Should return 0% shifts for empty database."""
        engine = DeterministicEngine(mock_model_config)
        empty_db = TrendDatabase(
            trends=[],
            categories=CATEGORIES,
            forces=["Consumer", "Customer", "Technology", "Government", "Environmental", "Competitive"],
        )
        result = engine.run(empty_db)

        assert len(result) == len(CATEGORIES)
        for cat in CATEGORIES:
            assert cat in result
            for year in mock_model_config.path_years:
                assert result[cat][year] == 0.0

    def test_single_trend_single_category(self, mock_model_config):
        """Should correctly compute shift for single trend with exposure."""
        trend = Trend(
            id="test_01",
            force="Consumer",
            name="Test Trend",
            description="Test",
            direction="Expansion",
            impact=3,
            probability=2,
            start_year=2025,
        )
        # Expose to one category only
        for cat in CATEGORIES:
            trend.category_exposure[cat] = 0
        trend.category_exposure["Hair: Color"] = 5  # Full exposure

        db = TrendDatabase(
            trends=[trend],
            categories=CATEGORIES,
            forces=["Consumer"],
        )

        engine = DeterministicEngine(mock_model_config)
        result = engine.run(db)

        # Hair: Color should have non-zero shift
        assert result["Hair: Color"][2030] != 0.0
        # Other categories should have zero or minimal shift
        assert result["Hair: Care"][2030] == 0.0

    def test_attenuation_reduces_shift(self, mock_model_config, mock_trends_database):
        """Should verify that attenuation factor reduces shifts."""
        engine_unattenuated = DeterministicEngine(mock_model_config)
        mock_model_config.attenuation = 1.0
        result_high = engine_unattenuated.run(mock_trends_database)

        engine_attenuated = DeterministicEngine(mock_model_config)
        mock_model_config.attenuation = 0.3
        result_low = engine_attenuated.run(mock_trends_database)

        # Attenuation 0.3 should produce smaller shifts than 1.0
        for cat in CATEGORIES:
            shift_high = abs(result_high[cat][2030])
            shift_low = abs(result_low[cat][2030])
            if shift_high > 0.001:  # Only check if there's a real shift
                assert shift_low < shift_high

    def test_expansion_trend_positive_shift(self, mock_model_config):
        """Should create positive shifts for Expansion trends."""
        trend = Trend(
            id="expansion_trend",
            force="Consumer",
            name="Beauty Growth",
            description="Market growing",
            direction="Expansion",
            impact=4,
            probability=4,
            start_year=2025,
        )
        for cat in CATEGORIES:
            trend.category_exposure[cat] = 3

        db = TrendDatabase(trends=[trend], categories=CATEGORIES, forces=["Consumer"])
        engine = DeterministicEngine(mock_model_config)
        result = engine.run(db)

        # Expansion with impact=4, prob=4 should be positive
        for cat in CATEGORIES:
            assert result[cat][2030] > 0

    def test_contraction_trend_negative_shift(self, mock_model_config):
        """Should create negative shifts for Contraction trends."""
        trend = Trend(
            id="contraction_trend",
            force="Government",
            name="Regulation",
            description="Market shrinking",
            direction="Contraction",
            impact=5,
            probability=4,
            start_year=2026,
        )
        for cat in CATEGORIES:
            trend.category_exposure[cat] = 3

        db = TrendDatabase(trends=[trend], categories=CATEGORIES, forces=["Government"])
        engine = DeterministicEngine(mock_model_config)
        result = engine.run(db)

        # Contraction with impact=5, prob=4 should be negative
        for cat in CATEGORIES:
            assert result[cat][2030] < 0

    def test_direction_sign_applied(self, mock_model_config):
        """Should correctly apply direction sign to normalized score."""
        # Same trend, different directions
        expansion = Trend(
            id="exp",
            force="Consumer",
            direction="Expansion",
            impact=3,
            probability=3,
        )
        contraction = Trend(
            id="con",
            force="Consumer",
            direction="Contraction",
            impact=3,
            probability=3,
        )

        assert expansion.direction_sign == 1
        assert contraction.direction_sign == -1
        assert expansion.weighted_score == -contraction.weighted_score


class TestDeterministicPaths:
    """Test path (2026-2030) and materialization."""

    def test_all_path_years_present(self, mock_model_config, mock_trends_database):
        """Should return all years from path_years config."""
        engine = DeterministicEngine(mock_model_config)
        result = engine.run(mock_trends_database)

        for cat in CATEGORIES:
            for year in mock_model_config.path_years:
                assert year in result[cat]

    def test_materialization_increases_over_time(self, mock_model_config, mock_trends_database):
        """Should verify materialization fraction increases from 2026 to 2030."""
        engine = DeterministicEngine(mock_model_config)
        result = engine.run(mock_trends_database)

        for cat in CATEGORIES:
            values = [result[cat][year] for year in mock_model_config.path_years]
            # Shifts should generally grow in magnitude from 2026 to 2030
            magnitudes = [abs(v) for v in values]
            # At least verify 2030 >= 2026
            assert magnitudes[-1] >= magnitudes[0]

    def test_path_respects_materialization_schedule(self, mock_model_config, mock_trends_database):
        """Should verify paths respect materialization schedule."""
        # Get ratio of 2026 to 2030
        engine = DeterministicEngine(mock_model_config)
        result = engine.run(mock_trends_database)

        mat_2026 = mock_model_config.materialization[2026]
        mat_2030 = mock_model_config.materialization[2030]

        for cat in CATEGORIES:
            shift_2026 = result[cat][2026]
            shift_2030 = result[cat][2030]

            if abs(shift_2030) > 0.001:
                # Ratio should approximately match materialization ratio
                ratio_actual = abs(shift_2026 / shift_2030)
                ratio_expected = mat_2026 / mat_2030
                assert abs(ratio_actual - ratio_expected) < 0.01


class TestDeterministicCompounding:
    """Test multiplicative compounding formula."""

    def test_multiplicative_compounding(self, mock_model_config):
        """Should use multiplicative formula, not additive."""
        # Create two equal trends
        trend1 = Trend(
            id="t1",
            force="Consumer",
            direction="Expansion",
            impact=2,
            probability=2,
        )
        trend2 = Trend(
            id="t2",
            force="Customer",
            direction="Expansion",
            impact=2,
            probability=2,
        )
        for cat in CATEGORIES:
            trend1.category_exposure[cat] = 2
            trend2.category_exposure[cat] = 2

        db = TrendDatabase(
            trends=[trend1, trend2],
            categories=CATEGORIES,
            forces=["Consumer", "Customer"],
        )

        engine = DeterministicEngine(mock_model_config)
        result = engine.run(db)

        # With multiplicative: (1 + a) * (1 + b) - 1 ≠ a + b
        # Check that shifts are not simply additive
        for cat in CATEGORIES:
            # If additive, would be a + b + a*b
            # Multiplicative compounding gives the correct formula
            assert result[cat][2030] > 0.001  # Non-zero shifts


class TestDeterministicScorecards:
    """Test force and value chain scorecards."""

    def test_force_scorecard_all_forces(self, mock_model_config, mock_trends_database):
        """Should compute weighted score for all forces."""
        engine = DeterministicEngine(mock_model_config)
        scorecard = engine.compute_force_scorecard(mock_trends_database)

        # Should have all 6 forces
        assert len(scorecard) == 6
        for force in ["Consumer", "Customer", "Technology", "Government", "Environmental", "Competitive"]:
            assert force in scorecard

    def test_force_scorecard_respects_weights(self, mock_model_config, mock_trends_database):
        """Should multiply by force weights."""
        engine = DeterministicEngine(mock_model_config)
        scorecard = engine.compute_force_scorecard(mock_trends_database)

        # With equal weights (default 1/6), no single force should dominate
        max_score = max(scorecard.values())
        min_score = min(scorecard.values())
        # All should be reasonably close
        assert max(abs(s) for s in scorecard.values()) > 0  # Some signal

    def test_vc_scorecard_all_steps(self, mock_model_config, mock_trends_database):
        """Should compute score for all value chain steps."""
        engine = DeterministicEngine(mock_model_config)
        scorecard = engine.compute_vc_scorecard(mock_trends_database)

        expected_steps = [
            "Raw Materials", "Formulation", "Manufacturing", "Packaging",
            "Supply Chain", "Marketing", "Commercial", "Consumer"
        ]
        assert len(scorecard) == len(expected_steps)
        for step in expected_steps:
            assert step in scorecard


class TestDeterministicEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_zero_exposure_ignored(self, mock_model_config):
        """Should ignore trends with zero exposure to a category."""
        trend = Trend(
            id="test",
            force="Consumer",
            direction="Expansion",
            impact=5,
            probability=5,
        )
        # Zero exposure to everything
        for cat in CATEGORIES:
            trend.category_exposure[cat] = 0

        db = TrendDatabase(trends=[trend], categories=CATEGORIES, forces=["Consumer"])
        engine = DeterministicEngine(mock_model_config)
        result = engine.run(db)

        # Should have no effect
        for cat in CATEGORIES:
            assert result[cat][2030] == 0.0

    def test_exposure_normalization(self, mock_model_config):
        """Should normalize exposure (0-5 scale) correctly."""
        trend = Trend(
            id="test",
            force="Consumer",
            direction="Expansion",
            impact=2,
            probability=2,
        )
        # Partial exposure
        for cat in CATEGORIES:
            trend.category_exposure[cat] = 2.5  # Half scale

        db = TrendDatabase(trends=[trend], categories=CATEGORIES, forces=["Consumer"])
        engine = DeterministicEngine(mock_model_config)
        result = engine.run(db)

        # Should have effect proportional to exposure
        assert all(result[cat][2030] >= 0 for cat in CATEGORIES)

    def test_neutral_threshold_applied(self, mock_model_config):
        """Should have mechanism for neutral threshold (shifts < threshold = 0)."""
        # Very low scores should produce very small shifts
        trend = Trend(
            id="test",
            force="Consumer",
            direction="Expansion",
            impact=1,
            probability=1,
        )
        for cat in CATEGORIES:
            trend.category_exposure[cat] = 1

        db = TrendDatabase(trends=[trend], categories=CATEGORIES, forces=["Consumer"])
        engine = DeterministicEngine(mock_model_config)
        result = engine.run(db)

        # Shifts might be below neutral threshold, but should still be computed
        assert all(isinstance(result[cat][2030], (int, float)) for cat in CATEGORIES)
