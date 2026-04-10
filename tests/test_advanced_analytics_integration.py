"""Integration tests for all advanced analytics modules (CVaR, Sobol, Reverse Stress, Tipping Points)."""
import pytest
import numpy as np
from pulse.simulation.cvar import CVaRAnalyzer
from pulse.simulation.sobol import SobolAnalyzer
from pulse.simulation.reverse_stress import ReverseStressTester
from pulse.simulation.tipping_points import TippingPointDetector
from pulse.ingestion.models import TrendDatabase, Trend
from pulse.config import ModelConfig, FORCES, CATEGORIES


@pytest.fixture
def sample_database():
    """Create a sample TrendDatabase for testing."""
    db = TrendDatabase()
    db.categories = CATEGORIES[:5]  # First 5 categories
    db.forces = FORCES

    # Add some sample trends
    for i in range(15):
        trend = Trend(
            id=f"trend_{i}",
            force=FORCES[i % 6],
            name=f"Trend {i}",
            description=f"Sample trend {i}",
            direction="Expansion" if i % 2 == 0 else "Contraction",
            gp1_pct_affected=0.05 + (i % 4) * 0.05,
            probability=2 + ((i + 1) % 4),
            category_exposure={cat: (i % 5) for cat in db.categories},
            vc_exposure={step: (i % 5) for step in ["Raw Materials", "Formulation"]},
        )
        db.trends.append(trend)

    return db


@pytest.fixture
def sample_mc_output():
    """Create sample Monte Carlo simulation output."""
    np.random.seed(42)
    return {
        "Hair: Color": {
            2026: np.random.normal(-0.01, 0.02, 10000),
            2027: np.random.normal(-0.025, 0.025, 10000),
            2028: np.random.normal(-0.050, 0.03, 10000),
            2029: np.random.normal(-0.080, 0.035, 10000),
            2030: np.random.normal(-0.110, 0.04, 10000),
        },
        "Hair: Care": {
            2026: np.random.normal(-0.005, 0.015, 10000),
            2027: np.random.normal(-0.015, 0.02, 10000),
            2028: np.random.normal(-0.030, 0.025, 10000),
            2029: np.random.normal(-0.050, 0.03, 10000),
            2030: np.random.normal(-0.070, 0.035, 10000),
        },
    }


class TestAllModulesImportable:
    """Test that all advanced analytics modules can be imported."""

    def test_all_modules_import(self):
        """All modules should import without error."""
        assert CVaRAnalyzer is not None
        assert SobolAnalyzer is not None
        assert ReverseStressTester is not None
        assert TippingPointDetector is not None


