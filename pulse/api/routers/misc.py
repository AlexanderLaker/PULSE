"""Session snapshot routes — extracted from pulse/api/app.py (June 2026 split, review F4)."""
import json
import logging
from typing import Optional, Any

import numpy as np
from fastapi import APIRouter, HTTPException, Depends

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
    load_latest_run_into_state, auto_run_startup_simulation,
    _persisted_simulation_state, _has_persisted_simulation,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Session Snapshots (Persistent History) ──────────────────────
@router.get("/api/v1/snapshots")
async def list_snapshots(user: dict = Depends(require_auth)):
    """List all session snapshots, newest first. Never deleted."""
    try:
        from pulse.database import get_db_connection, _row_to_dict
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, name, created_at, shifts, trends,
                       trend_count, net_shift, notes, created_by, model_version, iterations
                FROM session_snapshots
                ORDER BY created_at DESC
            """)
            rows = cursor.fetchall()
            snapshots = []
            for raw_row in rows:
                row = _row_to_dict(raw_row)
                snap = dict(row)
                # Parse JSON fields
                try:
                    snap["shifts"] = json.loads(snap["shifts"]) if snap["shifts"] else {}
                except (json.JSONDecodeError, TypeError):
                    snap["shifts"] = {}
                try:
                    snap["trends"] = json.loads(snap["trends"]) if snap["trends"] else []
                except (json.JSONDecodeError, TypeError):
                    snap["trends"] = []
                snapshots.append(snap)
            return snapshots
    except Exception as e:
        logger.error(f"Failed to list snapshots: {e}")
        return []

@router.post("/api/v1/snapshots")
async def create_snapshot(req: SnapshotCreate, user: dict = Depends(require_auth)):
    """Create a new session snapshot. Snapshots are permanent — never auto-deleted."""
    import uuid
    from pulse.database import get_db_connection, placeholder, ph, _row_to_dict
    snapshot_id = f"snap_{uuid.uuid4().hex[:12]}"
    p = placeholder()
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"""
                INSERT INTO session_snapshots
                    (id, name, shifts, trends, trend_count, net_shift, notes, model_version)
                VALUES ({ph(8)})
            """, (
                snapshot_id,
                req.name,
                json.dumps(req.shifts),
                json.dumps(req.trends),
                req.trend_count,
                req.net_shift,
                req.notes,
                __version__,
            ))
            conn.commit()
            # Fetch the created row to return full data
            cursor.execute(f"""
                SELECT id, name, created_at, shifts, trends,
                       trend_count, net_shift, notes, created_by, model_version, iterations
                FROM session_snapshots WHERE id = {p}
            """, (snapshot_id,))
            raw_row = cursor.fetchone()
            if raw_row:
                row = _row_to_dict(raw_row)
                snap = dict(row)
                try:
                    snap["shifts"] = json.loads(snap["shifts"]) if snap["shifts"] else {}
                except (json.JSONDecodeError, TypeError):
                    snap["shifts"] = {}
                try:
                    snap["trends"] = json.loads(snap["trends"]) if snap["trends"] else []
                except (json.JSONDecodeError, TypeError):
                    snap["trends"] = []
                return snap
        return {"id": snapshot_id, "status": "created"}
    except Exception as e:
        logger.error(f"Failed to create snapshot: {e}")
        raise HTTPException(500, f"Snapshot creation failed: {str(e)}")

@router.get("/api/v1/snapshots/{snapshot_id}")
async def get_snapshot(snapshot_id: str, user: dict = Depends(require_auth)):
    """Get a single snapshot by ID."""
    from pulse.database import get_db_connection, placeholder, _row_to_dict
    p = placeholder()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f"SELECT * FROM session_snapshots WHERE id = {p}", (snapshot_id,))
        raw_row = cursor.fetchone()
        if not raw_row:
            raise HTTPException(404, "Snapshot not found")
        row = _row_to_dict(raw_row)
        snap = dict(row)
        try:
            snap["shifts"] = json.loads(snap["shifts"]) if snap["shifts"] else {}
        except (json.JSONDecodeError, TypeError):
            snap["shifts"] = {}
        try:
            snap["trends"] = json.loads(snap["trends"]) if snap["trends"] else []
        except (json.JSONDecodeError, TypeError):
            snap["trends"] = []
        return snap
