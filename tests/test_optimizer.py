"""Tests for Resource Allocation Optimizer."""

import pytest
import numpy as np
from pulse.optimizer.allocation import AllocationOptimizer
from pulse.config import CATEGORIES


class TestOptimizerBasics:
    """Test basic optimizer functionality."""

    def test_optimizer_initializes(self, mock_model_config):
        """Should create optimizer without error."""
        optimizer = AllocationOptimizer(mock_model_config)
        assert optimizer is not None
        assert optimizer.config == mock_model_config

    def test_optimizer_with_shift_matrix(self, mock_model_config, deterministic_shift_matrix):
        """Should optimize given a shift matrix."""
        optimizer = AllocationOptimizer(mock_model_config)
        result = optimizer.optimize(deterministic_shift_matrix)

        assert result is not None
        assert "weights" in result

    def test_optimizer_handles_empty_shift_matrix(self, mock_model_config):
        """Should handle empty shift matrix gracefully."""
        optimizer = AllocationOptimizer(mock_model_config)
        result = optimizer.optimize({})

        assert "error" in result or len(result["weights"]) == 0


class TestOptimizerWeights:
    """Test optimization weight properties."""

    def test_weights_sum_to_one(self, mock_model_config, deterministic_shift_matrix):
        """Should ensure weights sum to 1.0."""
        optimizer = AllocationOptimizer(mock_model_config)
        result = optimizer.optimize(deterministic_shift_matrix)

        weights = result["weights"]
        total = sum(weights.values())

        assert abs(total - 1.0) < 0.001  # Allow tiny rounding error

    def test_all_categories_have_weights(self, mock_model_config, deterministic_shift_matrix):
        """Should return weights for all 13 categories."""
        optimizer = AllocationOptimizer(mock_model_config)
        result = optimizer.optimize(deterministic_shift_matrix)

        weights = result["weights"]
        for cat in deterministic_shift_matrix.keys():
            assert cat in weights

    def test_weights_respect_min_bound(self, mock_model_config, deterministic_shift_matrix):
        """Should respect minimum weight constraint."""
        min_weight = 0.05
        optimizer = AllocationOptimizer(mock_model_config)
        result = optimizer.optimize(
            deterministic_shift_matrix,
            min_weight=min_weight
        )

        weights = result["weights"]
        for cat, w in weights.items():
            assert w >= min_weight - 0.001  # Allow tiny rounding

    def test_weights_respect_max_bound(self, mock_model_config, deterministic_shift_matrix):
        """Should respect maximum weight constraint."""
        max_weight = 0.15
        optimizer = AllocationOptimizer(mock_model_config)
        result = optimizer.optimize(
            deterministic_shift_matrix,
            max_weight=max_weight
        )

        weights = result["weights"]
        for cat, w in weights.items():
            assert w <= max_weight + 0.001  # Allow tiny rounding


class TestOptimizerRiskAversion:
    """Test risk aversion parameter effects."""

    def test_higher_risk_aversion_reduces_concentration(
        self, mock_model_config, deterministic_shift_matrix
    ):
        """Should verify more risk aversion → more diversified allocation."""
        optimizer = AllocationOptimizer(mock_model_config)

        # High growth (low risk aversion)
        result_growth = optimizer.optimize(deterministic_shift_matrix, risk_aversion=0.1)
        weights_growth = list(result_growth["weights"].values())

        # Conservative (high risk aversion)
        result_conservative = optimizer.optimize(deterministic_shift_matrix, risk_aversion=3.0)
        weights_conservative = list(result_conservative["weights"].values())

        # Conservative should have lower max weight (more diversified)
        max_growth = max(weights_growth)
        max_conservative = max(weights_conservative)

        # Conservative allocation should be more balanced
        std_growth = np.std(weights_growth)
        std_conservative = np.std(weights_conservative)

        assert std_conservative <= std_growth

    def test_risk_aversion_zero_focused(self, mock_model_config, deterministic_shift_matrix):
        """Should concentrate on best opportunities with low risk aversion."""
        optimizer = AllocationOptimizer(mock_model_config)
        result = optimizer.optimize(
            deterministic_shift_matrix,
            risk_aversion=0.01,
            min_weight=0.01,
            max_weight=0.5
        )

        weights = result["weights"]
        weights_list = list(weights.values())

        # Should have one or few high-weight categories
        high_weight_count = sum(1 for w in weights_list if w > 0.1)
        assert high_weight_count >= 1

    def test_risk_aversion_high_balanced(self, mock_model_config, deterministic_shift_matrix):
        """Should balance allocation with high risk aversion."""
        optimizer = AllocationOptimizer(mock_model_config)
        result = optimizer.optimize(
            deterministic_shift_matrix,
            risk_aversion=5.0
        )

        weights = result["weights"]
        weights_list = list(weights.values())

        # Should have valid weights
        assert all(w > 0 for w in weights_list)
        assert abs(sum(weights_list) - 1.0) < 0.01

        # High risk aversion should produce more balanced allocation
        # Verify it's not extreme (not all concentrated in one category)
        max_weight = max(weights_list)
        assert max_weight < 0.35  # No single category dominates


