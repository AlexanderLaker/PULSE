"""Persistence: PostgreSQL in production, SQLite for local work and tests.

Setting ``POSTGRES_URL`` or ``DATABASE_URL`` selects PostgreSQL (psycopg2);
otherwise the database is the SQLite file at ``PRISM_DB_PATH`` (default
``data/prism.db``). On Vercel a database URL is required: a SQLite file there
would live in one function instance's scratch space and silently vanish. All
SQL is written once, with ``placeholder()`` / ``ph()`` for the parameter style
of the active backend.

The database holds scores, shares and percentage shifts, never an HCB
financial figure; texts (driver descriptions and sources, the Consumer
Journey content) may quote public market figures as evidence.
"""

import json
import logging
import os
import re
import time
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Collection, Dict, List, Optional, Sequence

from prism.config import CATEGORIES, FORCES, REGIONS, VALID_DIFFUSION_CURVES, VC_STAGES
from prism.drivers import (CONFIDENCE_LEVELS, DIRECTIONS, SOURCE_TIERS, Driver, InvalidDriversError,
                           simulation_problems)

logger = logging.getLogger(__name__)

POSTGRES_URL = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL")
USE_POSTGRES = bool(POSTGRES_URL)

if USE_POSTGRES:
    import psycopg2
    import psycopg2.extras
else:
    import sqlite3

#: The migrations under migrations/, in order. The schema below contains the
#: result of all of them; init_db records them on a new database, and every
#: migration records itself in schema_migrations when it has run.
SCHEMA_MIGRATIONS = ("0001_driver_schema",)
#: The PostgreSQL advisory lock init_db holds while it creates the schema (the
#: bytes of "prism" as a number), so that instances starting on a new database
#: at the same moment create it one after the other.
SCHEMA_LOCK = int.from_bytes(b"prism", "big")


class MigrationPendingError(RuntimeError):
    """The database needs a migration from migrations/ before this code may use it."""

    def __init__(self, migration: str):
        self.migration = migration
        super().__init__(f"This database needs migration {migration} before this release can use it: run "
                         f"migrations/{migration}/migrate.py (its README is the runbook).")


class DatabaseNotConfiguredError(RuntimeError):
    """No database URL is set where one is required (a Vercel deployment)."""


class DatabaseUnavailableError(ConnectionError):
    """The database could not be reached, even after the retries."""


class StaleRevisionError(RuntimeError):
    """A driver changed after the editor loaded it; the edit was not written."""

    def __init__(self, driver_id: str, expected: int, current: Optional[int]):
        self.driver_id, self.expected, self.current = driver_id, expected, current
        super().__init__(f"driver {driver_id} is at revision {current}, not {expected}")


class StaleVersionError(RuntimeError):
    """The journey content changed after the editor loaded it; the save was not written."""

    def __init__(self, expected: int, current: int):
        self.expected, self.current = expected, current
        super().__init__(f"the journey content is at version {current}, not {expected}")


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

