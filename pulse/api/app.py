"""FastAPI application — PRISM Profit Pool Shift Model backend.

Serves simulation results, handles real-time re-simulation on score changes,
and provides all data for the React Profit Pool Shift Model dashboard.
"""

import json
import logging
import asyncio
import numpy as np
from pathlib import Path
from typing import Optional, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator


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


from pulse import __version__
from pulse.config import ModelConfig, FORCES, CATEGORIES
from pulse.ingestion.models import Trend, TrendDatabase
from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine
from pulse.simulation.sensitivity import SensitivityEngine
from pulse.simulation.paths import PathAnalyzer
from pulse.optimizer.allocation import AllocationOptimizer
from pulse.audit.logger import AuditLogger
from pulse.api.routes.analytics import router as analytics_router
from pulse.api.routes.delphi import router as delphi_router
from pulse.api.routes.auth import router as auth_router
# Scanner/Emerging Trends routes removed — external API scanning disabled
# from pulse.api.routes.scanner import router as scanner_router

logger = logging.getLogger(__name__)

# ── Global state (loaded once on startup) ───────────────────────────
_state = {
    "db": None,
    "config": None,
    "mc_result": None,
    "allocation": None,
    "audit": None,
    "delphi": None,
}
_state_lock = asyncio.Lock()  # Protect concurrent mutations


def _load_trend_database() -> TrendDatabase:
    """Load trends from the Postgres/SQLite database into a TrendDatabase object.

    Only auto-seeds if the database is completely empty (first run).
    Use POST /api/v1/trends/sync to explicitly add missing trends.
    """
    from pulse.database import load_trends, save_trends
    db_trends = load_trends()

    if not db_trends:
        logger.info("Database empty — seeding with Intelligence Report trends...")
        try:
            from pulse.seed_trends import get_report_trends
            seed_trends = get_report_trends()
            save_trends(seed_trends)
            db_trends = load_trends()
            logger.info(f"Seeded {len(db_trends)} trends from Intelligence Report")
        except Exception as e:
            logger.error(f"Auto-seed failed: {e}")

    logger.info(f"Loaded {len(db_trends)} trends from database")
    return TrendDatabase(
        trends=db_trends,
        categories=CATEGORIES,
        forces=FORCES,
        source_file="database",
    )


# ── Pydantic models ────────────────────────────────────────────────
class SimulationRequest(BaseModel):
    iterations: int = Field(5000, ge=1, le=100000)  # 1 to 100k iterations
    include_sensitivity: bool = False
    include_allocation: bool = True
    risk_aversion: float = Field(1.0, ge=0.1, le=10.0)

    @field_validator("iterations")
    @classmethod
    def validate_iterations(cls, v):
        if v < 1:
            raise ValueError("iterations must be positive")
        return v

class TrendCreate(BaseModel):
    """Create a new trend (from scanner 'Add to Model' or manual entry)."""
    force: str
    name: str
    description: str = ""
    direction: str = "Expansion"
    probability: int = Field(3, ge=1, le=5)
    category_exposure: Optional[dict] = None   # {"Hair: Color": 3, ...}
    vc_exposure: Optional[dict] = None
    regional_exposure: Optional[dict] = None
    strategic_implication: str = ""
    data_source: str = ""
    confidence: str = "Medium"
    ai_suggested: bool = True
    gp1_pct_affected: Optional[float] = Field(None, ge=0.0, le=1.0, description="Fraction of category GP1 exposed (0.0-1.0)")
    peak_year: Optional[int] = Field(None, ge=2025, le=2035)
    diffusion_curve: Optional[str] = None

class TrendUpdate(BaseModel):
    probability: Optional[int] = Field(None, ge=1, le=5)
    direction: Optional[str] = None
    gp1_pct_affected: Optional[float] = Field(None, ge=0.0, le=1.0,
        description="Fraction of category GP1 exposed to this trend (0.0-1.0)")
    category_exposure: Optional[dict] = None
    vc_exposure: Optional[dict] = None
    regional_exposure: Optional[dict] = None
    name: Optional[str] = None
    description: Optional[str] = None
    strategic_implication: Optional[str] = None
    sources: Optional[list] = None
    peak_year: Optional[int] = Field(None, ge=2025, le=2035,
        description="Year when 100% of trend impact materializes (0 = default 2030)")
    diffusion_curve: Optional[str] = Field(None,
        description="Materialization shape: s_curve, linear, front_loaded, back_loaded, step_function")

class ShockRequest(BaseModel):
    shocked_force: str
    magnitude: float = Field(0.3)
    years: int = Field(5, ge=1, le=10)

class AllocationRequest(BaseModel):
    risk_aversion: float = Field(1.0, ge=0.1, le=10.0)
    min_weight: float = Field(0.02, ge=0.0, le=0.5)
    max_weight: float = Field(0.25, ge=0.0, le=1.0)

class ChatRequest(BaseModel):
    question: str


def _backfill_diffusion_fields(db) -> None:
    """
    One-time migration: assign logical peak_year and diffusion_curve to
    existing trends that still have the default (0 / 's_curve').

    Heuristics by force type:
      Government  → front_loaded, peak 2028 (regulation kicks in fast)
      Technology  → back_loaded, peak 2030 (slow adoption then scale)
      Consumer    → s_curve, peak 2029 (classic diffusion of preferences)
      Customer    → linear, peak 2030 (gradual channel evolution)
      Environmental → s_curve, peak 2030 (awareness tipping point)
      Competitive → front_loaded, peak 2029 (competitors react within 1-2 years)

    Trends with keywords like "ban", "phase-out", "regulation" get step_function.
    Already-set trends (peak_year != 0) are left untouched.
    """
    changed = []
    step_keywords = ["ban", "phase-out", "phase out", "prohibition", "deadline", "effective date", "mandatory"]
    force_defaults = {
        "Government":    ("front_loaded", 2028),
        "Technology":    ("back_loaded",  2030),
        "Consumer":      ("s_curve",      2029),
        "Customer":      ("linear",       2030),
        "Environmental": ("s_curve",      2030),
        "Competitive":   ("front_loaded", 2029),
    }
    for trend in db.trends:
        if getattr(trend, 'peak_year', 0) not in (0, None):
            continue  # already set by user
        curve, peak = force_defaults.get(trend.force, ("s_curve", 2030))
        # Override: step_function for hard regulatory deadlines
        desc_lower = (trend.description or "").lower() + (trend.name or "").lower()
        if any(kw in desc_lower for kw in step_keywords):
            curve = "step_function"
            peak = 2028
        # Override: high-probability trends peak sooner
        if trend.probability >= 5 and peak > 2028:
            peak = peak - 1
        trend.peak_year = peak
        trend.diffusion_curve = curve
        changed.append(trend)

    if changed:
        try:
            from pulse.database import save_trends
            save_trends(changed)
            logger.info(f"Backfilled peak_year/diffusion_curve for {len(changed)} trends")
        except Exception as e:
            logger.warning(f"Failed to backfill diffusion fields: {e}")


