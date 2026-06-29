"""Multi-expert trend score proposals — aggregation + response shaping.

Pure-Python (no FastAPI / no DB imports) so it is unit-testable and reused by
both the proposals endpoints (pulse/api/routers/trends.py) and the cheap
`proposal_summary` block attached to each serialized trend.

A "proposal" is one user's PARTIAL opinion on the 7 scoreable fields of a
trend:

    probability (int 1..5), gp1_pct_affected (float 0..1), peak_year (int),
    diffusion_curve (str), category_exposure (map), regional_exposure (map),
    vc_exposure (map)

Aggregation rules (from the frontend contract):
  - probability / gp1_pct_affected      → arithmetic mean of non-null values,
                                          rounded to 2 dp, with a count.
  - peak_year                           → median (number) of non-null values.
  - diffusion_curve                     → mode (most frequent) + full vote
                                          distribution.
  - exposure maps                       → PER CELL across users: {avg, count}.
  - A field's aggregate is omitted (None) when nobody scored it.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

SCALAR_MEAN_FIELDS = ("probability", "gp1_pct_affected")
EXPOSURE_FIELDS = ("category_exposure", "regional_exposure", "vc_exposure")


def _non_null(values: List[Any]) -> List[Any]:
    return [v for v in values if v is not None]


def _median(values: List[float]) -> Optional[float]:
    """Median of non-null numeric values (linear, like statistics.median).

    Returns None for an empty list. Even-length lists average the two
    middle values.
    """
    nums = sorted(float(v) for v in _non_null(values))
    n = len(nums)
    if n == 0:
        return None
    mid = n // 2
    if n % 2 == 1:
        m = nums[mid]
    else:
        m = (nums[mid - 1] + nums[mid]) / 2.0
    # Return ints cleanly (e.g. peak_year 2029, not 2029.0)
    return int(m) if float(m).is_integer() else round(m, 2)


def _mean2(values: List[float]) -> Optional[Dict[str, Any]]:
    nums = [float(v) for v in _non_null(values)]
    if not nums:
        return None
    return {"avg": round(sum(nums) / len(nums), 2), "count": len(nums)}


def _mode_distribution(values: List[Any]) -> Optional[Dict[str, Any]]:
    """Most-frequent value + the full vote distribution for a categorical
    field (diffusion_curve). Ties broken deterministically by first-seen
    insertion order so repeated calls are stable."""
    vals = _non_null(values)
    if not vals:
        return None
    dist: Dict[str, int] = {}
    for v in vals:
        key = str(v)
        dist[key] = dist.get(key, 0) + 1
    # Mode: highest count, ties → first inserted (stable).
    mode = max(dist.items(), key=lambda kv: kv[1])[0]
    return {"mode": mode, "distribution": dist, "count": len(vals)}


def _aggregate_exposure(rows: List[Dict[str, Any]], field: str) -> Dict[str, Dict[str, Any]]:
    """Per-cell aggregate across users for one exposure map field.

    Returns {display_key: {"avg": <2dp>, "count": <n>}} for every cell any
    user scored (non-null). Cells nobody scored are omitted.
    """
    sums: Dict[str, float] = {}
    counts: Dict[str, int] = {}
    for r in rows:
        m = r.get(field)
        if not isinstance(m, dict):
            continue
        for k, v in m.items():
            if v is None:
                continue
            try:
                fv = float(v)
            except (TypeError, ValueError):
                continue
            sums[k] = sums.get(k, 0.0) + fv
            counts[k] = counts.get(k, 0) + 1
    return {
        k: {"avg": round(sums[k] / counts[k], 2), "count": counts[k]}
        for k in sorted(sums.keys())
    }


def aggregate_proposals(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Build the `aggregate` block from a list of proposal-row dicts."""
    agg: Dict[str, Any] = {}
    for f in SCALAR_MEAN_FIELDS:
        agg[f] = _mean2([r.get(f) for r in rows])

    peak_vals = _non_null([r.get("peak_year") for r in rows])
    agg["peak_year"] = (
        {"median": _median(peak_vals), "count": len(peak_vals)} if peak_vals else None
    )

    agg["diffusion_curve"] = _mode_distribution([r.get("diffusion_curve") for r in rows])

    for f in EXPOSURE_FIELDS:
        agg[f] = _aggregate_exposure(rows, f)
    return agg


def _my_block(my_row: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """The caller's own proposal as a flat headline dict (or None)."""
    if not my_row:
        return None
    return {
        "probability": my_row.get("probability"),
        "gp1_pct_affected": my_row.get("gp1_pct_affected"),
        "peak_year": my_row.get("peak_year"),
        "diffusion_curve": my_row.get("diffusion_curve"),
        "category_exposure": my_row.get("category_exposure"),
        "regional_exposure": my_row.get("regional_exposure"),
        "vc_exposure": my_row.get("vc_exposure"),
        "comment": my_row.get("comment"),
    }


def _scorer_block(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """The named "who scored what" breakdown (headline scalar fields + the
    expert's free-text comment)."""
    out = []
    for r in rows:
        out.append({
            "user_id": r.get("user_id"),
            "name": r.get("user_name") or r.get("user_id"),
            "role": r.get("user_role") or "viewer",
            "probability": r.get("probability"),
            "gp1_pct_affected": r.get("gp1_pct_affected"),
            "peak_year": r.get("peak_year"),
            "diffusion_curve": r.get("diffusion_curve"),
            "comment": r.get("comment"),
        })
    return out


def build_proposals_response(
    trend_id: str,
    rows: List[Dict[str, Any]],
    user_id: Optional[str],
) -> Dict[str, Any]:
    """Full GET/PUT /trends/{id}/proposals response body.

    `rows` is every proposal row for the trend (decoded dicts). `user_id`
    selects the caller's own row for the `my` block.
    """
    my_row = None
    if user_id is not None:
        for r in rows:
            if r.get("user_id") == user_id:
                my_row = r
                break
    return {
        "trend_id": trend_id,
        "my": _my_block(my_row),
        "aggregate": aggregate_proposals(rows),
        "scorers": _scorer_block(rows),
    }


def build_proposal_summary(
    rows: List[Dict[str, Any]],
    user_id: Optional[str],
) -> Dict[str, Any]:
    """Compact per-trend summary for the trend list / detail handlers.

    Shape:
        {count, probability|null, gp1_pct_affected|null, peak_year|null,
         diffusion_curve|null, my|null}
    where the headline aggregates carry {avg/median/mode, count} and `my`
    is the caller's own partial proposal (or null).
    """
    prob = _mean2([r.get("probability") for r in rows])
    gp1 = _mean2([r.get("gp1_pct_affected") for r in rows])

    peak_vals = _non_null([r.get("peak_year") for r in rows])
    peak = {"median": _median(peak_vals), "count": len(peak_vals)} if peak_vals else None

    curve_full = _mode_distribution([r.get("diffusion_curve") for r in rows])
    curve = {"mode": curve_full["mode"], "count": curve_full["count"]} if curve_full else None

    my_row = None
    if user_id is not None:
        for r in rows:
            if r.get("user_id") == user_id:
                my_row = r
                break

    return {
        "count": len(rows),
        "probability": prob,
        "gp1_pct_affected": gp1,
        "peak_year": peak,
        "diffusion_curve": curve,
        "my": _my_block(my_row),
    }
