"""Simulation lifecycle service — extracted from pulse/api/app.py (June 2026 split, review F4).
Behavior-identical move; see app.py for assembly.
"""
import json
import logging

from pulse.api.serialization import _sanitize
from pulse.api.state import _state

logger = logging.getLogger(__name__)


def load_latest_run_into_state() -> bool:
    """Rehydrate _state["mc_result"]/_state["run_meta"] from the newest
    persisted run. Single implementation of the bundle-vs-legacy shape
    detection that previously existed in three near-identical copies
    (lifespan, _lazy_init, GET /simulation). Superset of all three:
    column fallbacks for convergence/force-attribution + full
    results_bundle.meta ribbon fields (scenario, seed, git_sha, ...).

    Returns True if a run was loaded. Caller manages locking.
    """
    from pulse.database import load_simulation_runs
    runs = load_simulation_runs(limit=1)
    if not runs:
        return False
    latest = runs[0]

    results = latest.get("results")
    if isinstance(results, str):
        results = json.loads(results)
    results = results or {}
    conv = latest.get("convergence_diagnostics")
    if isinstance(conv, str):
        conv = json.loads(conv)
    force_attr = latest.get("force_attribution")
    if isinstance(force_attr, str):
        force_attr = json.loads(force_attr)

    inner_meta = (results.get("meta") if isinstance(results, dict) else None) or {}

    if isinstance(results, dict) and "shift_matrix" in results:
        mc = {
            "shift_matrix": results.get("shift_matrix", {}),
            "decompositions": results.get("decompositions"),
            "totals": results.get("totals"),
            "vc_decomposition": results.get("vc_decomposition"),
            "journey_decomposition": results.get("journey_decomposition"),
            # D19/D3 (June 2026): integrity events + seed stability persist
            # with the run and must survive rehydration. seed_stability is
            # None for pre-2.8.1 runs — the UI shows "not recorded" then.
            "integrity_events": results.get("integrity_events") or [],
            "seed_stability": results.get("seed_stability"),
            "force_attribution": results.get("force_attribution") or force_attr,
            "convergence": conv or results.get("convergence") or {},
            "iterations": latest.get("iterations") or results.get("iterations") or 1000,
            "model_type": latest.get("model_type") or results.get("model_type") or "bayesian_copula",
            "model_version": results.get("model_version") or inner_meta.get("model_version"),
            "engine_name": results.get("engine_name") or inner_meta.get("engine_name"),
            "seed": results.get("seed") if results.get("seed") is not None else inner_meta.get("seed"),
        }
    else:
        # Legacy flat shape — results IS the shift matrix
        mc = {
            "shift_matrix": results or {},
            "convergence": conv or {},
            "force_attribution": force_attr,
            "iterations": latest.get("iterations", 1000),
            "model_type": latest.get("model_type", "bayesian_copula"),
        }

    run_date = latest.get("run_date")
    run_meta = {
        "run_id": latest.get("id"),
        "run_date": run_date.isoformat() if hasattr(run_date, "isoformat") else (str(run_date) if run_date else None),
        "iterations": latest.get("iterations"),
        "model_type": latest.get("model_type"),
        "scenario": inner_meta.get("scenario"),
        "notes": inner_meta.get("notes"),
        "seed": inner_meta.get("seed"),
        "chain_seeds": inner_meta.get("chain_seeds"),  # L8: derived chain seeds
        "chains": inner_meta.get("chains"),
        "git_sha": inner_meta.get("git_sha"),
        "model_version": inner_meta.get("model_version"),
        "engine_name": inner_meta.get("engine_name"),
        "engine_fidelity": inner_meta.get("engine_fidelity"),
        "numerics_backend": inner_meta.get("numerics_backend"),  # D13 audit trail
        "converged_categories": inner_meta.get("converged_categories"),
        "total_categories": inner_meta.get("total_categories"),
        "persisted_at_utc": inner_meta.get("persisted_at_utc"),
    }

    _state["mc_result"] = mc
    _state["run_meta"] = run_meta
    _state["simulation_stale"] = False
    logger.info(
        "Restored simulation from database (run_id=%s, shape=%s)",
        run_meta.get("run_id"),
        "bundle" if (isinstance(results, dict) and "shift_matrix" in results) else "flat",
    )
    return True


def _persisted_simulation_state() -> dict:
    """Detailed check for persisted runs — returns structured reason.

    Returns::

        {"has": bool, "reason": "ok" | "db_error" | "no_rows" | "malformed",
         "error": str | None, "latest_run_id": int | None}

    This is what /api/v1/health and /api/v1/diagnostics both consume so
    the dashboard can show *why* it thinks no simulation exists rather
    than a generic empty state.
    """
    try:
        from pulse.database import diagnose_connection
        diag = diagnose_connection()
    except Exception as e:
        return {"has": False, "reason": "db_error", "error": str(e), "latest_run_id": None}

    if not diag["db_reachable"]:
        return {
            "has": False, "reason": "db_error",
            "error": diag.get("error") or "DB unreachable",
            "latest_run_id": None,
        }
    if diag["simulation_run_count"] == 0:
        return {"has": False, "reason": "no_rows", "error": None, "latest_run_id": None}
    if not diag["latest_has_shift_matrix"]:
        return {
            "has": False, "reason": "malformed",
            "error": "latest row is missing shift_matrix key",
            "latest_run_id": diag.get("latest_run_id"),
        }
    return {
        "has": True, "reason": "ok", "error": None,
        "latest_run_id": diag.get("latest_run_id"),
    }

def _has_persisted_simulation() -> bool:
    """Back-compat boolean wrapper around _persisted_simulation_state()."""
    return _persisted_simulation_state()["has"]