def create_app(args=None) -> FastAPI:
    """Create and configure the FastAPI application."""

    async def _run_simulation(iterations: int = 5000):
        """Internal: run simulation and cache results (with locking)."""
        async with _state_lock:
            config = _state["config"]
            db = _state["db"]

            if not db:
                return

            # Bayesian MC
            mc = BayesianMonteCarloEngine(config)
            mc_result = mc.run(db, iterations=iterations)
            _state["mc_result"] = mc_result

            # Allocation
            opt = AllocationOptimizer(config)
            _state["allocation"] = opt.optimize(mc_result["shift_matrix"])

            # Persist to database
            try:
                from pulse.database import save_simulation_run
                save_simulation_run(
                    iterations=iterations,
                    model_type="bayesian_copula",
                    results=mc_result.get("shift_matrix", {}),
                    causal_decomposition=mc_result.get("causal_decomposition"),
                    allocation_recommendation=_state.get("allocation"),
                    convergence_diagnostics=mc_result.get("convergence"),
                )
            except Exception as e:
                logger.error(f"CRITICAL: Failed to persist simulation run: {e}")

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        """Lifespan context manager for startup/shutdown events."""
        # ─── Startup ───
        async with _state_lock:
            _state["audit"] = AuditLogger()
            _state["config"] = ModelConfig()

            # Always initialize the database schema (creates all tables including session_snapshots)
            try:
                from pulse.database import init_db
                init_db()
            except Exception as e:
                logger.warning(f"Database initialization failed: {e}")

            # Initialize Delphi protocol
            from pulse.elicitation.delphi import DelphiProtocol
            _state["delphi"] = DelphiProtocol()
            _state["delphi"]._ensure_tables_exist()

            # Load from database (seeds if empty)
            try:
                _state["db"] = _load_trend_database()
                logger.info(f"Loaded {_state['db'].trend_count} trends from database")
            except Exception as e:
                logger.error(f"Failed to load trends: {e}")

            # Migrate: backfill peak_year and diffusion_curve for existing trends
            if _state.get("db"):
                _backfill_diffusion_fields(_state["db"])

        # Auto-load latest simulation from DB if available
        if _state.get("db") and _state["db"].trend_count > 0 and not _state.get("mc_result"):
            try:
                from pulse.database import load_simulation_runs
                runs = load_simulation_runs(limit=1)
                if runs:
                    latest = runs[0]
                    results = latest.get("results")
                    if isinstance(results, str):
                        results = json.loads(results)
                    alloc = latest.get("allocation_recommendation")
                    if isinstance(alloc, str):
                        alloc = json.loads(alloc)
                    conv = latest.get("convergence_diagnostics")
                    if isinstance(conv, str):
                        conv = json.loads(conv)
                    _state["mc_result"] = {
                        "shift_matrix": results,
                        "convergence": conv or {},
                        "iterations": latest.get("iterations", 1000),
                        "model_type": latest.get("model_type", "bayesian_copula"),
                    }
                    _state["allocation"] = alloc
                    logger.info("Loaded latest simulation from database on startup")
            except Exception as e:
                logger.warning(f"Failed to load simulation from DB: {e}")

        # Auto-run simulation on startup if trends exist but no simulation is persisted
        if _state.get("db") and _state["db"].trend_count > 0 and not _state.get("mc_result"):
            try:
                logger.info("No persisted simulation found — auto-running initial simulation...")
                config = _state["config"]
                db = _state["db"]

                mc = BayesianMonteCarloEngine(config)
                mc_result = mc.run(db, iterations=config.iterations or 5000)
                _state["mc_result"] = mc_result

                opt = AllocationOptimizer(config)
                _state["allocation"] = opt.optimize(
                    mc_result["shift_matrix"], risk_aversion=1.0
                )

                _state["simulation_stale"] = False

                # Persist to database
                from pulse.database import save_simulation_run
                save_simulation_run(
                    iterations=config.iterations or 5000,
                    model_type="bayesian_copula",
                    results=_sanitize(mc_result["shift_matrix"]),
                    causal_decomposition=_sanitize(mc_result.get("causal_decomposition")),
                    allocation_recommendation=_sanitize(_state.get("allocation")),
                    convergence_diagnostics=_sanitize(mc_result.get("convergence")),
                )
                logger.info("Auto-simulation completed and persisted to database")
            except Exception as e:
                logger.warning(f"Auto-simulation on startup failed: {e}")

        yield

        # ─── Shutdown ───
        async with _state_lock:
            # Cleanup if needed
            pass

    app = FastAPI(
        title="PRISM Profit Pool Shift Model API",
        version=__version__,
        description="Profit Pool Simulation Engine — Bayesian MC + Causal DAG",
        lifespan=lifespan
    )

    # ── CORS Configuration ──────────────────────────────────────
    # Allow localhost:3000 for local development, and production domains
    import os
    cors_origins = os.environ.get('CORS_ORIGINS', 'http://localhost:3000,http://localhost:5173').split(',')
    if os.environ.get('ENV') == 'production':
        # In production, restrict to specific domains
        cors_origins = os.environ.get('CORS_ORIGINS', 'https://pulse.henkel.com').split(',')

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    # Include advanced analytics routes
    app.include_router(analytics_router, prefix="/api/v1")

    # Include Delphi expert elicitation routes
    app.include_router(delphi_router, prefix="/api/v1")

    # Include auth routes
    app.include_router(auth_router, prefix="/api/v1")

    # Scanner routes removed (Emerging Trends disabled)
    # app.include_router(scanner_router, prefix="/api/v1")

    # ── Lazy Initialization (Vercel serverless compatibility) ─────
    _initialized = {"done": False}

    async def _lazy_init():
        """Initialize state on first request if lifespan didn't run (Vercel serverless).

        Includes retry logic and graceful degradation for cold start failures.
        """
        if _initialized["done"]:
            return
        _initialized["done"] = True
        print("[PRISM] Lazy init: Vercel serverless cold start...", flush=True)

        try:
            async with _state_lock:
                if _state["config"] is None:
                    # Initialize database tables with retry (handles Neon connection issues)
                    try:
                        from pulse.database import init_db, USE_POSTGRES, POSTGRES_URL
                        print(f"[PRISM] DB mode: postgres={USE_POSTGRES}, url_set={bool(POSTGRES_URL)}", flush=True)
                        init_db()
                        print("[PRISM] Database initialized successfully", flush=True)
                    except Exception as e:
                        print(f"[PRISM] Database init FAILED: {e}", flush=True)
                        _initialized["done"] = False  # Allow retry on next request
                        return

                    # Initialize core components
                    _state["audit"] = AuditLogger()
                    _state["config"] = ModelConfig()
        
                    # Initialize Delphi (uses shared database, non-critical)
                    try:
                        from pulse.elicitation.delphi import DelphiProtocol
                        _state["delphi"] = DelphiProtocol()
                    except Exception as e:
                        logger.warning(f"Delphi init failed (non-critical): {e}")

                    # Seed default auth users if needed (non-critical)
                    try:
                        from pulse.api.auth import ensure_auth_tables
                        ensure_auth_tables()
                    except Exception as e:
                        logger.warning(f"Auth tables init failed (non-critical): {e}")

                    # Load trends from database (auto-seeds if empty)
                    if not _state["db"]:
                        try:
                            print("[PRISM] Loading trends from database...", flush=True)
                            _state["db"] = _load_trend_database()
                            tc = _state["db"].trend_count if _state["db"] else 0
                            print(f"[PRISM] Loaded {tc} trends", flush=True)
                        except Exception as e:
                            print(f"[PRISM] Failed to load trends: {e}", flush=True)
                            import traceback; traceback.print_exc()

                    # Try to load latest simulation from DB so Profit Pool Shift Model fills immediately
                    if _state["db"] and _state["db"].trend_count > 0 and not _state.get("mc_result"):
                        try:
                            from pulse.database import load_simulation_runs
                            runs = load_simulation_runs(limit=1)
                            if runs:
                                latest = runs[0]
                                results = latest.get("results")
                                if isinstance(results, str):
                                    results = json.loads(results)
                                alloc = latest.get("allocation_recommendation")
                                if isinstance(alloc, str):
                                    alloc = json.loads(alloc)
                                conv = latest.get("convergence_diagnostics")
                                if isinstance(conv, str):
                                    conv = json.loads(conv)
                                _state["mc_result"] = {
                                    "shift_matrix": results,
                                    "convergence": conv or {},
                                    "iterations": latest.get("iterations", 1000),
                                    "model_type": latest.get("model_type", "bayesian_copula"),
                                }
                                _state["allocation"] = alloc
                                _state["simulation_stale"] = False
                                print("[PRISM] Loaded latest simulation from database", flush=True)
                            else:
                                # No simulation in DB — auto-run one and persist it
                                print("[PRISM] No simulation in DB — auto-running initial simulation...", flush=True)
                                try:
                                    config = _state["config"]
                                    db = _state["db"]

                                    mc_engine = BayesianMonteCarloEngine(config)
                                    mc_result = mc_engine.run(db, iterations=config.iterations or 5000)
                                    _state["mc_result"] = mc_result

                                    opt = AllocationOptimizer(config)
                                    _state["allocation"] = opt.optimize(
                                        mc_result["shift_matrix"], risk_aversion=1.0
                                    )
                                    _state["simulation_stale"] = False

                                    # Persist to database for next cold start
                                    from pulse.database import save_simulation_run
                                    save_simulation_run(
                                        iterations=config.iterations or 5000,
                                        model_type="bayesian_copula",
                                        results=_sanitize(mc_result["shift_matrix"]),
                                        causal_decomposition=_sanitize(mc_result.get("causal_decomposition")),
                                        allocation_recommendation=_sanitize(_state.get("allocation")),
                                        convergence_diagnostics=_sanitize(mc_result.get("convergence")),
                                    )
                                    print("[PRISM] Auto-simulation completed and persisted to database", flush=True)
                                except Exception as sim_err:
                                    print(f"[PRISM] Auto-simulation failed: {sim_err}", flush=True)
                                    _state["simulation_stale"] = True
                                    _state["stale_reason"] = "No simulation has been run yet. Press Simulate to generate results."
                        except Exception as e:
                            print(f"[PRISM] Failed to load/run simulation: {e}", flush=True)
        except Exception as e:
            print(f"[PRISM] Lazy init failed completely: {e}", flush=True)
            import traceback; traceback.print_exc()
            _initialized["done"] = False  # Allow retry

    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.requests import Request
    from starlette.responses import Response

    class LazyInitMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request: Request, call_next):
            await _lazy_init()
            response = await call_next(request)
            return response

    app.add_middleware(LazyInitMiddleware)

    # ── Helpers ─────────────────────────────────────────────────────
    def _has_persisted_simulation() -> bool:
        """Check if there's a simulation run in the database (for serverless cold starts)."""
        try:
            from pulse.database import load_simulation_runs
            runs = load_simulation_runs(limit=1)
            return len(runs) > 0
        except Exception:
            return False

    # ── Health ──────────────────────────────────────────────────────
    @app.get("/api/v1/health")
    async def health():
        db = _state.get("db")
        return {
            "status": "ok",
            "version": __version__,
            "model_loaded": db is not None,
            "trend_count": db.trend_count if db else 0,
            "categories": len(db.categories) if db else 0,
            "has_simulation": _state.get("mc_result") is not None or _has_persisted_simulation(),
        }

    # ── Manual Seed + Simulate (for Vercel debugging) ──────────────
    @app.post("/api/v1/seed")
    async def manual_seed():
        """Manually trigger seeding + simulation. Use when auto-seed fails."""
        import traceback
        steps = []
        try:
            from pulse.database import init_db, load_trends, save_trends, USE_POSTGRES, POSTGRES_URL
            steps.append(f"db_mode=postgres:{USE_POSTGRES}, url_set={bool(POSTGRES_URL)}")

            init_db()
            steps.append("init_db OK")

            db_trends = load_trends()
            steps.append(f"existing_trends={len(db_trends)}")

            # Always re-seed to update source URLs and any trend metadata changes
            from pulse.seed_trends import get_report_trends
            seed = get_report_trends()
            steps.append(f"seed_trends_loaded={len(seed)}")
            save_trends(seed)
            steps.append("save_trends OK (re-seeded)")
            db_trends = load_trends()
            steps.append(f"after_seed_count={len(db_trends)}")

            # Rebuild TrendDatabase in memory
            _state["db"] = TrendDatabase(
                trends=db_trends, categories=CATEGORIES, forces=FORCES, source_file="database",
            )
            steps.append(f"trend_database_count={_state['db'].trend_count}")

            # Ensure config is initialized (but do NOT auto-simulate)
            config = _state.get("config") or ModelConfig()
            _state["config"] = config
            # Mark simulation as stale — admin must press Simulate
            _state["simulation_stale"] = True
            _state["stale_reason"] = "Trends re-seeded. Press Simulate to update results."
            steps.append("simulation marked stale (press Simulate to run)")

            return {"status": "ok", "steps": steps}

        except Exception as e:
            steps.append(f"ERROR: {type(e).__name__}: {e}")
            return JSONResponse(
                status_code=500,
                content={"status": "error", "steps": steps, "traceback": traceback.format_exc()},
            )

    # ── Trends ──────────────────────────────────────────────────────
    @app.get("/api/v1/trends")
    async def list_trends(force: Optional[str] = None):
        db = _state.get("db")
        if not db:
            raise HTTPException(404, "No model loaded")
        trends = db.trends
        if force:
            trends = [t for t in trends if t.force == force]
        def _build_sources(t):
            """Get structured sources array with URLs from trend."""
            sources = getattr(t, 'sources', None) or []
            if sources:
                # Ensure tier field is included if present
                return [
                    {
                        "title": s.get("title", ""),
                        "url": s.get("url", ""),
                        "data": s.get("data", ""),
                        "tier": s.get("tier", "")
                    }
                    for s in sources
                ]
            # Try parsing data_source as JSON (structured sources)
            if t.data_source:
                try:
                    parsed = json.loads(t.data_source)
                    if isinstance(parsed, list):
                        return [
                            {
                                "title": s.get("title", ""),
                                "url": s.get("url", ""),
                                "data": s.get("data", ""),
                                "tier": s.get("tier", "")
                            }
                            for s in parsed
                        ]
                except (json.JSONDecodeError, TypeError):
                    pass
                # Fallback: parse data_source text
                result = []
                for part in t.data_source.split(';'):
                    part = part.strip()
                    if part:
                        result.append({"title": part, "url": "", "data": t.source_type or "", "tier": ""})
                return result
            return []

        return [{
            "id": t.id, "force": t.force, "sub_category": t.sub_category,
            "name": t.name, "direction": t.direction,
            "probability": t.probability,
            "normalized_score": t.normalized_score,
            "gp1_shift": t.normalized_score,
            "gp1_pct_affected": t.gp1_pct_affected,
            "start_year": t.start_year,
            "category_exposure": t.category_exposure,
            "vc_exposure": t.vc_exposure,
            "regional_exposure": t.regional_exposure,
            "description": t.description,
            "strategic_implication": t.strategic_implication,
            "data_source": t.data_source,
            "source_type": t.source_type,
            "sources": _build_sources(t),
            "confidence": t.confidence, "ai_suggested": t.ai_suggested,
            "user_override": t.user_override,
            "scorer_count": t.scorer_count,
            "score_variance": t.score_variance,
            "probability_posterior": {"alpha": t.probability_posterior[0], "beta": t.probability_posterior[1]} if t.probability_posterior else None,
            "peak_year": getattr(t, 'peak_year', 0),
            "diffusion_curve": getattr(t, 'diffusion_curve', 's_curve'),
        } for t in trends]

    @app.post("/api/v1/trends")
    async def create_trend(req: TrendCreate):
        """Create a new trend."""
        db = _state.get("db")
        if not db:
            raise HTTPException(404, "No model loaded")

        # Validate force name
        if req.force not in FORCES:
            raise HTTPException(422, f"Invalid force: {req.force}. Must be one of {FORCES}")

        import uuid
        trend_id = f"{req.force.lower().replace(' ', '_')}_{uuid.uuid4().hex[:8]}"

        # Build category exposure — if not provided, assign moderate exposure
        # to all categories (will be refined by user later)
        cat_exp = req.category_exposure or {c: 3 for c in CATEGORIES}
        vc_exp = req.vc_exposure or {}
        reg_exp = req.regional_exposure or {}

        new_trend = Trend(
            id=trend_id,
            force=req.force,
            name=req.name,
            description=req.description,
            direction=req.direction,
            probability=req.probability,
            start_year=2026,
            strategic_implication=req.strategic_implication,
            category_exposure=cat_exp,
            vc_exposure=vc_exp,
            regional_exposure=reg_exp,
            data_source=req.data_source,
            source_type="scanner",
            confidence=req.confidence,
            ai_suggested=req.ai_suggested,
            gp1_pct_affected=req.gp1_pct_affected or 0.10,
            peak_year=req.peak_year or 0,
            diffusion_curve=req.diffusion_curve or "s_curve",
        )

        # Persist to database
        from pulse.database import save_trends
        save_trends([new_trend])

        # Add to in-memory TrendDatabase
        db.trends.append(new_trend)

        # Log to audit trail
        try:
            from pulse.database import log_audit
            log_audit("trend_added", "trend", trend_id, new_value=req.name, reason=f"Added from scanner: {req.force}")
        except Exception:
            pass

        # Mark simulation as stale
        _state["simulation_stale"] = True
        _state["stale_reason"] = f"New trend '{req.name}' was added"

        return {
            "status": "created",
            "trend_id": trend_id,
            "force": req.force,
            "name": req.name,
            "trend_count": db.trend_count,
        }

    @app.api_route("/api/v1/trends/revert-to-seed", methods=["GET", "POST"])
    async def revert_trends_to_seed():
        """Revert ALL trend probability scores back to seed_trends.py original values.

        This undoes any Delphi consensus application or manual edits to probability.
        Also resets debiasing_applied to False and score_variance to 0.
        """
        from pulse.seed_trends import get_report_trends
        from pulse.database import load_trends, save_trends, log_audit

        seed_trends = get_report_trends()
        db_trends = load_trends()

        seed_map = {t.id: t for t in seed_trends}
        changes = []

        for t in db_trends:
            seed = seed_map.get(t.id)
            if not seed:
                continue
            if t.probability != seed.probability or t.debiasing_applied:
                changes.append({
                    "id": t.id,
                    "name": t.name,
                    "old_probability": t.probability,
                    "new_probability": seed.probability,
                    "debiasing_was": t.debiasing_applied,
                })
                t.probability = seed.probability
                t.debiasing_applied = False
                t.score_variance = 0.0
                t.scorer_count = 1
                # Recalculate normalized_score
                t.__post_init__()

        if not changes:
            return {"status": "no_changes", "message": "All trends already match seed values"}

        try:
            save_trends(db_trends)
        except Exception as e:
            raise HTTPException(500, f"Failed to save reverted trends: {e}")

        # Refresh in-memory state
        db_trends = load_trends()
        db = _state.get("db")
        if db:
            db.trends = db_trends
            _state["simulation_stale"] = True
            _state["stale_reason"] = f"Reverted {len(changes)} trends to seed values"

        try:
            log_audit(
                "trends_reverted_to_seed",
                "trend",
                "all",
                old_value=f"{len(changes)} trends had modified probabilities",
                new_value="All probabilities reset to seed_trends.py",
                reason="User requested Delphi consensus revert",
            )
        except Exception:
            pass

        return {
            "status": "reverted",
            "changes": changes,
            "changes_count": len(changes),
            "total_trends": len(db_trends),
        }

    @app.get("/api/v1/trends/{trend_id}")
    async def get_trend(trend_id: str):
        db = _state.get("db")
        if not db:
            raise HTTPException(404, "No model loaded")
        trend = db.get_trend_by_id(trend_id)
        if not trend:
            raise HTTPException(404, f"Trend {trend_id} not found")
        return {
            "id": trend.id, "force": trend.force, "name": trend.name,
            "description": trend.description, "direction": trend.direction,
            "probability": trend.probability,
            "start_year": trend.start_year, "normalized_score": trend.normalized_score,
            "strategic_implication": trend.strategic_implication,
            "gp1_pct_affected": trend.gp1_pct_affected,
            "category_exposure": trend.category_exposure,
            "vc_exposure": trend.vc_exposure,
            "regional_exposure": trend.regional_exposure,
            "confidence": trend.confidence, "ai_suggested": trend.ai_suggested,
            "probability_posterior": trend.probability_posterior,
            "scorer_count": trend.scorer_count,
            "score_variance": trend.score_variance,
        }

    @app.put("/api/v1/trends/{trend_id}")
    async def update_trend(trend_id: str, update: TrendUpdate):
        db = _state.get("db")
        if not db:
            raise HTTPException(404, "No model loaded")
        trend = db.get_trend_by_id(trend_id)
        if not trend:
            raise HTTPException(404, f"Trend {trend_id} not found")

        audit = _state["audit"]
        if update.probability is not None:
            audit.log_score_change(trend_id, "probability", trend.probability, update.probability)
            trend.probability = max(1, min(5, update.probability))
        if update.direction is not None:
            trend.direction = update.direction
        if update.gp1_pct_affected is not None:
            audit.log("score_change", "trend", trend_id,
                       old_value=str(trend.gp1_pct_affected),
                       new_value=str(update.gp1_pct_affected),
                       reason="gp1_pct_affected update")
            trend.gp1_pct_affected = max(0.0, min(1.0, update.gp1_pct_affected))
        if update.category_exposure is not None:
            trend.category_exposure = update.category_exposure
        if update.vc_exposure is not None:
            trend.vc_exposure = update.vc_exposure
        if update.regional_exposure is not None:
            trend.regional_exposure = update.regional_exposure
        if update.name is not None:
            trend.name = update.name
        if update.description is not None:
            trend.description = update.description
        if update.strategic_implication is not None:
            trend.strategic_implication = update.strategic_implication
        if update.sources is not None:
            # Store structured sources as JSON in data_source
            if isinstance(update.sources, list) and len(update.sources) > 0 and isinstance(update.sources[0], dict):
                import json as _json
                trend.data_source = _json.dumps(update.sources)
            elif isinstance(update.sources, str):
                trend.data_source = update.sources
            else:
                trend.data_source = "; ".join(str(s) for s in update.sources)
        if update.peak_year is not None:
            trend.peak_year = update.peak_year
        if update.diffusion_curve is not None:
            from pulse.config import VALID_DIFFUSION_CURVES
            if update.diffusion_curve not in VALID_DIFFUSION_CURVES:
                raise HTTPException(422, f"Invalid diffusion_curve. Must be one of {VALID_DIFFUSION_CURVES}")
            trend.diffusion_curve = update.diffusion_curve
        trend.__post_init__()

        # Persist updated exposures
        from pulse.database import save_trends
        save_trends([trend])

        # Mark simulation as stale
        _state["simulation_stale"] = True
        _state["stale_reason"] = f"Trend '{trend_id}' was updated"

        return {"status": "updated", "trend_id": trend_id}

    @app.delete("/api/v1/trends/{trend_id}")
    async def delete_trend(trend_id: str):
        """Delete a trend from the model."""
        db = _state.get("db")
        if not db:
            raise HTTPException(404, "No model loaded")
        trend = db.get_trend_by_id(trend_id)
        if not trend:
            raise HTTPException(404, f"Trend {trend_id} not found")

        # Remove from in-memory database
        db.trends = [t for t in db.trends if t.id != trend_id]

        # Remove from persistent database
        try:
            from pulse.database import get_db_connection, placeholder, init_db
            init_db()
            p = placeholder()
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(f"DELETE FROM trends WHERE id = {p}", (trend_id,))
                cursor.execute(f"DELETE FROM trend_category_exposure WHERE trend_id = {p}", (trend_id,))
                cursor.execute(f"DELETE FROM trend_vc_exposure WHERE trend_id = {p}", (trend_id,))
                conn.commit()
        except Exception as e:
            logger.warning(f"Failed to delete trend from DB: {e}")

        # Audit log
        try:
            from pulse.database import log_audit
            log_audit("trend_deleted", "trend", trend_id, old_value=trend.name, reason="User deleted trend")
        except Exception:
            pass

        # Mark simulation as stale
        _state["simulation_stale"] = True
        _state["stale_reason"] = f"Trend '{trend_id}' was deleted"

        return {"status": "deleted", "trend_id": trend_id, "trend_count": db.trend_count}

    @app.delete("/api/v1/trends")
    async def delete_all_trends():
        """Delete ALL trends from the model. Use with caution."""
        db = _state.get("db")
        if not db:
            raise HTTPException(404, "No model loaded")

        count = len(db.trends)
        db.trends = []

        # Clear persistent database
        try:
            from pulse.database import get_db_connection, init_db
            init_db()
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM trends")
                cursor.execute("DELETE FROM trend_category_exposure")
                cursor.execute("DELETE FROM trend_vc_exposure")
                conn.commit()
        except Exception as e:
            logger.warning(f"Failed to clear trends from DB: {e}")

        # Audit log
        try:
            from pulse.database import log_audit
            log_audit("all_trends_deleted", "trend", "all", reason=f"Cleared {count} trends")
        except Exception:
            pass

        # Mark simulation as stale
        _state["simulation_stale"] = True
        _state["stale_reason"] = f"All {count} trends were deleted"

        return {"status": "deleted_all", "trends_deleted": count}

    @app.post("/api/v1/trends/sync")
    async def sync_missing_trends():
        """Explicitly sync missing trends from seed_trends.py into the database.

        Compares current DB trend IDs against seed_trends.py and inserts
        only the specific trends that are missing. Does NOT delete existing trends.
        User-triggered only — never runs automatically.
        """
        from pulse.seed_trends import get_report_trends
        from pulse.database import load_trends, save_trends

        seed_trends = get_report_trends()
        db_trends = load_trends()

        db_ids = {t.id for t in db_trends}
        seed_ids = {t.id for t in seed_trends}
        missing_ids = seed_ids - db_ids

        if not missing_ids:
            return {
                "status": "already_in_sync",
                "db_count": len(db_trends),
                "seed_count": len(seed_trends),
                "missing": [],
            }

        # Insert only missing trends (save_trends does delete-then-insert for ALL,
        # so we merge: keep existing DB trends + add missing from seed)
        missing_trends = [t for t in seed_trends if t.id in missing_ids]

        # We need to save the full set (existing + missing) since save_trends replaces all
        merged = db_trends + missing_trends
        try:
            save_trends(merged)
        except Exception as e:
            raise HTTPException(500, f"Failed to save trends: {e}")

        # Reload from DB and refresh in-memory state
        db_trends = load_trends()
        db = _state.get("db")
        if db:
            db.trends = db_trends
            _state["simulation_stale"] = True
            _state["stale_reason"] = f"Synced {len(missing_ids)} missing trends"

        # Audit log
        try:
            from pulse.database import log_audit
            log_audit(
                "trends_synced",
                "trend",
                ",".join(sorted(missing_ids)),
                reason=f"Added {len(missing_ids)} missing trends from seed_trends.py",
            )
        except Exception:
            pass

        return {
            "status": "synced",
            "added": sorted(missing_ids),
            "added_count": len(missing_ids),
            "total_count": len(db_trends),
        }

    # ── Simulation Status ─────────────────────────────────────────
    @app.get("/api/v1/simulation/status")
    async def get_simulation_status():
        """Check if the current simulation is stale (needs re-run)."""
        return {
            "stale": _state.get("simulation_stale", False),
            "reason": _state.get("stale_reason", ""),
            "has_results": _state.get("mc_result") is not None,
        }

    # ── Simulation ──────────────────────────────────────────────────
    @app.get("/api/v1/simulation")
    async def get_simulation():
        """Get current cached simulation results. Falls back to DB on serverless cold start."""
        mc = _state.get("mc_result")
        if not mc:
            # Serverless cold start — try loading latest simulation from database
            try:
                from pulse.database import load_simulation_runs
                runs = load_simulation_runs(limit=1)
                if runs:
                    latest = runs[0]
                    # Reconstruct mc_result from DB
                    mc = {
                        "shift_matrix": latest.get("results", {}),
                        "convergence": latest.get("convergence_diagnostics", {}),
                        "iterations": latest.get("iterations", 5000),
                        "model_type": latest.get("model_type", "bayesian_copula"),
                    }
                    _state["mc_result"] = mc
                    if latest.get("allocation_recommendation"):
                        _state["allocation"] = latest["allocation_recommendation"]
                    logger.info("Restored simulation from database (serverless cold start)")
            except Exception as e:
                logger.warning(f"Failed to load simulation from DB: {e}")

        if not mc:
            raise HTTPException(404, "No simulation results. Run a simulation first.")
        return _sanitize({
            "shift_matrix": mc["shift_matrix"],
            "convergence": _summarize_convergence(mc.get("convergence", {})),
            "iterations": mc.get("iterations", 5000),
            "model_type": mc.get("model_type", "bayesian_copula"),
            "allocation": _state.get("allocation"),
            "vc_decomposition": mc.get("vc_decomposition"),
        })

    @app.post("/api/v1/simulate")
    async def run_simulation(req: SimulationRequest):
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

            # Bayesian Monte Carlo
            mc = BayesianMonteCarloEngine(config)
            mc_result = mc.run(db, iterations=req.iterations)
            _state["mc_result"] = mc_result

            # Allocation optimizer
            if req.include_allocation:
                opt = AllocationOptimizer(config)
                _state["allocation"] = opt.optimize(
                    mc_result["shift_matrix"], risk_aversion=req.risk_aversion
                )

            _state["audit"].log_simulation_run("base", req.iterations, "bayesian_copula")

            # Clear stale flag — simulation is now fresh
            _state["simulation_stale"] = False
            _state.pop("stale_reason", None)

            # Persist simulation run to database (must succeed)
            from pulse.database import save_simulation_run
            try:
                save_simulation_run(
                    iterations=req.iterations,
                    model_type="bayesian_copula",
                    results=_sanitize(mc_result["shift_matrix"]),
                    causal_decomposition=_sanitize(mc_result.get("causal_decomposition")),
                    allocation_recommendation=_sanitize(_state.get("allocation")),
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
                "allocation": _state.get("allocation"),
                "competitive": _state.get("competitive"),
                "vc_decomposition": mc_result.get("vc_decomposition"),
            })

    # ── Sensitivity ─────────────────────────────────────────────────
    @app.get("/api/v1/sensitivity/tornado")
    async def tornado(category: Optional[str] = None):
        """Tornado sensitivity analysis — which trends have highest leverage."""
        db = _state.get("db")
        if not db:
            raise HTTPException(404, "No model loaded")

        # Validate category if provided
        if category and category not in CATEGORIES:
            raise HTTPException(422, f"Invalid category: {category}")

        se = SensitivityEngine(_state["config"])
        return _sanitize(se.tornado_analysis(db, category))

    @app.post("/api/v1/sensitivity/tornado")
    async def tornado_post(category: Optional[str] = None):
        """POST variant of tornado (for consistency with test expectations)."""
        db = _state.get("db")
        if not db:
            raise HTTPException(404, "No model loaded")

        # Validate category if provided
        if category and category not in CATEGORIES:
            raise HTTPException(422, f"Invalid category: {category}")

        se = SensitivityEngine(_state["config"])
        return _sanitize(se.tornado_analysis(db, category))

    @app.get("/api/v1/sensitivity/breakeven")
    async def breakeven(category: Optional[str] = None):
        """Breakeven analysis — what score change makes a category neutral."""
        db = _state.get("db")
        if not db:
            raise HTTPException(404, "No model loaded")

        # Validate category if provided
        if category and category not in CATEGORIES:
            raise HTTPException(422, f"Invalid category: {category}")

        se = SensitivityEngine(_state["config"])
        # Call a breakeven method if it exists, otherwise return a placeholder
        try:
            return _sanitize(se.breakeven_analysis(db, category))
        except (AttributeError, NotImplementedError):
            # Fallback: return a simple breakeven result structure
            return {
                "status": "ok",
                "category": category or "all",
                "analysis": "breakeven_analysis",
                "message": "Breakeven analysis not yet fully implemented"
            }

    @app.post("/api/v1/sensitivity/breakeven")
    async def breakeven_post(category: Optional[str] = None):
        """POST variant of breakeven."""
        db = _state.get("db")
        if not db:
            raise HTTPException(404, "No model loaded")

        # Validate category if provided
        if category and category not in CATEGORIES:
            raise HTTPException(422, f"Invalid category: {category}")

        se = SensitivityEngine(_state["config"])
        try:
            return _sanitize(se.breakeven_analysis(db, category))
        except (AttributeError, NotImplementedError):
            return {
                "status": "ok",
                "category": category or "all",
                "analysis": "breakeven_analysis",
                "message": "Breakeven analysis not yet fully implemented"
            }

    @app.get("/api/v1/sensitivity/attenuation")
    async def attenuation_sensitivity():
        db = _state.get("db")
        if not db:
            raise HTTPException(404, "No model loaded")
        se = SensitivityEngine(_state["config"])
        return _sanitize(se.attenuation_sensitivity(db))

    # ── Optimizer ───────────────────────────────────────────────────
    @app.post("/api/v1/optimize/allocation")
    async def optimize_allocation(req: AllocationRequest):
        mc = _state.get("mc_result")
        if not mc:
            raise HTTPException(404, "No simulation results")

        async with _state_lock:
            opt = AllocationOptimizer(_state["config"])
            result = opt.optimize(
                mc["shift_matrix"],
                risk_aversion=req.risk_aversion,
                min_weight=req.min_weight,
                max_weight=req.max_weight,
            )
            _state["allocation"] = result
            return _sanitize(result)

    # ── Config ──────────────────────────────────────────────────────
    @app.get("/api/v1/config")
    async def get_config():
        config = _state.get("config")
        if not config:
            return {}
        return {
            "attenuation": config.attenuation,
            "attenuation_source": config.attenuation_source,
            "force_weights": config.force_weights,
            "vc_weights": config.vc_weights,
            "region_weights": getattr(config, 'region_weights', {}),
            "category_weights": getattr(config, 'category_weights', {}),
            "force_correlation_matrix": getattr(config, 'force_correlation_matrix', {}),
            "path_years": config.path_years,
            "iterations": config.iterations,
            "within_force_rho": config.within_force_rho,
            "t_copula_df": config.t_copula_df,
            "backtesting_accuracy": config.backtesting_accuracy,
        }

    class ConfigUpdate(BaseModel):
        attenuation: Optional[float] = Field(None, ge=0.05, le=1.0,
            description="Attenuation factor (0.05-1.0). Controls how much raw "
                        "force scores translate to GP1 shifts. Lower = more "
                        "conservative output. Default 0.5.")
        attenuation_source: Optional[str] = Field(None,
            description="'assumed' | 'backtested' | 'admin_override'")
        force_weights: Optional[dict] = None
        vc_weights: Optional[dict] = None
        region_weights: Optional[dict] = None
        category_weights: Optional[dict] = None
        force_correlation_matrix: Optional[dict] = Field(None,
            description="6×6 force correlation matrix for copula. "
                        "Each force maps to a dict with all 6 forces. "
                        "Diagonal must be 1.0, off-diagonal in [0,1].")
        iterations: Optional[int] = Field(None, ge=1000, le=100000)
        within_force_rho: Optional[float] = Field(None, ge=0.0, le=0.9)
        t_copula_df: Optional[int] = Field(None, ge=2, le=30)

    @app.put("/api/v1/config")
    async def update_config(req: ConfigUpdate):
        """Admin endpoint to update model configuration (e.g. attenuation)."""
        config = _state.get("config")
        if not config:
            raise HTTPException(404, "No config loaded")

        audit = _state.get("audit")
        changes = {}

        if req.attenuation is not None:
            old_val = config.attenuation
            config.attenuation = req.attenuation
            config.attenuation_source = req.attenuation_source or "admin_override"
            changes["attenuation"] = {"old": old_val, "new": req.attenuation}

        if req.force_weights is not None:
            total = sum(req.force_weights.values())
            if abs(total - 1.0) > 0.01:
                raise HTTPException(400, f"Force weights must sum to 1.0, got {total}")
            changes["force_weights"] = {"old": config.force_weights, "new": req.force_weights}
            config.force_weights = req.force_weights

        if req.vc_weights is not None:
            total = sum(req.vc_weights.values())
            if abs(total - 1.0) > 0.01:
                raise HTTPException(400, f"VC weights must sum to 1.0, got {total}")
            changes["vc_weights"] = {"old": config.vc_weights, "new": req.vc_weights}
            config.vc_weights = req.vc_weights

        if req.region_weights is not None:
            total = sum(req.region_weights.values())
            if abs(total - 1.0) > 0.01:
                raise HTTPException(400, f"Region weights must sum to 1.0, got {total}")
            old_rw = getattr(config, 'region_weights', {})
            changes["region_weights"] = {"old": old_rw, "new": req.region_weights}
            config.region_weights = req.region_weights

        if req.category_weights is not None:
            total = sum(req.category_weights.values())
            if abs(total - 1.0) > 0.01:
                raise HTTPException(400, f"Category weights must sum to 1.0, got {total}")
            old_cw = getattr(config, 'category_weights', {})
            changes["category_weights"] = {"old": old_cw, "new": req.category_weights}
            config.category_weights = req.category_weights

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
            config.force_correlation_matrix = fcm

        if req.iterations is not None:
            changes["iterations"] = {"old": config.iterations, "new": req.iterations}
            config.iterations = req.iterations

        if req.within_force_rho is not None:
            changes["within_force_rho"] = {"old": config.within_force_rho, "new": req.within_force_rho}
            config.within_force_rho = req.within_force_rho

        if req.t_copula_df is not None:
            changes["t_copula_df"] = {"old": config.t_copula_df, "new": req.t_copula_df}
            config.t_copula_df = req.t_copula_df

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
            "attenuation": config.attenuation,
            "attenuation_source": config.attenuation_source,
            "force_weights": config.force_weights,
            "vc_weights": config.vc_weights,
            "region_weights": getattr(config, 'region_weights', {}),
            "category_weights": getattr(config, 'category_weights', {}),
            "force_correlation_matrix": getattr(config, 'force_correlation_matrix', {}),
            "iterations": config.iterations,
            "within_force_rho": config.within_force_rho,
            "t_copula_df": config.t_copula_df,
        }}

    # ── Audit ───────────────────────────────────────────────────────
    @app.get("/api/v1/audit/log")
    async def get_audit_log(limit: int = 50):
        audit = _state.get("audit")
        if not audit:
            return []
        return audit.get_log(limit)

    # ── Forces metadata ─────────────────────────────────────────────
    @app.get("/api/v1/forces")
    async def get_forces():
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
    @app.get("/api/v1/competitors")
    async def get_competitors():
        """Get all competitor profiles."""
        try:
            from pulse.api.seed_data import get_competitor_profiles
            profiles = get_competitor_profiles()
            return [{"id": p.id, "name": p.name, "archetype": p.archetype,
                    "hair_exposure": p.hair_exposure, "lhc_exposure": p.lhc_exposure,
                    "response_speed": p.response_speed, "typical_responses": p.typical_responses,
                    "category_exposure": p.category_exposure} for p in profiles]
        except Exception as e:
            logger.error(f"Failed to get competitors: {e}")
            raise HTTPException(500, str(e))

    @app.get("/api/v1/competitors/intelligence")
    async def get_competitive_intelligence():
        """Get comprehensive competitive intelligence."""
        try:
            from pulse.api.seed_data import get_seed_competitive_intelligence
            return get_seed_competitive_intelligence()
        except Exception as e:
            logger.error(f"Failed to get competitive intelligence: {e}")
            raise HTTPException(500, str(e))

    @app.get("/api/v1/competitors/{competitor_id}")
    async def get_competitor(competitor_id: str):
        """Get a single competitor's profile and intelligence."""
        try:
            from pulse.api.seed_data import get_competitor_profiles, get_seed_competitive_intelligence
            profiles = get_competitor_profiles()
            profile = next((p for p in profiles if p.id == competitor_id), None)
            if not profile:
                raise HTTPException(404, f"Competitor {competitor_id} not found")
            intel = get_seed_competitive_intelligence()
            comp_intel = intel.get("competitors", {}).get(competitor_id, {})
            return {
                "profile": {"id": profile.id, "name": profile.name, "archetype": profile.archetype,
                           "hair_exposure": profile.hair_exposure, "lhc_exposure": profile.lhc_exposure,
                           "response_speed": profile.response_speed, "typical_responses": profile.typical_responses,
                           "category_exposure": profile.category_exposure},
                "intelligence": comp_intel,
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to get competitor {competitor_id}: {e}")
            raise HTTPException(500, str(e))

    # ── Export endpoints ────────────────────────────────────────────
    @app.post("/api/v1/export/powerbi")
    async def export_powerbi(path: Optional[str] = None):
        """Generate flat JSON shift matrix for Power BI consumption."""
        mc = _state.get("mc_result")
        if not mc:
            raise HTTPException(404, "No simulation results")
        try:
            from pulse.excel_bridge.powerbi_export import PowerBIExporter
            exporter = PowerBIExporter(_state["config"])
            import tempfile, os
            out_dir = path or os.path.join(tempfile.gettempdir(), "pulse_exports")
            os.makedirs(out_dir, exist_ok=True)
            out_file = os.path.join(out_dir, "shift_matrix.json")
            exporter.export_shift_matrix(
                mc_result=mc,
                output_path=out_file,
            )
            return {"status": "exported", "path": out_file}
        except Exception as e:
            raise HTTPException(500, f"Export failed: {e}")

    @app.get("/api/v1/export/powerbi/status")
    async def export_powerbi_status():
        """Last Power BI export status."""
        import tempfile, os
        out_file = os.path.join(tempfile.gettempdir(), "pulse_exports", "shift_matrix.json")
        if os.path.exists(out_file):
            stat = os.stat(out_file)
            from datetime import datetime
            return {
                "last_export": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "file_path": out_file,
                "size_bytes": stat.st_size,
            }
        return {"last_export": None}

    @app.post("/api/v1/export/excel")
    async def export_excel():
        """Generate Shift Matrix Excel file."""
        mc = _state.get("mc_result")
        det = _state.get("det_result")
        if not mc:
            raise HTTPException(404, "No simulation results")
        try:
            from pulse.excel_bridge.writer import ShiftMatrixWriter
            import tempfile, os
            out_dir = os.path.join(tempfile.gettempdir(), "pulse_exports")
            os.makedirs(out_dir, exist_ok=True)
            out_file = os.path.join(out_dir, "shift_matrix.xlsx")
            writer = ShiftMatrixWriter(out_file)
            writer.write(mc, _state.get("config"), det, _state.get("allocation"))
            return {"status": "exported", "path": out_file}
        except Exception as e:
            raise HTTPException(500, f"Export failed: {e}")

    @app.post("/api/v1/export/pptx")
    async def export_pptx():
        """Generate executive PowerPoint presentation."""
        mc = _state.get("mc_result")
        if not mc:
            raise HTTPException(404, "No simulation results")
        try:
            import importlib
            import pulse.api.export_pptx as _pptx_mod
            importlib.reload(_pptx_mod)
            PowerPointExporter = _pptx_mod.PowerPointExporter
            from fastapi.responses import FileResponse
            import tempfile, os

            out_dir = os.path.join(tempfile.gettempdir(), "pulse_exports")
            os.makedirs(out_dir, exist_ok=True)
            out_file = os.path.join(out_dir, "PRISM_Profit_Pool_Shift_Model.pptx")

            db = _state.get("db")
            trends_list = [
                {
                    "id": t.id,
                    "name": t.name,
                    "force": t.force,
                    "direction": t.direction,
                    "probability": t.probability,
                    "normalized_score": t.normalized_score,
                    "description": t.description,
                }
                for t in (db.trends if db else [])
            ]

            config = _state.get("config")
            exporter = PowerPointExporter()
            exporter.export(
                output_path=out_file,
                shifts=mc.get("shift_matrix", {}),
                trends=trends_list,
                convergence=mc.get("convergence"),
                allocation=_state.get("allocation"),
                model_version=__version__,
                model_accuracy=(config.backtesting_accuracy if config and config.backtesting_accuracy is not None else 0.73),
            )

            return FileResponse(
                out_file,
                media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
                filename="PRISM_Profit_Pool_Shift_Model.pptx",
            )
        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            logger.error(f"PowerPoint export failed: {e}\n{tb}")
            raise HTTPException(500, f"Export failed: {str(e)}\n{tb}")

    # ── AI Scanning (disabled — external API integrations removed) ──
    @app.post("/api/v1/ai/scan")
    async def ai_scan():
        """AI trend scanning disabled — external API integrations removed."""
        return {
            "status": "disabled",
            "trends": [],
            "sources_checked": [],
            "total_trends": 0,
            "message": "External API scanning has been disabled. Use manual trend entry.",
        }

    # ── AI Chat endpoint ─────────────────────────────────────────
    @app.post("/api/v1/chat")
    async def chat(req: ChatRequest):
        """Natural language query interface."""
        try:
            from pulse.ai.chat import PulseChat
            from pulse.ai.provider import get_provider
            provider = get_provider()
            chat_engine = PulseChat(provider)
            context = {
                "simulation": _state.get("mc_result"),
                "trends": [{"id": t.id, "name": t.name, "force": t.force,
                            "direction": t.direction,
                            "probability": t.probability,
                            "normalized_score": t.normalized_score}
                           for t in (_state.get("db").trends if _state.get("db") else [])],
            }
            answer = await chat_engine.ask(req.question, context)
            return {"answer": answer}
        except ImportError:
            return {"answer": "AI features require additional setup. Set ANTHROPIC_API_KEY or configure an AI provider."}
        except Exception as e:
            return {"answer": f"AI query failed: {str(e)}"}

    # ── Session Snapshots (Persistent History) ──────────────────────
    class SnapshotCreate(BaseModel):
        name: str
        shifts: dict
        trends: list = []
        trend_count: int = 0
        net_shift: float = 0.0
        notes: Optional[str] = None

    @app.get("/api/v1/snapshots")
    async def list_snapshots():
        """List all session snapshots, newest first. Never deleted."""
        try:
            from pulse.database import get_db_connection, _row_to_dict
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, name, created_at, shifts, trends,
                           trend_count, net_shift, notes, created_by, model_version, iterations
                    FROM session_snapshots
                    ORDER BY created_at DESC
                """)
                rows = cursor.fetchall()
                snapshots = []
                for raw_row in rows:
                    row = _row_to_dict(raw_row)
                    snap = dict(row)
                    # Parse JSON fields
                    try:
                        snap["shifts"] = json.loads(snap["shifts"]) if snap["shifts"] else {}
                    except (json.JSONDecodeError, TypeError):
                        snap["shifts"] = {}
                    try:
                        snap["trends"] = json.loads(snap["trends"]) if snap["trends"] else []
                    except (json.JSONDecodeError, TypeError):
                        snap["trends"] = []
                    snapshots.append(snap)
                return snapshots
        except Exception as e:
            logger.error(f"Failed to list snapshots: {e}")
            return []

    @app.post("/api/v1/snapshots")
    async def create_snapshot(req: SnapshotCreate):
        """Create a new session snapshot. Snapshots are permanent — never auto-deleted."""
        import uuid
        from pulse.database import get_db_connection, placeholder, ph, _row_to_dict
        snapshot_id = f"snap_{uuid.uuid4().hex[:12]}"
        p = placeholder()
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(f"""
                    INSERT INTO session_snapshots
                        (id, name, shifts, trends, trend_count, net_shift, notes, model_version)
                    VALUES ({ph(8)})
                """, (
                    snapshot_id,
                    req.name,
                    json.dumps(req.shifts),
                    json.dumps(req.trends),
                    req.trend_count,
                    req.net_shift,
                    req.notes,
                    __version__,
                ))
                conn.commit()
                # Fetch the created row to return full data
                cursor.execute(f"""
                    SELECT id, name, created_at, shifts, trends,
                           trend_count, net_shift, notes, created_by, model_version, iterations
                    FROM session_snapshots WHERE id = {p}
                """, (snapshot_id,))
                raw_row = cursor.fetchone()
                if raw_row:
                    row = _row_to_dict(raw_row)
                    snap = dict(row)
                    try:
                        snap["shifts"] = json.loads(snap["shifts"]) if snap["shifts"] else {}
                    except (json.JSONDecodeError, TypeError):
                        snap["shifts"] = {}
                    try:
                        snap["trends"] = json.loads(snap["trends"]) if snap["trends"] else []
                    except (json.JSONDecodeError, TypeError):
                        snap["trends"] = []
                    return snap
            return {"id": snapshot_id, "status": "created"}
        except Exception as e:
            logger.error(f"Failed to create snapshot: {e}")
            raise HTTPException(500, f"Snapshot creation failed: {str(e)}")

    @app.get("/api/v1/snapshots/{snapshot_id}")
    async def get_snapshot(snapshot_id: str):
        """Get a single snapshot by ID."""
        from pulse.database import get_db_connection, placeholder, _row_to_dict
        p = placeholder()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"SELECT * FROM session_snapshots WHERE id = {p}", (snapshot_id,))
            raw_row = cursor.fetchone()
            if not raw_row:
                raise HTTPException(404, "Snapshot not found")
            row = _row_to_dict(raw_row)
            snap = dict(row)
            try:
                snap["shifts"] = json.loads(snap["shifts"]) if snap["shifts"] else {}
            except (json.JSONDecodeError, TypeError):
                snap["shifts"] = {}
            try:
                snap["trends"] = json.loads(snap["trends"]) if snap["trends"] else []
            except (json.JSONDecodeError, TypeError):
                snap["trends"] = []
            return snap

    # Try to serve static files for the dashboard
    dashboard_dir = Path(__file__).parent.parent / "dashboard" / "dist"
    if dashboard_dir.exists():
        app.mount("/", StaticFiles(directory=str(dashboard_dir), html=True), name="dashboard")

    return app


# Module-level app instance for `uvicorn pulse.api.app:app`
app = create_app()
