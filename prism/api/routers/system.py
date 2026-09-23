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
    its results. When the database fails, status is "degraded" and
    simulation_reason says why (legacy_schema: it still needs migration 0001;
    no_database: no URL is configured; db_error: anything else). A run that
    exists but cannot be served shows up in /api/v1/diagnostics and
    /api/v1/simulation.
    """
    from prism.api import state
    from prism.database import failure_reason, latest_run_summary
    try:
        drivers = state.driver_set()
        latest = latest_run_summary()
    except Exception as e:  # noqa: BLE001 (reported as degraded, never raised)
        logger.warning("health: database unavailable: %s", e)
        return {"status": "degraded", "version": __version__, "driver_count": 0,
                "categories": len(CATEGORIES), "has_simulation": False,
                "simulation_reason": failure_reason(e), "latest_run_id": None}
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
    empty" from "the latest run cannot be served". Errors are described in
    words that name no host, user or password (database.describe_error); only
    the database host name is shown.
    """
    from prism.api import state
    from prism.api.runs import run_status
    from prism.database import describe_error, diagnose_connection, failure_reason
    diag = diagnose_connection()
    reason = diag.pop("reason")
    if reason is not None:
        return {**diag, "simulation_reason": reason, "version": __version__}
    try:
        status = run_status(state.latest_run())
    except Exception as e:  # noqa: BLE001 (reported, never raised)
        logger.warning("diagnostics: the latest run cannot be read: %s", e)
        return {**diag, "simulation_reason": failure_reason(e), "error": describe_error(e),
                "version": __version__}
    return {**diag, "simulation_reason": status["reason"],
            "error": diag["error"] or status["error"], "version": __version__}
