"""Session snapshot routes — extracted from pulse/api/app.py (June 2026 split, review F4)."""
import json
import logging
from typing import Optional, Any

import numpy as np
from fastapi import APIRouter, HTTPException, Depends

from pulse import __version__
from pulse.config import ModelConfig, FORCES, CATEGORIES
from pulse.ingestion.models import Trend, TrendDatabase
from pulse.api.auth import require_auth, require_admin, identity_from_user
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

# M12 (July 2026 review): snapshots are viewer-writable session state — an
# unbounded write path into Neon. Caps below; retention keeps the newest
# snapshots per creator and drops the oldest beyond the cap.
MAX_SNAPSHOT_BYTES = 512 * 1024   # serialized shifts+trends payload
MAX_SNAPSHOTS_PER_USER = 50


# ── Session Snapshots (Persistent History) ──────────────────────
@router.get("/api/v1/snapshots")
async def list_snapshots(user: dict = Depends(require_auth)):
    """List all session snapshots, newest first.

    Retention (M12): the newest MAX_SNAPSHOTS_PER_USER per creator are kept;
    older ones are pruned when that creator saves a new snapshot.
    """
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
    """Create a new session snapshot.

    M12 (July 2026 review): payload capped at MAX_SNAPSHOT_BYTES and the
    newest MAX_SNAPSHOTS_PER_USER snapshots are retained per creator (the
    oldest beyond the cap are pruned in the same transaction). Snapshots
    are attributed to the verified JWT identity.
    """
    import uuid
    from pulse.database import get_db_connection, placeholder, ph, _row_to_dict
    shifts_json = json.dumps(req.shifts)
    trends_json = json.dumps(req.trends)
    # Adversarial re-review 2026-07-06: cap the TOTAL persisted bytes —
    # the original cap measured only shifts+trends, so multi-MB `name`/
    # `notes` strings slipped past it. (Belt: schema max_length; braces:
    # this total check.)
    payload_bytes = (
        len(shifts_json.encode()) + len(trends_json.encode())
        + len((req.name or "").encode()) + len((req.notes or "").encode())
    )
    if payload_bytes > MAX_SNAPSHOT_BYTES:
        raise HTTPException(
            413,
            f"Snapshot payload too large ({payload_bytes // 1024} KB > "
            f"{MAX_SNAPSHOT_BYTES // 1024} KB). Snapshots store view state, "
            f"not full result bundles.",
        )
    creator, _, _ = identity_from_user(user)
    snapshot_id = f"snap_{uuid.uuid4().hex[:12]}"
    p = placeholder()
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"""
                INSERT INTO session_snapshots
                    (id, name, shifts, trends, trend_count, net_shift, notes,
                     model_version, created_by)
                VALUES ({ph(9)})
            """, (
                snapshot_id,
                req.name,
                shifts_json,
                trends_json,
                req.trend_count,
                req.net_shift,
                req.notes,
                __version__,
                creator,
            ))
            # Retention: prune this creator's oldest snapshots beyond the cap.
            cursor.execute(
                f"SELECT id FROM session_snapshots WHERE created_by = {p} "
                f"ORDER BY created_at DESC",
                (creator,),
            )
            ids = [_row_to_dict(r)["id"] for r in cursor.fetchall()]
            for old_id in ids[MAX_SNAPSHOTS_PER_USER:]:
                cursor.execute(
                    f"DELETE FROM session_snapshots WHERE id = {p}", (old_id,)
                )
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
