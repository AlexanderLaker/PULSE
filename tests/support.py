"""Helpers the test modules share."""
import importlib.util
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]


def load_module(relative_path: str, name: str | None = None):
    """An entry point (a script, the migration, the Vercel function) loaded as a module.

    Entry points live outside the package and are not importable by name, so
    the tests load them from their file; ``relative_path`` is relative to the
    repository root.
    """
    path = REPO / relative_path
    spec = importlib.util.spec_from_file_location(name or path.stem, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def database_awaiting_a_migration(path: Path) -> Path:
    """A SQLite file that holds a table of the schema but no record of any
    migration: a database from before the migrations, which the code refuses
    until migration 0001 has run."""
    import sqlite3
    conn = sqlite3.connect(path)
    conn.execute("CREATE TABLE simulation_runs (id INTEGER PRIMARY KEY, iterations INTEGER, results TEXT)")
    conn.commit()
    conn.close()
    return path


def category_map(scores: dict | None = None) -> dict:
    """A complete category exposure map: the given scores, 0 in every other category."""
    from prism.config import CATEGORIES
    return {c: (scores or {}).get(c, 0) for c in CATEGORIES}


def region_map(scores: dict | None = None) -> dict:
    """A complete regional exposure map: the given scores, 0 in every other region."""
    from prism.config import REGIONS
    return {r: (scores or {}).get(r, 0) for r in REGIONS}


#: The hand-authored content files the API's content modules are generated from.
JOURNEY_CONTENT = REPO / "data" / "content" / "consumer_journey.json"
POOLS_CONTENT = REPO / "data" / "content" / "profit_pools.json"


def bundled_journey() -> dict:
    """The base Consumer Journey tile map, {lhc: [stage...], hair: [stage...]}:
    the tiles of data/content/consumer_journey.json, which the API serves
    until an admin saves an edit."""
    return json.loads(JOURNEY_CONTENT.read_text(encoding="utf-8"))["tiles"]
