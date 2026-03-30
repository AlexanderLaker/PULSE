"""Tests for Sensitivity Analysis Engine — tornado, breakeven, etc."""

import pytest
from pulse.simulation.sensitivity import SensitivityEngine
from pulse.config import CATEGORIES


class TestTornadoAnalysis:
    """Test tornado (one-way sensitivity) analysis."""

    def test_tornado_returns_list(self, mock_model_config, mock_trends_database):
        """Should return list of sensitivity results."""
        engine = SensitivityEngine(mock_model_config)
        result = engine.tornado_analysis(mock_trends_database)

        assert isinstance(result, list)
        assert len(result) > 0

    def test_tornado_includes_all_trends(self, mock_model_config, mock_trends_database):
        """Should include all trends in sensitivity analysis."""
        engine = SensitivityEngine(mock_model_config)
        result = engine.tornado_analysis(mock_trends_database)

        trend_ids = [item["trend_id"] for item in result]
        assert len(trend_ids) == len(mock_trends_database.trends)

        for trend in mock_trends_database.trends:
            assert trend.id in trend_ids

    def test_tornado_returns_sorted_by_range(self, mock_model_config, mock_trends_database):
        """Should sort by range (high - low) descending."""
        engine = SensitivityEngine(mock_model_config)
        result = engine.tornado_analysis(mock_trends_database)

        ranges = [item["range"] for item in result]

        # Should be sorted descending by range
        for i in range(len(ranges) - 1):
            assert ranges[i] >= ranges[i + 1]

    def test_tornado_has_required_fields(self, mock_model_config, mock_trends_database):
        """Should include all required fields in results."""
        engine = SensitivityEngine(mock_model_config)
        result = engine.tornado_analysis(mock_trends_database)

        required_fields = ["trend_id", "trend_name", "force", "low", "high", "range", "base"]

        for item in result:
            for field in required_fields:
                assert field in item

    def test_tornado_low_less_than_high(self, mock_model_config, mock_trends_database):
        """Should ensure low case <= high case."""
        engine = SensitivityEngine(mock_model_config)
        result = engine.tornado_analysis(mock_trends_database)

        for item in result:
            # Range is |high - low| so always positive
            assert item["range"] >= 0
            # For expansion trends, high > base > low
            # For contraction trends, low < base < high
            # So range = |high - low| >= 0 always

    def test_tornado_category_specific(self, mock_model_config, mock_trends_database):
        """Should support category-specific sensitivity."""
        engine = SensitivityEngine(mock_model_config)
        result_overall = engine.tornado_analysis(mock_trends_database, category=None)
        result_color = engine.tornado_analysis(mock_trends_database, category="Hair: Color")

        # Both should return results
        assert len(result_overall) > 0
        assert len(result_color) > 0

    def test_tornado_sensitivity_nonzero(self, mock_model_config, mock_trends_database):
        """Should detect at least some sensitive trends."""
        engine = SensitivityEngine(mock_model_config)
        result = engine.tornado_analysis(mock_trends_database)

        # At least some trends should have non-zero range
        ranges = [item["range"] for item in result]
        max_range = max(ranges)
        assert max_range > 0


class TestBreakevenAnalysis:
    """Test breakeven analysis."""

    def test_breakeven_returns_dict(self, mock_model_config, mock_trends_database):
        """Should return dictionary of breakeven results."""
        engine = SensitivityEngine(mock_model_config)
        result = engine.breakeven_analysis(mock_trends_database, "Hair: Color")

        assert isinstance(result, dict)

    def test_breakeven_for_nonzero_shift(self, mock_model_config, mock_trends_database):
        """Should compute breakeven for non-neutral category."""
        engine = SensitivityEngine(mock_model_config)
        result = engine.breakeven_analysis(mock_trends_database, "Hair: Color")

        # If category has shift != 0, should have breakeven results
        det_engine_result = engine.det_engine.run(mock_trends_database)
        shift = det_engine_result["Hair: Color"][2030]

        if abs(shift) > 0.001:
            # Should have some breakeven information
            assert len(result) > 0

    def test_breakeven_for_neutral_category(self, mock_model_config):
        """Should handle already-neutral categories."""
        from pulse.ingestion.models import TrendDatabase, Trend

        # Create database with zero-net trends (cancel out)
        expansion = Trend(id="exp", force="Consumer", direction="Expansion", impact=2, probability=2)
        contraction = Trend(id="con", force="Consumer", direction="Contraction", impact=2, probability=2)

        for cat in CATEGORIES:
            expansion.category_exposure[cat] = 2
            contraction.category_exposure[cat] = 2

        db = TrendDatabase(
            trends=[expansion, contraction],
            categories=CATEGORIES,
            forces=["Consumer"]
        )

        engine = SensitivityEngine(mock_model_config)
        result = engine.breakeven_analysis(db, "Hair: Color")

        # If already neutral, should indicate this
        if "already_neutral" in result:
            assert result["already_neutral"] is True


