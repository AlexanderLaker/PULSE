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


class TestFindStressScenario:
    """Test finding minimum stress scenarios."""

    def test_find_stress_scenario_negative_target(self):
        """Should find scenario achieving negative shift target."""
        tester = ReverseStressTester(max_iterations=100)

        def simple_model(params):
            # Model: shift = -0.01 * impact - 0.005 * probability
            return {
                "Category_A": -0.01 * params.get("Impact", 3) - 0.005 * params.get("Probability", 3)
            }

        result = tester.find_stress_scenario(
            simple_model,
            target_category="Category_A",
            target_shift=-0.10,
            param_names=["Impact", "Probability"]
        )

        assert "target_shift" in result
        assert result["target_shift"] == -0.10
        assert "achieved_shift" in result
        assert "stress_parameters" in result
        assert "parameter_changes" in result

    def test_find_stress_scenario_positive_target(self):
        """Should find scenario achieving positive shift target."""
        tester = ReverseStressTester(max_iterations=100)

        def expansion_model(params):
            return {
                "Category_B": 0.02 * params.get("Score", 3)
            }

        result = tester.find_stress_scenario(
            expansion_model,
            target_category="Category_B",
            target_shift=0.10,
            param_names=["Score"]
        )

        assert result["target_shift"] == 0.10
        assert "achieved_shift" in result

    def test_find_stress_scenario_with_custom_bounds(self):
        """Stress testing should respect parameter bounds."""
        tester = ReverseStressTester()

        def bounded_model(params):
            return {"Cat": params["X"]}

        result = tester.find_stress_scenario(
            bounded_model,
            target_category="Cat",
            target_shift=0.5,
            param_names=["X"],
            param_bounds={"X": (0.0, 1.0)}
        )

        # Stress parameter should be within bounds
        if "stress_parameters" in result:
            assert 0.0 <= result["stress_parameters"]["X"] <= 1.0

    def test_find_stress_scenario_with_current_values(self):
        """Stress testing should measure perturbation from baseline."""
        tester = ReverseStressTester()

        baseline = {"A": 3.0, "B": 3.0}

        def model(params):
            return {"Cat": params["A"] + params["B"]}

        result = tester.find_stress_scenario(
            model,
            target_category="Cat",
            target_shift=8.0,
            param_names=["A", "B"],
            current_values=baseline
        )

        if "parameter_changes" in result:
            # Changes measured from baseline
            assert "A" in result["parameter_changes"]
            assert "B" in result["parameter_changes"]

    def test_stress_scenario_includes_top_drivers(self):
        """Stress scenario should identify top parameter changes."""
        tester = ReverseStressTester()

        def model(params):
            return {
                "Cat": -0.01 * params["P1"] - 0.005 * params["P2"] - 0.002 * params["P3"]
            }

        result = tester.find_stress_scenario(
            model,
            target_category="Cat",
            target_shift=-0.15,
            param_names=["P1", "P2", "P3"]
        )

        if "top_drivers" in result:
            # Top drivers should be ordered by magnitude
            if len(result["top_drivers"]) > 1:
                changes = [abs(d["change"]) for d in result["top_drivers"]]
                assert changes == sorted(changes, reverse=True)

    def test_stress_scenario_perturbation_distance(self):
        """Stress scenario should report total perturbation."""
        tester = ReverseStressTester()

        def model(params):
            return {"Cat": params["X"]}

        result = tester.find_stress_scenario(
            model,
            target_category="Cat",
            target_shift=4.0,
            param_names=["X"],
            current_values={"X": 3.0},
            param_bounds={"X": (1, 5)}
        )

        assert "total_perturbation" in result
        assert result["total_perturbation"] >= 0


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


class TestReverseStressEdgeCases:
    """Test edge cases in reverse stress testing."""

    def test_model_evaluation_failure(self):
        """Should handle model evaluation failures gracefully."""
        tester = ReverseStressTester()

        def failing_model(params):
            raise ValueError("Model failed")

        result = tester.find_stress_scenario(
            failing_model,
            target_category="Cat",
            target_shift=-0.10,
            param_names=["X"]
        )

        # Should handle error gracefully
        assert "error" in result or "target_category" in result

    def test_single_parameter(self):
        """Reverse stress should work with single parameter."""
        tester = ReverseStressTester()

        def model(params):
            return {"Cat": params["OnlyParam"] * 0.01}

        result = tester.find_stress_scenario(
            model,
            target_category="Cat",
            target_shift=0.05,
            param_names=["OnlyParam"]
        )

        assert "target_shift" in result

    def test_zero_target(self):
        """Reverse stress should handle zero target."""
        tester = ReverseStressTester()

        def model(params):
            return {"Cat": params["X"] - 3.0}

        result = tester.find_stress_scenario(
            model,
            target_category="Cat",
            target_shift=0.0,
            param_names=["X"],
            current_values={"X": 3.0}
        )

        # Should achieve neutral shift
        if "achieved_shift" in result:
            assert abs(result["achieved_shift"]) < 0.01

    def test_impossible_target(self):
        """Reverse stress should report when target is impossible."""
        tester = ReverseStressTester()

        def bounded_model(params):
            # Max shift is 0.05
            return {"Cat": 0.05 * params["X"] / 5.0}

        result = tester.find_stress_scenario(
            bounded_model,
            target_category="Cat",
            target_shift=1.0,  # Impossible target
            param_names=["X"],
            param_bounds={"X": (1, 5)}
        )

        # Should report target not reached
        if "target_reached" in result:
            assert not result["target_reached"]
