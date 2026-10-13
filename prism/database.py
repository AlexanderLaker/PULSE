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
from collections.abc import Callable, Collection, Sequence
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from prism.config import CATEGORIES, FORCES, REGIONS, VALID_DIFFUSION_CURVES, VC_STAGES
from prism.drivers import (CONFIDENCE_LEVELS, DIRECTIONS, EXPOSURE_FIELDS, MODEL_FIELDS, SCALAR_SCORE_FIELDS,
                           SOURCE_TIERS, Driver, InvalidDriversError, simulation_problems)

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
#: How long one attempt to connect to PostgreSQL waits for each address of the
#: server, in seconds, unless the URL sets its own connect_timeout. Without it
#: a host that drops packets would hold each attempt for the operating
#: system's TCP timeout, minutes, while requests queue behind the API's lock.
CONNECT_TIMEOUT_SECONDS = 5
#: get_db_connection starts no further attempt that could end after this many
#: seconds of trying, so that a request hears its 503 well before the
#: dashboard gives up on it (lib/apiClient.ts waits 20 seconds).
CONNECT_BUDGET_SECONDS = 12


class MigrationPendingError(RuntimeError):
    """The database needs a migration from migrations/ before this code may use it."""

    def __init__(self, migration: str):
        self.migration = migration
        super().__init__(f"This database needs migration {migration} before this release can use it: run "
                         f"migrations/{migration}/migrate.py (its README is the runbook).")


class DriversMissingError(RuntimeError):
    """The drivers table is empty in a database that once held drivers (holds_history).

    A new database is seeded with the driver base; one that stores runs or
    driver edits but no drivers has lost them, and lost drivers are restored
    from the backup, never replaced by the base.
    """

    def __init__(self):
        super().__init__("This database stores runs or driver edits but no drivers, so its drivers were lost: "
                         "restore it from its backup (docs/OPERATIONS.md, Backups and restore). PRISM seeds "
                         "only a new database with the driver base.")


class DatabaseNotConfiguredError(RuntimeError):
    """No database URL is set where one is required (a Vercel deployment)."""


class DatabaseUnavailableError(ConnectionError):
    """The database could not be reached, even after the retries."""


class StaleRevisionError(RuntimeError):
    """A driver changed after the editor loaded it; the edit was not written."""

    def __init__(self, driver_id: str, expected: int, current: int | None):
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
    """Path of the SQLite file: PRISM_DB_PATH, or data/prism.db in the
    repository when that is unset or empty, wherever the process started."""
    return Path(os.environ.get("PRISM_DB_PATH") or Path(__file__).resolve().parents[1] / "data" / "prism.db")


def postgres_connect_options(url: str) -> dict:
    """What every PostgreSQL connection adds to its URL: TLS is required (a
    local server for tests says sslmode=disable) and an attempt gives up after
    CONNECT_TIMEOUT_SECONDS, unless the URL sets either itself. The API, the
    scripts and the migration connect with these."""
    from psycopg2.extensions import parse_dsn
    try:
        given = parse_dsn(url).keys()
    except Exception:  # noqa: BLE001 (a malformed URL: psycopg2.connect reports it)
        given = set()
    options: dict = {}
    if "sslmode" not in given:
        options["sslmode"] = "require"
    if "connect_timeout" not in given:
        options["connect_timeout"] = CONNECT_TIMEOUT_SECONDS
    return options


