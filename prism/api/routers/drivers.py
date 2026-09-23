"""Drivers: the list, the admin editor and the expert proposals."""
import copy
import json
import logging
import math

from fastapi import APIRouter, Depends, HTTPException

from prism.api import state
from prism.api.auth import identity_from_user, require_admin, require_auth
from prism.api.proposals import build_proposal_summary, build_proposals_response
from prism.api.schemas import DriverUpdate, ProposalUpdate
from prism.config import VALID_DIFFUSION_CURVES
from prism.drivers import MODEL_FIELDS

logger = logging.getLogger(__name__)

router = APIRouter()


def _driver_json(d, proposals: list, user_id: str) -> dict:
    return {
        "id": d.id,
        "force": d.force,
        "name": d.name,
        "description": d.description,
        "direction": d.direction,
        "probability": d.probability,
        "start_year": d.start_year,
        "peak_year": d.peak_year,
        "diffusion_curve": d.diffusion_curve,
        "gp1_pct_affected": d.gp1_pct_affected,
        "uncertainty": d.uncertainty,
        "confidence": d.confidence,
        "normalized_score": d.normalized_score,
        "category_exposure": d.category_exposure,
        "vc_exposure": d.vc_exposure,
        "regional_exposure": d.regional_exposure,
        "analysis": d.analysis,
        "data_source": d.data_source,
        "sources": d.sources,
        "baseline": d.baseline,
        "scores_edited": d.scores_edited,
        "proposal_summary": build_proposal_summary(proposals, user_id),
    }


def _exposure_map(name: str, value: dict) -> dict:
    """An exposure map whose scores are whole numbers from 0 to 5; 422 otherwise."""
    out = {}
    for key, score in value.items():
        if (isinstance(score, bool) or not isinstance(score, (int, float)) or not math.isfinite(score)
                or score != int(score) or not 0 <= score <= 5):
            raise HTTPException(422, f"{name}['{key}'] must be a whole number from 0 to 5")
        out[str(key)] = int(score)
    return out


def _require_driver(driver_id: str):
    driver = state.driver_set().get_driver_by_id(driver_id)
    if driver is None:
        raise HTTPException(404, f"Driver {driver_id} not found")
    return driver


@router.get("/api/v1/drivers")
def list_drivers(user: dict = Depends(require_auth)):
    from prism.database import load_all_driver_proposals
    drivers = state.driver_set().drivers
    proposals = load_all_driver_proposals()
    user_id = identity_from_user(user)[0]
    return [_driver_json(d, proposals.get(d.id, []), user_id) for d in drivers]


@router.put("/api/v1/drivers/{driver_id}")
def update_driver(driver_id: str, update: DriverUpdate, user: dict = Depends(require_admin)):
    """Apply an admin edit; every changed field is written to the audit log."""
    from prism.database import log_audit, save_drivers
    driver = copy.deepcopy(_require_driver(driver_id))
    sent = update.model_fields_set
    for name in sent:
        if getattr(update, name) is None and name != "uncertainty":
            raise HTTPException(422, f"{name} cannot be null")
    if "diffusion_curve" in sent and update.diffusion_curve not in VALID_DIFFUSION_CURVES:
        raise HTTPException(422, f"Invalid diffusion_curve. Must be one of {VALID_DIFFUSION_CURVES}")

    changes = {}
    for name in sorted(sent):
        new = getattr(update, name)
        if name == "sources":
            new = [s.model_dump() for s in new]
        elif name in ("category_exposure", "vc_exposure", "regional_exposure"):
            new = _exposure_map(name, new)
        if new != getattr(driver, name):
            changes[name] = (getattr(driver, name), new)
            setattr(driver, name, new)
    if not changes:
        return {"status": "unchanged", "driver_id": driver_id}

    if any(name in MODEL_FIELDS for name in changes):
        driver.scores_edited = True
    driver.recompute()
    save_drivers([driver])
    state.reset_drivers()

    actor = identity_from_user(user)[0]
    for name, (old, new) in changes.items():
        log_audit("driver_updated", "driver", driver_id,
                  old_value=json.dumps(old, default=str), new_value=json.dumps(new, default=str),
                  reason=name, user_id=actor)
    return {"status": "updated", "driver_id": driver_id, "changed": sorted(changes)}


@router.get("/api/v1/drivers/{driver_id}/proposals")
def get_driver_proposals(driver_id: str, user: dict = Depends(require_auth)):
    """The caller's own proposal, the aggregate across experts and who scored what."""
    from prism.database import load_driver_proposals
    _require_driver(driver_id)
    return build_proposals_response(driver_id, load_driver_proposals(driver_id), identity_from_user(user)[0])


@router.put("/api/v1/drivers/{driver_id}/proposals")
def put_driver_proposal(driver_id: str, proposal: ProposalUpdate, user: dict = Depends(require_auth)):
    """Merge the caller's partial proposal; any signed-in user may propose.

    A proposal never changes the driver; an admin endorses it by editing the
    driver.
    """
    from prism.database import load_driver_proposals, upsert_driver_proposal
    _require_driver(driver_id)
    sent = proposal.model_fields_set
    if "diffusion_curve" in sent and proposal.diffusion_curve is not None \
            and proposal.diffusion_curve not in VALID_DIFFUSION_CURVES:
        raise HTTPException(422, f"Invalid diffusion_curve. Must be one of {VALID_DIFFUSION_CURVES}")

    fields: dict = {}
    for name in ("probability", "gp1_pct_affected", "peak_year", "uncertainty", "diffusion_curve"):
        if name in sent and getattr(proposal, name) is not None:
            fields[name] = getattr(proposal, name)
    for name in ("category_exposure", "regional_exposure", "vc_exposure"):
        if name in sent:
            value = getattr(proposal, name)
            fields[name] = None if value is None else _exposure_map(name, value)
    if "comment" in sent:
        text = (proposal.comment or "").strip()
        fields["comment"] = text[:2000] or None

    user_id, user_name, user_role = identity_from_user(user)
    upsert_driver_proposal(driver_id, user_id, fields, user_name=user_name, user_role=user_role)
    return build_proposals_response(driver_id, load_driver_proposals(driver_id), user_id)
