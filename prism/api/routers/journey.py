"""Consumer Journey content: the tile map ({lhc, hair}) and the stage contexts.

The base content is prism/journey_content.py (generated from
data/content/consumer_journey.json; confidential, so it never ships with the
dashboard's code). Once an admin saves an edit, the newest stored version
takes the base map's place; the stage contexts come from the module with
every version and are not edited. A save must be a tile map the dashboard can
render (prism/journey.py) and names the version it was edited from, so an
admin never overwrites a save made in the meantime without seeing it.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from prism import database
from prism.api import state
from prism.api.auth import identity_from_user, require_admin, require_auth
from prism.journey import JOURNEYS, SIDES, content_problem
from prism.journey_content import CONTEXTS, TILES

router = APIRouter()


class JourneySave(BaseModel):
    """PUT /api/v1/journey: the whole tile map and the version it was edited from."""
    model_config = ConfigDict(extra="forbid")

    base_version: int = Field(..., ge=0)
    content: dict


@router.get("/api/v1/journey")
def get_journey_content(user: dict = Depends(require_auth)):
    """{"version", "source", "content", "contexts"}: the newest stored tile map
    (source "stored") or, while nothing is stored, the base map with version 0
    (source "base"); the stage contexts in either case."""
    state.ensure_schema()
    stored = database.load_journey_content()
    if stored["content"] is None:
        return {"version": 0, "source": "base", "content": TILES, "contexts": CONTEXTS}
    return {"version": stored["version"], "source": "stored", "content": stored["content"], "contexts": CONTEXTS}


@router.put("/api/v1/journey")
def put_journey_content(body: JourneySave, user: dict = Depends(require_admin)):
    """Store a new version of the whole tile map (admin only); 409 if the
    stored content is no longer the version the editor started from."""
    problem = content_problem(body.content)
    if problem:
        raise HTTPException(422, problem)
    # A database that lost its drivers is restored from its backup, which would discard this save:
    # driver_set() refuses it then (503, DriversMissingError), as it refuses the driver writes.
    state.driver_set()
    user_id = identity_from_user(user)[0]
    n_tiles = sum(len(stage[side]) for j in JOURNEYS for stage in body.content[j] for side in SIDES)

    def audit(version: int) -> database.AuditEntry:
        return database.AuditEntry("journey_content_updated", "journey", "default", user_id,
                                   new_value=f"version {version}, {n_tiles} tiles",
                                   reason="Journey content saved in the editor")

    try:
        version = database.save_journey_content(body.content, updated_by=str(user.get("email") or user_id),
                                                base_version=body.base_version, audit=audit)
    except database.StaleVersionError:
        raise HTTPException(409, "The journey content was saved by someone else after you opened it. "
                                 "Reload the page to see that version, then make your edit again.") from None
    return {"status": "saved", "version": version, "tiles": n_tiles}
