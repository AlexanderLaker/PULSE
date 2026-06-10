#!/usr/bin/env python3
"""
Backfill consumer-journey exposures into an existing trends database
WITHOUT re-seeding (preserves all admin-edited trend fields).

Inserts/replaces trend_journey_exposure rows from
pulse/seed_journey_exposure.py (AI-suggested 2026-06, derived from the
curated journey tile map). Run once against local SQLite and once against
prod (DATABASE_URL/POSTGRES_URL env set), then re-run the simulation so
the published run carries journey_decomposition:

    python scripts/backfill_journey_exposure.py
    python scripts/run_50k_prod.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pulse.database import init_db, get_db_connection, placeholder  # noqa: E402
from pulse.seed_journey_exposure import JOURNEY_EXPOSURE  # noqa: E402


def main() -> None:
    init_db()
    p = placeholder()
    inserted = 0
    skipped = []
    with get_db_connection() as conn:
        cursor = conn.cursor()
        for trend_id, stages in JOURNEY_EXPOSURE.items():
            cursor.execute(f"SELECT id FROM trends WHERE id = {p}", (trend_id,))
            if not cursor.fetchone():
                skipped.append(trend_id)
                continue
            cursor.execute(f"DELETE FROM trend_journey_exposure WHERE trend_id = {p}", (trend_id,))
            for stage, score in stages.items():
                cursor.execute(
                    f"INSERT INTO trend_journey_exposure (trend_id, journey_stage, exposure_score) "
                    f"VALUES ({p}, {p}, {p})",
                    (trend_id, stage, score),
                )
                inserted += 1
        conn.commit()
    print(f"Backfilled {inserted} journey-exposure rows for {len(JOURNEY_EXPOSURE) - len(skipped)} trends.")
    if skipped:
        print(f"Skipped {len(skipped)} trend ids not present in this DB: {', '.join(skipped[:8])}…")


if __name__ == "__main__":
    main()
