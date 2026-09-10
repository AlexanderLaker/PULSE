#!/usr/bin/env python3
"""
Replace the trend base with the reviewed 51-driver seed (release 2.11.0,
owner ruling O10). Archive-first, one run per database, by the owner.

    python3 scripts/replace_trend_base.py --dry-run    # report only, no writes
    python3 scripts/replace_trend_base.py              # local SQLite
    python3 scripts/replace_trend_base.py --postgres   # REQUIRED to touch Neon
    python3 scripts/replace_trend_base.py --force      # re-run on a database
                                                       # already on the 51 base
                                                       # (RESETS admin edits)

What it does, in order:
  1. Refuses to run against Postgres without --postgres (a .env
     DATABASE_URL/POSTGRES_URL outranks PRISM_DB_PATH — the same near-miss
     guard as the two migration scripts). A dry run never writes: it does
     not even apply the schema additions.
  2. Applies the 2.11.0 schema additions (init_db: the uncertainty columns).
     Refuses to run a second time on a database that is already on the 51
     base (no retired and no new ids): that would reset every admin edit
     made since the replacement to the seed values. --force overrides,
     after printing how many expert-reviewed rows would be reset.
  3. Archives the CURRENT base to data/archive/trend_base_<mode>_<stamp>.json:
     trends, the three exposure tables, trend_sources and every expert
     proposal. The archive is written and re-read before anything is
     changed; if it cannot be written the script stops (exit 3). It is the
     rollback: scripts/restore_trend_base.py is deliberately NOT provided —
     a rollback is a decision, load the archive by hand.
  4. Deletes the trends that are not in the new seed (retired, merged,
     force-moved ids) with their exposure, source and proposal rows.
  5. Writes the 51 drivers with pulse.database.save_trends (delete-then-
     insert per id, exactly what the admin full-reseed endpoint does).
  6. Restores the expert proposals of the KEPT ids from the pre-replacement
     snapshot, if any are missing. Since F-29 was fixed (2026-09-10)
     save_trends upserts the trend row instead of deleting and re-inserting
     it, so the ON DELETE CASCADE on trend_score_proposals no longer fires on
     a write and normally nothing needs restoring. The step stays as the
     safety net for a database last written by pre-2.11.0 code, where the
     cascade did fire; proposals on RETIRED ids are archived, never restored.
  7. Verifies: 51 trends, every driver with 12 category / 4 region / 8
     value-chain rows and at least one source, proposals restored; writes
     the verification next to the archive and an audit-log entry.

The first 2.11.0 simulation run after this replacement reports the mass
change as a critical input-drift event by design (D19). Re-run
scripts/run_50k_prod.py afterwards so the persisted run matches the base.
"""
from __future__ import annotations

import argparse
import collections
import datetime
import json
import os
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, REPO)
import pulse.env_loader  # noqa: F401,E402  (loads .env; shell wins — M17)
from pulse.database import (  # noqa: E402
    USE_POSTGRES, get_db_connection, init_db, load_trends, log_audit,
    placeholder, ph, save_trends, _row_to_dict,
)
from pulse.config import CATEGORIES, REGIONS, VC_STEPS  # noqa: E402

EXPECTED_COUNT = 51
ARCHIVE_TABLES = ["trends", "trend_category_exposure", "trend_vc_exposure",
                  "trend_regional_exposure", "trend_sources", "trend_score_proposals"]
PROPOSAL_COLUMNS = ["trend_id", "user_id", "user_name", "user_role", "probability",
                    "gp1_pct_affected", "peak_year", "diffusion_curve", "uncertainty",
                    "category_exposure", "regional_exposure", "vc_exposure", "comment",
                    "updated_at"]


def _rows(cur, sql: str, params=()) -> list:
    cur.execute(sql, params)
    return [_row_to_dict(r) for r in cur.fetchall()]


def _archive(archive_dir: str, stamp: str, mode: str) -> tuple[str, dict]:
    os.makedirs(archive_dir, exist_ok=True)
    out = os.path.join(archive_dir, f"trend_base_{mode}_{stamp}.json")
    payload = {"archived_at_utc": stamp, "mode": mode, "tables": {}}
    with get_db_connection() as conn:
        cur = conn.cursor()
        for table in ARCHIVE_TABLES:
            try:
                payload["tables"][table] = _rows(cur, f"SELECT * FROM {table}")
            except Exception as e:  # a missing table is archived as absent
                conn.rollback()
                payload["tables"][table] = None
                print(f"  {table}: not present ({type(e).__name__})")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=1, default=str, ensure_ascii=False)
    with open(out, encoding="utf-8") as fh:  # re-read: the archive must be loadable
        check = json.load(fh)
    counts = {t: (len(v) if v is not None else None) for t, v in check["tables"].items()}
    return out, counts