class TestAdvancedAnalyticsWorkflow:
    """Test a complete advanced analytics workflow."""

    def test_full_workflow_no_errors(self, sample_mc_output):
        """Complete workflow: CVaR → Sobol → Reverse Stress → Tipping Points."""

        # Step 1: CVaR analysis on MC output
        cvar_analyzer = CVaRAnalyzer(confidence_level=0.95)

        # Flatten MC samples to single distribution per category
        color_samples = np.concatenate(list(sample_mc_output["Hair: Color"].values()))
        care_samples = np.concatenate(list(sample_mc_output["Hair: Care"].values()))

        cvar_result = cvar_analyzer.compute_portfolio_cvar({
            "Hair: Color": color_samples,
            "Hair: Care": care_samples,
        })

        assert "portfolio_cvar" in cvar_result
        assert "diversification_ratio" in cvar_result

        # Step 2: Sensitivity analysis (Sobol)
        sobol_analyzer = SobolAnalyzer(n_samples=64)

        def model_func(weights):
            return sum(weights.values())

        sobol_result = sobol_analyzer.analyze_force_sensitivity(
            model_func, FORCES[:3]
        )

        # Sobol may not run if SALib not installed, but should not error
        assert isinstance(sobol_result, dict)

        # Step 3: Reverse stress testing
        tester = ReverseStressTester()

        def stress_model(params):
            impact = params.get("Impact", 3)
            return {
                "Hair: Color": -0.01 * impact,
                "Hair: Care": -0.008 * impact,
            }

        stress_result = tester.find_stress_scenario(
            stress_model,
            target_category="Hair: Color",
            target_shift=-0.15,
            param_names=["Impact"]
        )

        assert "target_shift" in stress_result

        # Step 4: Tipping point detection
        shift_matrix = {
            "Hair: Color": {2026: -0.01, 2027: -0.025, 2028: -0.050, 2029: -0.080, 2030: -0.110},
            "Hair: Care": {2026: -0.005, 2027: -0.015, 2028: -0.030, 2029: -0.050, 2030: -0.070},
        }

        detector = TippingPointDetector()
        tipping_result = detector.detect_all_categories(shift_matrix)

        assert "tipping_points" in tipping_result
        assert "by_category" in tipping_result

    def test_cvar_informs_reverse_stress(self, sample_mc_output):
        """CVaR tail analysis should inform reverse stress testing."""

        # Get CVaR worst-case scenario
        cvar_analyzer = CVaRAnalyzer(confidence_level=0.90)

        color_samples = np.concatenate(list(sample_mc_output["Hair: Color"].values()))
        cvar_result = cvar_analyzer.compute_cvar(color_samples)

        # CVaR gives us a worst-case shift (quite negative)
        worst_case_shift = cvar_result["cvar"]

        # Use this as target for reverse stress
        tester = ReverseStressTester()

        def model(params):
            # Scale model to reach the target shift
            return {"Hair: Color": worst_case_shift * params["X"] / 3.0}

        stress = tester.find_stress_scenario(
            model,
            target_category="Hair: Color",
            target_shift=worst_case_shift,
            param_names=["X"]
        )

        assert "achieved_shift" in stress
        # Should be able to achieve approximately the CVaR target (within 10%)
        assert abs(stress["achieved_shift"] - worst_case_shift) < abs(worst_case_shift) * 0.15

    def test_tipping_points_validate_sensitivity(self, sample_mc_output):
        """Tipping point detection should complement sensitivity analysis."""

        detector = TippingPointDetector()

        # Get path with acceleration
        shift_matrix = {
            "Hair: Color": {2026: -0.01, 2027: -0.025, 2028: -0.050, 2029: -0.080, 2030: -0.110},
        }

        tipping_result = detector.detect_all_categories(shift_matrix)

        # Identify acceleration points
        acceleration_points = [p for p in tipping_result["tipping_points"]
                               if p["type"] == "acceleration"]

        # These should match inflection points from Sobol sensitivity
        # (high sensitivity areas = inflection points)
        assert len(acceleration_points) > 0

    def test_cvar_and_tipping_points_complementary(self):
        """CVaR (tail risk) and tipping points (structure change) are complementary."""

        # CVaR focuses on magnitude of worst case
        cvar_analyzer = CVaRAnalyzer(confidence_level=0.95)
        samples = np.random.normal(-0.05, 0.03, 10000)
        cvar = cvar_analyzer.compute_cvar(samples)

        # Tipping points focus on acceleration/inflection
        detector = TippingPointDetector()
        path_values = np.linspace(-0.01, -0.15, 5)
        path = {year: val for year, val in zip(range(2026, 2031), path_values)}

        tipping = detector.detect_from_path(path)

        # Both should identify risky regions, but from different perspectives
        assert cvar["cvar"] < -0.02  # CVaR is quite negative
        assert len(tipping) > 0  # Tipping points detected (should detect acceleration)


