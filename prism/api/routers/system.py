"""Health and diagnostics. Both are anonymous and expose no credentials."""
import logging

from fastapi import APIRouter

from prism import __version__
from prism.config import CATEGORIES

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/v1/health")
def health():
    """Liveness plus the two facts the dashboard needs: drivers and a run exist.

    Cheap on purpose (the dashboard polls it): it reads the run's id, never
    its results. A run that exists but cannot be served shows up in
    /api/v1/diagnostics and /api/v1/simulation.
    """
    from prism.api import state
    from prism.database import latest_run_summary
    try:
        drivers = state.driver_set()
        latest = latest_run_summary()
    except Exception as e:  # noqa: BLE001 (reported as degraded, never raised)
        logger.warning("health: database unavailable: %s", e)
        return {"status": "degraded", "version": __version__, "driver_count": 0,
                "categories": len(CATEGORIES), "has_simulation": False,
                "simulation_reason": "db_error", "latest_run_id": None}
    return {
        "status": "ok",
        "version": __version__,
        "driver_count": drivers.driver_count,
        "categories": len(CATEGORIES),
        "has_simulation": latest is not None,
        "simulation_reason": "ok" if latest else "no_rows",
        "latest_run_id": latest["id"] if latest else None,
    }


@router.get("/api/v1/diagnostics")
def diagnostics():
    """What this server instance sees of the database and the latest run.

    Lets the dashboard tell "cannot reach the database" from "reachable but
    empty" from "the latest run cannot be served". Only the database host
    name is shown, never a credential.
    """
    from prism.api import state
    from prism.api.runs import run_status
    from prism.database import diagnose_connection
    diag = diagnose_connection()
    if not diag["db_reachable"]:
        return {**diag, "simulation_reason": "db_error", "version": __version__}
    try:
        status = run_status(state.latest_run())
    except Exception as e:  # noqa: BLE001 (reported, never raised)
        return {**diag, "simulation_reason": "db_error", "error": f"{type(e).__name__}: {e}",
                "version": __version__}
    return {**diag, "simulation_reason": status["reason"],
            "error": diag["error"] or status["error"], "version": __version__}
