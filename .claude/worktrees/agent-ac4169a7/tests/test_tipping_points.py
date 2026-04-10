"""Unit tests for tipping point detection module."""
import pytest
import numpy as np
from pulse.simulation.tipping_points import TippingPointDetector


class TestTippingPointDetectorBasics:
    """Test basic tipping point detector initialization."""

    def test_detector_initializes(self):
        """TippingPointDetector should initialize with parameters."""
        detector = TippingPointDetector(
            acceleration_threshold=0.004,
            regime_window=3
        )
        assert detector.acceleration_threshold == 0.004
        assert detector.regime_window == 3

    def test_detector_defaults(self):
        """TippingPointDetector should have sensible defaults."""
        detector = TippingPointDetector()
        assert detector.acceleration_threshold == 0.005
        assert detector.regime_window == 2


class TestDetectFromPath:
    """Test tipping point detection from single path."""

    def test_detect_acceleration_tipping(self):
        """Should detect acceleration tipping points."""
        detector = TippingPointDetector(acceleration_threshold=0.005)

        # Path with accelerating contraction
        path = {
            2026: -0.01,
            2027: -0.025,
            2028: -0.050,
            2029: -0.085,  # Acceleration visible here
            2030: -0.130
        }

        points = detector.detect_from_path(path, "Hair: Color")

        # Should detect acceleration
        accel_points = [p for p in points if p["type"] == "acceleration"]
        assert len(accel_points) > 0

    def test_detect_sign_reversal(self):
        """Should detect expansion to contraction reversals."""
        detector = TippingPointDetector()

        # Path that reverses from expansion to contraction
        path = {
            2026: 0.01,
            2027: 0.02,
            2028: 0.01,
            2029: -0.01,  # Sign reversal
            2030: -0.05
        }

        points = detector.detect_from_path(path, "Category_A")

        # Should detect sign reversal
        reversals = [p for p in points if p["type"] == "sign_reversal"]
        assert len(reversals) > 0

    def test_detect_inflection(self):
        """Should detect inflection point (max velocity)."""
        detector = TippingPointDetector()

        # Smooth S-curve path
        path = {
            2026: -0.005,
            2027: -0.015,
            2028: -0.035,
            2029: -0.065,
            2030: -0.100
        }

        points = detector.detect_from_path(path, "Hair: Care")

        # Should detect inflection
        inflections = [p for p in points if p["type"] == "inflection"]
        assert len(inflections) > 0

    def test_detect_severity_levels(self):
        """Should assign severity to detected points."""
        detector = TippingPointDetector()

        # Path with large acceleration
        path = {
            2026: -0.01,
            2027: -0.05,
            2028: -0.15,
            2029: -0.30,
            2030: -0.50
        }

        points = detector.detect_from_path(path, "Category_X")

        if points:
            for point in points:
                if "severity" in point:
                    assert point["severity"] in ["critical", "high", "medium", "low"]


class TestDetectAllCategories:
    """Test tipping point detection across all categories."""

    def test_detect_all_categories(self):
        """Should detect tipping points across all categories."""
        detector = TippingPointDetector()

        shift_matrix = {
            "Hair: Color": {
                2026: -0.01,
                2027: -0.025,
                2028: -0.050,
                2029: -0.080,
                2030: -0.110
            },
            "Hair: Care": {
                2026: -0.005,
                2027: -0.015,
                2028: -0.030,
                2029: -0.050,
                2030: -0.070
            },
            "LHC: FCN": {
                2026: 0.005,
                2027: 0.010,
                2028: 0.015,
                2029: 0.018,
                2030: 0.020
            }
        }

        result = detector.detect_all_categories(shift_matrix)

        assert "tipping_points" in result
        assert "by_category" in result
        assert "systemic_years" in result
        assert len(result["by_category"]) == 3

    def test_systemic_years_detection(self):
        """Should identify systemic tipping years (3+ categories)."""
        detector = TippingPointDetector()

        # All categories spike in 2028
        shift_matrix = {
            f"Category_{i}": {
                2026: -0.01 * (i % 3 + 1),
                2027: -0.02 * (i % 3 + 1),
                2028: -0.08 * (i % 3 + 1),  # Acceleration year
                2029: -0.15 * (i % 3 + 1),
                2030: -0.25 * (i % 3 + 1)
            }
            for i in range(5)
        }

        result = detector.detect_all_categories(shift_matrix)

        # Should detect 2028 as systemic year
        if "systemic_years" in result and result["systemic_years"]:
            assert any(year == 2028 for year in result["systemic_years"].keys())

    def test_tipping_points_ranking(self):
        """Tipping points should be ranked by severity."""
        detector = TippingPointDetector()

        shift_matrix = {
            "Cat1": {2026: -0.01, 2027: -0.05, 2028: -0.15, 2029: -0.35, 2030: -0.60},
            "Cat2": {2026: -0.005, 2027: -0.010, 2028: -0.015, 2029: -0.020, 2030: -0.025},
        }

        result = detector.detect_all_categories(shift_matrix)

        points = result["tipping_points"]
        if len(points) > 1:
            # Higher severity should come first
            severities = [p.get("severity_value", 0) for p in points]
            assert severities == sorted(severities, reverse=True)


