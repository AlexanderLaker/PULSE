"""Drivers: the list, the admin editor and the expert proposals."""
import copy
import json

from fastapi import APIRouter, Depends, HTTPException

from prism import database
from prism.analysis_texts import TEXTS as ANALYSIS_TEXTS
from prism.api import state
from prism.api.auth import identity_from_user, require_admin, require_auth
from prism.api.proposals import build_proposal_summary, build_proposals_response
from prism.api.schemas import DriverUpdate, ProposalUpdate
from prism.config import CATEGORIES, REGIONS, first_peak_year
from prism.drivers import MODEL_FIELDS, InvalidDriversError
from prism.numbers import whole_in_range

#: The names an exposure map may use, per field.
EXPOSURE_KEYS = {"category_exposure": CATEGORIES, "regional_exposure": REGIONS}

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
        "expected_effect": d.expected_effect,
        "category_exposure": d.category_exposure,
        "regional_exposure": d.regional_exposure,
        "vc_epicentre": d.vc_epicentre,
        # The generated reading ships with the code; a driver the base does not know has none.
        "analysis": ANALYSIS_TEXTS.get(d.id, ""),
        "sources": d.sources,
        "baseline": d.baseline,
        "scores_edited": d.scores_edited,
        "revision": d.revision,
        "proposal_summary": build_proposal_summary(proposals, user_id),
    }


def _checked_exposure_cells(name: str, value: dict) -> dict:
    """The cells of an exposure map as sent, each a name of the taxonomy with a whole-number score
    from 0 to 5; 422 otherwise. The map may name only some cells."""
    out = {}
    for key, score in value.items():
        if key not in EXPOSURE_KEYS[name]:
            raise HTTPException(422, f"{name}: {key!r} is not one of {', '.join(EXPOSURE_KEYS[name])}")
        if not whole_in_range(score, 0, 5):
            raise HTTPException(422, f"{name}['{key}'] must be a whole number from 0 to 5")
        out[str(key)] = int(score)
    return out


def _check_peak_year(driver, peak_year) -> None:
    """422 unless the peak year comes after the driver's onset (the later of the
    base year and its start year); the engine cannot ramp to an earlier one."""
    if peak_year is not None and peak_year < first_peak_year(driver.start_year):
        onset = first_peak_year(driver.start_year) - 1
        raise HTTPException(422, f"peak_year {peak_year} must come after the driver's onset ({onset})")


def _require_driver(driver_id: str):
    driver = state.driver_set().get_driver_by_id(driver_id)
    if driver is None:
        raise HTTPException(404, f"Driver {driver_id} not found")
    return driver


@router.get("/api/v1/drivers")
def list_drivers(user: dict = Depends(require_auth)):
    drivers = state.driver_set().drivers
    proposals = database.load_all_driver_proposals()
    user_id = identity_from_user(user)[0]
    return [_driver_json(d, proposals.get(d.id, []), user_id) for d in drivers]


@router.put("/api/v1/drivers/{driver_id}")
def update_driver(driver_id: str, update: DriverUpdate, user: dict = Depends(require_admin)):
    """Apply an admin edit; every changed field is written to the audit log.

    The edit names the driver revision it was made on; if the driver has
    changed since (another admin, another tab), nothing is written and the
    answer is 409. An exposure map may name only some cells: those cells
    change and the others keep their scores.
    """
    driver = copy.deepcopy(_require_driver(driver_id))
    sent = update.model_fields_set - {"revision"}
    for name in sent:
        if getattr(update, name) is None:
            raise HTTPException(422, f"{name} cannot be null")
    if "peak_year" in sent:
        _check_peak_year(driver, update.peak_year)
    if update.revision != driver.revision:
        raise HTTPException(409, _STALE)

    changes = {}
    for name in sorted(sent):
        new = getattr(update, name)
        if name == "sources":
            new = [s.model_dump() for s in new]
        elif name in EXPOSURE_KEYS:
            new = {**getattr(driver, name), **_checked_exposure_cells(name, new)}
        if new != getattr(driver, name):
            changes[name] = (getattr(driver, name), new)
            setattr(driver, name, new)
    if not changes:
        return {"status": "unchanged", "driver_id": driver_id, "revision": driver.revision}

    if set(changes) & set(MODEL_FIELDS):
        driver.scores_edited = True
    driver.recompute()
    actor = identity_from_user(user)[0]
    audit = [database.AuditEntry("driver_updated", "driver", driver_id, actor,
                                 old_value=json.dumps(old, default=str), new_value=json.dumps(new, default=str),
                                 reason=name)
             for name, (old, new) in changes.items()]
    try:
        revision = database.save_driver_edit(driver, update.revision, set(changes), audit)
    except database.StaleRevisionError:
        raise HTTPException(409, _STALE) from None
    except InvalidDriversError as e:
        raise HTTPException(422, str(e)) from None
    finally:
        state.reset_drivers()
    return {"status": "updated", "driver_id": driver_id, "changed": sorted(changes), "revision": revision}


_STALE = ("This driver was changed after you opened it (by another admin or in another tab). "
          "Reload the page to see the current version, then make your edit again.")


@router.get("/api/v1/drivers/{driver_id}/proposals")
def get_driver_proposals(driver_id: str, user: dict = Depends(require_auth)):
    """The caller's own proposal, the aggregate across experts and who scored what."""
    _require_driver(driver_id)
    proposals = database.load_driver_proposals(driver_id)
    return build_proposals_response(driver_id, proposals, identity_from_user(user)[0])


@router.put("/api/v1/drivers/{driver_id}/proposals")
def put_driver_proposal(driver_id: str, proposal: ProposalUpdate, user: dict = Depends(require_auth)):
    """Merge the caller's partial proposal; any signed-in user may propose.

    Only the fields sent change. A field sent as null clears it; an exposure
    map replaces the caller's whole map for that field. A proposal never
    changes the driver; an admin endorses it by editing the driver.
    """
    driver = _require_driver(driver_id)
    sent = proposal.model_fields_set
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
            fields[name] = _checked_exposure_cells(name, value) if value else None
    if "comment" in sent:
        text = (proposal.comment or "").strip()
        fields["comment"] = text[:2000] or None

    user_id, user_name, _ = identity_from_user(user)
    database.upsert_driver_proposal(driver_id, user_id, fields, user_name=user_name)
    return build_proposals_response(driver_id, database.load_driver_proposals(driver_id), user_id)
