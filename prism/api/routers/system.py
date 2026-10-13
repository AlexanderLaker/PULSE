"""Health and diagnostics. Both are anonymous and expose no credentials."""
import logging
import os

from fastapi import APIRouter

from prism import __version__, database
from prism.api import state
from prism.api.runs import run_status

logger = logging.getLogger(__name__)

router = APIRouter()


def deployed_commit() -> str | None:
    """The commit this deployment was built from (Vercel sets it at build time); None elsewhere."""
    return (os.environ.get("VERCEL_GIT_COMMIT_SHA") or "")[:12] or None


@router.get("/api/v1/health")
def health():
    """Liveness, the service version and deployed commit, the driver count and the newest run's id.

    Cheap on purpose (the dashboard polls it and reloads when the run id
    changes): it reads the run's id, never its results. When the database
    fails, status is "degraded" and simulation_reason says why
    (migration_pending: it needs a migration from migrations/ first;
    no_database: no URL is configured; drivers_missing: a database in use
    lost its drivers and is restored from its backup; db_error: anything
    else). A run that exists but cannot be served shows up in
    /api/v1/diagnostics and /api/v1/simulation.
    """
    try:
        drivers = state.driver_set()
        latest = database.latest_run_summary()
    except Exception as e:  # noqa: BLE001 (reported as degraded, never raised)
        logger.warning("health: database unavailable: %s", e)
        return {"status": "degraded", "version": __version__, "commit": deployed_commit(), "driver_count": 0,
                "has_simulation": False, "simulation_reason": database.failure_reason(e), "latest_run_id": None}
    return {
        "status": "ok",
        "version": __version__,
        "commit": deployed_commit(),
        "driver_count": drivers.driver_count,
        "has_simulation": latest is not None,
        "simulation_reason": "ok" if latest else "no_rows",
        "latest_run_id": latest["id"] if latest else None,
    }


@router.get("/api/v1/diagnostics")
def diagnostics():
    """What this server instance sees of the database and the latest run.

    Lets the dashboard tell "cannot reach the database" from "reachable but
    empty" from "the latest run cannot be served", and a database that lost
    its drivers (drivers_missing) from all of them; the documented uptime
    check alerts on any reason other than "ok". The route is anonymous, so
    errors are described in words that name no host, user or password
    (database.describe_error) and nothing else about the database is shown.
    """
    diag = database.diagnose_connection()
    reason = diag.pop("reason")
    if reason is not None:
        return {**diag, "simulation_reason": reason, "version": __version__}
    try:
        status = run_status(state.latest_run())
    except Exception as e:  # noqa: BLE001 (reported, never raised)
        logger.warning("diagnostics: the latest run cannot be read: %s", e)
        return {**diag, "simulation_reason": database.failure_reason(e), "error": database.describe_error(e),
                "version": __version__}
    return {**diag, "simulation_reason": status["reason"],
            "error": diag["error"] or status["error"], "version": __version__}
