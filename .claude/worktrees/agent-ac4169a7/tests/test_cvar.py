"""Unit tests for CVaR (Conditional Value-at-Risk) analysis module."""
import pytest
import numpy as np
from pulse.simulation.cvar import CVaRAnalyzer


class TestCVaRBasics:
    """Test basic CVaR computation."""

    def test_cvar_analyzer_initializes(self):
        """CVaRAnalyzer should initialize with confidence level."""
        analyzer = CVaRAnalyzer(confidence_level=0.95)
        assert analyzer.confidence_level == 0.95

    def test_compute_cvar_normal_distribution(self):
        """CVaR should compute correctly on normal distribution."""
        analyzer = CVaRAnalyzer(confidence_level=0.95)
        np.random.seed(42)
        samples = np.random.normal(-0.02, 0.03, 10000)
        result = analyzer.compute_cvar(samples)

        assert "var" in result
        assert "cvar" in result
        assert result["confidence_level"] == 0.95
        assert result["n_tail_samples"] > 0
        # CVaR should be more extreme than VaR
        assert abs(result["cvar"]) >= abs(result["var"])

    def test_compute_cvar_uniform_distribution(self):
        """CVaR should work on uniform distribution."""
        analyzer = CVaRAnalyzer(confidence_level=0.90)
        samples = np.linspace(-0.1, 0.1, 1000)
        result = analyzer.compute_cvar(samples)

        assert result["cvar"] <= result["var"]
        assert result["n_tail_samples"] >= 99  # ~10% of 1000 (±1 for rounding)

    def test_cvar_with_custom_alpha(self):
        """CVaR should accept custom confidence levels."""
        analyzer = CVaRAnalyzer(confidence_level=0.95)
        np.random.seed(123)
        samples = np.random.normal(0, 1, 10000)

        result_95 = analyzer.compute_cvar(samples, confidence_level=0.95)
        result_90 = analyzer.compute_cvar(samples, confidence_level=0.90)

        # Both should have valid CVaR values
        assert result_95["cvar"] is not None
        assert result_90["cvar"] is not None
        # Larger confidence level (95%) includes smaller tail
        assert result_95["n_tail_samples"] < result_90["n_tail_samples"]

    def test_cvar_tail_statistics(self):
        """CVaR result should include tail statistics."""
        analyzer = CVaRAnalyzer(confidence_level=0.95)
        samples = np.random.normal(-0.05, 0.02, 5000)
        result = analyzer.compute_cvar(samples)

        assert "tail_mean" in result
        assert "tail_std" in result
        assert "tail_min" in result
        assert "tail_max" in result
        assert result["tail_min"] <= result["tail_mean"] <= result["tail_max"]


class TestPortfolioCVaR:
    """Test portfolio-level CVaR calculation."""

    def test_portfolio_cvar_basic(self):
        """Portfolio CVaR should aggregate category samples."""
        analyzer = CVaRAnalyzer(confidence_level=0.95)
        np.random.seed(42)

        samples = {
            "Hair: Color": np.random.normal(-0.05, 0.03, 5000),
            "Hair: Care": np.random.normal(-0.02, 0.025, 5000),
            "LHC: FCN": np.random.normal(-0.03, 0.02, 5000),
        }

        result = analyzer.compute_portfolio_cvar(samples)

        assert "category_cvar" in result
        assert "portfolio_cvar" in result
        assert "risk_contributions" in result
        assert len(result["category_cvar"]) == 3
        assert len(result["risk_contributions"]) == 3

    def test_portfolio_cvar_equal_weights(self):
        """Portfolio CVaR with equal weights should be balanced."""
        analyzer = CVaRAnalyzer(confidence_level=0.95)
        np.random.seed(42)

        samples = {
            "Cat1": np.random.normal(-0.05, 0.03, 5000),
            "Cat2": np.random.normal(-0.05, 0.03, 5000),
        }

        result = analyzer.compute_portfolio_cvar(samples)

        # Risk contributions should be roughly balanced
        contrib1 = abs(result["risk_contributions"]["Cat1"])
        contrib2 = abs(result["risk_contributions"]["Cat2"])
        assert 0.3 < contrib1 / (contrib1 + contrib2) < 0.7

    def test_portfolio_cvar_custom_weights(self):
        """Portfolio CVaR should respect custom allocation weights."""
        analyzer = CVaRAnalyzer(confidence_level=0.95)
        np.random.seed(42)

        samples = {
            "Cat1": np.random.normal(-0.05, 0.03, 5000),
            "Cat2": np.random.normal(-0.02, 0.02, 5000),
        }

        weights = {"Cat1": 0.7, "Cat2": 0.3}
        result = analyzer.compute_portfolio_cvar(samples, weights=weights)

        assert result["weights_used"]["Cat1"] == 0.7
        assert result["weights_used"]["Cat2"] == 0.3

    def test_diversification_ratio(self):
        """Diversification ratio should be >1 for uncorrelated assets."""
        analyzer = CVaRAnalyzer(confidence_level=0.95)
        np.random.seed(42)

        # Uncorrelated samples
        samples = {
            "Cat1": np.random.normal(-0.05, 0.03, 5000),
            "Cat2": np.random.normal(-0.05, 0.03, 5000),
            "Cat3": np.random.normal(-0.05, 0.03, 5000),
        }

        result = analyzer.compute_portfolio_cvar(samples)

        # Diversification benefit should exist
        assert result["diversification_ratio"] > 1.0


