"""Trend CRUD + reseed/sync routes — extracted from pulse/api/app.py (June 2026 split, review F4)."""
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
    ConfigUpdate, SnapshotCreate, ProposalUpdate,
)
from pulse.api.proposals import build_proposals_response
from pulse.api.services.simulation_service import (
    load_latest_run_into_state,
    _persisted_simulation_state, _has_persisted_simulation,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/v1/trends")
async def list_trends(force: Optional[str] = None, user: dict = Depends(require_auth)):
    db = _state.get("db")
    if not db:
        raise HTTPException(404, "No model loaded")
    trends = db.trends
    if force:
        trends = [t for t in trends if t.force == force]

    # Multi-expert proposal summaries (June 2026): one DB round-trip for all
    # trends; degrades to empty (no summaries) if the store is unavailable.
    from pulse.api.proposals import build_proposal_summary
    user_id, _, _ = _identity_from_user(user)
    try:
        from pulse.database import load_all_trend_proposals
        proposals_by_trend = load_all_trend_proposals()
    except Exception as e:
        logger.warning(f"list_trends: proposal summaries unavailable ({e})")
        proposals_by_trend = {}

    def _build_sources(t):
        """Get structured sources array with URLs from trend."""
        sources = getattr(t, 'sources', None) or []
        if sources:
            # Ensure tier field is included if present
            return [
                {
                    "title": s.get("title", ""),
                    "url": s.get("url", ""),
                    "data": s.get("data", ""),
                    "tier": s.get("tier", "")
                }
                for s in sources
            ]
        # Try parsing data_source as JSON (structured sources)
        if t.data_source:
            try:
                parsed = json.loads(t.data_source)
                if isinstance(parsed, list):
                    return [
                        {
                            "title": s.get("title", ""),
                            "url": s.get("url", ""),
                            "data": s.get("data", ""),
                            "tier": s.get("tier", "")
                        }
                        for s in parsed
                    ]
            except (json.JSONDecodeError, TypeError):
                pass
            # Fallback: parse data_source text
            result = []
            for part in t.data_source.split(';'):
                part = part.strip()
                if part:
                    result.append({"title": part, "url": "", "data": t.source_type or "", "tier": ""})
            return result
        return []

    return [{
        "id": t.id, "force": t.force, "sub_category": t.sub_category,
        "name": t.name, "direction": t.direction,
        "probability": t.probability,
        "normalized_score": t.normalized_score,
        "gp1_shift": t.normalized_score,
        "gp1_pct_affected": t.gp1_pct_affected,
        "start_year": t.start_year,
        "category_exposure": t.category_exposure,
        "vc_exposure": t.vc_exposure,
        "regional_exposure": t.regional_exposure,
        "journey_exposure": getattr(t, "journey_exposure", None) or {},
        "description": t.description,
        "strategic_implication": t.strategic_implication,
        "data_source": t.data_source,
        "source_type": t.source_type,
        "sources": _build_sources(t),
        "confidence": t.confidence, "ai_suggested": t.ai_suggested,
        "user_override": t.user_override,
        "scorer_count": t.scorer_count,
        "score_variance": t.score_variance,
        "probability_posterior": {"alpha": t.probability_posterior[0], "beta": t.probability_posterior[1]} if t.probability_posterior else None,
        "peak_year": getattr(t, 'peak_year', 0),
        "diffusion_curve": getattr(t, 'diffusion_curve', 's_curve'),
        "ai_suggestion": getattr(t, 'ai_suggestion', None),
        "proposal_summary": build_proposal_summary(proposals_by_trend.get(t.id, []), user_id),
    } for t in trends]

@router.post("/api/v1/trends")
async def create_trend(req: TrendCreate, user: dict = Depends(require_admin)):
    """Create a new trend."""
    db = _state.get("db")
    if not db:
        raise HTTPException(404, "No model loaded")

    # Validate force name
    if req.force not in FORCES:
        raise HTTPException(422, f"Invalid force: {req.force}. Must be one of {FORCES}")

    # E1: source-credibility gate — refuse trends with no usable
    # evidence base. Tier-E (social media / unverified) is allowed
    # only as a corroborating signal alongside a B-tier-or-better
    # source. We catch the gate error and convert to a 422 so the
    # API caller sees a structured rejection rather than a 500.
    from pulse.seed_trends import assert_trend_credible, TierEGateError
    try:
        assert_trend_credible(f"new_trend({req.name!r})", req.sources or [])
    except TierEGateError as gate_err:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "Source credibility gate failed",
                "reason": str(gate_err),
                "guidance": "Attach at least one source rated S/A/A-/B+/B/B-/C "
                            "before the trend can be added to the model.",
            },
        )

    import uuid
    trend_id = f"{req.force.lower().replace(' ', '_')}_{uuid.uuid4().hex[:8]}"

    # Build category exposure — if not provided, assign moderate exposure
    # to all categories (will be refined by user later)
    cat_exp = req.category_exposure or {c: 3 for c in CATEGORIES}
    vc_exp = req.vc_exposure or {}
    reg_exp = req.regional_exposure or {}
    journey_exp = req.journey_exposure or {}

    new_trend = Trend(
        id=trend_id,
        force=req.force,
        name=req.name,
        description=req.description,
        direction=req.direction,
        probability=req.probability,
        start_year=2026,
        strategic_implication=req.strategic_implication,
        category_exposure=cat_exp,
        vc_exposure=vc_exp,
        regional_exposure=reg_exp,
        journey_exposure=journey_exp,
        data_source=req.data_source,
        source_type="scanner",
        confidence=req.confidence,
        ai_suggested=req.ai_suggested,
        gp1_pct_affected=req.gp1_pct_affected or 0.10,
        peak_year=req.peak_year or 0,
        diffusion_curve=req.diffusion_curve or "s_curve",
    )

    # Persist to database
    from pulse.database import save_trends
    save_trends([new_trend])

    # Add to in-memory TrendDatabase
    db.trends.append(new_trend)

    # Log to audit trail
    try:
        from pulse.database import log_audit
        log_audit("trend_added", "trend", trend_id, new_value=req.name,
                  reason=f"Added from scanner: {req.force}",
                  user_id=identity_from_user(user)[0])
    except Exception:
        pass

    # Mark simulation as stale
    _state["simulation_stale"] = True
    _state["stale_reason"] = f"New trend '{req.name}' was added"

    return {
        "status": "created",
        "trend_id": trend_id,
        "force": req.force,
        "name": req.name,
        "trend_count": db.trend_count,
    }

