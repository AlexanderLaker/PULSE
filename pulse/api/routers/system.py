"""System routes: health, diagnostics, seed — extracted from pulse/api/app.py (June 2026 split, review F4)."""
import json
import logging
from typing import Optional, Any

import numpy as np
from fastapi import APIRouter, HTTPException, Depends
# M4 (July 2026 review): JSONResponse is used by /diagnostics' DB-failure
# branch — the missing import made the endpoint crash (NameError → 500) on
# exactly the outage it exists to explain. Locked by a test now.
from fastapi.responses import JSONResponse

from pulse import __version__
from pulse.config import ModelConfig, FORCES, CATEGORIES
from pulse.ingestion.models import Trend, TrendDatabase
from pulse.api.auth import require_auth, require_admin
from pulse.api.serialization import _sanitize, _summarize_convergence
from pulse.api.state import _state, _state_lock, _load_trend_database, _backfill_diffusion_fields
from pulse.api.models import (
    SimulationRequest, TrendCreate, TrendUpdate, ShockRequest,
    ConfigUpdate, SnapshotCreate,
)
from pulse.api.services.simulation_service import (
    load_latest_run_into_state,
    _persisted_simulation_state, _has_persisted_simulation,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/v1/health")
async def health():
    db = _state.get("db")
    in_memory = _state.get("mc_result") is not None
    persisted = _persisted_simulation_state()
    has_sim = in_memory or persisted["has"]
    # `simulation_reason` is the diagnostic code when has_simulation is False:
    #   "ok"        — simulation is available (in-memory or DB-persisted)
    #   "no_rows"   — DB reachable, simulation_runs is empty
    #   "malformed" — rows exist but latest is missing shift_matrix
    #   "db_error"  — DB unreachable / query failed (error in `simulation_error`)
    return {
        "status": "ok",
        "version": __version__,
        "model_loaded": db is not None,
        "trend_count": db.trend_count if db else 0,
        "categories": len(db.categories) if db else 0,
        "has_simulation": has_sim,
        "simulation_reason": "ok" if has_sim else persisted["reason"],
        "simulation_error": None if has_sim else persisted.get("error"),
        "latest_run_id": persisted.get("latest_run_id"),
    }

# ── Diagnostics (public — no auth, no credentials exposed) ─────
@router.get("/api/v1/diagnostics")
async def diagnostics():
    """Diagnostic snapshot for dashboard + the scripts/diagnose_prism.py tool.

    Returns the same shape as pulse.database.diagnose_connection() plus
    a simulation_reason code that mirrors /api/v1/health. No credentials
    or secrets are ever returned — only the DB hostname.
    """
    try:
        from pulse.database import diagnose_connection
        diag = diagnose_connection()
    except Exception as e:
        return JSONResponse(
            status_code=200,
            content={
                "db_mode": "unknown",
                "db_host": None,
                "db_url_env": None,
                "db_reachable": False,
                "simulation_run_count": 0,
                "latest_run_id": None,
                "latest_run_date": None,
                "latest_iterations": None,
                "latest_has_shift_matrix": False,
                "latest_has_decompositions": False,
                "latest_has_totals": False,
                "latest_has_vc_decomposition": False,
                "error": f"{type(e).__name__}: {e}",
                "simulation_reason": "db_error",
                "in_memory_simulation": _state.get("mc_result") is not None,
                "version": __version__,
            },
        )
    persisted = _persisted_simulation_state()
    return {
        **diag,
        "simulation_reason": "ok" if (persisted["has"] or _state.get("mc_result")) else persisted["reason"],
        "in_memory_simulation": _state.get("mc_result") is not None,
        "version": __version__,
    }

# ── Manual Seed + Simulate (for Vercel debugging) ──────────────
@router.post("/api/v1/seed")
async def manual_seed(user: dict = Depends(require_admin)):
    """Manually trigger seeding + simulation. Use when auto-seed fails."""
    import traceback
    steps = []
    try:
        from pulse.database import init_db, load_trends, save_trends, USE_POSTGRES, POSTGRES_URL
        steps.append(f"db_mode=postgres:{USE_POSTGRES}, url_set={bool(POSTGRES_URL)}")

        init_db()
        steps.append("init_db OK")

        db_trends = load_trends()
        steps.append(f"existing_trends={len(db_trends)}")

        # Always re-seed to update source URLs and any trend metadata changes
        from pulse.seed_trends import get_report_trends
        seed = get_report_trends()
        steps.append(f"seed_trends_loaded={len(seed)}")
        save_trends(seed)
        steps.append("save_trends OK (re-seeded)")
        db_trends = load_trends()
        steps.append(f"after_seed_count={len(db_trends)}")

        # Rebuild TrendDatabase in memory
        _state["db"] = TrendDatabase(
            trends=db_trends, categories=CATEGORIES, forces=FORCES, source_file="database",
        )
        steps.append(f"trend_database_count={_state['db'].trend_count}")

        # Ensure config is initialized (but do NOT auto-simulate)
        config = _state.get("config") or ModelConfig()
        _state["config"] = config
        # Mark simulation as stale — admin must press Simulate
        _state["simulation_stale"] = True
        _state["stale_reason"] = "Trends re-seeded. Press Simulate to update results."
        steps.append("simulation marked stale (press Simulate to run)")

        return {"status": "ok", "steps": steps}

    except Exception as e:
        steps.append(f"ERROR: {type(e).__name__}: {e}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "steps": steps, "traceback": traceback.format_exc()},
        )

# ── Trends ──────────────────────────────────────────────────────