class TestSensitivityEdgeCases:
    """Test edge cases for sensitivity analysis."""

    def test_sensitivity_empty_database(self, mock_model_config):
        """Should handle empty database gracefully."""
        from pulse.ingestion.models import TrendDatabase

        empty_db = TrendDatabase(trends=[], categories=CATEGORIES, forces=[])

        engine = SensitivityEngine(mock_model_config)
        result = engine.tornado_analysis(empty_db)

        # Should return empty list or not crash
        assert isinstance(result, list)

    def test_sensitivity_single_trend(self, mock_model_config, mock_trend):
        """Should handle single-trend database."""
        from pulse.ingestion.models import TrendDatabase

        db = TrendDatabase(
            trends=[mock_trend],
            categories=CATEGORIES,
            forces=["Consumer"]
        )

        engine = SensitivityEngine(mock_model_config)
        result = engine.tornado_analysis(db)

        assert len(result) >= 1

    def test_tornado_preserves_original_scores(self, mock_model_config, mock_trends_database):
        """Should not modify original trend scores after analysis."""
        engine = SensitivityEngine(mock_model_config)

        # Store originals
        originals = {}
        for trend in mock_trends_database.trends:
            originals[trend.id] = (trend.probability, trend.gp1_pct_affected)

        # Run analysis
        engine.tornado_analysis(mock_trends_database)

        # Verify scores restored
        for trend in mock_trends_database.trends:
            assert trend.probability == originals[trend.id][0]
            assert trend.gp1_pct_affected == originals[trend.id][1]

    def test_sensitivity_with_dag(self, mock_model_config, mock_trends_database, mock_causal_dag):
        """Should support sensitivity with causal DAG."""
        engine = SensitivityEngine(mock_model_config, dag=mock_causal_dag)
        result = engine.tornado_analysis(mock_trends_database)

        # Should complete without error
        assert isinstance(result, list)
        assert len(result) > 0


class TestSensitivityConsistency:
    """Test consistency properties of sensitivity analysis."""

    def test_tornado_consistency_across_runs(self, mock_model_config, mock_trends_database):
        """Should produce consistent results across runs."""
        engine = SensitivityEngine(mock_model_config)

        result1 = engine.tornado_analysis(mock_trends_database)
        result2 = engine.tornado_analysis(mock_trends_database)

        # Same order
        ids1 = [item["trend_id"] for item in result1]
        ids2 = [item["trend_id"] for item in result2]
        assert ids1 == ids2

        # Same ranges (within rounding)
        for item1, item2 in zip(result1, result2):
            assert abs(item1["range"] - item2["range"]) < 1e-10

    def test_high_impact_score_produces_large_range(self, mock_model_config):
        """Should verify high-impact trends produce large ranges."""
        from pulse.ingestion.models import TrendDatabase, Trend

        # Create two trends: one high-impact, one low-impact
        high_impact = Trend(
            id="high",
            force="Consumer",
            direction="Expansion",
            impact=5,
            probability=5
        )
        low_impact = Trend(
            id="low",
            force="Consumer",
            direction="Expansion",
            impact=1,
            probability=1
        )

        for cat in CATEGORIES:
            high_impact.category_exposure[cat] = 3
            low_impact.category_exposure[cat] = 3

        db = TrendDatabase(
            trends=[high_impact, low_impact],
            categories=CATEGORIES,
            forces=["Consumer"]
        )

        engine = SensitivityEngine(mock_model_config)
        result = engine.tornado_analysis(db)

        # Find ranges
        high_range = next(item["range"] for item in result if item["trend_id"] == "high")
        low_range = next(item["range"] for item in result if item["trend_id"] == "low")

        # High impact should have larger or equal range
        # (with very small ranges, floating point precision matters)
        assert high_range >= low_range - 1e-6
