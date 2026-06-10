"""One-off migration (D10, June 2026): archive then drop the delphi_* tables.

The Delphi elicitation capability was removed from PRISM. Expert consensus
is now entered live via the admin Trend editor (which sets user_override).

Usage:
    python scripts/migrate_drop_delphi.py            # archive + drop
    python scripts/migrate_drop_delphi.py --dry-run  # show what would happen

Archives every delphi_* table to JSON under data/archive/ before dropping.
Idempotent: tables that don't exist are skipped.
"""
import json, os, sys, datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from pulse.database import get_db_connection  # noqa: E402

TABLES = ["delphi_rounds", "delphi_sessions", "delphi_calibration"]


def main(dry_run: bool = False) -> None:
    archive_dir = os.path.join("data", "archive")
    os.makedirs(archive_dir, exist_ok=True)
    stamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    with get_db_connection() as conn:
        cur = conn.cursor()
        for table in TABLES:
            try:
                cur.execute(f"SELECT * FROM {table}")
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description] if cur.description else []
            except Exception as e:
                print(f"skip {table}: {e}")
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
        if not dry_run:
            conn.commit()
    print("done." if not dry_run else "dry-run complete.")


if __name__ == "__main__":
    main(dry_run="--dry-run" in sys.argv)
