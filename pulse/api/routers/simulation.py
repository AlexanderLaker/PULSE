"""Simulation routes: status, results, simulate — extracted from pulse/api/app.py (June 2026 split, review F4)."""
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
    load_latest_run_into_state, auto_run_startup_simulation,
    _persisted_simulation_state, _has_persisted_simulation,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/v1/simulation/status")
async def get_simulation_status():
    """Check if the current simulation is stale (needs re-run)."""
    return {
        "stale": _state.get("simulation_stale", False),
        "reason": _state.get("stale_reason", ""),
        "has_results": _state.get("mc_result") is not None,
    }

# ── Simulation ──────────────────────────────────────────────────
@router.get("/api/v1/simulation")
async def get_simulation():
    """Get current cached simulation results. Falls back to DB on serverless cold start."""
    mc = _state.get("mc_result")
    run_meta: dict = _state.get("run_meta") or {}
    if not mc:
        # Serverless cold start — try loading latest simulation from database
        try:
            from pulse.database import load_simulation_runs
            runs = load_simulation_runs(limit=1)
            if runs:
                latest = runs[0]
                # `results` may be either the legacy flat shift_matrix
                # (older runs) or the new bundle shape with
                # shift_matrix / decompositions / totals / vc_decomposition.
                # Detect and rehydrate either layout.
                results_blob = latest.get("results", {}) or {}
                inner_meta = (
                    results_blob.get("meta")
                    if isinstance(results_blob, dict) else None
                ) or {}
                if isinstance(results_blob, dict) and "shift_matrix" in results_blob:
                    mc = {
                        "shift_matrix": results_blob.get("shift_matrix", {}),
                        "decompositions": results_blob.get("decompositions"),
                        "totals": results_blob.get("totals"),
                        "vc_decomposition": results_blob.get("vc_decomposition"),
                        "convergence": latest.get("convergence_diagnostics", {}),
                        "iterations": latest.get("iterations", 5000),
                        "model_type": latest.get("model_type", "bayesian_copula"),
                    }
                else:
                    # Legacy flat shape (pre-v2.5.1): results IS the shift matrix
                    mc = {
                        "shift_matrix": results_blob,
                        "convergence": latest.get("convergence_diagnostics", {}),
                        "iterations": latest.get("iterations", 5000),
                        "model_type": latest.get("model_type", "bayesian_copula"),
                    }
                # Build the run_meta block the dashboard displays in the
                # "Showing run #N" ribbon. Pull from results_bundle.meta
                # if the writer included it (v3.2+ runs), else synthesize
                # from the row-level columns.
                run_date = latest.get("run_date")
                run_meta = {
                    "run_id": latest.get("id"),
                    "run_date": run_date.isoformat() if hasattr(run_date, "isoformat") else str(run_date) if run_date else None,
                    "iterations": latest.get("iterations"),
                    "model_type": latest.get("model_type"),
                    "scenario": inner_meta.get("scenario"),
                    "notes": inner_meta.get("notes"),
                    "seed": inner_meta.get("seed"),
                    "chains": inner_meta.get("chains"),
                    "git_sha": inner_meta.get("git_sha"),
                    "model_version": inner_meta.get("model_version"),
                    "engine_name": inner_meta.get("engine_name"),
                    "converged_categories": inner_meta.get("converged_categories"),
                    "total_categories": inner_meta.get("total_categories"),
                    "persisted_at_utc": inner_meta.get("persisted_at_utc"),
                }
                _state["mc_result"] = mc
                _state["run_meta"] = run_meta
                logger.info(
                    "Restored simulation from database (run_id=%s, scenario=%s)",
                    run_meta.get("run_id"), run_meta.get("scenario"),
                )
        except Exception as e:
            logger.warning(f"Failed to load simulation from DB: {e}")

    if not mc:
        raise HTTPException(404, "No simulation results. Run a simulation first.")
    return _sanitize({
        "shift_matrix": mc["shift_matrix"],
        "convergence": _summarize_convergence(mc.get("convergence", {})),
        "iterations": mc.get("iterations", 5000),
        "model_type": mc.get("model_type", "bayesian_copula"),
        "vc_decomposition": mc.get("vc_decomposition"),
        "decompositions": mc.get("decompositions"),
        "totals": mc.get("totals"),
        # Run metadata the dashboard's "Showing run #N · date · scenario"
        # ribbon consumes. Safe to expose (no credentials, no €M).
        "run_meta": run_meta or None,
        "generated": (run_meta or {}).get("run_date") or (run_meta or {}).get("persisted_at_utc"),
        "model_version": (run_meta or {}).get("model_version"),
    })

