"""REMOVED in v3.2 (April 2026).

The backtesting engine was a stub — no historical v1-v11 data was
ever available to calibrate against. Removed as part of the v3.2
cleanup. The `attenuation_source` field still exists for audit purposes
but can only take the values "assumed" | "calibrated_v3.1_april2026"
| "admin_override".
"""

raise ImportError(
    "pulse.backtesting was removed in v3.2. "
    "No historical calibration data was ever available."
)