def _connect():
    if USE_POSTGRES:
        conn = psycopg2.connect(POSTGRES_URL, **postgres_connect_options(POSTGRES_URL))
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

    Connecting is tried up to three times with backoff, because a serverless
    PostgreSQL endpoint can take a moment to wake up; no attempt starts that
    could end after CONNECT_BUDGET_SECONDS.
    """
    conn, last_error, attempts = None, None, 0
    started = time.monotonic()
    for attempt in range(3):
        attempts += 1
        try:
            conn = _connect()
            break
        except DatabaseNotConfiguredError:
            raise
        except Exception as e:  # noqa: BLE001 (any driver error is retried)
            last_error = e
            wait = 0.5 * (2 ** attempt)
            if attempt == 2 or time.monotonic() - started + wait + CONNECT_TIMEOUT_SECONDS > CONNECT_BUDGET_SECONDS:
                break
            logger.warning("Database connection attempt %d failed: %s; retrying in %.1fs",
                           attempt + 1, describe_error(e), wait)
            time.sleep(wait)
    if conn is None:
        raise DatabaseUnavailableError(
            f"Failed to connect to the database after {attempts} attempt{'s' if attempts > 1 else ''}: "
            f"{describe_error(last_error)}") from last_error
    try:
        yield conn
        conn.commit()
    except Exception as e:
        try:
            conn.rollback()
        except Exception:  # noqa: BLE001 (a connection already lost cannot roll back; the first error counts)
            logger.debug("Rollback failed after: %s", describe_error(e))
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

def sql_list(values) -> str:
    """A SQL list of string literals, for a CHECK (column IN (...)) constraint."""
    return ", ".join("'" + str(v).replace("'", "''") + "'" for v in values)


def schema(postgres: bool) -> list[str]:
    """The current schema, for PostgreSQL or SQLite; migration 0001 builds it
    too. Every field of a driver is required, each score and share is checked
    against its scale and each name against the taxonomy; the years and the
    completeness of the exposure maps are checked when a driver is written
    (_require_simulatable). A proposal may leave any score empty, but a score
    it holds is on its scale."""
    serial = "SERIAL PRIMARY KEY" if postgres else "INTEGER PRIMARY KEY AUTOINCREMENT"
    return [
        f"""CREATE TABLE IF NOT EXISTS drivers (
            id TEXT PRIMARY KEY,
            force TEXT NOT NULL CHECK (force IN ({sql_list(FORCES)})),
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            direction TEXT NOT NULL CHECK (direction IN ({sql_list(DIRECTIONS)})),
            probability INTEGER NOT NULL CHECK (probability BETWEEN 1 AND 5),
            start_year INTEGER NOT NULL,
            peak_year INTEGER NOT NULL,
            diffusion_curve TEXT NOT NULL CHECK (diffusion_curve IN ({sql_list(VALID_DIFFUSION_CURVES)})),
            gp1_pct_affected DOUBLE PRECISION NOT NULL CHECK (gp1_pct_affected > 0 AND gp1_pct_affected <= 1),
            uncertainty INTEGER NOT NULL CHECK (uncertainty BETWEEN 0 AND 5),
            vc_epicentre TEXT NOT NULL CHECK (vc_epicentre IN ({sql_list(VC_STAGES)})),
            confidence TEXT NOT NULL CHECK (confidence IN ({sql_list(CONFIDENCE_LEVELS)})),
            baseline TEXT NOT NULL,
            scores_edited BOOLEAN NOT NULL DEFAULT FALSE,
            revision INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        f"""CREATE TABLE IF NOT EXISTS driver_category_exposure (
            driver_id TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
            category TEXT NOT NULL CHECK (category IN ({sql_list(CATEGORIES)})),
            exposure_score INTEGER NOT NULL CHECK (exposure_score BETWEEN 0 AND 5),
            PRIMARY KEY (driver_id, category)
        )""",
        f"""CREATE TABLE IF NOT EXISTS driver_regional_exposure (
            driver_id TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
            region TEXT NOT NULL CHECK (region IN ({sql_list(REGIONS)})),
            exposure_score INTEGER NOT NULL CHECK (exposure_score BETWEEN 0 AND 5),
            PRIMARY KEY (driver_id, region)
        )""",
        f"""CREATE TABLE IF NOT EXISTS driver_sources (
            id {serial},
            driver_id TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            tier TEXT NOT NULL CHECK (tier IN ({sql_list(("",) + SOURCE_TIERS)})),
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
            diffusion_curve TEXT CHECK (diffusion_curve IN ({sql_list(VALID_DIFFUSION_CURVES)})),
            uncertainty INTEGER CHECK (uncertainty BETWEEN 0 AND 5),
            category_exposure TEXT,
            regional_exposure TEXT,
            vc_epicentre TEXT CHECK (vc_epicentre IN ({sql_list(VC_STAGES)})),
            comment TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (driver_id, user_id)
        )""",
        # Append-only versions of the Consumer Journey content; the newest row
        # wins. Every version names who saved it.
        f"""CREATE TABLE IF NOT EXISTS journey_content (
            id {serial},
            content TEXT NOT NULL,
            updated_by TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        # One results bundle per production run (prism/api/runs.py reads it).
        f"""CREATE TABLE IF NOT EXISTS simulation_runs (
            id {serial},
            run_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            iterations INTEGER NOT NULL,
            results TEXT NOT NULL
        )""",
        # Every entry names what it acted on and who acted; a creation has no
        # old value and a deletion no new one.
        f"""CREATE TABLE IF NOT EXISTS audit_log (
            id {serial},
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            reason TEXT,
            user_id TEXT NOT NULL
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
    return {m.group(1) for statement in schema(USE_POSTGRES)
            for m in [re.match(r"\s*CREATE TABLE IF NOT EXISTS (\w+)", statement)] if m}


def pending_migration(cursor) -> str | None:
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
        for statement in schema(USE_POSTGRES):
            cursor.execute(statement)
        for version in SCHEMA_MIGRATIONS:
            cursor.execute(f"INSERT INTO schema_migrations (version) VALUES ({placeholder()}) "
                           "ON CONFLICT (version) DO NOTHING", (version,))
    logger.info("Database initialised (%s)", "postgres" if USE_POSTGRES else "sqlite")


def failure_reason(e: BaseException) -> str:
    """migration_pending (the database needs a migration), no_database (no URL
    where one is required), drivers_missing (a database in use lost its
    drivers) or db_error (anything else)."""
    if isinstance(e, MigrationPendingError):
        return "migration_pending"
    if isinstance(e, DatabaseNotConfiguredError):
        return "no_database"
    if isinstance(e, DriversMissingError):
        return "drivers_missing"
    return "db_error"


def is_missing_table(e: BaseException) -> bool:
    """Whether a database error says that a table does not exist: PostgreSQL's
    undefined_table (SQLSTATE 42P01) or SQLite's "no such table"."""
    return getattr(e, "pgcode", None) == "42P01" or "no such table" in str(e).lower()


def describe_error(e: BaseException) -> str:
    """A database failure in words that name no host, user or password.

    A driver's message about a failed connection can quote the connection
    string (a malformed percent-escape echoes part of the password), so the
    log, the 503 answers and /api/v1/diagnostics give this category instead.
    """
    if isinstance(e, (MigrationPendingError, DriversMissingError)):
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


def diagnose_connection() -> dict[str, Any]:
    """What this process sees of the database, for /api/v1/diagnostics.

    Never raises: a failure is reported in ``error`` as describe_error()
    words, so the dashboard can tell "cannot reach the database" from
    "reachable but empty" and from a database that lost its drivers
    (``reason`` drivers_missing, as in /api/v1/health). The answer is
    anonymous, so it names nothing about the database itself: no host, no
    user, no credential.
    """
    out: dict[str, Any] = {
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
        if ("drivers" not in tables or drivers_stamp()[0] == 0) and holds_history():
            # A database that lost its drivers, emptied or dropped: the run may
            # still be there, but neither it nor the drivers are served until
            # the database is restored.
            missing = DriversMissingError()
            out["error"], out["reason"] = describe_error(missing), failure_reason(missing)
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
    old_value: str | None = None
    new_value: str | None = None
    reason: str | None = None


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
    "baseline", "scores_edited",
)


def _driver_values(d: Driver) -> tuple:
    """The values of _DRIVER_COLUMNS for one driver, in that order."""
    return (d.id, d.force, d.name, d.description, d.direction, d.probability, d.start_year,
            d.peak_year, d.diffusion_curve, d.gp1_pct_affected, d.uncertainty, d.vc_epicentre, d.confidence,
            dumps(d.baseline), d.scores_edited)


def _require_simulatable(drivers: Sequence[Driver]) -> None:
    """Refuse to store drivers the engine could not simulate.

    The constraints of the schema hold each score of a driver row on its
    scale and each name in its taxonomy. The engine's own check runs here as
    well, before anything is written, and adds what the constraints do not
    hold: the onset and peak years (the peak after the onset depends on the
    model's base year, which the schema does not know) and a score for every
    category and every region. So every stored driver can be simulated as it
    stands.
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


def insert_drivers(drivers: list[Driver]) -> None:
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


#: The fields an admin edit can change (prism/api/schemas.py DriverUpdate):
#: the model's fields, the texts and the sources.
EDITABLE_FIELDS = frozenset({*MODEL_FIELDS, "description", "confidence", *_CHILD_WRITERS})


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


def load_drivers() -> list[Driver]:
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
        exposures: dict[str, dict[str, dict]] = {r["id"]: {"category": {}, "region": {}} for r in rows}
        for table, key, column in (("driver_category_exposure", "category", "category"),
                                   ("driver_regional_exposure", "region", "region")):
            cursor.execute(f"SELECT driver_id, {column} AS k, exposure_score FROM {table}")
            for r in cursor.fetchall():
                r = _row(r)
                exposures[r["driver_id"]][key][r["k"]] = int(r["exposure_score"])
        sources: dict[str, list] = {r["id"]: [] for r in rows}
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


def holds_history() -> bool:
    """Whether the database once held drivers: it stores a run or an audited driver edit.

    Both need drivers (the production run refuses a PostgreSQL database
    without them and seeds a SQLite file first). A new database has neither,
    so the API seeds its empty drivers table; one that has either and no
    drivers lost them (state.driver_set raises DriversMissingError). Other
    audit entries, such as a role change, say nothing about the drivers.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        for sql in ("SELECT 1 FROM simulation_runs LIMIT 1",
                    "SELECT 1 FROM audit_log WHERE entity_type = 'driver' LIMIT 1"):
            cursor.execute(sql)
            if cursor.fetchone() is not None:
                return True
    return False


def drivers_table_lost() -> bool:
    """Whether the drivers table itself is gone from a database that holds history.

    A process that set the schema up earlier does not create it again, so it
    reads a dropped drivers table as lost drivers here (state.driver_set), as
    a new process does once init_db has created the table empty.
    """
    with get_db_connection() as conn:
        tables = table_names(conn.cursor())
    return "drivers" not in tables and "simulation_runs" in tables and holds_history()


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


def load_latest_run() -> dict[str, Any] | None:
    """The newest persisted run with its decoded results, or None. Stored text
    that is not JSON stays text, which prism/api/runs.py reports as a run that
    lacks everything."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, run_date, iterations, results FROM simulation_runs "
                       "ORDER BY run_date DESC, id DESC LIMIT 1")
        raw = cursor.fetchone()
    if raw is None:
        return None
    r = _row(raw)
    try:
        results = _loads(r["results"])
    except ValueError:   # not JSON
        results = r["results"]
    return {"id": r["id"], "run_date": _as_datetime(r["run_date"]), "iterations": r["iterations"],
            "results": results}


def latest_run_summary() -> dict[str, Any] | None:
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

def load_journey_content() -> dict[str, Any]:
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
                         audit: Callable[[int], AuditEntry] | None = None) -> int:
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

_PROPOSAL_SCALAR_FIELDS = SCALAR_SCORE_FIELDS
_PROPOSAL_MAP_FIELDS = EXPOSURE_FIELDS
_PROPOSAL_TEXT_FIELDS = ("comment",)
_PROPOSAL_COLUMNS = ", ".join(("user_id", "user_name", *_PROPOSAL_SCALAR_FIELDS, *_PROPOSAL_MAP_FIELDS,
                               *_PROPOSAL_TEXT_FIELDS, "updated_at"))


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


def load_driver_proposals(driver_id: str) -> list[dict[str, Any]]:
    """Every expert proposal for one driver, oldest first."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f"SELECT {_PROPOSAL_COLUMNS} FROM driver_score_proposals "
                       f"WHERE driver_id = {placeholder()} ORDER BY updated_at ASC, user_id ASC", (driver_id,))
        return [_proposal(r) for r in cursor.fetchall()]


def load_all_driver_proposals() -> dict[str, list[dict[str, Any]]]:
    """Every proposal grouped by driver id, in one query."""
    out: dict[str, list[dict[str, Any]]] = {}
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f"SELECT driver_id, {_PROPOSAL_COLUMNS} FROM driver_score_proposals "
                       "ORDER BY updated_at ASC, user_id ASC")
        for raw in cursor.fetchall():
            r = _row(raw)
            out.setdefault(r["driver_id"], []).append(_proposal(r))
    return out


def upsert_driver_proposal(driver_id: str, user_id: str, fields: dict[str, Any],
                           user_name: str = "") -> dict[str, Any]:
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