@router.post("/api/v1/trends/revert-to-seed")
async def revert_trends_to_seed(user: dict = Depends(require_admin)):
    # (Adversarial re-review 2026-07-06: POST-only, matching full-reseed —
    #  a state-mutating GET is a CSRF-shaped surface even behind admin auth.)
    """Revert ALL trend probability scores back to seed_trends.py original values.

    This undoes any manual edits to probability.
    Also resets debiasing_applied to False and score_variance to 0.
    """
    from pulse.seed_trends import get_report_trends
    from pulse.database import load_trends, save_trends, log_audit

    seed_trends = get_report_trends()
    db_trends = load_trends()

    seed_map = {t.id: t for t in seed_trends}
    changes = []

    for t in db_trends:
        seed = seed_map.get(t.id)
        if not seed:
            continue
        if t.probability != seed.probability or t.debiasing_applied:
            changes.append({
                "id": t.id,
                "name": t.name,
                "old_probability": t.probability,
                "new_probability": seed.probability,
                "debiasing_was": t.debiasing_applied,
            })
            t.probability = seed.probability
            t.debiasing_applied = False
            t.score_variance = 0.0
            t.scorer_count = 1
            # Recalculate normalized_score
            t.__post_init__()

    if not changes:
        return {"status": "no_changes", "message": "All trends already match seed values"}

    try:
        save_trends(db_trends)
    except Exception as e:
        raise HTTPException(500, f"Failed to save reverted trends: {e}")

    # Refresh in-memory state
    db_trends = load_trends()
    db = _state.get("db")
    if db:
        db.trends = db_trends
        _state["simulation_stale"] = True
        _state["stale_reason"] = f"Reverted {len(changes)} trends to seed values"

    try:
        log_audit(
            "trends_reverted_to_seed",
            "trend",
            "all",
            old_value=f"{len(changes)} trends had modified probabilities",
            new_value="All probabilities reset to seed_trends.py",
            reason="User requested revert to seed scores",
            user_id=identity_from_user(user)[0],
        )
    except Exception:
        pass

    return {
        "status": "reverted",
        "changes": changes,
        "changes_count": len(changes),
        "total_trends": len(db_trends),
    }

