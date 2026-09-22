"""Persistence: PostgreSQL in production, SQLite for local work and tests.

Setting ``POSTGRES_URL`` or ``DATABASE_URL`` selects PostgreSQL (psycopg2);
otherwise the database is the SQLite file at ``PRISM_DB_PATH`` (default
``data/prism.db``). All SQL is written once, with ``placeholder()`` / ``ph()``
for the parameter style of the active backend.

The database holds relative figures only (scores, shares, percentage shifts);
no currency amount is ever stored.
"""

import json
import logging
import os
import time
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from prism.drivers import Driver

logger = logging.getLogger(__name__)

POSTGRES_URL = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL")
USE_POSTGRES = bool(POSTGRES_URL)

if USE_POSTGRES:
    import psycopg2
    import psycopg2.extras
else:
    import sqlite3

#: Migrations whose result the schema below already contains. init_db records
#: them on a new database so a migration script never runs on it.
SCHEMA_MIGRATIONS = ("0001_driver_schema",)


class LegacySchemaError(RuntimeError):
    """The database predates the current schema and must be migrated first."""


# ── JSON ────────────────────────────────────────────────────────────────────

def _json_default(o):
    if isinstance(o, datetime):
        return o.isoformat()
    if hasattr(o, "tolist"):  # numpy scalars and arrays, without importing numpy
        return o.tolist()
    raise TypeError(f"Object of type {type(o).__name__} is not JSON serializable")


def dumps(obj) -> str:
    """json.dumps that also accepts numpy scalars and arrays and datetimes."""
    return json.dumps(obj, default=_json_default)


def _loads(val):
    """Decode a JSON text column; None for NULL or empty text."""
    if val is None or val == "":
        return None
    return json.loads(val) if isinstance(val, str) else val


# ── Connections ─────────────────────────────────────────────────────────────