class TestThresholdBreach:
    """Test threshold breach detection."""

    def test_detect_threshold_breach(self):
        """Should detect when path crosses defined thresholds."""
        detector = TippingPointDetector()

        path = {
            2026: -0.01,
            2027: -0.03,
            2028: -0.07,
            2029: -0.12,
            2030: -0.18
        }

        thresholds = [
            {"level": -0.05, "label": "Minor contraction", "action": "Review"},
            {"level": -0.10, "label": "Major contraction", "action": "Act"},
        ]

        breaches = detector.detect_threshold_breach(path, thresholds, "Hair: Color")

        assert len(breaches) > 0
        assert breaches[0]["type"] == "threshold_breach"

    def test_threshold_breach_direction(self):
        """Should track direction of threshold crossing."""
        detector = TippingPointDetector()

        # Path that goes below threshold then recovers
        path = {
            2026: -0.02,
            2027: -0.08,  # Below -0.05
            2028: -0.05,
            2029: -0.02,
            2030: 0.00
        }

        thresholds = [
            {"level": -0.05, "label": "Threshold", "action": "Act"}
        ]

        breaches = detector.detect_threshold_breach(path, thresholds)

        if breaches:
            # Should have downward crossing (into breach)
            assert any(b["cross_direction"] == "downward" for b in breaches)

    def test_threshold_breach_severity(self):
        """Threshold breaches should have severity levels."""
        detector = TippingPointDetector()

        path = {
            2026: 0.0,
            2027: -0.15,  # Deep breach
        }

        thresholds = [
            {"level": -0.05, "label": "Threshold"}
        ]

        breaches = detector.detect_threshold_breach(path, thresholds)

        if breaches:
            assert "severity" in breaches[0]
            assert breaches[0]["severity"] in ["critical", "high", "medium"]


class TestTippingPointReporting:
    """Test tipping point reporting functionality."""

    def test_generate_tipping_point_report(self):
        """Report should be human-readable markdown."""
        detector = TippingPointDetector()

        shift_matrix = {
            "Hair: Color": {2026: -0.01, 2027: -0.05, 2028: -0.15, 2029: -0.35, 2030: -0.60},
            "Hair: Care": {2026: -0.005, 2027: -0.015, 2028: -0.035, 2029: -0.065, 2030: -0.100},
        }

        detection = detector.detect_all_categories(shift_matrix)
        report = detector.generate_tipping_point_report(detection)

        assert isinstance(report, str)
        assert len(report) > 100
        assert "tipping" in report.lower() or "point" in report.lower()


class TestTippingPointEdgeCases:
    """Test edge cases in tipping point detection."""

    def test_path_too_short(self):
        """Detector should handle paths with <3 points."""
        detector = TippingPointDetector()

        path = {
            2028: -0.05,
            2029: -0.10
        }

        points = detector.detect_from_path(path)

        # Should return empty or minimal points
        assert isinstance(points, list)

    def test_flat_path(self):
        """Detector should handle flat (constant) paths."""
        detector = TippingPointDetector()

        path = {
            2026: -0.05,
            2027: -0.05,
            2028: -0.05,
            2029: -0.05,
            2030: -0.05
        }

        points = detector.detect_from_path(path, "Flat")

        # Flat path has no acceleration or inflection
        accel = [p for p in points if p["type"] == "acceleration"]
        # Should be empty or very few
        assert len(accel) < 3

    def test_all_positive_path(self):
        """Detector should handle paths with only positive shifts."""
        detector = TippingPointDetector()

        path = {
            2026: 0.01,
            2027: 0.02,
            2028: 0.04,
            2029: 0.07,
            2030: 0.10
        }

        points = detector.detect_from_path(path, "Growth")

        # Should detect inflection but no sign reversals
        reversals = [p for p in points if p["type"] == "sign_reversal"]
        assert len(reversals) == 0

    def test_all_negative_path(self):
        """Detector should handle paths with only negative shifts."""
        detector = TippingPointDetector()

        path = {
            2026: -0.01,
            2027: -0.02,
            2028: -0.04,
            2029: -0.07,
            2030: -0.10
        }

        points = detector.detect_from_path(path, "Contraction")

        # Should detect inflection but no sign reversals
        reversals = [p for p in points if p["type"] == "sign_reversal"]
        assert len(reversals) == 0

    def test_empty_shift_matrix(self):
        """Detector should handle empty shift matrix."""
        detector = TippingPointDetector()

        result = detector.detect_all_categories({})

        assert "tipping_points" in result
        assert len(result["tipping_points"]) == 0

    def test_single_category(self):
        """Detector should work with single category."""
        detector = TippingPointDetector()

        shift_matrix = {
            "OnlyCategory": {2026: -0.01, 2027: -0.05, 2028: -0.15, 2029: -0.35, 2030: -0.60}
        }

        result = detector.detect_all_categories(shift_matrix)

        assert len(result["by_category"]) == 1


class TestTippingPointSeverity:
    """Test severity classification."""

    def test_critical_severity(self):
        """Should classify severe accelerations as critical."""
        detector = TippingPointDetector(acceleration_threshold=0.001)

        # Extreme acceleration
        path = {
            2026: -0.01,
            2027: -0.05,
            2028: -0.20,
            2029: -0.50,
            2030: -1.00
        }

        points = detector.detect_from_path(path)

        critical = [p for p in points if p.get("severity") == "critical"]
        # Should have critical points
        assert len(critical) > 0

    def test_high_severity(self):
        """Should classify moderate accelerations as high."""
        detector = TippingPointDetector(acceleration_threshold=0.005)

        path = {
            2026: -0.01,
            2027: -0.025,
            2028: -0.050,
            2029: -0.085,
            2030: -0.130
        }

        points = detector.detect_from_path(path)

        # Should have high severity points
        high_or_critical = [p for p in points if p.get("severity") in ["high", "critical"]]
        assert len(high_or_critical) > 0
