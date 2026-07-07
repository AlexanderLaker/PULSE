"""Legacy schema cleanup migration (owner rulings O3 + O4, 2026-07-07).

Removes the last dead schema objects the deleted features left behind.
The code stopped creating/reading/writing all of them on 2026-07-07:

  O3 — trend_journey_exposure   table   (quantitative journey layer, deleted)
  O4 — users                    table   (pre-Clerk auth; roles live in the
                                         Next-managed user_roles table — the
                                         engine has no user store)
  O4 — scanned_trends           table   (scanner deleted with the AI layer, R2)
  O4 — simulation_runs.allocation_recommendation  column  (optimizer, D4 —
                                         legacy-NULL on every row)

Usage:
    python scripts/migrate_drop_legacy.py             # local SQLite only
    python scripts/migrate_drop_legacy.py --dry-run   # show what would happen
    python scripts/migrate_drop_legacy.py --postgres  # REQUIRED to touch prod

Safety gate: if the connection resolves to Postgres, the script REFUSES to
run without the explicit --postgres acknowledgement (a .env DATABASE_URL
outranks PRISM_DB_PATH — same near-miss and same guard as
migrate_drop_delphi.py). Run against prod only AFTER deploying the code
that stopped writing these objects.

Every table is archived to JSON under data/archive/ before dropping.
Idempotent: objects that don't exist are skipped. Column drops need
SQLite >= 3.35 (Postgres: always fine).
"""
import json, os, sys, datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import pulse.env_loader  # noqa: F401,E402  (loads .env; shell wins — M17)
from pulse.database import get_db_connection, USE_POSTGRES  # noqa: E402

TABLES = ["trend_journey_exposure", "users", "scanned_trends"]
COLUMN_DROPS = [("simulation_runs", "allocation_recommendation")]


def _columns(cur, table: str) -> set:
    if USE_POSTGRES:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = %s", (table,)
        )
        rows = cur.fetchall()
        return {(r["column_name"] if isinstance(r, dict) else r[0]) for r in rows}
    cur.execute(f"PRAGMA table_info({table})")
    return {row[1] for row in cur.fetchall()}


def main(dry_run: bool = False, allow_postgres: bool = False) -> None:
    archive_dir = os.path.join("data", "archive")
    os.makedirs(archive_dir, exist_ok=True)
    stamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    mode = "postgres" if USE_POSTGRES else "sqlite"
    print(f"target database mode: {mode}")
    if USE_POSTGRES and not allow_postgres and not dry_run:
        print("REFUSING: this connection resolves to Postgres. If you really "
              "mean the production database, re-run with --postgres — and "
              "only after deploying the code that stopped writing these "
              "objects.")
        sys.exit(4)

    with get_db_connection() as conn:
        cur = conn.cursor()

        for table in TABLES:
            try:
                cur.execute(f"SELECT * FROM {table}")
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description] if cur.description else []
            except Exception as e:
                print(f"skip {table}: not present ({type(e).__name__})")
                conn.rollback()  # clear the aborted-transaction state (Postgres)
                continue
            data = [dict(zip(cols, r)) for r in rows]
            out = os.path.join(archive_dir, f"{table}_{stamp}.json")
            if dry_run:
                print(f"[dry-run] would archive {len(data)} rows of {table} -> {out}, then DROP")
                continue
            with open(out, "w") as fh:
                json.dump(data, fh, indent=2, default=str)
            print(f"archived {len(data)} rows of {table} -> {out}")
            cur.execute(f"DROP TABLE {table}")
            print(f"dropped {table}")

        for table, col in COLUMN_DROPS:
            try:
                present = _columns(cur, table)
            except Exception as e:
                print(f"skip {table}.{col}: table not inspectable ({type(e).__name__})")
                conn.rollback()
                continue
            if col not in present:
                print(f"skip {table}.{col}: not present")
                continue
            if dry_run:
                print(f"[dry-run] would ALTER TABLE {table} DROP COLUMN {col}")
                continue
            cur.execute(f"ALTER TABLE {table} DROP COLUMN {col}")
            print(f"dropped {table}.{col}")

        if not dry_run:
            conn.commit()
    print("done." if not dry_run else "dry-run complete.")


if __name__ == "__main__":
    main(dry_run="--dry-run" in sys.argv,
         allow_postgres="--postgres" in sys.argv)