def sqlite_path() -> Path:
    """Path of the SQLite file (``/tmp`` on Vercel, whose code folder is read-only)."""
    on_vercel = bool(os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"))
    return Path(os.environ.get("PRISM_DB_PATH", "/tmp/prism.db" if on_vercel else "data/prism.db"))


def _connect():
    if USE_POSTGRES:
        # TLS is required unless the URL says otherwise (a local server for tests).
        conn = psycopg2.connect(POSTGRES_URL, **({} if "sslmode=" in POSTGRES_URL else {"sslmode": "require"}))
        conn.autocommit = False
        conn.cursor_factory = psycopg2.extras.RealDictCursor
        return conn
    path = sqlite_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def get_db_connection():
    """A connection that commits on success and rolls back on error.

    Connecting is retried three times with backoff, because a serverless
    PostgreSQL endpoint can take a moment to wake up.
    """
    conn, last_error = None, None
    for attempt in range(3):
        try:
            conn = _connect()
            break
        except Exception as e:  # noqa: BLE001 (any driver error is retried)
            last_error = e
            if attempt < 2:
                wait = 0.5 * (2 ** attempt)
                logger.warning("Database connection attempt %d failed: %s; retrying in %.1fs", attempt + 1, e, wait)
                time.sleep(wait)
    if conn is None:
        raise RuntimeError(f"Failed to connect to the database after 3 attempts: {last_error}")
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error("Database error: %s", e)
        raise
    finally:
        conn.close()


def placeholder() -> str:
    """SQL parameter placeholder of the active backend."""
    return "%s" if USE_POSTGRES else "?"


def ph(count: int = 1) -> str:
    """``count`` comma-separated placeholders, e.g. ph(3) == "?, ?, ?"."""
    return ", ".join([placeholder()] * count)


def _row(row) -> dict:
    return row if isinstance(row, dict) else dict(row)


def _int_or_none(val):
    return None if val is None or val == "" else int(val)


# ── Schema ──────────────────────────────────────────────────────────────────

def _schema() -> List[str]:
    serial = "SERIAL PRIMARY KEY" if USE_POSTGRES else "INTEGER PRIMARY KEY AUTOINCREMENT"
    return [
        """CREATE TABLE IF NOT EXISTS drivers (
            id TEXT PRIMARY KEY,
            force TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            direction TEXT,
            probability INTEGER,
            start_year INTEGER,
            peak_year INTEGER DEFAULT 0,
            diffusion_curve TEXT DEFAULT 's_curve',
            gp1_pct_affected REAL,
            uncertainty INTEGER,
            confidence TEXT DEFAULT 'Medium',
            analysis TEXT,
            data_source TEXT,
            baseline TEXT,
            scores_edited BOOLEAN DEFAULT FALSE,
            revision INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS driver_category_exposure (
            driver_id TEXT REFERENCES drivers(id) ON DELETE CASCADE,
            category TEXT NOT NULL,
            exposure_score INTEGER,
            PRIMARY KEY (driver_id, category)
        )""",
        """CREATE TABLE IF NOT EXISTS driver_vc_exposure (
            driver_id TEXT REFERENCES drivers(id) ON DELETE CASCADE,
            vc_step TEXT NOT NULL,
            exposure_score INTEGER,
            PRIMARY KEY (driver_id, vc_step)
        )""",
        """CREATE TABLE IF NOT EXISTS driver_regional_exposure (
            driver_id TEXT REFERENCES drivers(id) ON DELETE CASCADE,
            region TEXT NOT NULL,
            exposure_score INTEGER,
            PRIMARY KEY (driver_id, region)
        )""",
        f"""CREATE TABLE IF NOT EXISTS driver_sources (
            id {serial},
            driver_id TEXT REFERENCES drivers(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            tier TEXT DEFAULT '',
            note TEXT DEFAULT ''
        )""",
        # One row per (driver, expert): any signed-in user can propose scores
        # for a driver; admins endorse by editing the driver itself.
        f"""CREATE TABLE IF NOT EXISTS driver_score_proposals (
            id {serial},
            driver_id TEXT REFERENCES drivers(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL,
            user_name TEXT,
            user_role TEXT,
            probability INTEGER,
            gp1_pct_affected REAL,
            peak_year INTEGER,
            diffusion_curve TEXT,
            uncertainty INTEGER,
            category_exposure TEXT,
            regional_exposure TEXT,
            vc_exposure TEXT,
            comment TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (driver_id, user_id)
        )""",
        # Append-only versions of the Consumer Journey content; the newest row wins.
        f"""CREATE TABLE IF NOT EXISTS journey_content (
            id {serial},
            content TEXT NOT NULL,
            updated_by TEXT DEFAULT '',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        f"""CREATE TABLE IF NOT EXISTS simulation_runs (
            id {serial},
            run_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            iterations INTEGER,
            results TEXT
        )""",
        f"""CREATE TABLE IF NOT EXISTS audit_log (
            id {serial},
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            action TEXT NOT NULL,
            entity_type TEXT,
            entity_id TEXT,
            old_value TEXT,
            new_value TEXT,
            reason TEXT,
            user_id TEXT DEFAULT 'system'
        )""",
        """CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        "CREATE INDEX IF NOT EXISTS idx_drivers_force ON drivers(force)",
        "CREATE INDEX IF NOT EXISTS idx_driver_score_proposals_driver ON driver_score_proposals(driver_id)",
        "CREATE INDEX IF NOT EXISTS idx_simulation_runs_date ON simulation_runs(run_date)",
        "CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp)",
    ]


def table_names(cursor) -> set:
    """Names of the tables in the connected database."""
    if USE_POSTGRES:
        cursor.execute("SELECT table_name AS name FROM information_schema.tables WHERE table_schema = current_schema()")
    else:
        cursor.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
    return {_row(r)["name"] for r in cursor.fetchall()}


def init_db() -> None:
    """Create any missing table; safe to call on every start.

    Refuses a database that still has the tables of the previous schema,
    because creating the new tables next to them would hide the real data
    behind an empty driver base.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        existing = table_names(cursor)
        if "trends" in existing and "drivers" not in existing:
            raise LegacySchemaError(
                "This database uses the previous schema (table 'trends'). Run "
                "migrations/0001_driver_schema/migrate.py against it before starting PRISM.")
        for statement in _schema():
            cursor.execute(statement)
        for version in SCHEMA_MIGRATIONS:
            cursor.execute(f"SELECT 1 FROM schema_migrations WHERE version = {placeholder()}", (version,))
            if cursor.fetchone() is None:
                cursor.execute(f"INSERT INTO schema_migrations (version) VALUES ({placeholder()})", (version,))
    logger.info("Database initialised (%s)", "postgres" if USE_POSTGRES else "sqlite")


def diagnose_connection() -> Dict[str, Any]:
    """What this process sees of the database, for /api/v1/diagnostics.

    Never raises: a failure is reported in ``error``, so the dashboard can tell
    "cannot reach the database" from "reachable but empty".
    """
    which_env = "POSTGRES_URL" if os.environ.get("POSTGRES_URL") else (
        "DATABASE_URL" if os.environ.get("DATABASE_URL") else None)
    out: Dict[str, Any] = {
        "db_mode": "postgres" if USE_POSTGRES else "sqlite",
        "db_host": (urlparse(POSTGRES_URL).hostname or "unknown") if USE_POSTGRES else f"<sqlite:{sqlite_path()}>",
        "db_url_env": which_env,
        "db_reachable": False,
        "simulation_run_count": 0,
        "latest_run_id": None,
        "latest_run_date": None,
        "error": None,
    }
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) AS n FROM simulation_runs")
            out["simulation_run_count"] = int(_row(cursor.fetchone())["n"] or 0)
            out["db_reachable"] = True
        latest = latest_run_summary()
        if latest:
            out["latest_run_id"] = latest["id"]
            out["latest_run_date"] = latest["run_date"]
    except Exception as e:  # noqa: BLE001 (reported, never raised)
        out["error"] = f"{type(e).__name__}: {e}"
        logger.warning("diagnose_connection: database probe failed: %s", out["error"])
    return out


# ── Drivers ─────────────────────────────────────────────────────────────────

_DRIVER_COLUMNS = (
    "id", "force", "name", "description", "direction", "probability", "start_year",
    "peak_year", "diffusion_curve", "gp1_pct_affected", "uncertainty", "confidence",
    "analysis", "data_source", "baseline", "scores_edited",
)


def save_drivers(drivers: List[Driver]) -> None:
    """Insert or replace drivers, keeping each row (and its proposals) alive.

    The driver row is upserted, never deleted, because expert proposals
    reference it with ON DELETE CASCADE: deleting and re-inserting on every
    edit would erase them. The exposure and source rows are rewritten from the
    object. ``created_at`` survives an edit; ``updated_at`` is refreshed and
    ``revision`` goes up by one (see drivers_stamp).
    """
    p = placeholder()
    cols = ", ".join(_DRIVER_COLUMNS)
    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in _DRIVER_COLUMNS if c != "id")
    with get_db_connection() as conn:
        cursor = conn.cursor()
        for d in drivers:
            cursor.execute(
                f"""INSERT INTO drivers ({cols}) VALUES ({ph(len(_DRIVER_COLUMNS))})
                    ON CONFLICT (id) DO UPDATE SET {updates}, revision = drivers.revision + 1,
                        updated_at = CURRENT_TIMESTAMP""",
                (d.id, d.force, d.name, d.description, d.direction, d.probability, d.start_year,
                 d.peak_year, d.diffusion_curve, d.gp1_pct_affected, d.uncertainty, d.confidence,
                 d.analysis, d.data_source, dumps(d.baseline) if d.baseline else None, d.scores_edited),
            )
            for table in ("driver_category_exposure", "driver_vc_exposure", "driver_regional_exposure", "driver_sources"):
                cursor.execute(f"DELETE FROM {table} WHERE driver_id = {p}", (d.id,))
            for category, score in d.category_exposure.items():
                cursor.execute(f"INSERT INTO driver_category_exposure (driver_id, category, exposure_score) VALUES ({ph(3)})",
                               (d.id, category, score))
            for step, score in d.vc_exposure.items():
                cursor.execute(f"INSERT INTO driver_vc_exposure (driver_id, vc_step, exposure_score) VALUES ({ph(3)})",
                               (d.id, step, score))
            for region, score in d.regional_exposure.items():
                cursor.execute(f"INSERT INTO driver_regional_exposure (driver_id, region, exposure_score) VALUES ({ph(3)})",
                               (d.id, region, score))
            for src in d.sources or []:
                cursor.execute(
                    f"INSERT INTO driver_sources (driver_id, title, url, tier, note) VALUES ({ph(5)})",
                    (d.id, src.get("title", ""), src.get("url", ""), src.get("tier", ""), src.get("note", "")),
                )
    logger.info("Saved %d drivers", len(drivers))


def load_drivers() -> List[Driver]:
    """All drivers with their exposures and sources, ordered by id.

    The order is part of the reproducibility contract: the copula pairs draws
    with drivers by position, so the same inputs and seed give the same result
    only if the drivers always arrive in the same order.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM drivers ORDER BY id")
        rows = [_row(r) for r in cursor.fetchall()]
        exposures: Dict[str, Dict[str, dict]] = {r["id"]: {"category": {}, "vc": {}, "region": {}} for r in rows}
        for table, key, column in (("driver_category_exposure", "category", "category"),
                                   ("driver_vc_exposure", "vc", "vc_step"),
                                   ("driver_regional_exposure", "region", "region")):
            cursor.execute(f"SELECT driver_id, {column} AS k, exposure_score FROM {table}")
            for r in cursor.fetchall():
                r = _row(r)
                if r["driver_id"] in exposures:
                    exposures[r["driver_id"]][key][r["k"]] = r["exposure_score"]
        sources: Dict[str, list] = {r["id"]: [] for r in rows}
        cursor.execute("SELECT driver_id, title, url, tier, note FROM driver_sources ORDER BY id")
        for r in cursor.fetchall():
            r = _row(r)
            if r["driver_id"] in sources:
                sources[r["driver_id"]].append({"title": r["title"], "url": r["url"],
                                                "tier": r["tier"] or "", "note": r["note"] or ""})

    drivers = []
    for r in rows:
        e = exposures[r["id"]]
        drivers.append(Driver(
            id=r["id"],
            force=r["force"],
            name=r["name"],
            description=r["description"] or "",
            direction=r["direction"],
            probability=r["probability"],
            start_year=r["start_year"],
            analysis=r["analysis"] or "",
            category_exposure=e["category"],
            vc_exposure=e["vc"],
            regional_exposure=e["region"],
            data_source=r["data_source"] or "",
            sources=sources[r["id"]],
            confidence=r["confidence"] or "Medium",
            # A missing GP1 share stays missing so the engine refuses to run.
            gp1_pct_affected=r["gp1_pct_affected"],
            peak_year=r["peak_year"] or 0,
            diffusion_curve=r["diffusion_curve"] or "s_curve",
            uncertainty=_int_or_none(r["uncertainty"]),
            baseline=_loads(r["baseline"]),
            scores_edited=bool(r["scores_edited"]),
        ))
    logger.info("Loaded %d drivers", len(drivers))
    return drivers


def drivers_stamp() -> tuple:
    """(row count, sum of row revisions) of the drivers table.

    Every write to a driver row raises its revision by one and rows are never
    deleted by the application, so the pair changes with every committed save,
    however close together two saves are. (A timestamp would not do: two saves
    can share one, and a transaction that started earlier can commit later.)
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) AS n, COALESCE(SUM(revision), 0) AS revisions FROM drivers")
        r = _row(cursor.fetchone())
    return int(r["n"] or 0), int(r["revisions"] or 0)


# ── Simulation runs ─────────────────────────────────────────────────────────

def save_simulation_run(iterations: int, results: dict) -> int:
    """Persist a run's results bundle and return its id."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        sql = f"INSERT INTO simulation_runs (iterations, results) VALUES ({ph(2)})"
        if USE_POSTGRES:
            cursor.execute(sql + " RETURNING id", (iterations, dumps(results)))
            run_id = _row(cursor.fetchone())["id"]
        else:
            cursor.execute(sql, (iterations, dumps(results)))
            run_id = cursor.lastrowid
    logger.info("Saved simulation run %s (%d iterations)", run_id, iterations)
    return run_id


def _as_datetime(val):
    return datetime.fromisoformat(val) if isinstance(val, str) else val


def load_latest_run() -> Optional[Dict[str, Any]]:
    """The newest persisted run with its decoded results, or None."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, run_date, iterations, results FROM simulation_runs "
                       "ORDER BY run_date DESC, id DESC LIMIT 1")
        raw = cursor.fetchone()
    if raw is None:
        return None
    r = _row(raw)
    return {"id": r["id"], "run_date": _as_datetime(r["run_date"]), "iterations": r["iterations"],
            "results": _loads(r["results"]) or {}}


def latest_run_summary() -> Optional[Dict[str, Any]]:
    """Id and date of the newest run, without loading its results."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, run_date FROM simulation_runs ORDER BY run_date DESC, id DESC LIMIT 1")
        raw = cursor.fetchone()
    if raw is None:
        return None
    r = _row(raw)
    run_date = _as_datetime(r["run_date"])
    return {"id": int(r["id"]), "run_date": run_date.isoformat() if run_date else None}