@router.post("/api/v1/trends/full-reseed")
async def full_reseed(user: dict = Depends(require_admin)):
    """Replace ALL trends in DB with current seed_trends.py values.

    C1 (July 2026 review): admin-only and POST-only. This endpoint replaces
    the entire production trend base — it previously accepted an
    unauthenticated GET, i.e. any browser hitting the URL wiped and
    reseeded prod. Every legitimate caller is an admin running a deliberate
    reseed after editing seed_trends.py.

    Unlike revert-to-seed (which only resets probability), this replaces
    every field: descriptions, gp1_pct_affected, exposures, etc.

    Also deletes orphaned trends whose IDs are no longer in seed_trends.py
    (e.g. retired trends like consumer_r12 and customer_r05 in v3.1).
    """
    from pulse.seed_trends import get_report_trends
    from pulse.database import (
        load_trends, save_trends, log_audit,
        get_db_connection, placeholder,
    )

    seed_trends = get_report_trends()
    old_trends = load_trends()
    old_count = len(old_trends)

    # Compute orphan IDs — trends in DB that are NOT in the new seed list
    seed_ids = {t.id for t in seed_trends}
    db_ids = {t.id for t in old_trends}
    orphan_ids = sorted(db_ids - seed_ids)

    # Delete orphans from all related tables before upserting the new seed
    if orphan_ids:
        p = placeholder()
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                for oid in orphan_ids:
                    cursor.execute(f"DELETE FROM trend_sources WHERE trend_id = {p}", (oid,))
                    cursor.execute(f"DELETE FROM trend_category_exposure WHERE trend_id = {p}", (oid,))
                    cursor.execute(f"DELETE FROM trend_vc_exposure WHERE trend_id = {p}", (oid,))
                    cursor.execute(f"DELETE FROM trend_regional_exposure WHERE trend_id = {p}", (oid,))
                    cursor.execute(f"DELETE FROM trend_journey_exposure WHERE trend_id = {p}", (oid,))
                    cursor.execute(f"DELETE FROM trends WHERE id = {p}", (oid,))
                conn.commit()
        except Exception as e:
            raise HTTPException(500, f"Failed to delete orphaned trends: {e}")

    try:
        save_trends(seed_trends)
    except Exception as e:
        raise HTTPException(500, f"Failed to save reseeded trends: {e}")

    # Reload from DB and refresh in-memory state
    db_trends = load_trends()
    db = _state.get("db")
    if db:
        db.trends = db_trends
        _state["simulation_stale"] = True
        _state["stale_reason"] = "Full reseed from seed_trends.py"

    try:
        log_audit(
            "trends_full_reseed",
            "trend",
            "all",
            old_value=f"{old_count} trends replaced (orphans removed: {orphan_ids})",
            new_value=f"{len(db_trends)} trends from seed_trends.py",
            reason="Full reseed — descriptions, parameters, exposures all refreshed",
            user_id=identity_from_user(user)[0],
        )
    except Exception:
        pass

    return {
        "status": "reseeded",
        "old_count": old_count,
        "new_count": len(db_trends),
        "orphans_deleted": orphan_ids,
        "orphans_deleted_count": len(orphan_ids),
        "message": f"All {len(db_trends)} trends replaced from seed_trends.py",
    }

@router.get("/api/v1/trends/{trend_id}")
async def get_trend(trend_id: str, user: dict = Depends(require_auth)):
    db = _state.get("db")
    if not db:
        raise HTTPException(404, "No model loaded")
    trend = db.get_trend_by_id(trend_id)
    if not trend:
        raise HTTPException(404, f"Trend {trend_id} not found")

    # Multi-expert proposal summary (June 2026): cheap per-trend load.
    from pulse.api.proposals import build_proposal_summary
    user_id, _, _ = _identity_from_user(user)
    try:
        from pulse.database import load_trend_proposals
        _prop_rows = load_trend_proposals(trend_id)
    except Exception as e:
        logger.warning(f"get_trend: proposal summary unavailable ({e})")
        _prop_rows = []

    return {
        "id": trend.id, "force": trend.force, "name": trend.name,
        "description": trend.description, "direction": trend.direction,
        "probability": trend.probability,
        "start_year": trend.start_year, "normalized_score": trend.normalized_score,
        "strategic_implication": trend.strategic_implication,
        "gp1_pct_affected": trend.gp1_pct_affected,
        "category_exposure": trend.category_exposure,
        "vc_exposure": trend.vc_exposure,
        "regional_exposure": trend.regional_exposure,
        "journey_exposure": getattr(trend, "journey_exposure", None) or {},
        "confidence": trend.confidence, "ai_suggested": trend.ai_suggested,
        "probability_posterior": trend.probability_posterior,
        "scorer_count": trend.scorer_count,
        "score_variance": trend.score_variance,
        "ai_suggestion": getattr(trend, "ai_suggestion", None),
        "proposal_summary": build_proposal_summary(_prop_rows, user_id),
    }