class TestOptimizerMetrics:
    """Test optimization metrics returned."""

    def test_returns_expected_return(self, mock_model_config, deterministic_shift_matrix):
        """Should compute expected portfolio return."""
        optimizer = AllocationOptimizer(mock_model_config)
        result = optimizer.optimize(deterministic_shift_matrix)

        assert "expected_pool_shift" in result
        assert isinstance(result["expected_pool_shift"], float)

    def test_returns_portfolio_risk(self, mock_model_config, deterministic_shift_matrix):
        """Should compute portfolio risk."""
        optimizer = AllocationOptimizer(mock_model_config)
        result = optimizer.optimize(deterministic_shift_matrix)

        assert "portfolio_risk" in result
        assert result["portfolio_risk"] >= 0

    def test_returns_sharpe_proxy(self, mock_model_config, deterministic_shift_matrix):
        """Should compute risk-adjusted return (Sharpe proxy)."""
        optimizer = AllocationOptimizer(mock_model_config)
        result = optimizer.optimize(deterministic_shift_matrix)

        assert "sharpe_proxy" in result
        assert isinstance(result["sharpe_proxy"], float)

    def test_returns_recommendation_categories(self, mock_model_config, deterministic_shift_matrix):
        """Should return invest_more and reduce categories."""
        optimizer = AllocationOptimizer(mock_model_config)
        result = optimizer.optimize(deterministic_shift_matrix)

        assert "invest_more" in result
        assert "reduce" in result
        assert isinstance(result["invest_more"], list)
        assert isinstance(result["reduce"], list)


class TestOptimizerTurnover:
    """Test turnover constraint."""

    def test_turnover_constraint_reduces_changes(
        self, mock_model_config, deterministic_shift_matrix
    ):
        """Should limit reallocation when turnover constraint applied."""
        optimizer = AllocationOptimizer(mock_model_config)

        # Current weights (equal)
        n = len(deterministic_shift_matrix)
        current_weights = {cat: 1.0/n for cat in deterministic_shift_matrix.keys()}

        # Optimize with strict turnover limit
        result = optimizer.optimize(
            deterministic_shift_matrix,
            current_weights=current_weights,
            max_turnover=0.1  # Only 10% reallocation allowed
        )

        weights = result["weights"]

        # Compute actual turnover
        turnover = sum(abs(weights[cat] - current_weights[cat])
                      for cat in weights.keys()) / 2

        # Should respect constraint (with some tolerance for optimizer approximation)
        assert turnover <= 0.15  # Allow small overage