@router.post("/api/v1/simulate")
async def run_simulation(req: SimulationRequest, user: dict = Depends(require_admin)):
    async with _state_lock:
        # Reload trends from database so we always simulate with latest data
        try:
            _state["db"] = _load_trend_database()
        except Exception as e:
            logger.error(f"Failed to reload trends: {e}")

        db = _state.get("db")
        if not db or db.trend_count == 0:
            raise HTTPException(404, "No trends found. Add trends before simulating.")

        config = _state["config"]

        # B6: Seed handling. Single-seed runs are reproducible; multi-seed
        # runs expose RNG sensitivity ("seed-wobble") on the headline.
        primary_seed = req.seed if req.seed is not None else 42
        seed_wobble = None
        from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine
        if req.seeds and len(req.seeds) > 1:
            import numpy as _np
            medians_2030 = []
            seed_runs = []
            last_result = None
            for s in req.seeds:
                _mc = BayesianMonteCarloEngine(config, seed=s)
                _r = _mc.run(db, iterations=req.iterations)
                last_result = _r
                sm = _r["shift_matrix"]
                last_year = max(int(y) for cat in sm.values() for y in cat.keys())
                headline = float(_np.mean([
                    cat[last_year]["median"] for cat in sm.values()
                    if last_year in cat and isinstance(cat[last_year], dict)
                ]))
                medians_2030.append(headline)
                seed_runs.append({"seed": int(s), "headline_median": headline})
            seed_wobble = {
                "seeds": [int(s) for s in req.seeds],
                "headline_mean": float(_np.mean(medians_2030)),
                "headline_std": float(_np.std(medians_2030, ddof=0)),
                "headline_min": float(_np.min(medians_2030)),
                "headline_max": float(_np.max(medians_2030)),
                "runs": seed_runs,
            }
            # The "canonical" mc_result we persist is the last seed's run
            mc_result = last_result
            primary_seed = int(req.seeds[-1])
            logger.info(f"Seed-wobble: mean={seed_wobble['headline_mean']:.4f} "
                        f"std={seed_wobble['headline_std']:.4f} "
                        f"min={seed_wobble['headline_min']:.4f} "
                        f"max={seed_wobble['headline_max']:.4f}")
        else:
            # A5: Default to multichain (n_chains=3) for proper convergence diagnostics
            # unless explicitly set to 1 (single-chain mode for backward compatibility)
            mc = BayesianMonteCarloEngine(config, seed=primary_seed)
            n_chains_to_use = req.n_chains if req.n_chains >= 1 else 3
            if n_chains_to_use > 1:
                mc_result = mc.run_multichain(
                    db, n_chains=n_chains_to_use, iterations=req.iterations
                )
                logger.info(f"Ran multichain simulation with {n_chains_to_use} chains")
            else:
                # Backward compatibility: single-chain mode (legacy)
                mc_result = mc.run(db, iterations=req.iterations)
                logger.info(f"Ran single-chain simulation (legacy mode)")

        mc_result["seed"] = primary_seed
        if seed_wobble:
            mc_result["seed_wobble"] = seed_wobble

        # F3: attenuation sensitivity band
        if req.include_attenuation_band:
            try:
                band_engine = BayesianMonteCarloEngine(config, seed=primary_seed)
                mc_result["attenuation_band"] = band_engine.attenuation_sensitivity_band(
                    db, mc_result, pct=req.attenuation_band_pct
                )
            except Exception as e:
                logger.warning(f"Attenuation band computation failed: {e}")
                mc_result["attenuation_band"] = {"error": str(e)}

        _state["mc_result"] = mc_result


        _state["audit"].log_simulation_run("base", req.iterations, "bayesian_copula")

        # Clear stale flag — simulation is now fresh
        _state["simulation_stale"] = False
        _state.pop("stale_reason", None)

        # Persist simulation run to database (must succeed).
        # Store the full result bundle (shift_matrix + decompositions +
        # totals + vc_decomposition) under `results` so cold-start reloads
        # can hydrate the dashboard's "Trends 2" and "Profit Pool Analysis 2"
        # views. Convergence + force_attribution live in their own columns.
        from pulse.database import save_simulation_run
        try:
            results_bundle = {
                "shift_matrix": mc_result.get("shift_matrix"),
                "decompositions": mc_result.get("decompositions"),
                "totals": mc_result.get("totals"),
                "vc_decomposition": mc_result.get("vc_decomposition"),
            }
            save_simulation_run(
                iterations=req.iterations,
                model_type="bayesian_copula",
                results=_sanitize(results_bundle),
                force_attribution=_sanitize(mc_result.get("force_attribution")),
                allocation_recommendation=None,
                convergence_diagnostics=_sanitize(mc_result.get("convergence")),
            )
            logger.info(f"Simulation persisted ({req.iterations} iterations)")
        except Exception as e:
            logger.error(f"CRITICAL: Failed to persist simulation run: {e}")
            # Don't fail the request — results are still in memory

        return _sanitize({
            "shift_matrix": mc_result["shift_matrix"],
            "convergence": _summarize_convergence(mc_result.get("convergence", {})),
            "iterations": mc_result["iterations"],
            "model_type": mc_result["model_type"],
            "competitive": _state.get("competitive"),
            "vc_decomposition": mc_result.get("vc_decomposition"),
            "decompositions": mc_result.get("decompositions"),
            "totals": mc_result.get("totals"),
            "seed": mc_result.get("seed"),
            "seed_wobble": mc_result.get("seed_wobble"),
            "attenuation_band": mc_result.get("attenuation_band"),
        })


# ── Config ──────────────────────────────────────────────────────
