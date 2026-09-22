"""Trend CRUD + reseed/sync routes — extracted from prism/api/app.py (June 2026 split, review F4)."""
import json
import logging
from typing import Optional, Any

import numpy as np
from fastapi import APIRouter, HTTPException, Depends

from prism import __version__
from prism.config import ModelConfig, FORCES, CATEGORIES
from prism.drivers import Driver, DriverSet
from prism.api.auth import require_auth, require_admin, identity_from_user
from prism.api.serialization import _sanitize, _summarize_convergence
from prism.api.state import _state, _state_lock, _load_driver_set, _backfill_diffusion_fields
from prism.api.schemas import (
    SimulationRequest, DriverCreate, DriverUpdate, ShockRequest,
    ConfigUpdate, SnapshotCreate, ProposalUpdate,
)
from prism.api.proposals import build_proposals_response
from prism.api.services.simulation_service import (
    load_latest_run_into_state,
    _persisted_simulation_state, _has_persisted_simulation,
)

logger = logging.getLogger(__name__)

router = APIRouter()

#: 2.11.0 (O10): full-reseed / sync refuse when the seed and the database
#: differ by more ids than this — a base replacement goes through
#: scripts/replace_trend_base.py (archive-first, proposals restored, verified).
BASE_REPLACEMENT_THRESHOLD = 10


@router.get("/api/v1/drivers")
async def list_drivers(force: Optional[str] = None, user: dict = Depends(require_auth)):
    db = _state.get("db")
    if not db:
        raise HTTPException(404, "No model loaded")
    drivers = db.drivers
    if force:
        drivers = [t for t in drivers if t.force == force]

    # Multi-expert proposal summaries (June 2026): one DB round-trip for all
    # trends; degrades to empty (no summaries) if the store is unavailable.
    from prism.api.proposals import build_proposal_summary
    user_id, _, _ = _identity_from_user(user)
    try:
        from prism.database import load_all_driver_proposals
        proposals_by_driver = load_all_driver_proposals()
    except Exception as e:
        logger.warning(f"list_trends: proposal summaries unavailable ({e})")
        proposals_by_driver = {}

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
        "description": t.description,
        "analysis": t.analysis,
        "data_source": t.data_source,
        "source_type": t.source_type,
        "sources": _build_sources(t),
        "confidence": t.confidence, "ai_suggested": t.ai_suggested,
        "user_override": t.user_override,
        "probability_posterior": {"alpha": t.probability_posterior[0], "beta": t.probability_posterior[1]} if t.probability_posterior else None,
        "peak_year": getattr(t, 'peak_year', 0),
        "diffusion_curve": getattr(t, 'diffusion_curve', 's_curve'),
        # 2.11.0 (O7): uncertainty score 0-5, None when not scored.
        "uncertainty": getattr(t, 'uncertainty', None),
        "ai_suggestion": getattr(t, 'ai_suggestion', None),
        "proposal_summary": build_proposal_summary(proposals_by_driver.get(t.id, []), user_id),
    } for t in drivers]

