"""Consumer Journey content: the admin-edited tile map ({lhc, hair}).

The dashboard ships the content as data/consumerJourney.ts; once an admin
saves an edit, the newest stored version takes precedence over that bundled
copy. A save must be a tile map the dashboard can render (prism/journey.py)
and names the version it was edited from, so an admin never overwrites a save
made in the meantime without seeing it.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from prism.api import state
from prism.api.auth import identity_from_user, require_admin, require_auth
from prism.journey import JOURNEYS, SIDES, content_problem

router = APIRouter()


class JourneySave(BaseModel):
    """PUT /api/v1/journey: the whole tile map and the version it was edited from."""
    model_config = ConfigDict(extra="forbid")

    base_version: int = Field(..., ge=0)
    content: dict


@router.get("/api/v1/journey")
def get_journey_content(user: dict = Depends(require_auth)):
    """{"version", "content"}: the newest stored version, or version 0 and
    content null while the dashboard's bundled content applies."""
    from prism.database import load_journey_content
    state.ensure_schema()
    return load_journey_content()


@router.put("/api/v1/journey")
def put_journey_content(body: JourneySave, user: dict = Depends(require_admin)):
    """Store a new version of the whole tile map (admin only); 409 if the
    stored content is no longer the version the editor started from."""
    problem = content_problem(body.content)
    if problem:
        raise HTTPException(422, problem)
    from prism.database import AuditEntry, StaleVersionError, save_journey_content
    state.ensure_schema()
    user_id = identity_from_user(user)[0]
    n_tiles = sum(len(stage[side]) for j in JOURNEYS for stage in body.content[j] for side in SIDES)

    def audit(version: int) -> AuditEntry:
        return AuditEntry("journey_content_updated", "journey", "default", user_id,
                          new_value=f"version {version}, {n_tiles} tiles",
                          reason="Journey content saved in the editor")

    try:
        version = save_journey_content(body.content, updated_by=str(user.get("email") or user_id),
                                       base_version=body.base_version, audit=audit)
    except StaleVersionError:
        raise HTTPException(409, "The journey content was saved by someone else after you opened it. "
                                 "Reload the page to see that version, then make your edit again.") from None
    return {"status": "saved", "version": version, "tiles": n_tiles}
