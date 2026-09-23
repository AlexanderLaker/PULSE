"""The persisted run as the dashboard receives it.

A run is written by scripts/run_production.py as one results bundle. This
module checks that the newest run carries every part of that contract and
shapes it for GET /api/v1/simulation.
"""
from datetime import timezone
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
    """The parts of the contract a stored results bundle lacks: the parts
    above, the run metadata and the drivers' fingerprint the next run and
    inputs_since_run compare with."""
    missing = [k for k in REQUIRED_KEYS if k not in results]
    meta = results.get("meta") or {}
    missing += [f"meta.{k}" for k in META_KEYS + ("driver_fingerprint",) if k not in meta]
    return missing


def run_status(run: Optional[dict]) -> dict:
    """Whether a run can be served: reason is "ok", "no_rows" or "malformed"."""
    if run is None:
        return {"has": False, "reason": "no_rows", "error": None, "latest_run_id": None}
    missing = missing_keys(run["results"])
    if missing:
        return {"has": False, "reason": "malformed", "latest_run_id": run["id"],
                "error": f"run {run['id']} lacks {', '.join(missing)}; re-run scripts/run_production.py"}
    return {"has": True, "reason": "ok", "error": None, "latest_run_id": run["id"]}


def inputs_since_run(run: dict, drivers) -> dict:
    """How the current drivers differ from the ones the run was computed on.

    {"changed", "added", "removed"} as lists of driver ids, all empty while
    the run still reflects the drivers. The dashboard uses it to say that an
    edit made since the run shows only after the next production run.
    """
    from prism.input_drift import changed_drivers, driver_fingerprint
    return changed_drivers(driver_fingerprint(drivers), run["results"]["meta"]["driver_fingerprint"])


def simulation_payload(run: dict, drivers) -> dict:
    """GET /api/v1/simulation body for a run that passed run_status, compared
    with the current ``drivers`` (``inputs_since_run``)."""
    results = run["results"]
    meta = results["meta"]
    run_date = run["run_date"]
    if hasattr(run_date, "isoformat"):
        # Stored without a zone, in UTC (CURRENT_TIMESTAMP on the database
        # server); said explicitly so the dashboard shows the right local time.
        run_date = (run_date if run_date.tzinfo else run_date.replace(tzinfo=timezone.utc)).isoformat()
    payload = {k: results[k] for k in REQUIRED_KEYS if k != "meta"}
    payload["run_meta"] = {
        "run_id": run["id"],
        "run_date": run_date,
        "iterations": run["iterations"],
        **{k: meta[k] for k in META_KEYS},
    }
    payload["inputs_since_run"] = inputs_since_run(run, drivers)
    return payload
