"""The latest persisted simulation run."""
from fastapi import APIRouter, Depends, HTTPException

from prism.api import state
from prism.api.auth import require_auth
from prism.api.runs import run_status, simulation_payload

router = APIRouter()


@router.get("/api/v1/simulation")
def get_simulation(user: dict = Depends(require_auth)):
    """The newest run written by the production job; 404 if there is none to serve."""
    run = state.latest_run()
    status = run_status(run)
    if not status["has"]:
        raise HTTPException(404, {"reason": status["reason"], "error": status["error"]})
    return simulation_payload(run)