@router.post("/api/v1/drivers")
async def create_driver(req: DriverCreate, user: dict = Depends(require_admin)):
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
    from prism.seed_drivers import assert_driver_credible, TierEGateError
    try:
        assert_driver_credible(req.name, req.sources or [])
    except TierEGateError as gate_err:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "Source credibility gate failed",
                "reason": str(gate_err),
                "guidance": "Attach at least one source rated S/A/A-/B+/B/B-/C "
                            "before the driver can be added to the model.",
            },
        )

    import uuid
    driver_id = f"{req.force.lower().replace(' ', '_')}_{uuid.uuid4().hex[:8]}"

    # Build category exposure — if not provided, assign moderate exposure
    # to all categories (will be refined by user later)
    cat_exp = req.category_exposure or {c: 3 for c in CATEGORIES}
    vc_exp = req.vc_exposure or {}
    reg_exp = req.regional_exposure or {}

    new_driver = Driver(
        id=driver_id,
        force=req.force,
        name=req.name,
        description=req.description,
        direction=req.direction,
        probability=req.probability,
        start_year=2026,
        analysis=req.analysis,
        category_exposure=cat_exp,
        vc_exposure=vc_exp,
        regional_exposure=reg_exp,
        data_source=req.data_source,
        source_type="scanner",
        confidence=req.confidence,
        ai_suggested=req.ai_suggested,
        gp1_pct_affected=req.gp1_pct_affected or 0.10,
        peak_year=req.peak_year or 0,
        diffusion_curve=req.diffusion_curve or "s_curve",
        uncertainty=req.uncertainty,
    )

    # Persist to database
    from prism.database import save_drivers
    save_drivers([new_driver])

    # Add to in-memory TrendDatabase
    db.drivers.append(new_driver)

    # Log to audit trail
    try:
        from prism.database import log_audit
        log_audit("trend_added", "trend", driver_id, new_value=req.name,
                  reason=f"Added from scanner: {req.force}",
                  user_id=identity_from_user(user)[0])
    except Exception:
        pass

    # Mark simulation as stale
    _state["simulation_stale"] = True
    _state["stale_reason"] = f"New driver '{req.name}' was added"

    return {
        "status": "created",
        "driver_id": driver_id,
        "force": req.force,
        "name": req.name,
        "driver_count": db.driver_count,
    }

@router.post("/api/v1/drivers/revert-to-seed")
async def revert_drivers_to_seed(user: dict = Depends(require_admin)):
    # (Adversarial re-review 2026-07-06: POST-only, matching full-reseed —
    #  a state-mutating GET is a CSRF-shaped surface even behind admin auth.)
    """Revert ALL trend probability scores back to seed_drivers.py original values.

    This undoes any manual edits to probability. (O1, 2026-07-07: the
    delphi-era reset of debiasing/variance fields is gone with the fields.)
    """
    from prism.seed_drivers import get_seed_drivers
    from prism.database import load_drivers, save_drivers, log_audit

    seed_drivers = get_seed_drivers()
    db_drivers = load_drivers()

    seed_map = {t.id: t for t in seed_drivers}
    changes = []

    for t in db_drivers:
        seed = seed_map.get(t.id)
        if not seed:
            continue
        if t.probability != seed.probability:
            changes.append({
                "id": t.id,
                "name": t.name,
                "old_probability": t.probability,
                "new_probability": seed.probability,
            })
            t.probability = seed.probability
            # Recalculate normalized_score
            t.__post_init__()

    if not changes:
        return {"status": "no_changes", "message": "All drivers already match seed values"}

    try:
        save_drivers(db_drivers)
    except Exception as e:
        raise HTTPException(500, f"Failed to save reverted drivers: {e}")

    # Refresh in-memory state
    db_drivers = load_drivers()
    db = _state.get("db")
    if db:
        db.drivers = db_drivers
        _state["simulation_stale"] = True
        _state["stale_reason"] = f"Reverted {len(changes)} drivers to seed values"

    try:
        log_audit(
            "trends_reverted_to_seed",
            "trend",
            "all",
            old_value=f"{len(changes)} drivers had modified probabilities",
            new_value="All probabilities reset to seed_drivers.py",
            reason="User requested revert to seed scores",
            user_id=identity_from_user(user)[0],
        )
    except Exception:
        pass

    return {
        "status": "reverted",
        "changes": changes,
        "changes_count": len(changes),
        "total_trends": len(db_drivers),
    }