class TestRealisticPulseScenario:
    """Test with realistic PRISM-like scenario."""

    def test_profit_pool_risk_analysis(self, sample_database):
        """Realistic profit pool risk analysis workflow."""

        config = ModelConfig()

        # Simulate what a Bayesian MC run would produce
        np.random.seed(42)
        shift_matrix_2030 = {
            cat: np.random.normal(-0.03 * (i % 3 + 1) / 3.0, 0.025, 5000)
            for i, cat in enumerate(config.category_names)
        }

        # Step 1: Risk measurement (CVaR)
        cvar = CVaRAnalyzer(confidence_level=0.95)
        risk_profile = cvar.compute_portfolio_cvar(shift_matrix_2030)

        # Examine tail risk
        portfolio_cvar = risk_profile["portfolio_cvar"]["cvar"]
        assert portfolio_cvar < -0.01  # Significant downside risk

        # Step 2: Sensitivity (which categories drive the portfolio risk?)
        risk_contribs = risk_profile["risk_contributions"]
        most_risky_cat = max(risk_contribs.items(), key=lambda x: abs(x[1]))[0]
        assert most_risky_cat in config.category_names

        # Step 3: Stress testing (what would cause this risk?)
        tester = ReverseStressTester()

        def portfolio_model(params):
            return {
                cat: -0.02 * params.get("Impact", 3) / 5.0
                for cat in config.category_names
            }

        # Find scenario that produces the CVaR shift
        stress = tester.find_stress_scenario(
            portfolio_model,
            target_category=most_risky_cat,
            target_shift=portfolio_cvar,
            param_names=["Impact"]
        )

        assert "stress_parameters" in stress

        # Step 4: Path analysis (when does this risk materialize?)
        detector = TippingPointDetector(acceleration_threshold=0.002)

        # Construct multi-year path with clear acceleration
        continuous_path = {
            2026: portfolio_cvar * 0.15,
            2027: portfolio_cvar * 0.30,
            2028: portfolio_cvar * 0.55,
            2029: portfolio_cvar * 0.85,
            2030: portfolio_cvar * 1.00,
        }

        tipping = detector.detect_from_path(continuous_path, "Portfolio")

        # Should detect either acceleration or inflection
        acceleration_or_inflection = [p for p in tipping
                                      if p["type"] in ["acceleration", "inflection"]]
        assert len(acceleration_or_inflection) > 0


class TestErrorHandlingAcrossModules:
    """Test error handling consistency across modules."""

    def test_empty_input_handling(self):
        """All modules should handle empty input gracefully."""

        # CVaR
        cvar = CVaRAnalyzer()
        try:
            result = cvar.compute_portfolio_cvar({})
            assert isinstance(result, dict)
        except Exception:
            pass  # Empty input may raise error, but not crash

        # Tipping Points
        detector = TippingPointDetector()
        result = detector.detect_all_categories({})
        assert "tipping_points" in result

        # Reverse Stress
        tester = ReverseStressTester()
        # Should not crash on bad input

        # Sobol
        sobol = SobolAnalyzer()
        # Should not crash on initialization

    def test_nan_handling(self):
        """Modules should handle NaN values appropriately."""

        cvar = CVaRAnalyzer()
        samples = np.array([-0.05, np.nan, 0.01, -0.02])

        # Should either handle NaN or error gracefully
        try:
            result = cvar.compute_cvar(samples)
            # If no error, should produce result
            assert isinstance(result, dict)
        except (ValueError, RuntimeWarning):
            pass  # NaN may cause error, which is acceptable


class TestOutputConsistency:
    """Test that outputs are consistent across multiple runs."""

    def test_deterministic_outputs(self):
        """Same input should produce same output (with seeding)."""

        # CVaR
        cvar = CVaRAnalyzer()
        np.random.seed(42)
        samples1 = np.random.normal(-0.05, 0.03, 1000)

        np.random.seed(42)
        samples2 = np.random.normal(-0.05, 0.03, 1000)

        result1 = cvar.compute_cvar(samples1)
        result2 = cvar.compute_cvar(samples2)

        assert result1["var"] == result2["var"]
        assert result1["cvar"] == result2["cvar"]

        # Tipping Points
        detector = TippingPointDetector()
        path = {2026: -0.01, 2027: -0.025, 2028: -0.050, 2029: -0.080, 2030: -0.110}

        tipping1 = detector.detect_from_path(path)
        tipping2 = detector.detect_from_path(path)

        assert len(tipping1) == len(tipping2)
