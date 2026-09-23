"""Load the repository's .env file into the process environment.

Import this module for its side effect, before anything reads the database
URL, in every entry point that runs on a developer's or the owner's machine:

    import prism.env_loader  # noqa: F401

Variables already set in the shell take precedence over the file
(``override=False``), so a single run can be pointed at another database with
``POSTGRES_URL=... DATABASE_URL=... python3 scripts/run_production.py`` (both,
because POSTGRES_URL wins when the file sets it). Without a .env file (a
Vercel deployment, where the variables come from the project settings)
nothing happens. A host with a .env file but without python-dotenv (one that
installs only api/requirements.txt) logs a warning and goes on without it.
"""
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_ROOT / ".env"


def load_env_file(path: Path = ENV_FILE) -> bool:
    """Load ``path`` into the environment if it exists; True when it was loaded."""
    if not path.exists():
        return False
    try:
        from dotenv import load_dotenv
    except ImportError:
        logger.warning("%s was not loaded: python-dotenv is not installed (pip install -r requirements-dev.txt)",
                       path)
        return False
    load_dotenv(path, override=False)
    logger.info("Loaded environment from %s (shell variables take precedence)", path)
    return True


load_env_file()