@router.post("/api/v1/drivers/full-reseed")
async def full_reseed(user: dict = Depends(require_admin)):
    """Replace ALL trends in DB with current seed_drivers.py values.

    C1 (July 2026 review): admin-only and POST-only. This endpoint replaces
    the entire production trend base — it previously accepted an
    unauthenticated GET, i.e. any browser hitting the URL wiped and
    reseeded prod. Every legitimate caller is an admin running a deliberate
    reseed after editing seed_drivers.py.

    Unlike revert-to-seed (which only resets probability), this replaces
    every field: descriptions, gp1_pct_affected, exposures, etc.

    Also deletes orphaned trends whose IDs are no longer in seed_drivers.py
    (e.g. retired trends like consumer_r12 and customer_r05 in v3.1).
    """
    from prism.seed_drivers import get_seed_drivers
    from prism.database import (
        load_drivers, save_drivers, log_audit,
        get_db_connection, placeholder,
    )

    seed_drivers = get_seed_drivers()
    old_drivers = load_drivers()
    old_count = len(old_drivers)

    # Compute orphan IDs — trends in DB that are NOT in the new seed list
    seed_ids = {t.id for t in seed_drivers}
    db_ids = {t.id for t in old_drivers}
    orphan_ids = sorted(db_ids - seed_ids)

    # 2.11.0 (O10): a base REPLACEMENT is not a reseed. When the id sets differ
    # materially (the 99 → 51 move, or any future review), the archive-first
    # script is the only sanctioned path: it archives trends, exposures,
    # sources and expert proposals, restores the kept ids' proposals across
    # the Postgres cascade (F-29) and verifies. This endpoint does none of that.
    added_ids = sorted(seed_ids - db_ids)
    if old_count and len(orphan_ids) + len(added_ids) > BASE_REPLACEMENT_THRESHOLD:
        raise HTTPException(409,
            f"full-reseed refused: the seed and the database differ by {len(orphan_ids)} retired "
            f"and {len(added_ids)} new ids — that is a driver-base replacement. Run "
            f"scripts/replace_trend_base.py (archive-first) instead.")

    # Delete orphans from all related tables before upserting the new seed
    if orphan_ids:
        p = placeholder()
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                for oid in orphan_ids:
                    cursor.execute(f"DELETE FROM driver_sources WHERE driver_id = {p}", (oid,))
                    cursor.execute(f"DELETE FROM driver_category_exposure WHERE driver_id = {p}", (oid,))
                    cursor.execute(f"DELETE FROM driver_vc_exposure WHERE driver_id = {p}", (oid,))
                    cursor.execute(f"DELETE FROM driver_regional_exposure WHERE driver_id = {p}", (oid,))
                    cursor.execute(f"DELETE FROM drivers WHERE id = {p}", (oid,))
                conn.commit()
        except Exception as e:
            raise HTTPException(500, f"Failed to delete orphaned drivers: {e}")

    try:
        save_drivers(seed_drivers)
    except Exception as e:
        raise HTTPException(500, f"Failed to save reseeded drivers: {e}")

    # Reload from DB and refresh in-memory state
    db_drivers = load_drivers()
    db = _state.get("db")
    if db:
        db.drivers = db_drivers
        _state["simulation_stale"] = True
        _state["stale_reason"] = "Full reseed from seed_drivers.py"

    try:
        log_audit(
            "trends_full_reseed",
            "trend",
            "all",
            old_value=f"{old_count} drivers replaced (orphans removed: {orphan_ids})",
            new_value=f"{len(db_drivers)} drivers from seed_drivers.py",
            reason="Full reseed — descriptions, parameters, exposures all refreshed",
            user_id=identity_from_user(user)[0],
        )
    except Exception:
        pass

    return {
        "status": "reseeded",
        "old_count": old_count,
        "new_count": len(db_drivers),
        "orphans_deleted": orphan_ids,
        "orphans_deleted_count": len(orphan_ids),
        "message": f"All {len(db_drivers)} drivers replaced from seed_drivers.py",
    }

@router.get("/api/v1/drivers/{driver_id}")
async def get_driver(driver_id: str, user: dict = Depends(require_auth)):
    db = _state.get("db")
    if not db:
        raise HTTPException(404, "No model loaded")
    driver = db.get_driver_by_id(driver_id)
    if not driver:
        raise HTTPException(404, f"Driver {driver_id} not found")

    # Multi-expert proposal summary (June 2026): cheap per-trend load.
    from prism.api.proposals import build_proposal_summary
    user_id, _, _ = _identity_from_user(user)
    try:
        from prism.database import load_driver_proposals
        _prop_rows = load_driver_proposals(driver_id)
    except Exception as e:
        logger.warning(f"get_trend: proposal summary unavailable ({e})")
        _prop_rows = []

    return {
        "id": driver.id, "force": driver.force, "name": driver.name,
        "description": driver.description, "direction": driver.direction,
        "probability": driver.probability,
        "start_year": driver.start_year, "normalized_score": driver.normalized_score,
        "analysis": driver.analysis,
        "gp1_pct_affected": driver.gp1_pct_affected,
        "category_exposure": driver.category_exposure,
        "vc_exposure": driver.vc_exposure,
        "regional_exposure": driver.regional_exposure,
        "confidence": driver.confidence, "ai_suggested": driver.ai_suggested,
        "probability_posterior": driver.probability_posterior,
        "peak_year": getattr(driver, 'peak_year', 0),
        "diffusion_curve": getattr(driver, 'diffusion_curve', 's_curve'),
        "uncertainty": getattr(driver, 'uncertainty', None),
        "ai_suggestion": getattr(driver, "ai_suggestion", None),
        "proposal_summary": build_proposal_summary(_prop_rows, user_id),
    }

