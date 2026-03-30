"""Vercel serverless entry point for PRISM FastAPI backend.

Vercel's Python runtime looks for an `app` variable that is an ASGI application.
This module imports and re-exports the FastAPI app from the pulse package.
"""
import sys
import os
import logging
import time
from pathlib import Path

logger = logging.getLogger(__name__)

# Ensure the project root is on the Python path so `pulse` is importable
project_root = str(Path(__file__).resolve().parent.parent)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# ── Cold-start retry wrapper ──────────────────────────────────────
def _create_app_with_retry(max_retries: int = 3, backoff: float = 0.5):
    """Create FastAPI app with retry logic for Vercel cold starts.

    Database connections (especially Neon Postgres) can fail on first
    attempt during cold starts. Retry with exponential backoff.
    """
    last_error = None
    for attempt in range(max_retries):
        try:
            from pulse.api.app import create_app
            application = create_app()
            if attempt > 0:
                logger.info(f"App created successfully on attempt {attempt + 1}")
            return application
        except Exception as e:
            last_error = e
            wait = backoff * (2 ** attempt)
            logger.warning(
                f"Cold start attempt {attempt + 1}/{max_retries} failed: {e}. "
                f"Retrying in {wait:.1f}s..."
            )
            time.sleep(wait)

    # Final fallback: create a minimal health-only app
    logger.error(f"All {max_retries} attempts failed. Last error: {last_error}")
    logger.error("Creating minimal fallback app...")

    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    fallback = FastAPI(title="PRISM (degraded mode)")
    fallback.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @fallback.get("/api/v1/health")
    async def health():
        return {
            "status": "degraded",
            "error": str(last_error),
            "version": "unknown",
            "model_loaded": False,
            "trend_count": 0,
            "categories": 0,
            "has_simulation": False,
        }

    @fallback.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
    async def catch_all(path: str):
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=503,
            content={
                "error": "Service temporarily unavailable — cold start failed",
                "detail": str(last_error),
                "retry": True,
            },
        )

    return fallback


# Vercel expects an `app` variable — ASGI handler
app = _create_app_with_retry()
