"""Consumer Journey content: the admin-edited tile map ({lhc, hair}).

The dashboard ships the content as data/consumerJourney.ts; once an admin
saves an edit, the newest stored version takes precedence over that bundled
copy. Every save names the version it was edited from, so an admin never
overwrites a save made in the meantime without seeing it.
"""
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from prism.api import state
from prism.api.auth import identity_from_user, require_admin, require_auth
from prism.config import display_code
from prism.seed_drivers import DRIVERS

router = APIRouter()

#: The largest tile map accepted, as JSON text (the shipped content is about a third of this).
MAX_CONTENT_BYTES = 2_000_000
JOURNEYS = ("lhc", "hair")
SIDES = ("benefiting", "negativelyImpacted")
#: The display codes a tile may cite: the drivers of the driver base, the
#: codes data/driverCodeMap.ts resolves on the dashboard.
DRIVER_CODES = frozenset(display_code(d.id, d.force) for d in DRIVERS)


class JourneySave(BaseModel):
    """PUT /api/v1/journey: the whole tile map and the version it was edited from."""
    model_config = ConfigDict(extra="forbid")

    base_version: int = Field(..., ge=0)
    content: dict


def content_problem(content: dict) -> Optional[str]:
    """Why a tile map cannot be stored, or None.

    The shape is what the dashboard renders: exactly the two journeys, each a
    list of stages with an id, a label and two lists of tiles, every tile an
    object with a unique string id, a name and the list of driver codes it
    cites, each the code of a driver of the base.
    """
    if set(content) != set(JOURNEYS):
        return "content must hold exactly the journeys lhc and hair"
    if len(json.dumps(content)) > MAX_CONTENT_BYTES:
        return f"content is larger than {MAX_CONTENT_BYTES:,} bytes of JSON"
    seen: set = set()
    for journey in JOURNEYS:
        stages = content[journey]
        if not isinstance(stages, list):
            return f"{journey} must be a list of stages"
        for i, stage in enumerate(stages):
            where = f"{journey}[{i}]"
            if not isinstance(stage, dict) or not isinstance(stage.get("id"), str) \
                    or not isinstance(stage.get("label"), str):
                return f"{where} must be a stage with a string id and label"
            for side in SIDES:
                tiles = stage.get(side)
                if not isinstance(tiles, list):
                    return f"{where}.{side} must be a list of tiles"
                for j, tile in enumerate(tiles):
                    if not isinstance(tile, dict) or not isinstance(tile.get("id"), str) or not tile["id"] \
                            or not isinstance(tile.get("name"), str):
                        return f"{where}.{side}[{j}] must be a tile with a string id and name"
                    if tile["id"] in seen:
                        return f"tile id {tile['id']!r} appears twice"
                    seen.add(tile["id"])
                    codes = tile.get("driverCodes")
                    if not isinstance(codes, list) or not all(isinstance(c, str) for c in codes):
                        return f"tile {tile['id']!r} must list its driver codes in driverCodes"
                    unknown = sorted(set(codes) - DRIVER_CODES)
                    if unknown:
                        return f"tile {tile['id']!r} cites {', '.join(unknown)}, which are not drivers"
    return None


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
