"""Write the generated PRISM Analysis texts into a database.

Each driver's analysis is generated (scripts/build_driver_analysis.py, then
scripts/generate_seed.py) and read-only on the Drivers page. A new database
is seeded with the current texts; an existing database is brought up to date
with this script whenever the texts have been regenerated.

    python3 scripts/sync_analysis.py --dry-run    list the drivers whose text would change
    python3 scripts/sync_analysis.py              write them, in one transaction, with an audit entry each

The target is the database in POSTGRES_URL or DATABASE_URL (.env is loaded),
otherwise the local SQLite file. It changes the analysis column and raises
the revision of each driver it changes, so an admin editing one of them at
that moment is asked to reload before saving. Drivers the seed does not
contain are left alone and listed.

Exit codes: 0 done (or nothing to do); 1 the database still needs a migration
(the message names it) or has no drivers table yet.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import prism.env_loader  # noqa: E402,F401  (loads .env before prism.database reads the URL)
from prism.database import (POSTGRES_URL, USE_POSTGRES, AuditEntry, get_db_connection,  # noqa: E402
                            insert_audit, pending_migration, placeholder, sqlite_path, table_names)
from prism.seed_drivers import DRIVERS  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="report what would change, write nothing")
    args = parser.parse_args(argv)

    target = f"PostgreSQL at {urlparse(POSTGRES_URL).hostname}" if USE_POSTGRES else f"SQLite at {sqlite_path()}"
    seed = {d.id: d.analysis for d in DRIVERS}
    p = placeholder()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        migration = pending_migration(cursor)
        if migration:
            print(f"{target}: needs migration {migration} first: run migrations/{migration}/migrate.py.")
            return 1
        if "drivers" not in table_names(cursor):
            print(f"{target}: no drivers table yet, nothing to sync (the API creates and seeds it on first use).")
            return 1
        cursor.execute("SELECT id, analysis FROM drivers ORDER BY id")
        current = {r["id"]: r["analysis"] for r in cursor.fetchall()}
        stale = sorted(i for i in current if i in seed and current[i] != seed[i])
        unknown = sorted(i for i in current if i not in seed)
        missing = sorted(i for i in seed if i not in current)

        print(f"{target}: {len(current)} drivers, {len(stale)} with an outdated analysis")
        for driver_id in stale:
            print(f"  {driver_id}")
        if unknown:
            print(f"Not in the seed, left alone: {', '.join(unknown)}")
        if missing:
            print(f"In the seed but not in this database (not added): {', '.join(missing)}")
        if args.dry_run or not stale:
            if args.dry_run:
                conn.rollback()
            return 0

        for driver_id in stale:
            cursor.execute(f"UPDATE drivers SET analysis = {p}, revision = revision + 1, "
                           f"updated_at = CURRENT_TIMESTAMP WHERE id = {p}",
                           (seed[driver_id], driver_id))
        insert_audit(cursor, [AuditEntry("analysis_synced", "driver", driver_id, "sync-analysis-cli",
                                         reason="PRISM Analysis replaced by the generated text")
                              for driver_id in stale])
    print(f"Updated {len(stale)} driver(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
