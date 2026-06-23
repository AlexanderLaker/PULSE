#!/usr/bin/env python3
"""
Migrate production Neon Postgres to PRISM v3.5.

WHAT THIS DOES
--------------
  1. Ensures schema is up to date (peak_year + diffusion_curve columns,
     plus whatever schema evolution has landed since v3.1). Idempotent.
  2. Upserts ALL 99 v3.5 trends from pulse/seed_trends.py. Safe against
     prod currently being at v3.1 (82), v3.3 (95), or v3.5 (99) —
     upsert semantics mean existing rows are updated and new rows are
     inserted.
  3. Verifies the 4 Gemini-review additions are present post-migration:
       - consumer_r33     Ultra-Fast-Fashion Beauty (Shein/Temu)
       - technology_r19   Neuro-Scents
       - competitive_r14  AfCFTA Pan-African Integration
       - government_r14   PVA Unit-Dose Film Biodegradability
  4. Reports before/after counts, new-trend presence, by-force
     distribution, and column coverage.

IMPORTANT: v3.5 is purely ADDITIVE over v3.3. It does NOT retire any
trends. (v3.1 → v3.5 retirements — consumer_r12, customer_r05 — were
already processed by migrate_prod_to_v3_1.py.)

SAFETY
------
  - Runs in --dry-run mode by default. Shows what WOULD change
    without writing.
  - Pass --apply to actually write.
  - Requires POSTGRES_URL (or DATABASE_URL) in the environment. Fail
    fast if not set — never fall back to SQLite by accident.

USAGE
-----
  export POSTGRES_URL='postgresql://...@ep-xxx.neon.tech/neondb?sslmode=require'

  # 1) Preview
  python scripts/migrate_prod_to_v3_5.py

  # 2) Apply
  python scripts/migrate_prod_to_v3_5.py --apply
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

# ─── Pre-flight: force Postgres mode, refuse SQLite fallback ──────────
POSTGRES_URL = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL")
if not POSTGRES_URL:
    print(
        "X POSTGRES_URL (or DATABASE_URL) not set. This script will NOT\n"
        "  fall back to SQLite - it's a production migration. Export the\n"
        "  Neon connection string first:\n\n"
        "    export POSTGRES_URL='postgresql://...@ep-xxx.neon.tech/neondb?sslmode=require'\n",
        file=sys.stderr,
    )
    sys.exit(2)

if not (POSTGRES_URL.startswith("postgres://") or POSTGRES_URL.startswith("postgresql://")):
    print(f"X POSTGRES_URL doesn't look like a Postgres URL: {POSTGRES_URL[:40]}...", file=sys.stderr)
    sys.exit(2)

from pulse.database import (  # noqa: E402
    get_db_connection, init_db, save_trends, USE_POSTGRES,
)
from pulse.seed_trends import get_report_trends  # noqa: E402

if not USE_POSTGRES:
    print("X pulse.database didn't pick up Postgres mode. Check POSTGRES_URL.", file=sys.stderr)
    sys.exit(2)


# v3.5 Gemini-review additions (over v3.3 base of 95).
NEW_V3_5_IDS = [
    "consumer_r33",      # Ultra-Fast-Fashion Beauty
    "technology_r19",    # Neuro-Scents
    "competitive_r14",   # AfCFTA Pan-African Integration
    "government_r14",    # PVA Unit-Dose Film Biodegradability
]

# Legacy retired IDs that must NOT reappear (already removed in v3.1 migration).
RETIRED_IDS = ["consumer_r12", "customer_r05"]

EXPECTED_TOTAL = 99
EXPECTED_BY_FORCE = {
    "Consumer":      32,
    "Customer":      10,
    "Technology":    18,
    "Government":    14,
    "Environmental": 11,
    "Competitive":   14,
}


def _vals(row):
    if row is None:
        return None
    if isinstance(row, dict):
        return tuple(row.values())
    return tuple(row)


def count_trends() -> dict:
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
        cur.execute("SELECT id FROM trends WHERE id = ANY(%s)", (NEW_V3_5_IDS,))
        new_present = [_vals(row)[0] for row in cur.fetchall()]
        cur.execute("SELECT id FROM trends WHERE id = ANY(%s)", (RETIRED_IDS,))
        retired_present = [_vals(row)[0] for row in cur.fetchall()]
        cur.execute(
            "SELECT force, COUNT(*) FROM trends GROUP BY force ORDER BY force"
        )
        by_force = dict(_vals(row) for row in cur.fetchall())
    return {
        "total": total,
        "with_peak_year": with_peak,
        "with_diffusion_curve": with_curve,
        "new_v3_5_present": new_present,
        "retired_still_present": retired_present,
        "by_force": by_force,
    }


def print_fingerprint(label: str, fp: dict) -> None:
    print(f"\n-- {label} ---------------------------------------------")
    print(f"  total trends            : {fp['total']}")
    print(f"  with peak_year > 0      : {fp['with_peak_year']}")
    print(f"  with diffusion_curve    : {fp['with_diffusion_curve']}")
    new = fp["new_v3_5_present"]
    missing = sorted(set(NEW_V3_5_IDS) - set(new))
    print(f"  v3.5 new trends present : {sorted(new) if new else '(none)'}")
    if missing:
        print(f"  v3.5 new trends MISSING : {missing}")
    retired = fp["retired_still_present"]
    if retired:
        print(f"  retired still in table  : {retired} (!!)")
    print(f"  by force                : {fp['by_force']}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually write to the DB. Without this flag, runs in dry-run mode.",
    )
    args = parser.parse_args()

    masked = POSTGRES_URL.split("@")[-1] if "@" in POSTGRES_URL else "<hidden>"
    print(f"\nPRISM v3.5 Production Migration")
    print(f"  target DB: {masked}")
    print(f"  mode     : {'APPLY' if args.apply else 'DRY-RUN'}")

    # 1) Ensure schema is current.
    print("\n[1/4] Ensuring schema has peak_year + diffusion_curve...")
    if args.apply:
        init_db()
        print("      OK schema up to date")
    else:
        print("      (dry-run) init_db() skipped; run with --apply to execute")

    # 2) Snapshot BEFORE.
    print("\n[2/4] Snapshotting current state...")
    before = count_trends()
    print_fingerprint("BEFORE", before)

    # 3) Upsert all 99 v3.5 trends.
    print("\n[3/4] Applying v3.5 seed (additive upsert over v3.3)...")
    trends = get_report_trends()
    if len(trends) != EXPECTED_TOTAL:
        print(
            f"X seed_trends.py is not at v3.5 canon: "
            f"got {len(trends)} trends, expected {EXPECTED_TOTAL}.",
            file=sys.stderr,
        )
        return 2
    print(f"  v3.5 trends to upsert   : {len(trends)}")

    curve_counter = Counter(getattr(t, "diffusion_curve", None) or "(none)" for t in trends)
    peak_years = sorted({getattr(t, "peak_year", 0) for t in trends if getattr(t, "peak_year", 0)})
    print(f"    diffusion_curve       : {dict(curve_counter)}")
    print(f"    peak_year range       : {min(peak_years)}..{max(peak_years)}")

    force_counter = Counter(t.force for t in trends)
    print(f"    by force in seed      : {dict(force_counter)}")
    for f, exp in EXPECTED_BY_FORCE.items():
        got = force_counter.get(f, 0)
        if got != exp:
            print(
                f"X seed force-count mismatch: {f} expected {exp}, got {got}",
                file=sys.stderr,
            )
            return 2

    if args.apply:
        save_trends(trends)
        print(f"  OK {len(trends)} trends upserted")
    else:
        print("  (dry-run) save_trends skipped; run with --apply to execute")

    # 4) Snapshot AFTER + verify.
    print("\n[4/4] Verifying...")
    after = count_trends()
    print_fingerprint("AFTER", after)

    ok = True
    if args.apply:
        if after["total"] != EXPECTED_TOTAL:
            ok = False
            print(f"\nX FAIL: expected {EXPECTED_TOTAL} trends, got {after['total']}")
        if after["with_peak_year"] != EXPECTED_TOTAL:
            ok = False
            print(
                f"\nX FAIL: expected {EXPECTED_TOTAL} trends with peak_year, "
                f"got {after['with_peak_year']}"
            )
        if after["with_diffusion_curve"] != EXPECTED_TOTAL:
            ok = False
            print(
                f"\nX FAIL: expected {EXPECTED_TOTAL} trends with diffusion_curve, "
                f"got {after['with_diffusion_curve']}"
            )
        missing_new = sorted(set(NEW_V3_5_IDS) - set(after["new_v3_5_present"]))
        if missing_new:
            ok = False
            print(f"\nX FAIL: v3.5 new trends missing after upsert: {missing_new}")
        if after["retired_still_present"]:
            ok = False
            print(
                f"\nX FAIL: retired trends still present: "
                f"{after['retired_still_present']}"
            )
        if after["by_force"] != EXPECTED_BY_FORCE:
            ok = False
            print(
                f"\nX FAIL: by-force distribution drift. "
                f"expected={EXPECTED_BY_FORCE} got={after['by_force']}"
            )
        if ok:
            print("\nOK Migration complete. Production Neon is on v3.5 (99 trends).")
        else:
            print("\nX Migration completed with warnings. Review above.")
    else:
        print("\n(dry-run) No changes written. Re-run with --apply to commit.")

    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