@router.put("/api/v1/drivers/{driver_id}")
async def update_driver(driver_id: str, update: DriverUpdate, user: dict = Depends(require_admin)):
    db = _state.get("db")
    if not db:
        raise HTTPException(404, "No model loaded")
    driver = db.get_driver_by_id(driver_id)
    if not driver:
        raise HTTPException(404, f"Driver {driver_id} not found")

    audit = _state["audit"]
    actor_id, _, _ = identity_from_user(user)  # M3: attribute edits to the verified JWT identity
    if update.probability is not None:
        audit.log_score_change(driver_id, "probability", driver.probability,
                               update.probability, user_id=actor_id)
        driver.probability = max(1, min(5, update.probability))
    if update.direction is not None:
        driver.direction = update.direction
    if update.gp1_pct_affected is not None:
        audit.log("score_change", "trend", driver_id,
                   old_value=str(driver.gp1_pct_affected),
                   new_value=str(update.gp1_pct_affected),
                   reason="gp1_pct_affected update",
                   user_id=actor_id)
        driver.gp1_pct_affected = max(0.0, min(1.0, update.gp1_pct_affected))
    if update.category_exposure is not None:
        driver.category_exposure = update.category_exposure
    if update.vc_exposure is not None:
        driver.vc_exposure = update.vc_exposure
    if update.regional_exposure is not None:
        driver.regional_exposure = update.regional_exposure
    if update.name is not None:
        driver.name = update.name
    if update.description is not None:
        driver.description = update.description
    if update.analysis is not None:
        driver.analysis = update.analysis
    if update.sources is not None:
        # Store structured sources as JSON in data_source
        if isinstance(update.sources, list) and len(update.sources) > 0 and isinstance(update.sources[0], dict):
            import json as _json
            driver.data_source = _json.dumps(update.sources)
        elif isinstance(update.sources, str):
            driver.data_source = update.sources
        else:
            driver.data_source = "; ".join(str(s) for s in update.sources)
    if update.peak_year is not None:
        driver.peak_year = update.peak_year
    if update.diffusion_curve is not None:
        from prism.config import VALID_DIFFUSION_CURVES
        if update.diffusion_curve not in VALID_DIFFUSION_CURVES:
            raise HTTPException(422, f"Invalid diffusion_curve. Must be one of {VALID_DIFFUSION_CURVES}")
        driver.diffusion_curve = update.diffusion_curve
    # 2.11.0 (O7): re-scoring the uncertainty changes the Beta-prior spread
    # and the per-trend jitter, so it is a score change (audited) and
    # __post_init__ below recomputes the prior. An EXPLICIT null clears the
    # score (back to the 2.10.0 behaviour: κ 6, global jitter); an absent
    # field leaves it unchanged, like every other field of this endpoint.
    uncertainty_sent = "uncertainty" in update.model_fields_set
    if uncertainty_sent:
        new_unc = None if update.uncertainty is None else max(0, min(5, int(update.uncertainty)))
        if new_unc != getattr(driver, 'uncertainty', None):
            audit.log("score_change", "trend", driver_id,
                       old_value=str(getattr(driver, 'uncertainty', None)),
                       new_value=str(new_unc),
                       reason="uncertainty update" if new_unc is not None else "uncertainty cleared",
                       user_id=actor_id)
        driver.uncertainty = new_unc
    # D7 (June 2026): any score-bearing admin edit marks the trend as
    # expert-reviewed — drives the "AI suggestion · expert-reviewed" chip.
    if uncertainty_sent or any(v is not None for v in (update.probability, update.direction,
                                                       update.gp1_pct_affected, update.category_exposure,
                                                       update.vc_exposure, update.regional_exposure,
                                                       update.peak_year, update.diffusion_curve)):
        driver.user_override = True
    driver.__post_init__()

    # Persist updated exposures
    from prism.database import save_drivers
    save_drivers([driver])

    # Mark simulation as stale
    _state["simulation_stale"] = True
    _state["stale_reason"] = f"Driver '{driver_id}' was updated"

    return {"status": "updated", "driver_id": driver_id}