@router.put("/api/v1/trends/{trend_id}")
async def update_trend(trend_id: str, update: TrendUpdate, user: dict = Depends(require_admin)):
    db = _state.get("db")
    if not db:
        raise HTTPException(404, "No model loaded")
    trend = db.get_trend_by_id(trend_id)
    if not trend:
        raise HTTPException(404, f"Trend {trend_id} not found")

    audit = _state["audit"]
    actor_id, _, _ = identity_from_user(user)  # M3: attribute edits to the verified JWT identity
    if update.probability is not None:
        audit.log_score_change(trend_id, "probability", trend.probability,
                               update.probability, user_id=actor_id)
        trend.probability = max(1, min(5, update.probability))
    if update.direction is not None:
        trend.direction = update.direction
    if update.gp1_pct_affected is not None:
        audit.log("score_change", "trend", trend_id,
                   old_value=str(trend.gp1_pct_affected),
                   new_value=str(update.gp1_pct_affected),
                   reason="gp1_pct_affected update",
                   user_id=actor_id)
        trend.gp1_pct_affected = max(0.0, min(1.0, update.gp1_pct_affected))
    if update.category_exposure is not None:
        trend.category_exposure = update.category_exposure
    if update.vc_exposure is not None:
        trend.vc_exposure = update.vc_exposure
    if update.regional_exposure is not None:
        trend.regional_exposure = update.regional_exposure
    if update.journey_exposure is not None:
        # Validate namespaced stage keys ("<journey>:<stage_id>") against
        # the journey taxonomy before accepting admin edits.
        from pulse.config import JOURNEY_STAGES
        for k, v in update.journey_exposure.items():
            journey, _, stage = str(k).partition(":")
            if journey not in JOURNEY_STAGES or stage not in JOURNEY_STAGES[journey]:
                raise HTTPException(422, f"Invalid journey stage key: {k}")
            if not isinstance(v, (int, float)) or not (0 <= v <= 5):
                raise HTTPException(422, f"Invalid journey exposure for {k}: {v} (0-5)")
        trend.journey_exposure = update.journey_exposure
    if update.name is not None:
        trend.name = update.name
    if update.description is not None:
        trend.description = update.description
    if update.strategic_implication is not None:
        trend.strategic_implication = update.strategic_implication
    if update.sources is not None:
        # Store structured sources as JSON in data_source
        if isinstance(update.sources, list) and len(update.sources) > 0 and isinstance(update.sources[0], dict):
            import json as _json
            trend.data_source = _json.dumps(update.sources)
        elif isinstance(update.sources, str):
            trend.data_source = update.sources
        else:
            trend.data_source = "; ".join(str(s) for s in update.sources)
    if update.peak_year is not None:
        trend.peak_year = update.peak_year
    if update.diffusion_curve is not None:
        from pulse.config import VALID_DIFFUSION_CURVES
        if update.diffusion_curve not in VALID_DIFFUSION_CURVES:
            raise HTTPException(422, f"Invalid diffusion_curve. Must be one of {VALID_DIFFUSION_CURVES}")
        trend.diffusion_curve = update.diffusion_curve
    # D7 (June 2026): any score-bearing admin edit marks the trend as
    # expert-reviewed — drives the "AI suggestion · expert-reviewed" chip.
    if any(v is not None for v in (update.probability, update.direction,
                                   update.gp1_pct_affected, update.category_exposure,
                                   update.vc_exposure, update.regional_exposure,
                                   update.journey_exposure,
                                   update.peak_year, update.diffusion_curve)):
        trend.user_override = True
    trend.__post_init__()

    # Persist updated exposures
    from pulse.database import save_trends
    save_trends([trend])

    # Mark simulation as stale
    _state["simulation_stale"] = True
    _state["stale_reason"] = f"Trend '{trend_id}' was updated"

    return {"status": "updated", "trend_id": trend_id}

# M3 (July 2026 review): identity derivation moved to pulse.api.auth so every
# router attributes audit entries from the same verified-JWT source.
_identity_from_user = identity_from_user


