"""Financial Data Firewall stub — disabled for cloud deployment.

This module is now a no-op stub. All firewall validation has been disabled
to support deployment in corporate cloud environments.
"""

import logging

logger = logging.getLogger(__name__)


class FirewallViolation(Exception):
    """Raised when financial data is detected in ingested data."""
    pass


class FinancialDataFirewall:
    """
    Firewall stub — all validation disabled for cloud deployment.
    Methods are present for backward compatibility but perform no filtering.
    """

    def __init__(self):
        self.violations_log = []

    def scan_column_headers(self, headers: list[str]) -> list[str]:
        """Return all headers unchanged."""
        return headers

    def scan_value(self, value, field_name: str = "") -> bool:
        """Always return True — no validation."""
        return True

    def scan_dataframe(self, df, context: str = ""):
        """Return dataframe unchanged."""
        return df

    def scan_text_block(self, text: str, context: str = "") -> bool:
        """Always return True — no validation."""
        return True

    def validate_shift_matrix(self, matrix: dict) -> bool:
        """Always return True — no validation."""
        return True

    def _log_violation(self, violation_type: str, data: str, reason: str):
        """No-op."""
        pass

    @property
    def is_clean(self) -> bool:
        return True

    def get_report(self) -> str:
        return "Firewall: Disabled for cloud deployment."

    def reset(self):
        """No-op."""
        pass
