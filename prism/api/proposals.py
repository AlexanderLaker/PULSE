"""Expert score proposals: aggregation and response shapes.

Plain Python with no web or database imports, so it is easy to test. A
proposal is one expert's partial view of a driver's scoreable fields:
probability (1-5), gp1_pct_affected (0-1), peak_year, diffusion_curve,
uncertainty (0-5), the value-chain epicentre and the category and regional
exposure maps.

Aggregation across experts:
  - probability, gp1_pct_affected: mean of the scored values (2 decimals) and a count
  - peak_year: median; uncertainty: median rounded half up to a whole score
  - diffusion_curve, vc_epicentre: the vote distribution and the majority, the
    value with more votes than any other (none on a tie)
  - exposure maps: per cell, the mean and the count
  - a field nobody scored aggregates to None
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

SCALAR_MEAN_FIELDS = ("probability", "gp1_pct_affected")
EXPOSURE_FIELDS = ("category_exposure", "regional_exposure")


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
    """The votes on a categorical field (diffusion_curve, vc_epicentre): the
    distribution and its majority, the value with more votes than any other.
    A tie has no majority (mode None): the choice stays with the admin."""
    vals = _non_null(values)
    if not vals:
        return None
    dist: Dict[str, int] = {}
    for v in vals:
        dist[str(v)] = dist.get(str(v), 0) + 1
    top = max(dist.values())
    leaders = [k for k, n in dist.items() if n == top]
    return {"mode": leaders[0] if len(leaders) == 1 else None, "distribution": dist, "count": len(vals)}


def _aggregate_exposure(rows: List[Dict[str, Any]], field: str) -> Dict[str, Dict[str, Any]]:
    """Per-cell aggregate across users for one exposure map field.

    Returns {display_key: {"avg": <2dp>, "count": <n>}} for every cell any
    user scored (non-null). Cells nobody scored are omitted.
    """
    sums: Dict[str, float] = {}
    counts: Dict[str, int] = {}
    for r in rows:
        for k, v in (r.get(field) or {}).items():
            sums[k] = sums.get(k, 0.0) + float(v)
            counts[k] = counts.get(k, 0) + 1
    return {
        k: {"avg": round(sums[k] / counts[k], 2), "count": counts[k]}
        for k in sorted(sums.keys())
    }


def _uncertainty_agg(rows: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Median of the scored uncertainties, rounded half up to a whole score 0-5."""
    vals = _non_null([r.get("uncertainty") for r in rows])
    if not vals:
        return None
    return {"median": int(_median(vals) + 0.5), "count": len(vals)}


def aggregate_proposals(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Build the `aggregate` block from a list of proposal-row dicts."""
    agg: Dict[str, Any] = {}
    for f in SCALAR_MEAN_FIELDS:
        agg[f] = _mean2([r.get(f) for r in rows])

    peak_vals = _non_null([r.get("peak_year") for r in rows])
    agg["peak_year"] = (
        {"median": _median(peak_vals), "count": len(peak_vals)} if peak_vals else None
    )
    agg["uncertainty"] = _uncertainty_agg(rows)

    agg["diffusion_curve"] = _mode_distribution([r.get("diffusion_curve") for r in rows])
    agg["vc_epicentre"] = _mode_distribution([r.get("vc_epicentre") for r in rows])

    for f in EXPOSURE_FIELDS:
        agg[f] = _aggregate_exposure(rows, f)
    return agg


def _own_row(rows: List[Dict[str, Any]], user_id: Optional[str]) -> Optional[Dict[str, Any]]:
    """The caller's own proposal among the rows, or None."""
    return next((r for r in rows if user_id is not None and r.get("user_id") == user_id), None)


def _my_block(my_row: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """The caller's own proposal as a flat headline dict (or None)."""
    if not my_row:
        return None
    return {
        "probability": my_row.get("probability"),
        "gp1_pct_affected": my_row.get("gp1_pct_affected"),
        "peak_year": my_row.get("peak_year"),
        "diffusion_curve": my_row.get("diffusion_curve"),
        "uncertainty": my_row.get("uncertainty"),
        "vc_epicentre": my_row.get("vc_epicentre"),
        "category_exposure": my_row.get("category_exposure"),
        "regional_exposure": my_row.get("regional_exposure"),
        "comment": my_row.get("comment"),
    }


def _scorer_block(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Who scored what: the headline fields, the value-chain epicentre and the
    comment, so the review panel can show each expert's vote by name."""
    out = []
    for r in rows:
        out.append({
            "user_id": r.get("user_id"),
            "name": r.get("user_name") or r.get("user_id"),
            "probability": r.get("probability"),
            "gp1_pct_affected": r.get("gp1_pct_affected"),
            "peak_year": r.get("peak_year"),
            "diffusion_curve": r.get("diffusion_curve"),
            "uncertainty": r.get("uncertainty"),
            "vc_epicentre": r.get("vc_epicentre"),
            "comment": r.get("comment"),
        })
    return out


def build_proposals_response(
    driver_id: str,
    rows: List[Dict[str, Any]],
    user_id: Optional[str],
) -> Dict[str, Any]:
    """Body of GET and PUT /api/v1/drivers/{id}/proposals.

    ``rows`` are all proposals for the driver; ``user_id`` picks the caller's
    own for the ``my`` block.
    """
    return {
        "driver_id": driver_id,
        "my": _my_block(_own_row(rows, user_id)),
        "aggregate": aggregate_proposals(rows),
        "scorers": _scorer_block(rows),
    }


def build_proposal_summary(
    rows: List[Dict[str, Any]],
    user_id: Optional[str],
) -> Dict[str, Any]:
    """Compact per-driver summary attached to GET /api/v1/drivers: what the
    driver table shows. {count, probability, gp1_pct_affected, my}: the number
    of experts, the two headline means with their counts (or None) and the
    caller's own proposal (or None)."""
    return {
        "count": len(rows),
        "probability": _mean2([r.get("probability") for r in rows]),
        "gp1_pct_affected": _mean2([r.get("gp1_pct_affected") for r in rows]),
        "my": _my_block(_own_row(rows, user_id)),
    }
