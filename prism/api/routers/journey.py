"""Consumer Journey content: the admin-edited tile map ({lhc, hair}).

The dashboard ships the content as data/consumerJourney.ts; once an admin
saves an edit, the newest stored version takes precedence over that seed.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException

from prism.api import state
from prism.api.auth import identity_from_user, require_admin, require_auth

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/v1/journey")
def get_journey_content(user: dict = Depends(require_auth)):
    """The newest stored content; 404 while the dashboard's bundled seed applies."""
    from prism.database import load_journey_content
    state.ensure_schema()
    content = load_journey_content()
    if not content:
        raise HTTPException(404, "No stored journey content; the bundled seed applies")
    return content


@router.put("/api/v1/journey")
def put_journey_content(content: dict, user: dict = Depends(require_admin)):
    """Store a new version of the whole tile map (admin only)."""
    if not isinstance(content.get("lhc"), list) or not isinstance(content.get("hair"), list):
        raise HTTPException(422, "Body must contain lhc[] and hair[] journey arrays")
    n_tiles = sum(
        len(s.get("benefiting", [])) + len(s.get("negativelyImpacted", []))
        for j in ("lhc", "hair") for s in content[j] if isinstance(s, dict)
    )
    from prism.database import log_audit, save_journey_content
    state.ensure_schema()
    user_id = identity_from_user(user)[0]
    save_journey_content(content, updated_by=str(user.get("email") or user_id))
    log_audit("journey_content_updated", "journey", "default", new_value=f"{n_tiles} tiles",
              reason="Journey content saved in the editor", user_id=user_id)
    return {"status": "saved", "tiles": n_tiles}
