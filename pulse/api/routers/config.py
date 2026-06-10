"""Config, audit log, forces routes — extracted from pulse/api/app.py (June 2026 split, review F4)."""
import json
import logging
from typing import Optional, Any

import numpy as np
from fastapi import APIRouter, HTTPException, Depends

from pulse import __version__
from pulse.config import ModelConfig, FORCES, CATEGORIES
from pulse.ingestion.models import Trend, TrendDatabase
from pulse.api.auth import require_auth, require_admin
from pulse.api.serialization import _sanitize, _summarize_convergence
from pulse.api.state import _state, _state_lock, _load_trend_database, _backfill_diffusion_fields
from pulse.api.models import (
    SimulationRequest, TrendCreate, TrendUpdate, ShockRequest,
    ConfigUpdate, SnapshotCreate,
)
from pulse.api.services.simulation_service import (
    load_latest_run_into_state,
    _persisted_simulation_state, _has_persisted_simulation,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/v1/config")
async def get_config():
    config = _state.get("config")
    if not config:
        return {}
    return {
        "per_force_attenuation": dict(config.per_force_attenuation),
        "within_force_overlap": dict(getattr(config, "within_force_overlap", {})),
        "attenuation_source": config.attenuation_source,
        "force_weights": config.force_weights,
        "vc_weights": config.vc_weights,
        "region_weights": getattr(config, 'region_weights', {}),
        "category_weights": getattr(config, 'category_weights', {}),
        "force_correlation_matrix": getattr(config, 'force_correlation_matrix', {}),
        "force_overlap_matrix": getattr(config, 'force_overlap_matrix', {}),
        "within_force_overlap": getattr(config, 'within_force_overlap', {}),
        "path_years": config.path_years,
        "iterations": config.iterations,
        "within_force_rho": config.within_force_rho,
        "t_copula_df": config.t_copula_df,
    }

@router.put("/api/v1/config")
async def update_config(req: ConfigUpdate, user: dict = Depends(require_admin)):
    """Admin endpoint to update model configuration (e.g. attenuation).

    Validates the *fully merged* proposed config via pydantic
    ModelConfigValidator before applying any changes — so an invalid
    partial update is rejected atomically rather than leaving the
    in-memory config half-mutated.

    If req.dry_run=True, the proposed config is validated and the
    diff returned, but no state mutation, audit log, or simulation
    invalidation occurs.
    """
    config = _state.get("config")
    if not config:
        raise HTTPException(404, "No config loaded")

    audit = _state.get("audit")
    changes = {}
    # B4: ModelConfig is frozen. Stage every update into this overrides
    # dict — we construct a new config at the end, validate it, and
    # only swap it into state on success. No half-mutated state ever.
    overrides: dict = {}


    if req.force_weights is not None:
        total = sum(req.force_weights.values())
        if abs(total - 1.0) > 0.01:
            raise HTTPException(400, f"Force weights must sum to 1.0, got {total}")
        changes["force_weights"] = {"old": config.force_weights, "new": req.force_weights}
        overrides["force_weights"] = req.force_weights

    if req.vc_weights is not None:
        total = sum(req.vc_weights.values())
        if abs(total - 1.0) > 0.01:
            raise HTTPException(400, f"VC weights must sum to 1.0, got {total}")
        changes["vc_weights"] = {"old": config.vc_weights, "new": req.vc_weights}
        overrides["vc_weights"] = req.vc_weights

    if req.region_weights is not None:
        total = sum(req.region_weights.values())
        if abs(total - 1.0) > 0.01:
            raise HTTPException(400, f"Region weights must sum to 1.0, got {total}")
        old_rw = getattr(config, 'region_weights', {})
        changes["region_weights"] = {"old": old_rw, "new": req.region_weights}
        overrides["region_weights"] = req.region_weights

    if req.category_weights is not None:
        total = sum(req.category_weights.values())
        if abs(total - 1.0) > 0.01:
            raise HTTPException(400, f"Category weights must sum to 1.0, got {total}")
        old_cw = getattr(config, 'category_weights', {})
        changes["category_weights"] = {"old": old_cw, "new": req.category_weights}
        overrides["category_weights"] = req.category_weights

    if req.force_correlation_matrix is not None:
        # Validate: must be symmetric, diagonal 1.0, off-diagonal in [0, 1]
        fcm = req.force_correlation_matrix
        forces = ["Consumer", "Customer", "Technology", "Government", "Environmental", "Competitive"]
        for f in forces:
            if f not in fcm:
                raise HTTPException(400, f"Force correlation matrix missing force '{f}'")
            row = fcm[f]
            if not isinstance(row, dict) or len(row) != 6:
                raise HTTPException(400, f"Force correlation matrix row '{f}' must have all 6 forces")
            # Check diagonal is 1.0, off-diagonal in [0, 1]
            if abs(row.get(f, 0) - 1.0) > 0.01:
                raise HTTPException(400, f"Diagonal ({f},{f}) must be 1.0")
            for other_f, val in row.items():
                if not isinstance(val, (int, float)):
                    raise HTTPException(400, f"Force correlation ({f},{other_f}) must be numeric")
                if val < 0 or val > 1:
                    raise HTTPException(400, f"Force correlation ({f},{other_f}) must be in [0, 1], got {val}")
        # Check symmetry
        for f1 in forces:
            for f2 in forces:
                v12 = fcm.get(f1, {}).get(f2, 0)
                v21 = fcm.get(f2, {}).get(f1, 0)
                if abs(v12 - v21) > 0.001:
                    raise HTTPException(400, f"Force correlation matrix not symmetric: ({f1},{f2})={v12} but ({f2},{f1})={v21}")
        old_fcm = getattr(config, 'force_correlation_matrix', {})
        changes["force_correlation_matrix"] = {"old": old_fcm, "new": fcm}
        overrides["force_correlation_matrix"] = fcm

    if req.force_overlap_matrix is not None:
        fom = req.force_overlap_matrix
        forces = ["Consumer", "Customer", "Technology", "Government", "Environmental", "Competitive"]
        for f in forces:
            if f not in fom:
                raise HTTPException(400, f"Force overlap matrix missing force '{f}'")
            row = fom[f]
            if not isinstance(row, dict):
                raise HTTPException(400, f"Force overlap matrix row '{f}' must be a dict")
            for other_f, val in row.items():
                if other_f == f:
                    continue  # diagonal sent separately in within_force_overlap
                if not isinstance(val, (int, float)):
                    raise HTTPException(400, f"Force overlap ({f},{other_f}) must be numeric")
                if val < 0 or val > 0.45:
                    raise HTTPException(400, f"Force overlap ({f},{other_f}) must be in [0, 0.45], got {val}")
        old_fom = getattr(config, 'force_overlap_matrix', {})
        changes["force_overlap_matrix"] = {"old": old_fom, "new": fom}
        overrides["force_overlap_matrix"] = fom

    if req.within_force_overlap is not None:
        wfo = req.within_force_overlap
        forces = ["Consumer", "Customer", "Technology", "Government", "Environmental", "Competitive"]
        for f in forces:
            if f not in wfo:
                raise HTTPException(400, f"Within-force overlap missing force '{f}'")
            val = wfo[f]
            if not isinstance(val, (int, float)):
                raise HTTPException(400, f"Within-force overlap '{f}' must be numeric")
            if val < 0 or val > 0.5:
                raise HTTPException(400, f"Within-force overlap '{f}' must be in [0, 0.5], got {val}")
        old_wfo = getattr(config, 'within_force_overlap', {})
        changes["within_force_overlap"] = {"old": old_wfo, "new": wfo}
        overrides["within_force_overlap"] = wfo

    if req.iterations is not None:
        changes["iterations"] = {"old": config.iterations, "new": req.iterations}
        overrides["iterations"] = req.iterations

    if req.within_force_rho is not None:
        changes["within_force_rho"] = {"old": config.within_force_rho, "new": req.within_force_rho}
        overrides["within_force_rho"] = req.within_force_rho

    if req.t_copula_df is not None:
        changes["t_copula_df"] = {"old": config.t_copula_df, "new": req.t_copula_df}
        overrides["t_copula_df"] = req.t_copula_df

    # Build the candidate (new) config without touching the live one
    candidate = config.copy_with(**overrides) if overrides else config

    # D1 (June 2026, F-01): spectral gate. The trend-level correlation
    # matrix induced by (within_force_rho, force_correlation_matrix) must
    # be positive semi-definite for the CURRENT trend population --
    # otherwise the engine silently repairs-and-rescales every correlation
    # (configured != effective). Reject invalid settings instead.
    if ("within_force_rho" in overrides) or ("force_correlation_matrix" in overrides):
        db_now = _state.get("db")
        if db_now and db_now.trends:
            from pulse.config_validation import correlation_lambda_min
            lam = correlation_lambda_min(
                candidate.force_correlation_matrix,
                candidate.within_force_rho,
                [t.force for t in db_now.trends],
            )
            if lam < -1e-9:
                raise HTTPException(400,
                    f"Correlation settings rejected: the implied "
                    f"{len(db_now.trends)}-trend matrix is not positive "
                    f"semi-definite (min eigenvalue {lam:.3f}). The engine "
                    f"would silently weaken all correlations to compensate. "
                    f"Lower cross-force correlations and/or within-force rho.")

    # ── Pydantic gate: validate the FULL proposed config ──────────
    # The bespoke checks above catch field-local issues (sums, ranges)
    # but the pydantic ModelConfigValidator enforces cross-field
    # invariants (correct force/VC step membership, monotonic
    # materialization, etc.) on the merged result. If this fails we
    # still need to roll back the mutations we already wrote into
    # `config` above — so capture originals for restore.
    from pulse.config_validation import ModelConfigValidator
    from pydantic import ValidationError as _PydValidationError

    try:
        ModelConfigValidator(
            region=getattr(candidate, "region", "Global"),
            aggregation_method=getattr(candidate, "aggregation_method", "Multiplicative"),
            attenuation=candidate.attenuation,
            attenuation_source=candidate.attenuation_source,
            neutral_threshold=candidate.neutral_threshold,
            base_year=candidate.base_year,
            path_years=list(candidate.path_years),
            materialization=dict(candidate.materialization),
            force_weights=dict(candidate.force_weights),
            vc_weights=dict(candidate.vc_weights),
            category_names=list(candidate.category_names),
            iterations=candidate.iterations,
            within_force_rho=candidate.within_force_rho,
            t_copula_df=candidate.t_copula_df,
        )
    except _PydValidationError as ve:
        # No rollback needed — we never mutated the live config
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Proposed config failed validation",
                "issues": ve.errors(),
                "rolled_back": list(changes.keys()),
            },
        )

    # ── Dry-run: validation passed but caller didn't want to commit
    if req.dry_run:
        return {
            "dry_run": True,
            "validated": True,
            "would_update": list(changes.keys()),
            "diff": {k: {"old": v["old"], "new": v["new"]} for k, v in changes.items()},
        }

    # Commit: swap the new config into state atomically
    _state["config"] = candidate
    config = candidate

    if audit and changes:
        audit.log("config_update", "config", "global",
                   old_value=json.dumps({k: v["old"] for k, v in changes.items()}),
                   new_value=json.dumps({k: v["new"] for k, v in changes.items()}),
                   reason="Admin config update")

    # Mark simulation as stale — admin must press Simulate to apply
    _state["simulation_stale"] = True
    _state["stale_reason"] = f"Configuration changed: {', '.join(changes.keys())}"
    _state.pop("simulation_results", None)

    return {"updated": list(changes.keys()), "config": {
        "per_force_attenuation": dict(config.per_force_attenuation),
        "within_force_overlap": dict(getattr(config, "within_force_overlap", {})),
        "attenuation_source": config.attenuation_source,
        "force_weights": config.force_weights,
        "vc_weights": config.vc_weights,
        "region_weights": getattr(config, 'region_weights', {}),
        "category_weights": getattr(config, 'category_weights', {}),
        "force_correlation_matrix": getattr(config, 'force_correlation_matrix', {}),
        "force_overlap_matrix": getattr(config, 'force_overlap_matrix', {}),
        "within_force_overlap": getattr(config, 'within_force_overlap', {}),
        "iterations": config.iterations,
        "within_force_rho": config.within_force_rho,
        "t_copula_df": config.t_copula_df,
    }}

# ── Audit ───────────────────────────────────────────────────────
@router.get("/api/v1/audit/log")
async def get_audit_log(limit: int = 50, user: dict = Depends(require_auth)):
    audit = _state.get("audit")
    if not audit:
        return []
    return audit.get_log(limit)

# ── Forces metadata ─────────────────────────────────────────────
@router.get("/api/v1/forces")
async def get_forces(user: dict = Depends(require_auth)):
    db = _state.get("db")
    config = _state.get("config")
    if not db or not config:
        return {"forces": FORCES}

    force_data = []
    for force in FORCES:
        trends = db.get_trends_by_force(force)
        avg_score = sum(t.normalized_score for t in trends) / max(len(trends), 1)
        exp_count = sum(1 for t in trends if t.direction == "Expansion")
        con_count = sum(1 for t in trends if t.direction == "Contraction")
        force_data.append({
            "name": force,
            "weight": config.force_weights.get(force, 0),
            "trend_count": len(trends),
            "avg_score": round(avg_score, 4),
            "expansion_count": exp_count,
            "contraction_count": con_count,
            "net_direction": "Expansion" if avg_score > 0 else "Contraction",
        })
    return force_data

# ── Competitors metadata ────────────────────────────────────────