class TestCVaRStressDecomposition:
    """Test CVaR decomposition by force attribution."""

    def test_cvar_stress_decomposition_basic(self):
        """CVaR stress decomposition should identify dominant forces in tail."""
        analyzer = CVaRAnalyzer(confidence_level=0.95)
        np.random.seed(42)

        samples = {
            "Hair: Color": np.random.normal(-0.05, 0.03, 5000),
            "Hair: Care": np.random.normal(-0.03, 0.02, 5000),
        }

        force_attributions = {
            "Hair: Color": {
                "Consumer": np.random.normal(-0.03, 0.02, 5000),
                "Government": np.random.normal(-0.02, 0.01, 5000),
            },
            "Hair: Care": {
                "Consumer": np.random.normal(-0.02, 0.015, 5000),
                "Government": np.random.normal(-0.01, 0.01, 5000),
            }
        }

        result = analyzer.cvar_stress_decomposition(samples, force_attributions)

        assert "category_force_decomposition" in result
        assert "dominant_forces_in_tail" in result
        assert "Hair: Color" in result["category_force_decomposition"]

    def test_cvar_stress_without_attribution_error(self):
        """CVaR stress decomposition should fail gracefully without attributions."""
        analyzer = CVaRAnalyzer(confidence_level=0.95)
        samples = {
            "Cat1": np.random.normal(0, 1, 1000),
        }

        result = analyzer.cvar_stress_decomposition(samples)

        assert "error" in result


class TestCVaRScenarioComparison:
    """Test CVaR across multiple scenarios."""

    def test_cvar_by_scenario(self):
        """CVaR comparison should rank scenarios by severity."""
        analyzer = CVaRAnalyzer(confidence_level=0.95)
        np.random.seed(42)

        scenario_samples = {
            "Base Case": {
                "Cat1": np.random.normal(-0.02, 0.02, 5000),
                "Cat2": np.random.normal(-0.02, 0.02, 5000),
            },
            "Stress": {
                "Cat1": np.random.normal(-0.08, 0.04, 5000),
                "Cat2": np.random.normal(-0.08, 0.04, 5000),
            },
            "Bull": {
                "Cat1": np.random.normal(0.03, 0.02, 5000),
                "Cat2": np.random.normal(0.03, 0.02, 5000),
            }
        }

        result = analyzer.cvar_by_scenario(scenario_samples)

        assert "by_scenario" in result
        assert "ranking" in result
        assert len(result["ranking"]) == 3
        # Stress should be more risky (more negative CVaR) than Base
        stress_cvar = result["by_scenario"]["Stress"]["portfolio_cvar"]["cvar"]
        base_cvar = result["by_scenario"]["Base Case"]["portfolio_cvar"]["cvar"]
        assert stress_cvar <= base_cvar


class TestCVaRReporting:
    """Test CVaR reporting functionality."""

    def test_generate_cvar_report(self):
        """CVaR report should be human-readable markdown."""
        analyzer = CVaRAnalyzer(confidence_level=0.95)
        np.random.seed(42)

        samples = {
            "Cat1": np.random.normal(-0.05, 0.03, 5000),
            "Cat2": np.random.normal(-0.03, 0.02, 5000),
        }

        portfolio = analyzer.compute_portfolio_cvar(samples)
        report = analyzer.generate_cvar_report(portfolio)

        assert isinstance(report, str)
        assert "CVaR" in report or "Risk" in report
        assert len(report) > 100


class TestCVaREdgeCases:
    """Test CVaR edge cases."""

    def test_single_sample(self):
        """CVaR should handle single sample."""
        analyzer = CVaRAnalyzer()
        samples = np.array([-0.05])
        result = analyzer.compute_cvar(samples)

        assert result["var"] == -0.05
        assert result["cvar"] == -0.05

    def test_all_identical_samples(self):
        """CVaR should handle identical samples."""
        analyzer = CVaRAnalyzer()
        samples = np.array([-0.05] * 1000)
        result = analyzer.compute_cvar(samples)

        assert np.isclose(result["var"], -0.05)
        assert np.isclose(result["cvar"], -0.05)
        assert np.isclose(result["tail_std"], 0.0)

    def test_empty_risk_contributions(self):
        """Portfolio CVaR should handle zero risk."""
        analyzer = CVaRAnalyzer()
        samples = {"Cat1": np.array([0.0] * 100)}
        result = analyzer.compute_portfolio_cvar(samples)

        assert "risk_contributions" in result
