"""Competitor intelligence routes — extracted from pulse/api/app.py (June 2026 split, review F4)."""
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


@router.get("/api/v1/competitors")
async def get_competitors(user: dict = Depends(require_auth)):
    """Get all competitor profiles."""
    try:
        from pulse.api.seed_data import get_competitor_profiles
        profiles = get_competitor_profiles()
        return [{"id": p.id, "name": p.name, "archetype": p.archetype,
                "hair_exposure": p.hair_exposure, "lhc_exposure": p.lhc_exposure,
                "response_speed": p.response_speed, "typical_responses": p.typical_responses,
                "category_exposure": p.category_exposure} for p in profiles]
    except Exception as e:
        logger.error(f"Failed to get competitors: {e}")
        raise HTTPException(500, str(e))

@router.get("/api/v1/competitors/intelligence")
async def get_competitive_intelligence(user: dict = Depends(require_auth)):
    """Get comprehensive competitive intelligence."""
    try:
        from pulse.api.seed_data import get_seed_competitive_intelligence
        return get_seed_competitive_intelligence()
    except Exception as e:
        logger.error(f"Failed to get competitive intelligence: {e}")
        raise HTTPException(500, str(e))

@router.get("/api/v1/competitors/{competitor_id}")
async def get_competitor(competitor_id: str, user: dict = Depends(require_auth)):
    """Get a single competitor's profile and intelligence."""
    try:
        from pulse.api.seed_data import get_competitor_profiles, get_seed_competitive_intelligence
        profiles = get_competitor_profiles()
        profile = next((p for p in profiles if p.id == competitor_id), None)
        if not profile:
            raise HTTPException(404, f"Competitor {competitor_id} not found")
        intel = get_seed_competitive_intelligence()
        comp_intel = intel.get("competitors", {}).get(competitor_id, {})
        return {
            "profile": {"id": profile.id, "name": profile.name, "archetype": profile.archetype,
                       "hair_exposure": profile.hair_exposure, "lhc_exposure": profile.lhc_exposure,
                       "response_speed": profile.response_speed, "typical_responses": profile.typical_responses,
                       "category_exposure": profile.category_exposure},
            "intelligence": comp_intel,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get competitor {competitor_id}: {e}")
        raise HTTPException(500, str(e))
# ── AI Chat endpoint ─────────────────────────────────────────
