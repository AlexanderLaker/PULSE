"""What one API process keeps in memory: the drivers and the latest run.

Both are loaded on first use and refreshed when the database changes: the
driver set when database.drivers_stamp() moves (it changes with every saved
driver row), the run when the newest run's id is no longer the one held (a
newer run, or the held one removed). A production run, a migration or an
edit made through another server instance therefore reaches every instance
on its next request that reads them, without a restart.

The model configuration is the code's default ModelConfig: production runs
use exactly that (plus the cell weights they record), so it is what the
dashboard shows and what the category drill-down computes with.
"""
import logging
import threading

from prism import database
from prism.config import ModelConfig
from prism.drivers import DriverSet
from prism.seed_drivers import get_seed_drivers

logger = logging.getLogger(__name__)

_lock = threading.RLock()
_config = ModelConfig()
_cache: dict = {"db_ready": False, "drivers": None, "drivers_stamp": None, "run": None}


def model_config() -> ModelConfig:
    return _config


def ensure_schema() -> None:
    """Create the tables on a new database (once per process)."""
    if not _cache["db_ready"]:
        database.init_db()
        _cache["db_ready"] = True


def driver_set() -> DriverSet:
    """The current drivers, reloaded if the database has changed.

    A new database starts with the driver base: its empty drivers table is
    seeded from prism.seed_drivers. Two instances starting on a new database at
    the same moment may both try: the second insert fails as a whole (one
    transaction), and the drivers the first stored are used. A database that
    once held drivers (database.holds_history) and has none, its drivers
    table emptied or dropped, lost them; it is restored from its backup, never
    reseeded, so this raises DriversMissingError (503) until then.
    """
    with _lock:
        ensure_schema()
        try:
            stamp = database.drivers_stamp()
        except Exception as e:
            if database.drivers_table_lost():
                raise database.DriversMissingError() from e
            raise
        if stamp[0] == 0:
            if database.holds_history():
                raise database.DriversMissingError()
            logger.warning("The drivers table of this new database is empty; seeding it with the driver base")
            try:
                database.insert_drivers(get_seed_drivers())
            except Exception:
                if database.drivers_stamp()[0] == 0:
                    raise
                logger.info("Another instance seeded the drivers first")
            stamp = database.drivers_stamp()
        if _cache["drivers"] is None or _cache["drivers_stamp"] != stamp:
            _cache["drivers"] = DriverSet(drivers=database.load_drivers())
            _cache["drivers_stamp"] = stamp
        return _cache["drivers"]


def latest_run() -> dict | None:
    """The newest persisted run ({id, run_date, iterations, results}), or None."""
    with _lock:
        ensure_schema()
        summary = database.latest_run_summary()
        if summary is None:
            _cache["run"] = None
        elif _cache["run"] is None or _cache["run"]["id"] != summary["id"]:
            _cache["run"] = database.load_latest_run()
        return _cache["run"]


def reset_drivers() -> None:
    """Drop the cached drivers so the next request reloads them."""
    with _lock:
        _cache.update(drivers=None, drivers_stamp=None)


def reset() -> None:
    """Forget everything cached, including that the schema exists (for tests)."""
    with _lock:
        _cache.update(db_ready=False, drivers=None, drivers_stamp=None, run=None)
