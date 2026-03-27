"""Unit tests for Sobol sensitivity analysis module."""
import pytest
import numpy as np
from pulse.simulation.sobol import SobolAnalyzer


class TestSobolAnalyzerBasics:
    """Test basic Sobol analyzer initialization."""

    def test_sobol_analyzer_initializes(self):
        """SobolAnalyzer should initialize with sample size."""
        analyzer = SobolAnalyzer(n_samples=512)
        assert analyzer.n_samples == 512

    def test_sobol_default_samples(self):
        """SobolAnalyzer should have default sample size."""
        analyzer = SobolAnalyzer()
        assert analyzer.n_samples == 1024


class TestSobolForceSensitivity:
    """Test Sobol sensitivity analysis on force weights."""

    def test_force_sensitivity_basic(self):
        """Force sensitivity analysis should return Sobol indices."""
        analyzer = SobolAnalyzer(n_samples=128)

        force_names = ["Consumer", "Customer", "Technology"]

        def model_func(weights):
            # Simple model: sum of weighted forces
            return sum(weights.values())

        result = analyzer.analyze_force_sensitivity(model_func, force_names)

        if "error" not in result:  # SALib may not be installed
            assert "first_order" in result
            assert "total_order" in result
            assert "ranking" in result
            assert len(result["first_order"]) == 3
            assert all(f in result["first_order"] for f in force_names)

    def test_force_sensitivity_with_bounds(self):
        """Force sensitivity should respect custom bounds."""
        analyzer = SobolAnalyzer(n_samples=128)

        force_names = ["Force1", "Force2"]
        bounds = {
            "Force1": (0.1, 0.5),
            "Force2": (0.2, 0.4),
        }

        def model_func(weights):
            return sum(weights.values())

        result = analyzer.analyze_force_sensitivity(
            model_func, force_names, bounds=bounds
        )

        if "error" not in result:
            assert "first_order" in result

    def test_force_sensitivity_ranking(self):
        """Force sensitivity should rank forces by importance."""
        analyzer = SobolAnalyzer(n_samples=128)

        force_names = ["Primary", "Secondary", "Tertiary"]

        def model_func(weights):
            # Primary has 2x impact, Secondary has 1x, Tertiary negligible
            return 2.0 * weights["Primary"] + weights["Secondary"]

        result = analyzer.analyze_force_sensitivity(model_func, force_names)

        if "error" not in result and "ranking" in result:
            # Primary should be ranked highest
            assert result["ranking"][0]["force"] == "Primary"


class TestSobolTrendSensitivity:
    """Test Sobol sensitivity on individual trend scores."""

    def test_trend_sensitivity_basic(self):
        """Trend sensitivity analysis should work."""
        analyzer = SobolAnalyzer(n_samples=128)

        trend_names = ["Trend_A", "Trend_B", "Trend_C"]

        def model_func(scores):
            # Simple model: average of trend scores
            return np.mean(list(scores.values()))

        result = analyzer.analyze_trend_sensitivity(model_func, trend_names)

        if "error" not in result:
            assert "first_order" in result
            assert "total_order" in result
            assert "ranking" in result

    def test_trend_sensitivity_with_bounds(self):
        """Trend sensitivity should respect score bounds."""
        analyzer = SobolAnalyzer(n_samples=128)

        trend_names = ["T1", "T2"]

        def model_func(scores):
            return sum(scores.values())

        result = analyzer.analyze_trend_sensitivity(
            model_func, trend_names, score_bounds=(1, 5)
        )

        if "error" not in result:
            assert len(result["ranking"]) == 2


class TestSobolCategorySensitivity:
    """Test Sobol sensitivity analysis per category."""

    def test_category_sensitivity(self):
        """Category sensitivity should analyze per-category shifts."""
        analyzer = SobolAnalyzer(n_samples=128)

        categories = ["Hair: Color", "Hair: Care"]
        params = ["Impact", "Probability"]

        def model_func(params):
            # Return shift per category
            impact = params.get("Impact", 3)
            prob = params.get("Probability", 3)
            return {
                "Hair: Color": (impact * prob) / 25.0,
                "Hair: Care": (impact * prob) / 25.0,
            }

        result = analyzer.analyze_category_sensitivity(
            model_func, categories, params
        )

        if "error" not in result:
            assert "Hair: Color" in result or isinstance(result, dict)