def on_vercel() -> bool:
    return bool(os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"))


def sqlite_path() -> Path:
    """Path of the SQLite file: PRISM_DB_PATH, or data/prism.db when that is unset or empty."""
    return Path(os.environ.get("PRISM_DB_PATH") or "data/prism.db")


def _connect():
    if USE_POSTGRES:
        # TLS is required unless the URL says otherwise (a local server for tests).
        conn = psycopg2.connect(POSTGRES_URL, **({} if "sslmode=" in POSTGRES_URL else {"sslmode": "require"}))
        conn.autocommit = False
        conn.cursor_factory = psycopg2.extras.RealDictCursor
        return conn
    if on_vercel():
        raise DatabaseNotConfiguredError(
            "No DATABASE_URL or POSTGRES_URL is set for this deployment; add it in the Vercel project settings.")
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
        except DatabaseNotConfiguredError:
            raise
        except Exception as e:  # noqa: BLE001 (any driver error is retried)
            last_error = e
            if attempt < 2:
                wait = 0.5 * (2 ** attempt)
                logger.warning("Database connection attempt %d failed: %s; retrying in %.1fs",
                               attempt + 1, describe_error(e), wait)
                time.sleep(wait)
    if conn is None:
        raise DatabaseUnavailableError(
            f"Failed to connect to the database after 3 attempts: {describe_error(last_error)}") from last_error
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        if not isinstance(e, (StaleRevisionError, StaleVersionError)):  # conflicts are expected answers
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


# ── Schema ──────────────────────────────────────────────────────────────────

def one_of(values) -> str:
    """A SQL list of string literals, for a CHECK (column IN (...)) constraint."""
    return ", ".join("'" + str(v).replace("'", "''") + "'" for v in values)


def _schema() -> List[str]:
    """The current schema. Every score of a driver is required and checked
    against its scale and the taxonomy, so a stored driver can always be
    simulated; a proposal may leave any score empty, but a score it holds is
    on its scale."""
    serial = "SERIAL PRIMARY KEY" if USE_POSTGRES else "INTEGER PRIMARY KEY AUTOINCREMENT"
    return [
        f"""CREATE TABLE IF NOT EXISTS drivers (
            id TEXT PRIMARY KEY,
            force TEXT NOT NULL CHECK (force IN ({one_of(FORCES)})),
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            direction TEXT NOT NULL CHECK (direction IN ({one_of(DIRECTIONS)})),
            probability INTEGER NOT NULL CHECK (probability BETWEEN 1 AND 5),
            start_year INTEGER NOT NULL,
            peak_year INTEGER NOT NULL,
            diffusion_curve TEXT NOT NULL CHECK (diffusion_curve IN ({one_of(VALID_DIFFUSION_CURVES)})),
            gp1_pct_affected DOUBLE PRECISION NOT NULL CHECK (gp1_pct_affected > 0 AND gp1_pct_affected <= 1),
            uncertainty INTEGER NOT NULL CHECK (uncertainty BETWEEN 0 AND 5),
            vc_epicentre TEXT NOT NULL CHECK (vc_epicentre IN ({one_of(VC_STAGES)})),
            confidence TEXT NOT NULL CHECK (confidence IN ({one_of(CONFIDENCE_LEVELS)})),
            analysis TEXT NOT NULL,
            baseline TEXT NOT NULL,
            scores_edited BOOLEAN NOT NULL DEFAULT FALSE,
            revision INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        f"""CREATE TABLE IF NOT EXISTS driver_category_exposure (
            driver_id TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
            category TEXT NOT NULL CHECK (category IN ({one_of(CATEGORIES)})),
            exposure_score INTEGER NOT NULL CHECK (exposure_score BETWEEN 0 AND 5),
            PRIMARY KEY (driver_id, category)
        )""",
        f"""CREATE TABLE IF NOT EXISTS driver_regional_exposure (
            driver_id TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
            region TEXT NOT NULL CHECK (region IN ({one_of(REGIONS)})),
            exposure_score INTEGER NOT NULL CHECK (exposure_score BETWEEN 0 AND 5),
            PRIMARY KEY (driver_id, region)
        )""",
        f"""CREATE TABLE IF NOT EXISTS driver_sources (
            id {serial},
            driver_id TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            tier TEXT NOT NULL CHECK (tier IN ({one_of(("",) + SOURCE_TIERS)})),
            published TEXT NOT NULL
        )""",
        # One row per (driver, expert): any signed-in user can propose scores
        # for a driver; admins endorse by editing the driver itself.
        f"""CREATE TABLE IF NOT EXISTS driver_score_proposals (
            id {serial},
            driver_id TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL,
            user_name TEXT NOT NULL,
            probability INTEGER CHECK (probability BETWEEN 1 AND 5),
            gp1_pct_affected DOUBLE PRECISION CHECK (gp1_pct_affected > 0 AND gp1_pct_affected <= 1),
            peak_year INTEGER,
            diffusion_curve TEXT CHECK (diffusion_curve IN ({one_of(VALID_DIFFUSION_CURVES)})),
            uncertainty INTEGER CHECK (uncertainty BETWEEN 0 AND 5),
            category_exposure TEXT,
            regional_exposure TEXT,
            vc_epicentre TEXT CHECK (vc_epicentre IN ({one_of(VC_STAGES)})),
            comment TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (driver_id, user_id)
        )""",
        # Append-only versions of the Consumer Journey content; the newest row wins.
        # Migration 0001 keeps the next three tables as it finds them, so their
        # definitions here are the ones a migrated database has.
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


def schema_tables() -> set:
    """The tables the schema creates."""
    return {m.group(1) for statement in _schema()
            for m in [re.match(r"\s*CREATE TABLE IF NOT EXISTS (\w+)", statement)] if m}


def pending_migration(cursor) -> Optional[str]:
    """The first migration the connected database still needs, or None.

    A database lists the migrations it has had in schema_migrations. One that
    holds tables of this schema but no such list predates the migrations and
    needs all of them; one without any table of this schema is new, and
    init_db creates the schema and records every migration. (The dashboard's
    own table, user_roles, is not part of the schema.)
    """
    tables = table_names(cursor)
    if "schema_migrations" in tables:
        cursor.execute("SELECT version FROM schema_migrations")
        done = {_row(r)["version"] for r in cursor.fetchall()}
    elif tables & schema_tables():
        done = set()
    else:
        return None
    return next((m for m in SCHEMA_MIGRATIONS if m not in done), None)


def init_db() -> None:
    """Create any missing table; safe to call on every start, from any number
    of instances at once.

    Refuses a database that still needs a migration, because creating the
    new tables next to its own would hide the real data behind an empty
    driver base.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if USE_POSTGRES:
            # Two transactions creating the same table at once collide in the
            # catalogue; the lock makes the second wait and find it created.
            cursor.execute("SELECT pg_advisory_xact_lock(%s)", (SCHEMA_LOCK,))
        else:
            # Outside a transaction SQLite commits each CREATE TABLE on its
            # own, and a second instance could find some tables but no
            # migration list yet and take the file for an old database. In
            # one write transaction the schema appears at once, and the second
            # instance waits for it.
            cursor.execute("BEGIN IMMEDIATE")
        migration = pending_migration(cursor)
        if migration:
            raise MigrationPendingError(migration)
        for statement in _schema():
            cursor.execute(statement)
        for version in SCHEMA_MIGRATIONS:
            cursor.execute(f"INSERT INTO schema_migrations (version) VALUES ({placeholder()}) "
                           "ON CONFLICT (version) DO NOTHING", (version,))
    logger.info("Database initialised (%s)", "postgres" if USE_POSTGRES else "sqlite")


def failure_reason(e: BaseException) -> str:
    """migration_pending (the database needs a migration), no_database (no URL
    where one is required) or db_error (anything else)."""
    if isinstance(e, MigrationPendingError):
        return "migration_pending"
    if isinstance(e, DatabaseNotConfiguredError):
        return "no_database"
    return "db_error"


def describe_error(e: BaseException) -> str:
    """A database failure in words that name no host, user or password.

    A driver's message about a failed connection can quote the connection
    string (a malformed percent-escape echoes part of the password), so the
    log, the 503 answers and /api/v1/diagnostics give this category instead.
    """
    if isinstance(e, MigrationPendingError):
        return str(e)
    if isinstance(e, DatabaseNotConfiguredError):
        return "no database URL is set for this deployment"
    cause = e.__cause__ or e
    text = str(cause).lower()
    for needles, words in (
        (("password authentication failed", "authentication failed"), "the database refused the credentials"),
        (("could not translate host name", "name or service not known", "nodename nor servname"),
         "the database host name does not resolve"),
        (("timeout", "timed out"), "the database did not answer in time"),
        (("connection refused",), "the database refused the connection"),
        (("ssl", "certificate"), "the TLS connection to the database failed"),
        (("percent-encoded", "invalid dsn", "invalid connection option", "missing \"=\""),
         "the database URL is malformed"),
        (("does not exist",), "a database object does not exist"),
    ):
        if any(n in text for n in needles):
            return f"{words} ({type(cause).__name__})"
    return f"database error ({type(cause).__name__})"


def diagnose_connection() -> Dict[str, Any]:
    """What this process sees of the database, for /api/v1/diagnostics.

    Never raises: a failure is reported in ``error`` as describe_error()
    words, so the dashboard can tell "cannot reach the database" from
    "reachable but empty". The answer is anonymous, so it names nothing about
    the database itself: no host, no user, no credential.
    """
    out: Dict[str, Any] = {
        "db_reachable": False,
        "simulation_run_count": 0,
        "latest_run_id": None,
        "error": None,
        "reason": None,
    }
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            tables = table_names(cursor)
            out["db_reachable"] = True
            migration = pending_migration(cursor)
            if migration:
                pending = MigrationPendingError(migration)
                out["error"], out["reason"] = describe_error(pending), failure_reason(pending)
                return out
            if "simulation_runs" not in tables:   # a new database the API has not initialised yet
                return out
            cursor.execute("SELECT COUNT(*) AS n FROM simulation_runs")
            out["simulation_run_count"] = int(_row(cursor.fetchone())["n"] or 0)
        latest = latest_run_summary()
        if latest:
            out["latest_run_id"] = latest["id"]
    except Exception as e:  # noqa: BLE001 (reported, never raised)
        out["error"], out["reason"] = describe_error(e), failure_reason(e)
        logger.warning("diagnose_connection: database probe failed: %s", e)
    return out


# ── Audit log ───────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class AuditEntry:
    """One row of the audit log: what changed, and who changed it (the
    verified identity of the caller). The writes that are audited take their
    entries with them and store them in their own transaction."""
    action: str
    entity_type: str
    entity_id: str
    user_id: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    reason: Optional[str] = None


def insert_audit(cursor, entries: Sequence[AuditEntry]) -> None:
    """Write audit entries with the caller's cursor, so they commit or roll
    back with the change they record."""
    for e in entries:
        cursor.execute(
            f"INSERT INTO audit_log (action, entity_type, entity_id, old_value, new_value, reason, user_id) "
            f"VALUES ({ph(7)})",
            (e.action, e.entity_type, e.entity_id, e.old_value, e.new_value, e.reason, e.user_id))


# ── Drivers ─────────────────────────────────────────────────────────────────

_DRIVER_COLUMNS = (
    "id", "force", "name", "description", "direction", "probability", "start_year",
    "peak_year", "diffusion_curve", "gp1_pct_affected", "uncertainty", "vc_epicentre", "confidence",
    "analysis", "baseline", "scores_edited",
)


def _driver_values(d: Driver) -> tuple:
    """The values of _DRIVER_COLUMNS for one driver, in that order."""
    return (d.id, d.force, d.name, d.description, d.direction, d.probability, d.start_year,
            d.peak_year, d.diffusion_curve, d.gp1_pct_affected, d.uncertainty, d.vc_epicentre, d.confidence,
            d.analysis, dumps(d.baseline), d.scores_edited)


def _require_simulatable(drivers: Sequence[Driver]) -> None:
    """Refuse to store drivers the engine could not simulate.

    The constraints of the schema hold every score of a driver row on its
    scale; that the exposure maps name every category and every region is
    checked here, before anything is written, so every stored driver can be
    simulated as it stands.
    """
    problems = simulation_problems(list(drivers))
    if problems:
        raise InvalidDriversError(problems)


def _write_category_exposure(cursor, d: Driver) -> None:
    cursor.execute(f"DELETE FROM driver_category_exposure WHERE driver_id = {placeholder()}", (d.id,))
    for category, score in d.category_exposure.items():
        cursor.execute(f"INSERT INTO driver_category_exposure (driver_id, category, exposure_score) VALUES ({ph(3)})",
                       (d.id, category, score))


def _write_regional_exposure(cursor, d: Driver) -> None:
    cursor.execute(f"DELETE FROM driver_regional_exposure WHERE driver_id = {placeholder()}", (d.id,))
    for region, score in d.regional_exposure.items():
        cursor.execute(f"INSERT INTO driver_regional_exposure (driver_id, region, exposure_score) VALUES ({ph(3)})",
                       (d.id, region, score))


def _write_sources(cursor, d: Driver) -> None:
    cursor.execute(f"DELETE FROM driver_sources WHERE driver_id = {placeholder()}", (d.id,))
    for src in d.sources:
        cursor.execute(f"INSERT INTO driver_sources (driver_id, title, url, tier, published) VALUES ({ph(5)})",
                       (d.id, src["title"], src["url"], src["tier"], src["published"]))


#: The driver fields kept in tables of their own, and the function that rewrites each.
_CHILD_WRITERS = {
    "category_exposure": _write_category_exposure,
    "regional_exposure": _write_regional_exposure,
    "sources": _write_sources,
}


def insert_drivers(drivers: List[Driver]) -> None:
    """Store the drivers of a new database, each with its exposures and sources.

    Raises InvalidDriversError, and writes nothing, if a driver could not be
    simulated.
    """
    _require_simulatable(drivers)
    cols = ", ".join(_DRIVER_COLUMNS)
    with get_db_connection() as conn:
        cursor = conn.cursor()
        for d in drivers:
            cursor.execute(f"INSERT INTO drivers ({cols}) VALUES ({ph(len(_DRIVER_COLUMNS))})", _driver_values(d))
            for write in _CHILD_WRITERS.values():
                write(cursor, d)
    logger.info("Seeded %d drivers", len(drivers))


#: The fields an admin edit can change (prism/api/schemas.py DriverUpdate).
EDITABLE_FIELDS = frozenset({
    "description", "direction", "probability", "gp1_pct_affected", "peak_year", "diffusion_curve",
    "uncertainty", "confidence", "vc_epicentre", *_CHILD_WRITERS,
})


def save_driver_edit(driver: Driver, expected_revision: int, changed: Collection[str],
                     audit: Sequence[AuditEntry] = ()) -> int:
    """Write an admin edit of one stored driver and its audit entries; returns its new revision.

    Only the ``changed`` fields are written (and whether the driver's scores
    have been edited), so a column the edit did not touch keeps what the
    database holds. The row is written only if it is still at
    ``expected_revision`` (the revision the editor loaded), in the same
    statement that raises it, so of two edits made from the same state only
    the first lands. The second raises StaleRevisionError and changes
    nothing. The audit entries are written in the same transaction: an edit
    is never stored without them. An edit that leaves a driver the engine
    could not simulate raises InvalidDriversError and changes nothing.
    """
    if not set(changed) <= EDITABLE_FIELDS:
        raise ValueError(f"not editable: {sorted(set(changed) - EDITABLE_FIELDS)}")
    _require_simulatable([driver])
    p = placeholder()
    columns = [c for c in _DRIVER_COLUMNS if c in changed] + ["scores_edited"]
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            f"UPDATE drivers SET {', '.join(f'{c} = {p}' for c in columns)}, revision = revision + 1, "
            f"updated_at = CURRENT_TIMESTAMP WHERE id = {p} AND revision = {p}",
            tuple(getattr(driver, c) for c in columns) + (driver.id, int(expected_revision)))
        if cursor.rowcount != 1:
            cursor.execute(f"SELECT revision FROM drivers WHERE id = {p}", (driver.id,))
            row = cursor.fetchone()
            raise StaleRevisionError(driver.id, int(expected_revision), int(_row(row)["revision"]) if row else None)
        for field, write in _CHILD_WRITERS.items():
            if field in changed:
                write(cursor, driver)
        insert_audit(cursor, audit)
    return int(expected_revision) + 1


def _begin_snapshot(cursor) -> None:
    """Make the reads that follow in this transaction one consistent snapshot.

    PostgreSQL reads each statement's own snapshot at READ COMMITTED, so the
    transaction asks for REPEATABLE READ; SQLite reads in autocommit mode
    unless a transaction is open, so one is opened.
    """
    cursor.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY" if USE_POSTGRES else "BEGIN")


def load_drivers() -> List[Driver]:
    """All drivers with their exposures and sources, ordered by id.

    The order is part of the reproducibility contract: the copula pairs draws
    with drivers by position, so the same inputs and seed give the same result
    only if the drivers always arrive in the same order. The four reads see
    one snapshot of the database, so an edit saved meanwhile is read whole or
    not at all.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        _begin_snapshot(cursor)
        cursor.execute("SELECT * FROM drivers ORDER BY id")
        rows = [_row(r) for r in cursor.fetchall()]
        exposures: Dict[str, Dict[str, dict]] = {r["id"]: {"category": {}, "region": {}} for r in rows}
        for table, key, column in (("driver_category_exposure", "category", "category"),
                                   ("driver_regional_exposure", "region", "region")):
            cursor.execute(f"SELECT driver_id, {column} AS k, exposure_score FROM {table}")
            for r in cursor.fetchall():
                r = _row(r)
                exposures[r["driver_id"]][key][r["k"]] = int(r["exposure_score"])
        sources: Dict[str, list] = {r["id"]: [] for r in rows}
        cursor.execute("SELECT driver_id, title, url, tier, published FROM driver_sources ORDER BY id")
        for r in cursor.fetchall():
            r = _row(r)
            sources[r["driver_id"]].append({"title": r["title"], "url": r["url"], "tier": r["tier"],
                                            "published": r["published"]})

    drivers = []
    for r in rows:
        e = exposures[r["id"]]
        drivers.append(Driver(
            id=r["id"],
            force=r["force"],
            name=r["name"],
            description=r["description"],
            direction=r["direction"],
            probability=int(r["probability"]),
            start_year=int(r["start_year"]),
            analysis=r["analysis"],
            category_exposure=e["category"],
            regional_exposure=e["region"],
            vc_epicentre=r["vc_epicentre"],
            sources=sources[r["id"]],
            confidence=r["confidence"],
            gp1_pct_affected=float(r["gp1_pct_affected"]),
            peak_year=int(r["peak_year"]),
            diffusion_curve=r["diffusion_curve"],
            uncertainty=int(r["uncertainty"]),
            baseline=_loads(r["baseline"]),
            scores_edited=bool(r["scores_edited"]),
            revision=int(r["revision"]),
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
    logger.debug("Saved simulation run %s (%d iterations)", run_id, iterations)
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
# Each save appends a row; the newest row is the content and its id is the
# content's version. A save names the version it was edited from, so two
# admins editing at once cannot silently overwrite each other.

def load_journey_content() -> Dict[str, Any]:
    """{"version": id of the newest row, "content": its tile map}; version 0 and
    content None while nothing is stored (the dashboard's bundled content applies)."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, content FROM journey_content ORDER BY id DESC LIMIT 1")
        row = cursor.fetchone()
    if row is None:
        return {"version": 0, "content": None}
    r = _row(row)
    return {"version": int(r["id"]), "content": _loads(r["content"])}


def save_journey_content(content: dict, updated_by: str, base_version: int,
                         audit: Optional[Callable[[int], AuditEntry]] = None) -> int:
    """Store a new version of the journey content ({lhc, hair}); returns its version.

    ``base_version`` is the version the editor loaded (0 for the bundled
    content). If another save has happened since, StaleVersionError is raised
    and nothing is written. The check and the insert run under a lock that
    serialises saves (PostgreSQL) or under SQLite's write lock. ``audit``
    builds the save's audit entry from the new version; it is written in the
    same transaction.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if USE_POSTGRES:
            cursor.execute("LOCK TABLE journey_content IN SHARE ROW EXCLUSIVE MODE")
        elif not conn.in_transaction:
            cursor.execute("BEGIN IMMEDIATE")
        cursor.execute("SELECT COALESCE(MAX(id), 0) AS v FROM journey_content")
        current = int(_row(cursor.fetchone())["v"] or 0)
        if current != int(base_version):
            raise StaleVersionError(int(base_version), current)
        sql = f"INSERT INTO journey_content (content, updated_by) VALUES ({ph(2)})"
        if USE_POSTGRES:
            cursor.execute(sql + " RETURNING id", (dumps(content), updated_by or ""))
            version = int(_row(cursor.fetchone())["id"])
        else:
            cursor.execute(sql, (dumps(content), updated_by or ""))
            version = int(cursor.lastrowid)
        if audit is not None:
            insert_audit(cursor, [audit(version)])
    logger.info("Saved journey content version %d (by %s)", version, updated_by or "unknown")
    return version


# ── Expert score proposals ──────────────────────────────────────────────────
# A proposal is partial: any subset of the scoreable fields may be set, and a
# NULL field means "this expert did not score that".

_PROPOSAL_SCALAR_FIELDS = ("probability", "gp1_pct_affected", "peak_year", "diffusion_curve", "uncertainty",
                           "vc_epicentre")
_PROPOSAL_MAP_FIELDS = ("category_exposure", "regional_exposure")
_PROPOSAL_TEXT_FIELDS = ("comment",)
_PROPOSAL_COLUMNS = ("user_id, user_name, probability, gp1_pct_affected, peak_year, "
                     "diffusion_curve, uncertainty, vc_epicentre, category_exposure, regional_exposure, "
                     "comment, updated_at")


def _proposal(raw) -> dict:
    """One proposal row (the _PROPOSAL_COLUMNS) as a dict, the maps decoded."""
    r = _row(raw)
    return {
        "user_id": r["user_id"],
        "user_name": r["user_name"],
        **{k: r[k] for k in _PROPOSAL_SCALAR_FIELDS},
        **{k: _loads(r[k]) for k in _PROPOSAL_MAP_FIELDS},
        "comment": r["comment"],
        "updated_at": r["updated_at"],
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
                           user_name: str = "") -> Dict[str, Any]:
    """Merge a partial proposal into this expert's row and return the merged row.

    Only the keys present in ``fields`` change; everything else on an existing
    row is left as it was. One statement inserts the row or updates it, so
    two saves by the same expert at the same moment neither collide on the
    key nor lose each other's fields.
    """
    names = [k for k in _PROPOSAL_SCALAR_FIELDS + _PROPOSAL_MAP_FIELDS + _PROPOSAL_TEXT_FIELDS if k in fields]
    values = [dumps(fields[k]) if k in _PROPOSAL_MAP_FIELDS and fields[k] is not None else fields[k]
              for k in names]
    columns = ["driver_id", "user_id", "user_name", *names]
    updates = ", ".join([f"{c} = excluded.{c}" for c in ("user_name", *names)] + ["updated_at = CURRENT_TIMESTAMP"])
    p = placeholder()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f"INSERT INTO driver_score_proposals ({', '.join(columns)}) VALUES ({ph(len(columns))}) "
                       f"ON CONFLICT (driver_id, user_id) DO UPDATE SET {updates}",
                       (driver_id, user_id, user_name or "", *values))
        cursor.execute(f"SELECT {_PROPOSAL_COLUMNS} FROM driver_score_proposals "
                       f"WHERE driver_id = {p} AND user_id = {p}", (driver_id, user_id))
        return _proposal(cursor.fetchone())