def _proposals_payload(trend_id: str, user_id: str | None) -> dict:
    """Load + shape the full proposals response for a trend."""
    from pulse.database import load_trend_proposals
    rows = load_trend_proposals(trend_id)
    return build_proposals_response(trend_id, rows, user_id)


@router.get("/api/v1/trends/{trend_id}/proposals")
async def get_trend_proposals(trend_id: str, user: dict = Depends(require_auth)):
    """Multi-expert score proposals for a trend (authenticated read).

    Returns the caller's own proposal (`my`), the cross-expert aggregate
    (means/median/mode + per-cell exposure aggregates), and a named
    "who scored what" breakdown (`scorers`).
    """
    db = _state.get("db")
    if not db:
        raise HTTPException(404, "No model loaded")
    if not db.get_trend_by_id(trend_id):
        raise HTTPException(404, f"Trend {trend_id} not found")
    user_id, _, _ = _identity_from_user(user)
    try:
        from pulse.database import init_db
        init_db()
        return _proposals_payload(trend_id, user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"get_trend_proposals failed for {trend_id}: {e}")
        raise HTTPException(503, "Proposals store unavailable")


@router.put("/api/v1/trends/{trend_id}/proposals")
async def put_trend_proposal(
    trend_id: str, proposal: ProposalUpdate, user: dict = Depends(require_auth)
):
    """Upsert the CALLER's own partial score proposal for a trend.

    ANY authenticated user may write their own row (not admin-only). The body
    is a partial object: only the fields actually sent are merged into the
    caller's existing row; unspecified fields are never wiped. Ranges are
    validated/clamped; an unknown diffusion_curve is rejected with 400. This
    does NOT change the live trend — endorsement is a separate admin action
    via PUT /trends/{id}.
    """
    db = _state.get("db")
    if not db:
        raise HTTPException(404, "No model loaded")
    if not db.get_trend_by_id(trend_id):
        raise HTTPException(404, f"Trend {trend_id} not found")

    user_id, user_name, user_role = _identity_from_user(user)

    # Only the fields the client actually sent (pydantic v2): distinguishes
    # "absent" (leave untouched) from "explicitly null".
    sent = proposal.model_fields_set
    fields: dict = {}

    if "probability" in sent and proposal.probability is not None:
        fields["probability"] = max(1, min(5, int(proposal.probability)))
    if "gp1_pct_affected" in sent and proposal.gp1_pct_affected is not None:
        fields["gp1_pct_affected"] = max(0.0, min(1.0, float(proposal.gp1_pct_affected)))
    if "peak_year" in sent and proposal.peak_year is not None:
        fields["peak_year"] = int(proposal.peak_year)
    if "diffusion_curve" in sent and proposal.diffusion_curve is not None:
        from pulse.config import VALID_DIFFUSION_CURVES
        if proposal.diffusion_curve not in VALID_DIFFUSION_CURVES:
            raise HTTPException(
                400, f"Invalid diffusion_curve. Must be one of {VALID_DIFFUSION_CURVES}"
            )
        fields["diffusion_curve"] = proposal.diffusion_curve

    # Exposure maps: clamp every cell to 0..5, drop non-numeric values.
    def _clean_exposure(m: dict) -> dict:
        out = {}
        for k, v in (m or {}).items():
            try:
                fv = float(v)
            except (TypeError, ValueError):
                continue
            out[str(k)] = max(0.0, min(5.0, fv))
        return out

    for mfield in ("category_exposure", "regional_exposure", "vc_exposure"):
        if mfield in sent:
            val = getattr(proposal, mfield)
            fields[mfield] = _clean_exposure(val) if val is not None else None

    # Free-text comment: trim whitespace, cap length, store empty as NULL.
    if "comment" in sent:
        text = (proposal.comment or "").strip()
        fields["comment"] = text[:2000] if text else None

    try:
        from pulse.database import init_db, upsert_trend_proposal
        init_db()
        upsert_trend_proposal(
            trend_id, user_id, fields, user_name=user_name, user_role=user_role
        )
        return _proposals_payload(trend_id, user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"put_trend_proposal failed for {trend_id}/{user_id}: {e}")
        raise HTTPException(503, "Failed to persist proposal")


