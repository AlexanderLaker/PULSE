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
    load_latest_run_into_state,
    _persisted_simulation_state, _has_persisted_simulation,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/v1/simulation/status")
async def get_simulation_status(user: dict = Depends(require_auth)):
    """Check if the current simulation is stale (needs re-run)."""
    return {
        "stale": _state.get("simulation_stale", False),
        "reason": _state.get("stale_reason", ""),
        "has_results": _state.get("mc_result") is not None,
    }

# ── Simulation ──────────────────────────────────────────────────
@router.get("/api/v1/simulation")
async def get_simulation(user: dict = Depends(require_auth)):
    """Get current cached simulation results. Falls back to DB on serverless cold start."""
    mc = _state.get("mc_result")
    run_meta: dict = _state.get("run_meta") or {}
    if not mc:
        # Serverless cold start — rehydrate from the newest persisted run.
        # July 2026 review: this used to be a THIRD inline copy of the
        # bundle-vs-legacy rehydration that had already drifted from the
        # canonical one; the service function is the single implementation
        # (F4) and everything must go through it.
        try:
            if load_latest_run_into_state():
                mc = _state.get("mc_result")
                run_meta = _state.get("run_meta") or {}
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
        "journey_decomposition": mc.get("journey_decomposition"),
        "decompositions": mc.get("decompositions"),
        "totals": mc.get("totals"),
        # D19: integrity events (incl. input drift)
        "integrity_events": mc.get("integrity_events") or [],
        # M2 (owner re-ruling 2026-07-06): cross-seed stability of the
        # terminal-year portfolio median. None for pre-2.8.1 runs.
        "seed_stability": mc.get("seed_stability"),
        # Run metadata the dashboard's "Showing run #N · date · scenario"
        # ribbon consumes. Safe to expose (no credentials, no €M).
        "run_meta": run_meta or None,
        "generated": (run_meta or {}).get("run_date") or (run_meta or {}).get("persisted_at_utc"),
        "model_version": (run_meta or {}).get("model_version"),
    })

def _scipy_available() -> bool:
    """Environment probe for the F2 guard (patchable in tests).

    D13 (June 2026): scipy is a hard engine requirement — the numpy
    approximation layer was deleted. This probe only decides whether this
    runtime is ALLOWED to compute at all; it is never a math fallback.
    """
    from importlib.util import find_spec
    return find_spec("scipy") is not None


@router.post("/api/v1/simulate")
async def run_simulation(req: SimulationRequest, user: dict = Depends(require_admin)):
    # F2 (owner decision): numbers must be consistent — only the scipy
    # engine may generate runs. Serverless (no scipy) is read-only.
    if not _scipy_available():
        raise HTTPException(
            409,
            "Simulation runs are produced offline with the scipy engine "
            "(scripts/run_50k_prod.py). This runtime has no scipy and would "
            "generate inconsistent numbers — refusing to simulate.",
        )
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

        # T2 (June 2026): the attenuation sensitivity-band re-run was removed.

        _state["mc_result"] = mc_result


        _state["audit"].log_simulation_run("base", req.iterations, "bayesian_copula")

        # Clear stale flag — simulation is now fresh
        _state["simulation_stale"] = False
        _state.pop("stale_reason", None)

        # D19: input-drift integrity event — diff this run's trend scoring
        # state against the previous accepted run's persisted fingerprint.
        from pulse.audit.input_drift import (
            trend_fingerprint, compute_input_drift_event, previous_fingerprint_from_runs,
        )
        current_fp = trend_fingerprint(db.trends)
        try:
            from pulse.database import load_simulation_runs
            prev_fp, prev_id, prev_date = previous_fingerprint_from_runs(load_simulation_runs(limit=1))
            drift_event = compute_input_drift_event(current_fp, prev_fp, prev_id, prev_date)
            if drift_event:
                mc_result.setdefault("integrity_events", []).append(drift_event)
        except Exception as e:
            logger.warning(f"Input-drift check skipped: {e}")

        # Persist simulation run to database (must succeed).
        # Store the full result bundle (shift_matrix + decompositions +
        # totals + vc_decomposition) under `results` so cold-start reloads
        # can hydrate the dashboard's "Trends 2" and "Profit Pool Analysis 2"
        # views. Convergence + force_attribution live in their own columns.
        from pulse.database import save_simulation_run
        try:
            from datetime import datetime, timezone
            results_bundle = {
                "shift_matrix": mc_result.get("shift_matrix"),
                "decompositions": mc_result.get("decompositions"),
                "totals": mc_result.get("totals"),
                "vc_decomposition": mc_result.get("vc_decomposition"),
                "journey_decomposition": mc_result.get("journey_decomposition"),
                # D19/D3: persist integrity events + seed stability with the run
                "integrity_events": mc_result.get("integrity_events", []),
                "seed_stability": mc_result.get("seed_stability"),
                "meta": {
                    "engine_fidelity": "scipy",  # guarded above
                    # D13: numerics backend recorded for the audit trail
                    "numerics_backend": mc_result.get("numerics_backend"),
                    "seed": mc_result.get("seed"),
                    "chain_seeds": mc_result.get("chain_seeds"),  # L8
                    "chains": mc_result.get("n_chains"),
                    "model_version": mc_result.get("model_version"),
                    "engine_name": mc_result.get("engine_name"),
                    "persisted_at_utc": datetime.now(timezone.utc).isoformat(),
                    # D19: fingerprint of THIS run's inputs for the next diff
                    "trend_fingerprint": current_fp,
                },
            }
            run_id = save_simulation_run(
                iterations=req.iterations,
                model_type="bayesian_copula",
                results=_sanitize(results_bundle),
                force_attribution=_sanitize(mc_result.get("force_attribution")),
                allocation_recommendation=None,
                convergence_diagnostics=_sanitize(mc_result.get("convergence")),
            )
            # Refresh the in-memory run_meta so GET /simulation immediately
            # describes THIS run (previously it kept showing the prior run's
            # ribbon meta until the next cold-start rehydration).
            _meta = results_bundle["meta"]
            _state["run_meta"] = {
                "run_id": run_id,
                "run_date": _meta.get("persisted_at_utc"),
                "iterations": req.iterations,
                "model_type": "bayesian_copula",
                "seed": mc_result.get("seed"),
                "chains": mc_result.get("n_chains"),
                "model_version": mc_result.get("model_version"),
                "engine_name": mc_result.get("engine_name"),
                "engine_fidelity": _meta.get("engine_fidelity"),
                "numerics_backend": _meta.get("numerics_backend"),
                "persisted_at_utc": _meta.get("persisted_at_utc"),
            }
            logger.info(f"Simulation persisted ({req.iterations} iterations, run_id={run_id})")
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
            "journey_decomposition": mc_result.get("journey_decomposition"),
            "decompositions": mc_result.get("decompositions"),
            "totals": mc_result.get("totals"),
            "integrity_events": mc_result.get("integrity_events") or [],
            "seed_stability": mc_result.get("seed_stability"),
            "seed": mc_result.get("seed"),
            "seed_wobble": mc_result.get("seed_wobble"),
        })


# ── Config ──────────────────────────────────────────────────────
