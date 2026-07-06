"""PRISM FastAPI assembly.

June 2026 split (review F4): this module now only assembles the app —
lifespan + lazy serverless init, CORS, and router registration. The
pieces live in:

    pulse/api/state.py                      shared _state dict + lock + DB loaders
    pulse/api/serialization.py              _sanitize / _summarize_convergence
    pulse/api/models.py                     Pydantic request models
    pulse/api/services/simulation_service.py  rehydrate / auto-run / persisted-state probe
    pulse/api/routers/{system,trends,simulation,config,competitors,misc}.py

Behavior is intentionally identical to the pre-split monolith; the
route table is fingerprint-tested in tests/test_api.py.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from pulse import __version__
from pulse.config import ModelConfig
from pulse.audit.logger import AuditLogger
from pulse.api.state import (
    _state, _state_lock, _load_trend_database, _backfill_diffusion_fields,
    get_state_snapshot,  # noqa: F401  (re-export for back-compat)
)
from pulse.api.services.simulation_service import load_latest_run_into_state
from pulse.api.routers.system import router as system_router
from pulse.api.routers.trends import router as trends_router
from pulse.api.routers.simulation import router as simulation_router
from pulse.api.routers.config import router as config_router
from pulse.api.routers.competitors import router as competitors_router
from pulse.api.routers.misc import router as misc_router
from pulse.api.routers.journey import router as journey_router

logger = logging.getLogger(__name__)


def create_app(args=None) -> FastAPI:
    """Create and configure the FastAPI application."""

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


            # Load from database (seeds if empty)
            try:
                _state["db"] = _load_trend_database()
                logger.info(f"Loaded {_state['db'].trend_count} trends from database")
            except Exception as e:
                logger.error(f"Failed to load trends: {e}")

            # Migrate: backfill peak_year and diffusion_curve for existing trends
            if _state.get("db"):
                _backfill_diffusion_fields(_state["db"])

        # Auto-load latest simulation from DB if available. F2 (June 2026,
        # owner decision): the online service NEVER simulates on its own —
        # it only serves runs persisted by the offline CLI (scipy engine).
        # If nothing is persisted, the dashboard shows its "no simulation"
        # state; numbers must be consistent with the calibrated engine.
        if _state.get("db") and _state["db"].trend_count > 0 and not _state.get("mc_result"):
            try:
                if not load_latest_run_into_state():
                    _state["simulation_stale"] = True
                    _state["stale_reason"] = (
                        "No persisted simulation found. Runs are produced offline "
                        "(scripts/run_50k_prod.py) — the online service never simulates."
                    )
                    logger.info("No persisted simulation found — serving empty state (F2: no online auto-run)")
            except Exception as e:
                logger.warning(f"Failed to load simulation from DB: {e}")

        yield

        # ─── Shutdown ───
        async with _state_lock:
            # Cleanup if needed
            pass

    app = FastAPI(
        title="PRISM Profit Pool Shift Model API",
        version=__version__,
        description="Profit Pool Simulation Engine — Bayesian Monte Carlo with a Gaussian copula",
        lifespan=lifespan
    )

    # ── CORS Configuration ──────────────────────────────────────
    import os
    # (localhost:5173 removed July 2026 — that was the deleted Vite dashboard.)
    cors_origins = os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(',')
    if os.environ.get('ENV') == 'production':
        cors_origins = os.environ.get('CORS_ORIGINS', 'https://pulse.henkel.com').split(',')

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    # ── Routers (paths are absolute inside each router) ─────────
    # Analytics router removed (D14 + Sobol rider, June 2026): CVaR /
    # Sobol / tipping-points / reverse-stress deleted end-to-end.
    app.include_router(system_router)
    app.include_router(trends_router)
    app.include_router(simulation_router)
    app.include_router(config_router)
    app.include_router(competitors_router)
    app.include_router(misc_router)
    # Consumer Journey content store (v3.6 journey layer): GET is proxied
    # through Next.js /api/journey (which enforces viewer auth); PUT is
    # admin-only inside the router itself.
    app.include_router(journey_router)
    # Scanner routes removed (Emerging Trends disabled)

    # ── Lazy Initialization (Vercel serverless compatibility) ─────
    _initialized = {"done": False}

    async def _lazy_init():
        """Initialize state on first request if lifespan didn't run (Vercel
        serverless). Retries on failure; degrades gracefully."""
        if _initialized["done"]:
            return
        _initialized["done"] = True
        print("[PRISM] Lazy init: Vercel serverless cold start...", flush=True)
        try:
            async with _state_lock:
                if _state["config"] is None:
                    try:
                        from pulse.database import init_db, USE_POSTGRES, POSTGRES_URL
                        print(f"[PRISM] DB mode: postgres={USE_POSTGRES}, url_set={bool(POSTGRES_URL)}", flush=True)
                        init_db()
                        print("[PRISM] Database initialized successfully", flush=True)
                    except Exception as e:
                        print(f"[PRISM] Database init FAILED: {e}", flush=True)
                        _initialized["done"] = False  # Allow retry on next request
                        return

                    _state["audit"] = AuditLogger()
                    _state["config"] = ModelConfig()

                    if not _state["db"]:
                        try:
                            print("[PRISM] Loading trends from database...", flush=True)
                            _state["db"] = _load_trend_database()
                            tc = _state["db"].trend_count if _state["db"] else 0
                            print(f"[PRISM] Loaded {tc} trends", flush=True)
                        except Exception as e:
                            print(f"[PRISM] Failed to load trends: {e}", flush=True)
                            import traceback; traceback.print_exc()

                    if _state["db"] and _state["db"].trend_count > 0 and not _state.get("mc_result"):
                        try:
                            if load_latest_run_into_state():
                                print("[PRISM] Loaded latest simulation from database", flush=True)
                            else:
                                # F2: never auto-run online — read-only over persisted runs.
                                print("[PRISM] No simulation in DB — serving empty state (F2: no online auto-run)", flush=True)
                                _state["simulation_stale"] = True
                                _state["stale_reason"] = (
                                    "No persisted simulation found. Runs are produced offline "
                                    "(scripts/run_50k_prod.py) — the online service never simulates."
                                )
                        except Exception as e:
                            print(f"[PRISM] Failed to load/run simulation: {e}", flush=True)
        except Exception as e:
            print(f"[PRISM] Lazy init failed completely: {e}", flush=True)
            import traceback; traceback.print_exc()
            _initialized["done"] = False  # Allow retry

    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.requests import Request

    class LazyInitMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request: Request, call_next):
            await _lazy_init()
            response = await call_next(request)
            return response

    app.add_middleware(LazyInitMiddleware)

    return app


# Module-level app instance for `uvicorn pulse.api.app:app`
app = create_app()