# M3 (July 2026 review): identity derivation moved to pulse.api.auth so every
# router attributes audit entries from the same verified-JWT source.
_identity_from_user = identity_from_user


def _proposals_payload(driver_id: str, user_id: str | None) -> dict:
    """Load + shape the full proposals response for a trend."""
    from prism.database import load_driver_proposals
    rows = load_driver_proposals(driver_id)
    return build_proposals_response(driver_id, rows, user_id)


@router.get("/api/v1/drivers/{driver_id}/proposals")
async def get_driver_proposals(driver_id: str, user: dict = Depends(require_auth)):
    """Multi-expert score proposals for a trend (authenticated read).

    Returns the caller's own proposal (`my`), the cross-expert aggregate
    (means/median/mode + per-cell exposure aggregates), and a named
    "who scored what" breakdown (`scorers`).
    """
    db = _state.get("db")
    if not db:
        raise HTTPException(404, "No model loaded")
    if not db.get_driver_by_id(driver_id):
        raise HTTPException(404, f"Driver {driver_id} not found")
    user_id, _, _ = _identity_from_user(user)
    try:
        from prism.database import init_db
        init_db()
        return _proposals_payload(driver_id, user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"get_trend_proposals failed for {driver_id}: {e}")
        raise HTTPException(503, "Proposals store unavailable")


@router.put("/api/v1/drivers/{driver_id}/proposals")
async def put_driver_proposal(
    driver_id: str, proposal: ProposalUpdate, user: dict = Depends(require_auth)
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
    if not db.get_driver_by_id(driver_id):
        raise HTTPException(404, f"Driver {driver_id} not found")

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
    if "uncertainty" in sent and proposal.uncertainty is not None:
        fields["uncertainty"] = max(0, min(5, int(proposal.uncertainty)))
    if "diffusion_curve" in sent and proposal.diffusion_curve is not None:
        from prism.config import VALID_DIFFUSION_CURVES
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
        from prism.database import init_db, upsert_driver_proposal
        init_db()
        upsert_driver_proposal(
            driver_id, user_id, fields, user_name=user_name, user_role=user_role
        )
        return _proposals_payload(driver_id, user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"put_trend_proposal failed for {driver_id}/{user_id}: {e}")
        raise HTTPException(503, "Failed to persist proposal")


@router.delete("/api/v1/drivers/{driver_id}")
async def delete_driver(driver_id: str, user: dict = Depends(require_admin)):
    """Delete a trend from the model."""
    db = _state.get("db")
    if not db:
        raise HTTPException(404, "No model loaded")
    driver = db.get_driver_by_id(driver_id)
    if not driver:
        raise HTTPException(404, f"Driver {driver_id} not found")

    # Remove from in-memory database
    db.drivers = [t for t in db.drivers if t.id != driver_id]

    # Remove from persistent database
    try:
        from prism.database import get_db_connection, placeholder, init_db
        init_db()
        p = placeholder()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"DELETE FROM drivers WHERE id = {p}", (driver_id,))
            cursor.execute(f"DELETE FROM driver_category_exposure WHERE driver_id = {p}", (driver_id,))
            cursor.execute(f"DELETE FROM driver_vc_exposure WHERE driver_id = {p}", (driver_id,))
            conn.commit()
    except Exception as e:
        logger.warning(f"Failed to delete trend from DB: {e}")

    # Audit log
    try:
        from prism.database import log_audit
        log_audit("trend_deleted", "trend", driver_id, old_value=driver.name,
                  reason="User deleted driver",
                  user_id=identity_from_user(user)[0])
    except Exception:
        pass

    # Mark simulation as stale
    _state["simulation_stale"] = True
    _state["stale_reason"] = f"Driver '{driver_id}' was deleted"

    return {"status": "deleted", "driver_id": driver_id, "driver_count": db.driver_count}