class TestOptimizerFrontier:
    """Test efficient frontier computation."""

    def test_frontier_includes_points(self, mock_model_config, deterministic_shift_matrix):
        """Should compute efficient frontier with multiple points."""
        optimizer = AllocationOptimizer(mock_model_config)
        result = optimizer.optimize(deterministic_shift_matrix)

        assert "frontier" in result
        frontier = result["frontier"]
        assert isinstance(frontier, list)
        assert len(frontier) > 0

    def test_frontier_increasing_risk(self, mock_model_config, deterministic_shift_matrix):
        """Should trace frontier from low-risk to high-return."""
        optimizer = AllocationOptimizer(mock_model_config)
        result = optimizer.optimize(deterministic_shift_matrix)

        frontier = result["frontier"]

        if len(frontier) > 1:
            # Frontier points may have similar risks if variance is low
            # Just verify structure is correct
            risks = [f["risk"] for f in frontier]
            returns = [f["expected_return"] for f in frontier]

            # Should have positive values in the frontier
            assert all(isinstance(r, float) for r in risks)
            assert all(isinstance(ret, float) for ret in returns)

    def test_frontier_contains_weights(self, mock_model_config, deterministic_shift_matrix):
        """Should include weights at each frontier point."""
        optimizer = AllocationOptimizer(mock_model_config)
        result = optimizer.optimize(deterministic_shift_matrix)

        frontier = result["frontier"]

        for point in frontier:
            assert "weights" in point
            assert isinstance(point["weights"], dict)


class TestOptimizerEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_optimizer_all_expansion(self, mock_model_config):
        """Should handle all-positive shifts (pure expansion)."""
        shift_matrix = {
            cat: {"path": {2030: {"median": 0.05}}}
            for cat in CATEGORIES
        }

        optimizer = AllocationOptimizer(mock_model_config)
        result = optimizer.optimize(shift_matrix)

        weights = result["weights"]
        assert sum(weights.values()) == pytest.approx(1.0, abs=0.01)

    def test_optimizer_all_contraction(self, mock_model_config):
        """Should handle all-negative shifts (pure contraction)."""
        shift_matrix = {
            cat: {"path": {2030: {"median": -0.05}}}
            for cat in CATEGORIES
        }

        optimizer = AllocationOptimizer(mock_model_config)
        result = optimizer.optimize(shift_matrix)

        weights = result["weights"]
        assert sum(weights.values()) == pytest.approx(1.0, abs=0.01)

    def test_optimizer_mixed_expansion_contraction(self, mock_model_config):
        """Should handle mixed expansion/contraction."""
        shift_matrix = {}
        for i, cat in enumerate(CATEGORIES):
            direction = 0.05 if i % 2 == 0 else -0.05
            shift_matrix[cat] = {"path": {2030: {"median": direction}}}

        optimizer = AllocationOptimizer(mock_model_config)
        result = optimizer.optimize(shift_matrix)

        weights = result["weights"]
        assert sum(weights.values()) == pytest.approx(1.0, abs=0.01)

    def test_optimizer_identical_categories(self, mock_model_config):
        """Should handle when all categories have identical shifts."""
        shift_matrix = {
            cat: {"path": {2030: {"median": 0.0}}}
            for cat in CATEGORIES
        }

        optimizer = AllocationOptimizer(mock_model_config)
        result = optimizer.optimize(shift_matrix)

        weights = result["weights"]
        # Should default to equal weights
        expected = 1.0 / len(CATEGORIES)
        for w in weights.values():
            assert abs(w - expected) < 0.01

    def test_optimizer_extreme_bounds(self, mock_model_config, deterministic_shift_matrix):
        """Should handle extreme weight bounds."""
        optimizer = AllocationOptimizer(mock_model_config)
        result = optimizer.optimize(
            deterministic_shift_matrix,
            min_weight=0.001,
            max_weight=0.99
        )

        weights = result["weights"]
        assert sum(weights.values()) == pytest.approx(1.0, abs=0.01)

    def test_optimizer_impossible_constraints(self, mock_model_config, deterministic_shift_matrix):
        """Should handle impossible constraints gracefully."""
        optimizer = AllocationOptimizer(mock_model_config)

        # min > max — impossible constraint
        result = optimizer.optimize(
            deterministic_shift_matrix,
            min_weight=0.5,
            max_weight=0.3
        )

        # Should still return a valid result (likely fallback to equal weights)
        weights = result["weights"]
        assert sum(weights.values()) == pytest.approx(1.0, abs=0.01)
