"""Serialization helpers — extracted from pulse/api/app.py (June 2026 split, review F4).
Behavior-identical move; see app.py for assembly.
"""
import numpy as np


def _sanitize(obj):
    """Recursively convert numpy types to native Python for JSON serialization."""
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj

def _summarize_convergence(conv: dict) -> dict:
    """Summarize per-category convergence into a flat top-level dict for the frontend.

    Backend produces: {"Hair: Color": {"r_hat": 1.02, "ess": 500, "converged": true}, ...}
    Frontend expects: {"r_hat": 1.03, "converged": true, "categories": {...}}
    """
    if not conv or not isinstance(conv, dict):
        return {"r_hat": 0, "converged": False, "categories": {}}

    # If it already has a top-level r_hat, it's already summarized
    if "r_hat" in conv and not any(isinstance(v, dict) for v in conv.values()):
        return conv

    r_hats = []
    all_converged = True
    for cat_key, cat_val in conv.items():
        if isinstance(cat_val, dict) and "r_hat" in cat_val:
            r_hats.append(cat_val["r_hat"])
            if not cat_val.get("converged", True):
                all_converged = False

    max_r_hat = max(r_hats) if r_hats else 0
    return {
        "r_hat": float(max_r_hat),
        "converged": all_converged and max_r_hat < 1.05 if r_hats else False,
        "categories": conv,
    }
