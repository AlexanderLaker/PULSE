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
from prism.config import CATEGORIES, REGIONS, VALID_DIFFUSION_CURVES, VC_STEPS, first_peak_year
from prism.drivers import MODEL_FIELDS

#: The names an exposure map may use, per field.
EXPOSURE_KEYS = {"category_exposure": CATEGORIES, "regional_exposure": REGIONS}

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
        "regional_exposure": d.regional_exposure,
        "vc_epicentre": d.vc_epicentre,
        "analysis": d.analysis,
        "sources": d.sources,
        "baseline": d.baseline,
        "scores_edited": d.scores_edited,
        "revision": d.revision,
        "proposal_summary": build_proposal_summary(_modelled(d, proposals), user_id),
    }


def _exposure_map(name: str, value: dict) -> dict:
    """An exposure map on the taxonomy's names with whole-number scores 0-5; 422 otherwise."""
    out = {}
    for key, score in value.items():
        if key not in EXPOSURE_KEYS[name]:
            raise HTTPException(422, f"{name}: {key!r} is not one of {', '.join(EXPOSURE_KEYS[name])}")
        if (isinstance(score, bool) or not isinstance(score, (int, float)) or not math.isfinite(score)
                or score != int(score) or not 0 <= score <= 5):
            raise HTTPException(422, f"{name}['{key}'] must be a whole number from 0 to 5")
        out[str(key)] = int(score)
    return out


def _check_peak_year(driver, peak_year) -> None:
    """422 unless the peak year comes after the driver's onset (the later of the
    base year and its start year); the engine could not ramp to an earlier one."""
    if peak_year is not None and peak_year < first_peak_year(driver.start_year):
        onset = first_peak_year(driver.start_year) - 1
        raise HTTPException(422, f"peak_year {peak_year} must come after the driver's onset ({onset})")


def _modelled(driver, proposals: list) -> list:
    """The proposals with a peak year the engine cannot ramp to (at or before
    the driver's onset) read as unscored, so the aggregate never averages one
    and the expert's next save clears it."""
    first = first_peak_year(driver.start_year)
    return [{**p, "peak_year": None} if p.get("peak_year") is not None and p["peak_year"] < first else p
            for p in proposals]


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
    """Apply an admin edit; every changed field is written to the audit log.

    The edit names the driver revision it was made on; if the driver has
    changed since (another admin, another tab), nothing is written and the
    answer is 409. An exposure map may name only some cells: those cells
    change and the others keep their scores. A stored exposure on a name
    outside the taxonomy cannot be simulated; every save drops it, so an
    admin can repair such a driver by saving it.
    """
    from prism.database import AuditEntry, StaleRevisionError, save_driver_edit
    driver = copy.deepcopy(_require_driver(driver_id))
    sent = update.model_fields_set - {"revision"}
    for name in sent:
        if getattr(update, name) is None:
            raise HTTPException(422, f"{name} cannot be null")
    if "diffusion_curve" in sent and update.diffusion_curve not in VALID_DIFFUSION_CURVES:
        raise HTTPException(422, f"Invalid diffusion_curve. Must be one of {VALID_DIFFUSION_CURVES}")
    if "vc_epicentre" in sent and update.vc_epicentre not in VC_STEPS:
        raise HTTPException(422, f"Invalid vc_epicentre. Must be one of {VC_STEPS}")
    if "peak_year" in sent:
        _check_peak_year(driver, update.peak_year)
    if update.revision != driver.revision:
        raise HTTPException(409, _STALE)

    changes, edited = {}, set()
    for name in sorted(sent):
        new = getattr(update, name)
        if name == "sources":
            new = [s.model_dump() for s in new]
        elif name in EXPOSURE_KEYS:
            new = {**getattr(driver, name), **_exposure_map(name, new)}
        if new != getattr(driver, name):
            changes[name] = (getattr(driver, name), new)
            edited.add(name)
            setattr(driver, name, new)
    # The repair: names outside the taxonomy go. It changes no score the
    # engine uses, so on its own it does not mark the scores as edited, and
    # the audit entry says what was dropped.
    dropped = {}
    for name, keys in EXPOSURE_KEYS.items():
        current = getattr(driver, name) or {}
        valid = {k: v for k, v in current.items() if k in keys}
        if valid != current:
            dropped[name] = sorted(set(current) - set(valid))
            changes[name] = (changes[name][0] if name in changes else current, valid)
            setattr(driver, name, valid)
    if not changes:
        return {"status": "unchanged", "driver_id": driver_id, "revision": driver.revision}

    if edited & set(MODEL_FIELDS):
        driver.scores_edited = True
    driver.recompute()
    actor = identity_from_user(user)[0]

    def reason(name: str) -> str:
        if name not in dropped:
            return name
        note = f"names outside the taxonomy dropped: {', '.join(dropped[name])}"
        return f"{name}; {note}" if name in edited else f"{name}: {note}"

    audit = [AuditEntry("driver_updated", "driver", driver_id, old_value=json.dumps(old, default=str),
                        new_value=json.dumps(new, default=str), reason=reason(name), user_id=actor)
             for name, (old, new) in changes.items()]
    try:
        revision = save_driver_edit(driver, update.revision, audit)
    except StaleRevisionError:
        raise HTTPException(409, _STALE) from None
    finally:
        state.reset_drivers()
    return {"status": "updated", "driver_id": driver_id, "changed": sorted(changes), "revision": revision}