def _verify(seed_ids: set) -> dict:
    with get_db_connection() as conn:
        cur = conn.cursor()
        trends = _rows(cur, "SELECT id, force, direction, uncertainty FROM trends ORDER BY id")
        cat = collections.Counter(r["trend_id"] for r in _rows(cur, "SELECT trend_id FROM trend_category_exposure"))
        reg = collections.Counter(r["trend_id"] for r in _rows(cur, "SELECT trend_id FROM trend_regional_exposure"))
        vcs = collections.Counter(r["trend_id"] for r in _rows(cur, "SELECT trend_id FROM trend_vc_exposure"))
        src = collections.Counter(r["trend_id"] for r in _rows(cur, "SELECT trend_id FROM trend_sources"))
        props = _rows(cur, "SELECT trend_id, user_id FROM trend_score_proposals")
    ids = {r["id"] for r in trends}
    problems = []
    if ids != seed_ids:
        problems.append(f"id set differs from the seed: missing {sorted(seed_ids - ids)}, extra {sorted(ids - seed_ids)}")
    for tid in sorted(ids):
        if cat[tid] != len(CATEGORIES):
            problems.append(f"{tid}: {cat[tid]} category rows (expected {len(CATEGORIES)})")
        if reg[tid] != len(REGIONS):
            problems.append(f"{tid}: {reg[tid]} region rows (expected {len(REGIONS)})")
        if vcs[tid] != len(VC_STEPS):
            problems.append(f"{tid}: {vcs[tid]} value-chain rows (expected {len(VC_STEPS)})")
        if src[tid] < 1:
            problems.append(f"{tid}: no sources")
    unscored = [r["id"] for r in trends if r.get("uncertainty") is None]
    if unscored:
        problems.append(f"drivers without an uncertainty score: {unscored}")
    orphan_props = sorted({p["trend_id"] for p in props if p["trend_id"] not in ids})
    if orphan_props:
        problems.append(f"proposals pointing at deleted trends: {orphan_props}")
    return {
        "trend_count": len(trends),
        "forces": dict(collections.Counter(r["force"] for r in trends)),
        "directions": dict(collections.Counter(r["direction"] for r in trends)),
        "proposal_rows": len(props),
        "problems": problems,
    }


