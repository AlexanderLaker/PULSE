"""Delphi legacy cleanup migration (D10 June 2026 · extended O1 2026-07-07).

The Delphi elicitation capability was removed from PRISM in June 2026 (D10);
expert consensus is entered live via the admin Trend editor (which sets
user_override). Owner ruling O1 (2026-07-07) additionally deletes every
delphi-era remnant: this script now also drops the three legacy columns the
capability left on `trends` (scorer_count, score_variance, debiasing_applied)
— the code stopped reading/writing them the same day.

Usage:
    python scripts/migrate_drop_delphi.py                 # local SQLite only
    python scripts/migrate_drop_delphi.py --dry-run       # show what would happen
    python scripts/migrate_drop_delphi.py --postgres      # REQUIRED to touch prod

Run once against EACH database. Safety gate (2026-07-07, after a near-miss:
.env's DATABASE_URL outranks PRISM_DB_PATH, so a "local" invocation silently
resolved to prod Neon): if the connection resolves to Postgres, the script
REFUSES to run without the explicit --postgres acknowledgement — the same
loud-refusal philosophy as the prod run's wrong-DB-mode guard (H1).

Archives every delphi_* table to JSON under data/archive/ before dropping.
Idempotent: tables/columns that don't exist are skipped. Column drops need
SQLite >= 3.35 (Postgres: always fine).
"""
import json, os, sys, datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import pulse.env_loader  # noqa: F401,E402  (loads .env; shell wins — M17)
from pulse.database import get_db_connection, USE_POSTGRES  # noqa: E402

TABLES = ["delphi_rounds", "delphi_sessions", "delphi_calibration"]
LEGACY_TREND_COLUMNS = ["scorer_count", "score_variance", "debiasing_applied"]


def _trend_columns(cur) -> set:
    """Column names of the trends table, both backends."""
    if USE_POSTGRES:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'trends'"
        )
        rows = cur.fetchall()
        return {(r["column_name"] if isinstance(r, dict) else r[0]) for r in rows}
    cur.execute("PRAGMA table_info(trends)")
    return {row[1] for row in cur.fetchall()}


def main(dry_run: bool = False, allow_postgres: bool = False) -> None:
    archive_dir = os.path.join("data", "archive")
    os.makedirs(archive_dir, exist_ok=True)
    stamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    mode = "postgres" if USE_POSTGRES else "sqlite"
    print(f"target database mode: {mode}")
    if USE_POSTGRES and not allow_postgres and not dry_run:
        print("REFUSING: this connection resolves to Postgres (a .env "
              "DATABASE_URL outranks PRISM_DB_PATH). If you really mean the "
              "production database, re-run with --postgres. Deploy the code "
              "that stops writing these columns BEFORE dropping them, or "
              "admin trend saves on the old deployment will fail.")
        sys.exit(4)

    with get_db_connection() as conn:
        cur = conn.cursor()

        # 1) delphi_* tables — archive then drop (D10)
        for table in TABLES:
            try:
                cur.execute(f"SELECT * FROM {table}")
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description] if cur.description else []
            except Exception as e:
                print(f"skip {table}: not present ({type(e).__name__})")
                # A failed SELECT aborts the current Postgres transaction —
                # roll back so the remaining statements run cleanly.
                conn.rollback()
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

        # 2) delphi-era columns on trends — drop (O1, 2026-07-07)
        present = _trend_columns(cur)
        for col in LEGACY_TREND_COLUMNS:
            if col not in present:
                print(f"skip trends.{col}: not present")
                continue
            if dry_run:
                print(f"[dry-run] would ALTER TABLE trends DROP COLUMN {col}")
                continue
            cur.execute(f"ALTER TABLE trends DROP COLUMN {col}")
            print(f"dropped trends.{col}")

        if not dry_run:
            conn.commit()
    print("done." if not dry_run else "dry-run complete.")


if __name__ == "__main__":
    main(dry_run="--dry-run" in sys.argv,
         allow_postgres="--postgres" in sys.argv)
