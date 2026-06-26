#!/usr/bin/env python3
"""
Backfill the AI baseline snapshot (trends.ai_suggestion) into an existing
database WITHOUT re-seeding (June 2026 multi-expert proposals layer).

For every trend whose ai_suggestion column is still NULL, copy that trend's
CURRENT scoreable values into ai_suggestion as a JSON blob:

    {probability, gp1_pct_affected, peak_year, diffusion_curve,
     category_exposure, regional_exposure, vc_exposure}

This gives existing DBs an "AI suggestion" reference (the present state of
each trend) without overwriting anything else and without a full reseed.
Idempotent: rows that already have a snapshot are left untouched.

Run once against local SQLite and once against prod (with DATABASE_URL /
POSTGRES_URL set):

    python scripts/backfill_ai_suggestion.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pulse.database import (  # noqa: E402
    init_db, get_db_connection, placeholder, _row_to_dict, _safe_dumps,
)


def _exposure_map(cursor, p, table, key_col, trend_id):
    cursor.execute(
        f"SELECT {key_col}, exposure_score FROM {table} WHERE trend_id = {p}",
        (trend_id,),
    )
    out = {}
    for r in cursor.fetchall():
        row = _row_to_dict(r)
        out[row[key_col]] = row["exposure_score"]
    return out


def main() -> None:
    init_db()
    p = placeholder()
    updated = 0
    scanned = 0
    with get_db_connection() as conn:
        cursor = conn.cursor()
        # Only trends with no snapshot yet.
        cursor.execute(
            "SELECT id, probability, gp1_pct_affected, peak_year, diffusion_curve "
            "FROM trends WHERE ai_suggestion IS NULL"
        )
        rows = [_row_to_dict(r) for r in cursor.fetchall()]
        for row in rows:
            scanned += 1
            tid = row["id"]
            snapshot = {
                "probability": row.get("probability"),
                "gp1_pct_affected": row.get("gp1_pct_affected"),
                "peak_year": row.get("peak_year"),
                "diffusion_curve": row.get("diffusion_curve"),
                "category_exposure": _exposure_map(
                    cursor, p, "trend_category_exposure", "category", tid
                ),
                "regional_exposure": _exposure_map(
                    cursor, p, "trend_regional_exposure", "region", tid
                ),
                "vc_exposure": _exposure_map(
                    cursor, p, "trend_vc_exposure", "vc_step", tid
                ),
            }
            cursor.execute(
                f"UPDATE trends SET ai_suggestion = {p} WHERE id = {p} AND ai_suggestion IS NULL",
                (_safe_dumps(snapshot), tid),
            )
            updated += 1
        conn.commit()
    print(f"Scanned {scanned} trend(s) without an AI baseline; backfilled {updated}.")


if __name__ == "__main__":
    main()
