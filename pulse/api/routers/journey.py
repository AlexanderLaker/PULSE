"""Consumer Journey content routes (v3.6, 2026-06).

Isolated router for the journey-content store: the admin-managed
{lhc, hair} tile map persisted via pulse.database.journey_content.
GET requires a viewer token (defense-in-depth, in addition to the
Next.js /api/journey proxy auth); PUT requires an admin token.
Removable without touching other routers.
"""
import logging

from fastapi import APIRouter, HTTPException, Depends

from pulse.api.auth import require_admin, require_auth, identity_from_user

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/v1/journey")
async def get_journey_content(user: dict = Depends(require_auth)):
    """Admin-managed Consumer Journey content ({lhc, hair} tile map).

    Returns 404 when no server-managed content exists yet — the frontend
    then falls back to its bundled seed module (data/consumerJourney.ts).
    """
    try:
        from pulse.database import init_db, load_journey_content
        init_db()
        content = load_journey_content()
    except Exception as e:
        logger.warning(f"journey content load failed: {e}")
        raise HTTPException(503, "Journey content store unavailable")
    if not content:
        raise HTTPException(404, "No server-managed journey content yet")
    return content


@router.put("/api/v1/journey")
async def put_journey_content(content: dict, user: dict = Depends(require_admin)):
    """Persist the full journey content blob (admin only).

    Expects {"lhc": [...stages], "hair": [...stages]}. Stored as a single
    versioned blob — tile-level merging happens client-side where the
    editing UI lives.
    """
    if not isinstance(content, dict) or not isinstance(content.get("lhc"), list) or not isinstance(content.get("hair"), list):
        raise HTTPException(422, "Body must contain lhc[] and hair[] journey arrays")
    n_tiles = sum(
        len(s.get("benefiting", [])) + len(s.get("negativelyImpacted", []))
        for j in ("lhc", "hair") for s in content.get(j, []) if isinstance(s, dict)
    )
    try:
        from pulse.database import init_db, save_journey_content, log_audit
        init_db()
        save_journey_content(content, updated_by=str(user.get("email", "")))
        try:
            log_audit("journey_content_updated", "journey", "default",
                      new_value=f"{n_tiles} tiles",
                      reason=f"Journey content updated by {user.get('email', 'unknown')}",
                      user_id=identity_from_user(user)[0])  # M3
        except Exception:
            pass
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"journey content save failed: {e}")
        raise HTTPException(503, "Failed to persist journey content")
    return {"status": "saved", "tiles": n_tiles}