# ── Consumer Journey content ────────────────────────────────────────────────

def save_journey_content(content: dict, updated_by: str = "") -> None:
    """Store a new version of the journey content ({lhc, hair} tile map)."""
    with get_db_connection() as conn:
        conn.cursor().execute(f"INSERT INTO journey_content (content, updated_by) VALUES ({ph(2)})",
                              (dumps(content), updated_by or ""))
    logger.info("Saved journey content (by %s)", updated_by or "unknown")


def load_journey_content() -> Optional[dict]:
    """The newest journey content, or None when only the bundled seed exists."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT content FROM journey_content ORDER BY id DESC LIMIT 1")
        row = cursor.fetchone()
    return _loads(_row(row)["content"]) if row else None


# ── Expert score proposals ──────────────────────────────────────────────────
# A proposal is partial: any subset of the scoreable fields may be set, and a
# NULL field means "this expert did not score that".

_PROPOSAL_SCALAR_FIELDS = ("probability", "gp1_pct_affected", "peak_year", "diffusion_curve", "uncertainty")
_PROPOSAL_MAP_FIELDS = ("category_exposure", "regional_exposure", "vc_exposure")
_PROPOSAL_TEXT_FIELDS = ("comment",)
_PROPOSAL_COLUMNS = ("user_id, user_name, user_role, probability, gp1_pct_affected, peak_year, "
                     "diffusion_curve, uncertainty, category_exposure, regional_exposure, vc_exposure, "
                     "comment, updated_at")


def _proposal(raw) -> dict:
    r = _row(raw)
    return {
        "user_id": r.get("user_id"),
        "user_name": r.get("user_name"),
        "user_role": r.get("user_role"),
        "probability": r.get("probability"),
        "gp1_pct_affected": r.get("gp1_pct_affected"),
        "peak_year": r.get("peak_year"),
        "diffusion_curve": r.get("diffusion_curve"),
        "uncertainty": _int_or_none(r.get("uncertainty")),
        "category_exposure": _loads(r.get("category_exposure")),
        "regional_exposure": _loads(r.get("regional_exposure")),
        "vc_exposure": _loads(r.get("vc_exposure")),
        "comment": r.get("comment"),
        "updated_at": r.get("updated_at"),
    }


def load_driver_proposals(driver_id: str) -> List[Dict[str, Any]]:
    """Every expert proposal for one driver, oldest first."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f"SELECT {_PROPOSAL_COLUMNS} FROM driver_score_proposals "
                       f"WHERE driver_id = {placeholder()} ORDER BY updated_at ASC, user_id ASC", (driver_id,))
        return [_proposal(r) for r in cursor.fetchall()]


