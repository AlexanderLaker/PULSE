"""Load the repository's .env file into the process environment.

Import this module for its side effect in command-line entry points:

    import prism.env_loader  # noqa: F401

Variables already set in the shell take precedence over the file
(``override=False``), so a single run can be pointed at another database with
``DATABASE_URL=... python scripts/run_production.py``.
"""
import logging
from pathlib import Path

from dotenv import load_dotenv

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_ROOT / ".env"

if ENV_FILE.exists():
    load_dotenv(ENV_FILE, override=False)
    logger.info("Loaded environment from %s (shell variables take precedence)", ENV_FILE)
else:
    logger.info(".env not found at %s; using the process environment only", ENV_FILE)
