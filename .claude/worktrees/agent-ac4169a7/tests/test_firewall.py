"""Tests for Financial Data Firewall — disabled stub.

This test file verifies that the firewall stub passes all tests trivially
(no-op behavior) for backward compatibility.
"""

import pytest
import pandas as pd
from pulse.ingestion.firewall import FinancialDataFirewall, FirewallViolation


@pytest.fixture
def firewall():
    """Create a fresh firewall instance for each test."""
    return FinancialDataFirewall()


class TestFirewallColumnHeaders:
    """Test firewall stub (all pass-through)."""

    def test_allows_all_headers(self, firewall):
        """Firewall stub allows all columns."""
        headers = ["Trend Name", "NES", "Description", "GP1", "GP2"]
        safe = firewall.scan_column_headers(headers)
        assert len(safe) == len(headers)

    def test_allows_financial_keywords(self, firewall):
        """Firewall stub allows financial keywords."""
        headers = ["Revenue", "Profit", "Cost", "Price"]
        safe = firewall.scan_column_headers(headers)
        assert len(safe) == len(headers)

    def test_allows_currency_symbols(self, firewall):
        """Firewall stub allows currency symbols."""
        headers = ["Value_€", "Amount_$", "Cost_EUR"]
        safe = firewall.scan_column_headers(headers)
        assert len(safe) == len(headers)


class TestFirewallValueScanning:
    """Test firewall stub (all allow pass-through)."""

    def test_allows_all_numeric_values(self, firewall):
        """Firewall stub allows all numeric values."""
        assert firewall.scan_value(1, "score") is True
        assert firewall.scan_value(100, "large_number") is True
        assert firewall.scan_value(1000000, "financial_value") is True
        assert firewall.scan_value(-500, "negative") is True

    def test_allows_all_text_patterns(self, firewall):
        """Firewall stub allows all text patterns."""
        assert firewall.scan_value("€2,199M", "nes") is True
        assert firewall.scan_value("Revenue: 1234", "field") is True
        assert firewall.scan_value("$1,234M", "value") is True
        assert firewall.scan_value("GP1 €911.9M", "financial") is True

    def test_allows_none_values(self, firewall):
        """Firewall stub allows None values."""
        assert firewall.scan_value(None, "field") is True


class TestFirewallDataFrameScanning:
    """Test DataFrame scanning (all pass-through)."""

    def test_preserves_all_dataframes(self, firewall):
        """Firewall stub preserves all dataframes unchanged."""
        df = pd.DataFrame({
            "Trend": ["A", "B"],
            "NES": [1000, 2000],
            "GP1": [500, 600],
            "Revenue": [2199, 1500],
        })
        result = firewall.scan_dataframe(df, context="test")
        assert result.equals(df)
        assert "NES" in result.columns
        assert "Revenue" in result.columns

    def test_preserves_financial_values(self, firewall):
        """Firewall stub preserves financial values."""
        df = pd.DataFrame({
            "Category": ["Hair: Color", "Hair: Care"],
            "Value": ["€2,199M", "€1,500M"],
        })
        result = firewall.scan_dataframe(df)
        assert result.equals(df)


class TestFirewallTextBlocking:
    """Test text block scanning (all allow)."""

    def test_allows_all_text(self, firewall):
        """Firewall stub allows all text."""
        text1 = "This trend impacts €2,199M in NES value"
        text2 = "Revenue impact is 500 units"
        text3 = "This trend affects profit margins"

        assert firewall.scan_text_block(text1, "description") is True
        assert firewall.scan_text_block(text2, "note") is True
        assert firewall.scan_text_block(text3, "description") is True


class TestShiftMatrixValidation:
    """Test shift matrix validation (all allow)."""

    def test_allows_percentage_matrix(self, firewall):
        """Firewall stub allows percentage matrices."""
        matrix = {
            "Hair: Color": {
                2030: {"median": -0.05, "p10": -0.10, "p90": 0.0}
            }
        }
        assert firewall.validate_shift_matrix(matrix) is True

    def test_allows_large_values(self, firewall):
        """Firewall stub allows any numeric values."""
        matrix = {
            "Hair: Color": {
                2030: {"median": 2.5},
                2031: {"median": 100},
                2032: {"median": 10000},
            }
        }
        assert firewall.validate_shift_matrix(matrix) is True

    def test_allows_nested_structures(self, firewall):
        """Firewall stub allows any nested structure."""
        matrix = {
            "Category A": {
                "path": {
                    2026: {"median": 0.01},
                    2027: {"median": 2500},
                }
            }
        }
        assert firewall.validate_shift_matrix(matrix) is True


class TestFirewallReporting:
    """Test firewall report generation."""

    def test_always_clean(self, firewall):
        """Firewall stub always reports clean."""
        report = firewall.get_report()
        assert "Disabled" in report or "Firewall" in report

    def test_reset_is_noop(self, firewall):
        """Firewall stub reset is no-op."""
        firewall.reset()
        assert firewall.is_clean is True


class TestSpecialCases:
    """Test edge cases — all allowed."""

    def test_allows_all_patterns(self, firewall):
        """Firewall stub allows all patterns."""
        assert firewall.scan_value("EUR 1234567", "field") is True
        assert firewall.scan_value("-0.05", "shift") is True
        assert firewall.scan_value("€0.05", "field") is True
        assert firewall.scan_value("REVENUE: 1234", "field") is True
        assert firewall.scan_value("Profit 500", "field") is True
        assert firewall.scan_value("NES revenue €2,199M for Q1", "field") is True
