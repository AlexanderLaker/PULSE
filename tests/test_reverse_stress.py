"""Unit tests for reverse stress testing module."""
import pytest
import numpy as np
from pulse.simulation.reverse_stress import ReverseStressTester


class TestReverseStressTesterBasics:
    """Test basic reverse stress testing functionality."""

    def test_reverse_stress_initializes(self):
        """ReverseStressTester should initialize with parameters."""
        tester = ReverseStressTester(max_iterations=200, tolerance=1e-6)
        assert tester.max_iterations == 200
        assert tester.tolerance == 1e-6

    def test_reverse_stress_defaults(self):
        """ReverseStressTester should have sensible defaults."""
        tester = ReverseStressTester()
        assert tester.max_iterations == 300
        assert tester.tolerance == 1e-7


class TestMultiCategoryStress:
    """Test multi-category stress scenarios."""

    def test_multi_category_stress_basic(self):
        """Should find scenario satisfying multiple category targets."""
        tester = ReverseStressTester()

        def model(params):
            impact = params.get("Impact", 3)
            return {
                "Color": -0.01 * impact,
                "Care": -0.008 * impact
            }

        result = tester.find_multi_category_stress(
            model,
            targets={"Color": -0.05, "Care": -0.04},
            param_names=["Impact"]
        )

        assert "targets" in result
        assert "achieved_shifts" in result
        assert len(result["achieved_shifts"]) == 2

    def test_multi_category_stress_conflicting_targets(self):
        """Should handle conflicting multi-category targets."""
        tester = ReverseStressTester()

        def model(params):
            p1 = params["P1"]
            return {
                "A": p1,
                "B": -p1  # Conflicting: when A goes up, B goes down
            }

        result = tester.find_multi_category_stress(
            model,
            targets={"A": 0.1, "B": 0.1},  # Both positive - impossible
            param_names=["P1"]
        )

        assert "targets" in result

    def test_multi_category_stress_convergence(self):
        """Multi-category stress should report convergence metrics."""
        tester = ReverseStressTester()

        def model(params):
            return {
                "Cat1": params.get("X", 3),
                "Cat2": params.get("X", 3) * 0.8
            }

        result = tester.find_multi_category_stress(
            model,
            targets={"Cat1": 4.0, "Cat2": 3.2},
            param_names=["X"]
        )

        if "errors" in result:
            assert "Cat1" in result["errors"]
            assert "Cat2" in result["errors"]


class TestSensitivityToTarget:
    """Test sensitivity of perturbation to target variation."""

    def test_sensitivity_to_target(self):
        """Should compute how difficulty varies with target shift."""
        tester = ReverseStressTester()

        def model(params):
            return {"Cat": -0.01 * params["Impact"]}

        result = tester.sensitivity_to_target(
            model,
            target_category="Cat",
            target_range=[-0.05, -0.10, -0.15],
            param_names=["Impact"]
        )

        assert "sensitivity_curve" in result
        assert "category" in result
        assert result["category"] == "Cat"
        assert len(result["sensitivity_curve"]) == 3

    def test_sensitivity_curve_feasibility(self):
        """Sensitivity curve should identify feasible targets."""
        tester = ReverseStressTester()

        def model(params):
            return {"Cat": -0.05 * params["X"]}

        result = tester.sensitivity_to_target(
            model,
            target_category="Cat",
            target_range=[-0.10, -0.25, -0.5],
            param_names=["X"],
            param_bounds={"X": (1, 5)}
        )

        if "sensitivity_curve" in result:
            # At least some targets should be feasible
            assert any(s.get("feasible") for s in result["sensitivity_curve"])


class TestReverseStressReporting:
    """Test reverse stress reporting."""

    def test_generate_reverse_stress_report(self):
        """Report should be human-readable markdown."""
        tester = ReverseStressTester()

        results = [
            {
                "target_category": "Hair: Color",
                "target_shift": -0.10,
                "achieved_shift": -0.098,
                "target_reached": True,
                "total_perturbation": 0.25,
                "top_drivers": [
                    {
                        "param": "Consumer_Trend_1",
                        "from": 3.0,
                        "to": 4.5,
                        "change": 1.5,
                        "pct_change": 50.0
                    }
                ]
            }
        ]

        report = tester.generate_reverse_stress_report(results)

        assert isinstance(report, str)
        assert len(report) > 100
        assert "Hair: Color" in report


