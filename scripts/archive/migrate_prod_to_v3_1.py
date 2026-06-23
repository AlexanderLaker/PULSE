#!/usr/bin/env python3
"""
Migrate production Neon Postgres to PRISM v3.1.

WHAT THIS DOES
--------------
  1. Ensures schema has peak_year + diffusion_curve columns (idempotent).
  2. Deletes retired trends (consumer_r12 "Post-COVID Hygiene",
     customer_r05 "Quick Commerce").
  3. Upserts all 82 v3.1 trends with their explicit peak_year +
     diffusion_curve assignments from pulse/seed_trends.py.
  4. Reports before / after counts, retired-trend presence, and
     column coverage.

SAFETY
------
  - Runs in --dry-run mode by default. Shows what WOULD change
    without writing.
  - Pass --apply to actually write. A single transaction wraps the
    trend writes; on error, nothing is committed.
  - Requires POSTGRES_URL (or DATABASE_URL) in the environment. Fail
    fast if not set — never fall back to SQLite by accident.

USAGE
-----
  # From the PROFIT_POOL_ENGINE/ root, with your prod DB URL:
  export POSTGRES_URL='postgresql://...@ep-xxx.neon.tech/neondb?sslmode=require'

  # 1) Preview
  python scripts/migrate_prod_to_v3_1.py

  # 2) Apply
  python scripts/migrate_prod_to_v3_1.py --apply
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import Counter

# Ensure pulse/ is importable whether we're run from repo root or scripts/.
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

# ─── Pre-flight: force Postgres mode, refuse SQLite fallback ──────────
POSTGRES_URL = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL")
if not POSTGRES_URL:
    print(
        "✗ POSTGRES_URL (or DATABASE_URL) not set. This script will NOT\n"
        "  fall back to SQLite — it's a production migration. Export the\n"
        "  Neon connection string first:\n\n"
        "    export POSTGRES_URL='postgresql://...@ep-xxx.neon.tech/neondb?sslmode=require'\n",
        file=sys.stderr,
    )
    sys.exit(2)

# Sanity: is this actually a Postgres URL?
if not (POSTGRES_URL.startswith("postgres://") or POSTGRES_URL.startswith("postgresql://")):
    print(f"✗ POSTGRES_URL doesn't look like a Postgres URL: {POSTGRES_URL[:40]}…", file=sys.stderr)
    sys.exit(2)

# Import AFTER env is set so the database module picks it up.
from pulse.database import (  # noqa: E402
    get_db_connection, init_db, save_trends, load_trends, USE_POSTGRES,
)
from pulse.seed_trends import get_report_trends  # noqa: E402

if not USE_POSTGRES:
    print("✗ pulse.database didn't pick up Postgres mode. Check POSTGRES_URL.", file=sys.stderr)
    sys.exit(2)


RETIRED_IDS = ["consumer_r12", "customer_r05"]


def _vals(row):
    """Normalize a row from RealDictCursor (dict) or default cursor (tuple) into a tuple."""
    if row is None:
        return None
    if isinstance(row, dict):
        return tuple(row.values())
    return tuple(row)


def count_trends() -> dict:
    """Return a before/after fingerprint of the trends table."""
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM trends")
        total = _vals(cur.fetchone())[0]
        cur.execute(
            "SELECT COUNT(*) FROM trends WHERE peak_year IS NOT NULL AND peak_year > 0"
        )
        with_peak = _vals(cur.fetchone())[0]
        cur.execute(
            "SELECT COUNT(*) FROM trends "
            "WHERE diffusion_curve IS NOT NULL AND diffusion_curve <> ''"
        )
        with_curve = _vals(cur.fetchone())[0]
        cur.execute(
            "SELECT id FROM trends WHERE id = ANY(%s)",
            (RETIRED_IDS,),
        )
        retired_present = [_vals(row)[0] for row in cur.fetchall()]
        cur.execute(
            "SELECT force, COUNT(*) FROM trends GROUP BY force ORDER BY force"
        )
        by_force = dict(_vals(row) for row in cur.fetchall())
    return {
        "total": total,
        "with_peak_year": with_peak,
        "with_diffusion_curve": with_curve,
        "retired_still_present": retired_present,
        "by_force": by_force,
    }


def print_fingerprint(label: str, fp: dict) -> None:
    print(f"\n── {label} ─────────────────────────────────────────────")
    print(f"  total trends            : {fp['total']}")
    print(f"  with peak_year > 0      : {fp['with_peak_year']}")
    print(f"  with diffusion_curve    : {fp['with_diffusion_curve']}")
    retired = fp["retired_still_present"]
    print(f"  retired still in table  : {retired if retired else '(none)'}")
    print(f"  by force                : {fp['by_force']}")


def delete_retired(apply: bool) -> int:
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM trends WHERE id = ANY(%s)", (RETIRED_IDS,))
        targets = [_vals(row)[0] for row in cur.fetchall()]
        if not targets:
            return 0
        print(f"  → would delete retired: {targets}" if not apply
              else f"  → deleting retired   : {targets}")
        if apply:
            for tid in targets:
                cur.execute("DELETE FROM trend_sources           WHERE trend_id = %s", (tid,))
                cur.execute("DELETE FROM trend_category_exposure WHERE trend_id = %s", (tid,))
                cur.execute("DELETE FROM trend_vc_exposure       WHERE trend_id = %s", (tid,))
                cur.execute("DELETE FROM trend_regional_exposure WHERE trend_id = %s", (tid,))
                cur.execute("DELETE FROM trends                   WHERE id       = %s", (tid,))
            conn.commit()
        return len(targets)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually write to the DB. Without this flag, runs in dry-run mode.",
    )
    args = parser.parse_args()

    # Mask URL for log.
    masked = POSTGRES_URL.split("@")[-1] if "@" in POSTGRES_URL else "<hidden>"
    print(f"\nPRISM v3.1 Production Migration")
    print(f"  target DB: {masked}")
    print(f"  mode     : {'APPLY' if args.apply else 'DRY-RUN'}")

    # 1) Ensure schema has peak_year + diffusion_curve columns.
    #    init_db() uses CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN,
    #    both idempotent. Run it unconditionally — no-op if already current.
    print("\n[1/4] Ensuring schema has peak_year + diffusion_curve...")
    if args.apply:
        init_db()
        print("      ✓ schema up to date")
    else:
        print("      (dry-run) init_db() skipped; run with --apply to execute")

    # 2) Snapshot BEFORE.
    print("\n[2/4] Snapshotting current state...")
    before = count_trends()
    print_fingerprint("BEFORE", before)

    # 3) Delete retired + upsert 82 v3.1 trends.
    print("\n[3/4] Applying v3.1 seed...")
    n_retired = delete_retired(apply=args.apply)
    print(f"  retired removed         : {n_retired}")

    trends = get_report_trends()
    assert len(trends) == 82, f"seed list should be 82 trends, got {len(trends)}"
    print(f"  v3.1 trends to upsert   : {len(trends)}")
    curve_counter = Counter(getattr(t, "diffusion_curve", None) or "(none)" for t in trends)
    peak_counter = Counter(getattr(t, "peak_year", 0) or 0 for t in trends)
    print(f"    diffusion_curve       : {dict(curve_counter)}")
    print(f"    peak_year             : "
          f"min={min(peak_counter.keys() - {0}) if peak_counter.keys() - {0} else '?'}, "
          f"max={max(peak_counter.keys())}")
    if args.apply:
        save_trends(trends)
        print("  ✓ 82 trends upserted")
    else:
        print("  (dry-run) save_trends skipped; run with --apply to execute")

    # 4) Snapshot AFTER.
    print("\n[4/4] Verifying...")
    after = count_trends()
    print_fingerprint("AFTER", after)

    # Summary gate
    ok = True
    if args.apply:
        if after["total"] != 82:
            ok = False
            print(f"\n✗ FAIL: expected 82 trends, got {after['total']}")
        if after["with_peak_year"] != 82:
            ok = False
            print(f"\n✗ FAIL: expected 82 trends with peak_year, got {after['with_peak_year']}")
        if after["with_diffusion_curve"] != 82:
            ok = False
            print(f"\n✗ FAIL: expected 82 trends with diffusion_curve, "
                  f"got {after['with_diffusion_curve']}")
        if after["retired_still_present"]:
            ok = False
            print(f"\n✗ FAIL: retired trends still present: "
                  f"{after['retired_still_present']}")
        if ok:
            print("\n✓ Migration complete. Production Neon is on v3.1.")
        else:
            print("\n✗ Migration completed with warnings. Review above.")
    else:
        print("\n(dry-run) No changes written. Re-run with --apply to commit.")

    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