_STALE = ("This driver was changed after you opened it (by another admin or in another tab). "
          "Reload the page to see the current version, then make your edit again.")


@router.get("/api/v1/drivers/{driver_id}/proposals")
def get_driver_proposals(driver_id: str, user: dict = Depends(require_auth)):
    """The caller's own proposal, the aggregate across experts and who scored what."""
    from prism.database import load_driver_proposals
    driver = _require_driver(driver_id)
    return build_proposals_response(driver_id, _modelled(driver, load_driver_proposals(driver_id)),
                                    identity_from_user(user)[0])


@router.put("/api/v1/drivers/{driver_id}/proposals")
def put_driver_proposal(driver_id: str, proposal: ProposalUpdate, user: dict = Depends(require_auth)):
    """Merge the caller's partial proposal; any signed-in user may propose.

    Only the fields sent change. A field sent as null clears it; an exposure
    map replaces the caller's whole map for that field. A proposal never
    changes the driver; an admin endorses it by editing the driver.
    """
    from prism.database import load_driver_proposals, upsert_driver_proposal
    driver = _require_driver(driver_id)
    sent = proposal.model_fields_set
    if "diffusion_curve" in sent and proposal.diffusion_curve is not None \
            and proposal.diffusion_curve not in VALID_DIFFUSION_CURVES:
        raise HTTPException(422, f"Invalid diffusion_curve. Must be one of {VALID_DIFFUSION_CURVES}")
    if "vc_epicentre" in sent and proposal.vc_epicentre is not None and proposal.vc_epicentre not in VC_STEPS:
        raise HTTPException(422, f"Invalid vc_epicentre. Must be one of {VC_STEPS}")
    if "peak_year" in sent:
        _check_peak_year(driver, proposal.peak_year)

    fields: dict = {}
    for name in ("probability", "gp1_pct_affected", "peak_year", "uncertainty", "diffusion_curve", "vc_epicentre"):
        if name in sent:
            fields[name] = getattr(proposal, name)
    for name in EXPOSURE_KEYS:
        if name in sent:
            value = getattr(proposal, name)
            # An empty map means "not scored", the same as null.
            fields[name] = _exposure_map(name, value) if value else None
    if "comment" in sent:
        text = (proposal.comment or "").strip()
        fields["comment"] = text[:2000] or None

    user_id, user_name, _ = identity_from_user(user)
    upsert_driver_proposal(driver_id, user_id, fields, user_name=user_name)
    return build_proposals_response(driver_id, _modelled(driver, load_driver_proposals(driver_id)), user_id)