def load_all_driver_proposals() -> Dict[str, List[Dict[str, Any]]]:
    """Every proposal grouped by driver id, in one query."""
    out: Dict[str, List[Dict[str, Any]]] = {}
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f"SELECT driver_id, {_PROPOSAL_COLUMNS} FROM driver_score_proposals "
                       "ORDER BY updated_at ASC, user_id ASC")
        for raw in cursor.fetchall():
            r = _row(raw)
            out.setdefault(r["driver_id"], []).append(_proposal(r))
    return out


def upsert_driver_proposal(driver_id: str, user_id: str, fields: Dict[str, Any],
                           user_name: str = "", user_role: str = "") -> Dict[str, Any]:
    """Merge a partial proposal into this expert's row and return the merged row.

    Only the keys present in ``fields`` change; everything else on an existing
    row is left as it was.
    """
    p = placeholder()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f"SELECT {_PROPOSAL_COLUMNS} FROM driver_score_proposals "
                       f"WHERE driver_id = {p} AND user_id = {p}", (driver_id, user_id))
        existing = cursor.fetchone()
        merged = _proposal(existing) if existing else {
            k: None for k in _PROPOSAL_SCALAR_FIELDS + _PROPOSAL_MAP_FIELDS + _PROPOSAL_TEXT_FIELDS}
        for k in _PROPOSAL_SCALAR_FIELDS + _PROPOSAL_MAP_FIELDS + _PROPOSAL_TEXT_FIELDS:
            if k in fields:
                merged[k] = fields[k]

        def enc(v):
            return dumps(v) if v is not None else None

        values = (user_name or "", user_role or "",
                  merged.get("probability"), merged.get("gp1_pct_affected"), merged.get("peak_year"),
                  merged.get("diffusion_curve"), merged.get("uncertainty"),
                  enc(merged.get("category_exposure")), enc(merged.get("regional_exposure")),
                  enc(merged.get("vc_exposure")), merged.get("comment"))
        if existing:
            cursor.execute(
                f"""UPDATE driver_score_proposals
                    SET user_name = {p}, user_role = {p}, probability = {p}, gp1_pct_affected = {p},
                        peak_year = {p}, diffusion_curve = {p}, uncertainty = {p},
                        category_exposure = {p}, regional_exposure = {p}, vc_exposure = {p},
                        comment = {p}, updated_at = CURRENT_TIMESTAMP
                    WHERE driver_id = {p} AND user_id = {p}""",
                values + (driver_id, user_id))
        else:
            cursor.execute(
                f"""INSERT INTO driver_score_proposals (driver_id, user_id, user_name, user_role, probability,
                        gp1_pct_affected, peak_year, diffusion_curve, uncertainty, category_exposure,
                        regional_exposure, vc_exposure, comment)
                    VALUES ({ph(13)})""",
                (driver_id, user_id) + values)

    merged.update(user_id=user_id, user_name=user_name or "", user_role=user_role or "")
    return merged


# ── Audit log ───────────────────────────────────────────────────────────────

def log_audit(action: str, entity_type: str, entity_id: str, old_value: Optional[str] = None,
              new_value: Optional[str] = None, reason: Optional[str] = None,
              user_id: str = "system") -> None:
    """Append one entry to the audit log."""
    with get_db_connection() as conn:
        conn.cursor().execute(
            f"INSERT INTO audit_log (action, entity_type, entity_id, old_value, new_value, reason, user_id) "
            f"VALUES ({ph(7)})",
            (action, entity_type, entity_id, old_value, new_value, reason, user_id))
