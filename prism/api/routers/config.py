"""The model configuration production runs use, read-only.

Changing a parameter is a reviewed code change (prism/config.py and its
generators) followed by a production run; the finance cell weights enter at
run time. The weights a particular run applied travel with that run.
"""
from fastapi import APIRouter, Depends

from prism.api import state
from prism.api.auth import require_auth
from prism.config import DEFAULT_FORCE_OVERLAP_MATRIX

router = APIRouter()


@router.get("/api/v1/config")
def get_config(user: dict = Depends(require_auth)):
    """The parameters of the model, plus the overlap matrix the attenuation is derived from.

    The iteration count is left out: a production run sets its own (3 x
    50,000) and the served run reports what it used.
    """
    c = state.model_config()
    return {
        "force_weights": dict(c.force_weights),
        "per_force_attenuation": dict(c.per_force_attenuation),
        "within_force_overlap": dict(c.within_force_overlap),
        "force_overlap_matrix": DEFAULT_FORCE_OVERLAP_MATRIX,
        "force_correlation_matrix": c.force_correlation_matrix,
        "within_force_rho": c.within_force_rho,
        "attenuation_source": c.attenuation_source,
        "peak_year_jitter": c.peak_year_jitter,
        "base_year": c.base_year,
        "path_years": list(c.path_years),
        "cell_weights": c.cell_weights,
        "cell_weights_source": c.cell_weights_source,
    }
