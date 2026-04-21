"""REMOVED in v3.2 (April 2026).

The SensitivityEngine (tornado / breakeven / force-elimination /
weight / attenuation sensitivity) was a stub whose methods all raised
NotImplementedError. It was removed as part of the v3.2 cleanup.

For what-if analysis, use the fully-implemented alternatives:
  - pulse.simulation.sobol         — Global Sobol sensitivity indices
  - pulse.simulation.reverse_stress — Reverse stress testing
  - pulse.simulation.tipping_points — Structural inflection detection
"""

raise ImportError(
    "pulse.simulation.sensitivity was removed in v3.2. "
    "Use pulse.simulation.sobol, reverse_stress, or tipping_points instead."
)