@router.delete("/api/v1/trends/{trend_id}")
async def delete_trend(trend_id: str, user: dict = Depends(require_admin)):
    """Delete a trend from the model."""
    db = _state.get("db")
    if not db:
        raise HTTPException(404, "No model loaded")
    trend = db.get_trend_by_id(trend_id)
    if not trend:
        raise HTTPException(404, f"Trend {trend_id} not found")

    # Remove from in-memory database
    db.trends = [t for t in db.trends if t.id != trend_id]

    # Remove from persistent database
    try:
        from pulse.database import get_db_connection, placeholder, init_db
        init_db()
        p = placeholder()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"DELETE FROM trends WHERE id = {p}", (trend_id,))
            cursor.execute(f"DELETE FROM trend_category_exposure WHERE trend_id = {p}", (trend_id,))
            cursor.execute(f"DELETE FROM trend_vc_exposure WHERE trend_id = {p}", (trend_id,))
            cursor.execute(f"DELETE FROM trend_journey_exposure WHERE trend_id = {p}", (trend_id,))
            conn.commit()
    except Exception as e:
        logger.warning(f"Failed to delete trend from DB: {e}")

    # Audit log
    try:
        from pulse.database import log_audit
        log_audit("trend_deleted", "trend", trend_id, old_value=trend.name,
                  reason="User deleted trend",
                  user_id=identity_from_user(user)[0])
    except Exception:
        pass

    # Mark simulation as stale
    _state["simulation_stale"] = True
    _state["stale_reason"] = f"Trend '{trend_id}' was deleted"

    return {"status": "deleted", "trend_id": trend_id, "trend_count": db.trend_count}

@router.delete("/api/v1/trends")
async def delete_all_trends(user: dict = Depends(require_admin)):
    """Delete ALL trends from the model. Use with caution."""
    db = _state.get("db")
    if not db:
        raise HTTPException(404, "No model loaded")

    count = len(db.trends)
    db.trends = []

    # Clear persistent database
    try:
        from pulse.database import get_db_connection, init_db
        init_db()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM trends")
            cursor.execute("DELETE FROM trend_category_exposure")
            cursor.execute("DELETE FROM trend_vc_exposure")
            cursor.execute("DELETE FROM trend_journey_exposure")
            conn.commit()
    except Exception as e:
        logger.warning(f"Failed to clear trends from DB: {e}")

    # Audit log
    try:
        from pulse.database import log_audit
        log_audit("all_trends_deleted", "trend", "all",
                  reason=f"Cleared {count} trends",
                  user_id=identity_from_user(user)[0])
    except Exception:
        pass

    # Mark simulation as stale
    _state["simulation_stale"] = True
    _state["stale_reason"] = f"All {count} trends were deleted"

    return {"status": "deleted_all", "trends_deleted": count}

@router.post("/api/v1/trends/sync")
async def sync_missing_trends(user: dict = Depends(require_admin)):
    """Explicitly sync missing trends from seed_trends.py into the database.

    Compares current DB trend IDs against seed_trends.py and inserts
    only the specific trends that are missing. Does NOT delete existing trends.
    User-triggered only — never runs automatically.
    """
    from pulse.seed_trends import get_report_trends
    from pulse.database import load_trends, save_trends

    seed_trends = get_report_trends()
    db_trends = load_trends()

    db_ids = {t.id for t in db_trends}
    seed_ids = {t.id for t in seed_trends}
    missing_ids = seed_ids - db_ids

    if not missing_ids:
        return {
            "status": "already_in_sync",
            "db_count": len(db_trends),
            "seed_count": len(seed_trends),
            "missing": [],
        }

    # Insert only missing trends (save_trends does delete-then-insert for ALL,
    # so we merge: keep existing DB trends + add missing from seed)
    missing_trends = [t for t in seed_trends if t.id in missing_ids]

    # We need to save the full set (existing + missing) since save_trends replaces all
    merged = db_trends + missing_trends
    try:
        save_trends(merged)
    except Exception as e:
        raise HTTPException(500, f"Failed to save trends: {e}")

    # Reload from DB and refresh in-memory state
    db_trends = load_trends()
    db = _state.get("db")
    if db:
        db.trends = db_trends
        _state["simulation_stale"] = True
        _state["stale_reason"] = f"Synced {len(missing_ids)} missing trends"

    # Audit log
    try:
        from pulse.database import log_audit
        log_audit(
            "trends_synced",
            "trend",
            ",".join(sorted(missing_ids)),
            reason=f"Added {len(missing_ids)} missing trends from seed_trends.py",
            user_id=identity_from_user(user)[0],
        )
    except Exception:
        pass

    return {
        "status": "synced",
        "added": sorted(missing_ids),
        "added_count": len(missing_ids),
        "total_count": len(db_trends),
    }

# ── Simulation Status ─────────────────────────────────────────
