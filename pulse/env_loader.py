"""Load the repo-root .env into the process environment (import side effect).

The engine and the ops scripts read configuration from ``os.environ``
(``DATABASE_URL`` / ``POSTGRES_URL``, ``PRISM_DB_PATH``, ``PRISM_JWT_SECRET``);
importing this module makes the repo-root ``.env`` available to them:

    import pulse.env_loader  # noqa: F401  (import-for-side-effect)

M17 (July 2026 review): ``override=False`` — real shell environment variables
WIN over .env values (the python-dotenv default). The previous
``override=True`` silently ignored e.g. a staging ``DATABASE_URL`` exported on
the command line in favour of the .env prod value, so operators could not
redirect a run without editing the file.

July 2026 rewrite: the former 270-line EnvConfig class in this module
configured only deleted features (AI providers, news/patent/social scanners,
Power BI service principals) and defaulted the SQLite path to the legacy
``data/pulse.db``. Nothing imported it. Deleted, not maintained.
"""
import logging
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover — dev environments install python-dotenv
    raise ImportError(
        "python-dotenv is required. Install with: pip install -r requirements-dev.txt"
    )

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent.parent
ENV_FILE = PROJECT_ROOT / ".env"

if ENV_FILE.exists():
    load_dotenv(ENV_FILE, override=False)  # M17: shell wins over .env
    logger.info("Loaded environment from %s (shell variables take precedence)", ENV_FILE)
else:
    logger.warning(
        ".env not found at %s — relying on the process environment. "
        "Copy .env.example to .env for local development.", ENV_FILE
    )
