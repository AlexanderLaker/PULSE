"""The persisted run as the dashboard receives it.

A run is written by scripts/run_production.py as one results bundle. This
module checks that the newest run carries every part of that contract and
shapes it for GET /api/v1/simulation.
"""
from typing import Optional

#: Parts of a results bundle the dashboard reads.
REQUIRED_KEYS = (
    "shift_matrix", "regional_shift_matrix", "decompositions", "totals",
    "cell_weights_used", "category_weights_used", "region_weights_used", "cell_weights_source",
    "mc_standard_error", "integrity_events", "seed_stability", "meta",
)

#: Run metadata passed through to the dashboard's run information.
META_KEYS = (
    "seed", "chain_seeds", "chains", "model_version", "engine_name", "numerics_backend",
    "driver_count", "attenuation_source", "persisted_at_utc",
)


def missing_keys(results: dict) -> list:
    return [k for k in REQUIRED_KEYS if k not in (results or {})]


def run_status(run: Optional[dict]) -> dict:
    """Whether a run can be served: reason is "ok", "no_rows" or "malformed"."""
    if run is None:
        return {"has": False, "reason": "no_rows", "error": None, "latest_run_id": None}
    missing = missing_keys(run["results"])
    if missing:
        return {"has": False, "reason": "malformed", "latest_run_id": run["id"],
                "error": f"run {run['id']} lacks {', '.join(missing)}; re-run scripts/run_production.py"}
    return {"has": True, "reason": "ok", "error": None, "latest_run_id": run["id"]}


def simulation_payload(run: dict) -> dict:
    """GET /api/v1/simulation body for a run that passed run_status."""
    results = run["results"]
    meta = results["meta"]
    run_date = run["run_date"]
    payload = {k: results[k] for k in REQUIRED_KEYS if k != "meta"}
    payload["run_meta"] = {
        "run_id": run["id"],
        "run_date": run_date.isoformat() if hasattr(run_date, "isoformat") else run_date,
        "iterations": run["iterations"],
        **{k: meta.get(k) for k in META_KEYS},
    }
    return payload
