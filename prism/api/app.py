"""The PRISM API application.

The API serves what the production job and the editors wrote to the
database (the latest persisted simulation run, the drivers, the stored
Consumer Journey tile map), the model configuration, which is code, and the
content that ships with the code and never with the dashboard's bundle: the
Consumer Journey's base tile map and stage contexts and the Profit Pool
Explorer's views (prism/journey_content.py, prism/explorer_content.py). The
only writes it accepts are an admin's driver edit, an expert's score proposal
and an admin's journey content save; on a new, empty database it also creates
the tables and seeds the driver base on first use (a database that lost its
drivers is restored from its backup, never reseeded). It never runs the
simulation; runs come from scripts/run_production.py. On PostgreSQL every
authenticated request re-checks the token's role against the dashboard's
user_roles table (prism/api/auth.py).

The dashboard reaches the API on its own origin (a Vercel rewrite in
production, the Next.js dev server's rewrite locally), so no CORS policy is
needed. Run it locally with ``uvicorn prism.api.app:app --port 8000``; the
repository's .env is loaded first, so the database URL there applies.
"""
import prism.env_loader  # noqa: F401  (before prism.database reads the database URL)
import logging
import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from prism import __version__
from prism.api.auth import RoleRefused
from prism.api.routers import config, drivers, explorer, journey, simulation, system
from prism.database import (DatabaseNotConfiguredError, DatabaseUnavailableError, DriversMissingError,
                            MigrationPendingError, on_vercel)

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    # The interactive documentation (/docs, /redoc, /openapi.json) describes
    # every route to whoever asks. It is served only where PRISM_API_DOCS=1
    # asks for it (a development machine), whatever the host, and never on
    # Vercel.
    docs = os.environ.get("PRISM_API_DOCS") == "1" and not on_vercel()
    app = FastAPI(
        title="PRISM API",
        version=__version__,
        description="The persisted PRISM run, the drivers with their expert proposals, the model configuration, "
                    "the Consumer Journey content and the Profit Pool Explorer's views; admin edits of the drivers "
                    "and the journey arrive through the dashboard's server routes.",
        docs_url="/docs" if docs else None,
        redoc_url="/redoc" if docs else None,
        openapi_url="/openapi.json" if docs else None,
    )

    @app.exception_handler(MigrationPendingError)
    @app.exception_handler(DatabaseNotConfiguredError)
    @app.exception_handler(DriversMissingError)
    def _not_ready(request: Request, exc: Exception) -> JSONResponse:
        # The database needs a migration or no database is configured: nothing
        # is read from it or written to it until that is fixed (the model
        # configuration, which is code, is still served). A database that lost
        # its drivers serves neither the drivers nor the run and takes no write
        # until it is restored; the configuration and the stored Journey stay
        # readable.
        return JSONResponse(status_code=503, content={"detail": str(exc)})

    @app.exception_handler(RoleRefused)
    def _refused(request: Request, exc: RoleRefused) -> JSONResponse:
        # The stored role no longer covers the token's (or an admin route was
        # asked without it): the body names the refusal in `code` next to
        # FastAPI's `detail`, and the dashboard leaves on `no_role`.
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail, "code": exc.code})

    @app.exception_handler(DatabaseUnavailableError)
    def _unreachable(request: Request, exc: Exception) -> JSONResponse:
        # A passing outage (a waking serverless database, a network fault).
        # The answer names nothing about the database; the log has the
        # category of the failure (prism.database.describe_error).
        logger.warning("%s %s: %s", request.method, request.url.path, exc)
        return JSONResponse(status_code=503, content={
            "detail": "The database cannot be reached right now; try again in a moment."})

    for module in (system, drivers, simulation, config, journey, explorer):
        app.include_router(module.router)
    return app


app = create_app()