def main(dry_run: bool, allow_postgres: bool, force: bool = False, archive_dir: str | None = None) -> int:
    mode = "postgres" if USE_POSTGRES else "sqlite"
    stamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    print(f"target database mode: {mode}")
    if USE_POSTGRES and not allow_postgres and not dry_run:
        print("REFUSING: this connection resolves to Postgres. If you really mean "
              "the production database, re-run with --postgres — after the 2.11.0 "
              "code is deployed and the local SQLite run has been checked.")
        return 4

    from pulse.seed_trends import get_report_trends
    seed = get_report_trends()
    seed_ids = {t.id for t in seed}
    if len(seed) != EXPECTED_COUNT or len(seed_ids) != EXPECTED_COUNT:
        print(f"ABORT: the seed module holds {len(seed)} trends / {len(seed_ids)} ids, expected {EXPECTED_COUNT}")
        return 2

    if not dry_run:
        init_db()  # 2.11.0 columns (uncertainty) before anything is written
    try:
        current = load_trends()
    except Exception as e:
        print(f"ABORT: the database has no readable trends table ({type(e).__name__}: {e}). "
              "A fresh database is seeded by the service on first start, not by this script.")
        return 2
    db_ids = {t.id for t in current}
    kept = sorted(db_ids & seed_ids)
    new = sorted(seed_ids - db_ids)
    retired = sorted(db_ids - seed_ids)
    with get_db_connection() as conn:
        cur = conn.cursor()
        try:
            props_all = _rows(cur, "SELECT * FROM trend_score_proposals")
        except Exception:
            conn.rollback()
            props_all = []
    props_kept = [p for p in props_all if p["trend_id"] in seed_ids]
    props_lost = [p for p in props_all if p["trend_id"] not in seed_ids]

    print(f"current base: {len(current)} trends; new seed: {len(seed)} drivers")
    print(f"  kept ids: {len(kept)}   new ids: {len(new)}   retired ids: {len(retired)}")
    print(f"  expert proposals: {len(props_all)} rows ({len(props_kept)} on kept ids are restored, "
          f"{len(props_lost)} on retired ids are archived only)")
    if new:
        print("  new: " + ", ".join(new))
    if retired:
        print("  retired: " + ", ".join(retired))
    already_on_base = not new and not retired
    reviewed = sum(1 for t in current if getattr(t, "user_override", False))
    if already_on_base:
        print(f"  this database is already on the 51-driver base; a re-run would reset "
              f"{reviewed} expert-reviewed row(s) and every other admin edit to the seed values")
    if dry_run:
        print("dry-run complete: nothing written.")
        return 0
    if already_on_base and not force:
        print("REFUSING: nothing to replace (no retired and no new ids). Re-run with --force "
              "only if you deliberately want to reset the base to the seed values.")
        return 7

    # 3. archive first (data/archive/ is git-ignored; --archive-dir overrides)
    archive_dir = archive_dir or os.path.join(REPO, "data", "archive")
    try:
        archive_path, counts = _archive(archive_dir, stamp, mode)
    except Exception as e:
        print(f"ABORT: archive failed ({type(e).__name__}: {e}); nothing changed")
        return 3
    print(f"archived current base -> {archive_path}: " + ", ".join(f"{t} {n}" for t, n in counts.items()))

    # 4./5./6. replace
    p = placeholder()
    with get_db_connection() as conn:
        cur = conn.cursor()
        for oid in retired:
            for table in ("trend_score_proposals", "trend_sources", "trend_category_exposure",
                          "trend_vc_exposure", "trend_regional_exposure"):
                cur.execute(f"DELETE FROM {table} WHERE trend_id = {p}", (oid,))
            cur.execute(f"DELETE FROM trends WHERE id = {p}", (oid,))
        conn.commit()
    print(f"deleted {len(retired)} retired trend(s) with their exposure, source and proposal rows")

    save_trends(seed)
    print(f"wrote {len(seed)} drivers from pulse/seed_trends.py")

    restored = 0
    if props_kept:
        with get_db_connection() as conn:
            cur = conn.cursor()
            present = {(r["trend_id"], r["user_id"]) for r in
                       _rows(cur, "SELECT trend_id, user_id FROM trend_score_proposals")}
            cols = [c for c in PROPOSAL_COLUMNS if c in props_kept[0]]
            for row in props_kept:
                if (row["trend_id"], row["user_id"]) in present:
                    continue  # still there: since F-29 a save no longer cascades
                cur.execute(
                    f"INSERT INTO trend_score_proposals ({', '.join(cols)}) VALUES ({ph(len(cols))})",
                    tuple(row.get(c) for c in cols),
                )
                restored += 1
            conn.commit()
    print(f"expert proposals on kept ids: {len(props_kept)} snapshot, {restored} re-inserted after the cascade")

    # 7. verify
    result = _verify(seed_ids)
    result.update({"archive": archive_path, "kept": kept, "new": new, "retired": retired,
                   "proposals_restored": restored, "proposals_archived_only": len(props_lost)})
    with open(os.path.join(archive_dir, f"trend_base_replacement_{mode}_{stamp}.json"), "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=1, ensure_ascii=False)
    print(f"verification: {result['trend_count']} trends; forces {result['forces']}; "
          f"directions {result['directions']}; proposal rows {result['proposal_rows']}")
    if result["problems"]:
        print("PROBLEMS:")
        for line in result["problems"]:
            print("  - " + line)
        print("The archive above is the rollback.")
        return 5
    try:
        log_audit(
            "trend_base_replaced", "trend", "all",
            old_value=f"{len(current)} trends (archive {os.path.basename(archive_path)})",
            new_value=f"{len(seed)} drivers from the September 2026 core set (release 2.11.0)",
            reason="Owner ruling O10: 51-driver base; kept %d, new %d, retired %d" % (len(kept), len(new), len(retired)),
            user_id="owner-cli",
        )
    except Exception as e:
        print(f"audit log entry failed ({type(e).__name__}: {e}); the replacement itself is complete")
    print("done. Re-run scripts/run_50k_prod.py so the persisted run matches the new base.")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--postgres", action="store_true", help="acknowledge that the target is the production database")
    ap.add_argument("--force", action="store_true",
                    help="re-run on a database already on the 51 base (resets admin edits to the seed)")
    ap.add_argument("--archive-dir", default=None, help="where to write the archive (default data/archive under the repo)")
    a = ap.parse_args()
    sys.exit(main(dry_run=a.dry_run, allow_postgres=a.postgres, force=a.force, archive_dir=a.archive_dir))
