"""
Shape-compatibility shims for schema migrations.

Post-D5, ``velocity[year]`` is a dict of percentiles (``{"median": ..., "p10": ..., "p90": ...}``)
rather than a scalar float. Downstream consumers (Excel writers, Power BI exporters,
report generators) used to treat it as a scalar. This module gives them a single
tolerant accessor so every call site degrades gracefully against either shape.

Add new helpers here whenever a schema change creates a "fan-out" of defensive
isinstance checks across the codebase.
"""
from __future__ import annotations

from typing import Any


def velocity_median(entry: Any, default: float = 0.0) -> float:
    """Return the median velocity regardless of dict/scalar shape.

    - New shape (post-D5): ``{"median": x, "p10": ..., "p90": ...}`` → returns ``x``
    - Legacy shape: scalar float → returned directly
    - Missing/None → returns ``default``

    Always returns a float so arithmetic callers never see None.
    """
    if entry is None:
        return float(default)
    if isinstance(entry, dict):
        return float(entry.get("median", default))
    try:
        return float(entry)
    except (TypeError, ValueError):
        return float(default)
