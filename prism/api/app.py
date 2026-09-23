"""The PRISM API application.

The API serves what the production job and the editors wrote to the
database: the latest persisted simulation run, the drivers, the model
configuration and the Consumer Journey content. The only writes it accepts
are an admin's driver edit, an expert's score proposal and an admin's
journey content save. It never runs the simulation; runs come from
scripts/run_production.py.

The dashboard reaches the API on its own origin (a Vercel rewrite in
production, the Next.js dev server's rewrite locally), so no CORS policy is
needed. Run it locally with ``uvicorn prism.api.app:app --port 8000``; the
repository's .env is loaded first, so the database URL there applies.
"""
import prism.env_loader  # noqa: F401  (before prism.database reads the database URL)
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from prism import __version__
from prism.api.routers import config, drivers, journey, simulation, system
from prism.database import DatabaseNotConfiguredError, LegacySchemaError


def create_app() -> FastAPI:
    app = FastAPI(
        title="PRISM API",
        version=__version__,
        description="Read access to the persisted PRISM run, the drivers and the journey content.",
    )

    @app.exception_handler(LegacySchemaError)
    @app.exception_handler(DatabaseNotConfiguredError)
    def _not_ready(request: Request, exc: Exception) -> JSONResponse:
        # The database needs migration 0001, or no database is configured:
        # nothing is served and nothing is written until that is fixed.
        return JSONResponse(status_code=503, content={"detail": str(exc)})

    for module in (system, drivers, simulation, config, journey):
        app.include_router(module.router)
    return app


app = create_app()