@router.delete("/api/v1/drivers")
async def delete_all_drivers(user: dict = Depends(require_admin)):
    """Delete ALL trends from the model. Use with caution."""
    db = _state.get("db")
    if not db:
        raise HTTPException(404, "No model loaded")

    count = len(db.drivers)
    db.drivers = []

    # Clear persistent database
    try:
        from prism.database import get_db_connection, init_db
        init_db()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM drivers")
            cursor.execute("DELETE FROM driver_category_exposure")
            cursor.execute("DELETE FROM driver_vc_exposure")
            conn.commit()
    except Exception as e:
        logger.warning(f"Failed to clear trends from DB: {e}")

    # Audit log
    try:
        from prism.database import log_audit
        log_audit("all_trends_deleted", "trend", "all",
                  reason=f"Cleared {count} drivers",
                  user_id=identity_from_user(user)[0])
    except Exception:
        pass

    # Mark simulation as stale
    _state["simulation_stale"] = True
    _state["stale_reason"] = f"All {count} drivers were deleted"

    return {"status": "deleted_all", "trends_deleted": count}

@router.post("/api/v1/drivers/sync")
async def sync_missing_drivers(user: dict = Depends(require_admin)):
    """Explicitly sync missing trends from seed_drivers.py into the database.

    Compares current DB trend IDs against seed_drivers.py and inserts
    only the specific trends that are missing. Does NOT delete existing trends.
    User-triggered only — never runs automatically.
    """
    from prism.seed_drivers import get_seed_drivers
    from prism.database import load_drivers, save_drivers

    seed_drivers = get_seed_drivers()
    db_drivers = load_drivers()

    db_ids = {t.id for t in db_drivers}
    seed_ids = {t.id for t in seed_drivers}
    missing_ids = seed_ids - db_ids

    # 2.11.0 (O10): syncing the 51-driver seed INTO a 99-trend database would
    # produce a hybrid base; a material difference is a replacement, see
    # full_reseed above.
    if db_drivers and len(missing_ids) + len(db_ids - seed_ids) > BASE_REPLACEMENT_THRESHOLD:
        raise HTTPException(409,
            f"sync refused: {len(missing_ids)} seed ids are missing and {len(db_ids - seed_ids)} "
            f"database ids are not in the seed — that is a driver-base replacement. Run "
            f"scripts/replace_trend_base.py (archive-first) instead.")

    if not missing_ids:
        return {
            "status": "already_in_sync",
            "db_count": len(db_drivers),
            "seed_count": len(seed_drivers),
            "missing": [],
        }

    # Insert only missing trends (save_trends does delete-then-insert for ALL,
    # so we merge: keep existing DB trends + add missing from seed)
    missing_drivers = [t for t in seed_drivers if t.id in missing_ids]

    # We need to save the full set (existing + missing) since save_trends replaces all
    merged = db_drivers + missing_drivers
    try:
        save_drivers(merged)
    except Exception as e:
        raise HTTPException(500, f"Failed to save drivers: {e}")

    # Reload from DB and refresh in-memory state
    db_drivers = load_drivers()
    db = _state.get("db")
    if db:
        db.drivers = db_drivers
        _state["simulation_stale"] = True
        _state["stale_reason"] = f"Synced {len(missing_ids)} missing drivers"

    # Audit log
    try:
        from prism.database import log_audit
        log_audit(
            "trends_synced",
            "trend",
            ",".join(sorted(missing_ids)),
            reason=f"Added {len(missing_ids)} missing drivers from seed_drivers.py",
            user_id=identity_from_user(user)[0],
        )
    except Exception:
        pass

    return {
        "status": "synced",
        "added": sorted(missing_ids),
        "added_count": len(missing_ids),
        "total_count": len(db_drivers),
    }

# ── Simulation Status ─────────────────────────────────────────