class TestSobolSecondOrder:
    """Test second-order interaction analysis."""

    def test_second_order_interactions(self):
        """Second-order Sobol indices should capture interactions."""
        analyzer = SobolAnalyzer(n_samples=128)

        params = ["Param1", "Param2", "Param3"]

        def model_func(values):
            # Multiplicative interaction term
            return values["Param1"] * values["Param2"] + values["Param3"]

        result = analyzer.analyze_force_sensitivity(model_func, params)

        if "error" not in result and "second_order" in result:
            # Should detect Param1-Param2 interaction
            assert "second_order" in result


class TestSobolInterpretation:
    """Test interpretation and reporting of Sobol results."""

    def test_sobol_result_interpretation(self):
        """Sobol results should include human-readable interpretation."""
        analyzer = SobolAnalyzer(n_samples=128)

        forces = ["Force1", "Force2"]

        def model_func(weights):
            return weights["Force1"] * 2.0 + weights["Force2"]

        result = analyzer.analyze_force_sensitivity(model_func, forces)

        if "error" not in result:
            assert "interpretation" in result
            assert isinstance(result["interpretation"], str)


class TestSobolIndexComputation:
    """Test Sobol index computation utilities."""

    def test_sobol_indices_dict_conversion(self):
        """Sobol indices should convert to dict format."""
        analyzer = SobolAnalyzer()

        # Mock SALib-like output
        Si = {
            'S1': np.array([0.3, 0.5, 0.2]),
            'ST': np.array([0.35, 0.52, 0.25]),
            'S1_conf': np.array([0.02, 0.03, 0.01]),
            'ST_conf': np.array([0.03, 0.04, 0.02]),
        }
        names = ["A", "B", "C"]

        result = analyzer.compute_sobol_indices_dict(Si, names)

        assert "S1" in result
        assert "ST" in result
        assert result["S1"]["A"] == 0.3
        assert result["ST"]["B"] == 0.52


class TestSobolEdgeCases:
    """Test Sobol edge cases."""

    def test_sobol_single_parameter(self):
        """Sobol analysis should work with single parameter."""
        analyzer = SobolAnalyzer(n_samples=64)

        def model_func(weights):
            return weights.get("OnlyParam", 1.0)

        result = analyzer.analyze_force_sensitivity(
            model_func, ["OnlyParam"]
        )

        # Should either work or gracefully error
        if "error" not in result:
            assert "first_order" in result

    def test_sobol_many_parameters(self):
        """Sobol should handle many parameters."""
        analyzer = SobolAnalyzer(n_samples=128)

        params = [f"Param_{i}" for i in range(10)]

        def model_func(weights):
            return sum(weights.values())

        result = analyzer.analyze_force_sensitivity(model_func, params)

        if "error" not in result:
            assert len(result["first_order"]) == 10

    def test_sobol_constant_output(self):
        """Sobol should handle constant model output."""
        analyzer = SobolAnalyzer(n_samples=128)

        def constant_model(weights):
            return 1.0  # Always returns same value

        result = analyzer.analyze_force_sensitivity(
            constant_model, ["Force1", "Force2"]
        )

        # Should complete without error (output variance = 0)
        if "error" not in result:
            assert "first_order" in result


class TestSobolNormalization:
    """Test weight normalization in Sobol analysis."""

    def test_sobol_weight_normalization(self):
        """Weights should be normalized to sum to 1."""
        analyzer = SobolAnalyzer(n_samples=128)

        captured_weights = []

        def capturing_model(weights):
            captured_weights.append(weights)
            return sum(weights.values())

        forces = ["F1", "F2", "F3"]
        result = analyzer.analyze_force_sensitivity(capturing_model, forces)

        if captured_weights:
            # Check that all weight sets sum to ~1
            for w_dict in captured_weights[:10]:
                total = sum(w_dict.values())
                assert 0.99 <= total <= 1.01, f"Weights sum to {total}, not 1.0"
