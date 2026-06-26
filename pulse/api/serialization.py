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
    """Pass per-category MC diagnostics through to the client as detail only.

    T2 (June 2026): the synthetic top-level R̂ / "converged" headline badge was
    removed. R̂ on i.i.d. Monte-Carlo draws is ≈1.0 by construction, so a
    headline "converged ✓" could only ever reassure and never flag a real
    problem — the methodology retired it, and the API no longer manufactures it.
    The per-category dict is still returned under ``categories`` as raw detail.
    """
    if not conv or not isinstance(conv, dict):
        return {"categories": {}}
    # If a legacy persisted run already carries a flat summary, keep only its
    # category detail and drop any stored r_hat/converged headline.
    if not any(isinstance(v, dict) for v in conv.values()):
        return {"categories": conv.get("categories", {}) if "categories" in conv else {}}
    return {"categories": conv}
