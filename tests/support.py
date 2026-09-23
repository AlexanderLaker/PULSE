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


def bundled_journey() -> dict:
    """The Consumer Journey tile map the dashboard ships: LHC_JOURNEY and
    HAIR_JOURNEY from data/consumerJourney.ts, which are JSON literals."""
    src = (REPO / "data" / "consumerJourney.ts").read_text(encoding="utf-8")

    def extract(name):
        start = src.index("[", src.index("=", src.index(f"export const {name}")))
        depth, in_string, escaped = 0, False, False
        for i in range(start, len(src)):
            ch = src[i]
            if in_string:
                if escaped:
                    escaped = False
                elif ch == "\\":
                    escaped = True
                elif ch == '"':
                    in_string = False
                continue
            if ch == '"':
                in_string = True
            elif ch in "[{":
                depth += 1
            elif ch in "]}":
                depth -= 1
                if depth == 0:
                    return json.loads(src[start:i + 1])
        raise AssertionError(f"{name} not found in data/consumerJourney.ts")
    return {"lhc": extract("LHC_JOURNEY"), "hair": extract("HAIR_JOURNEY")}
