"""Migration 0002: C-05 (Ageing Consumers) takes its rescored values, and they become its baseline.

Release 2.13.0 rescored C-05 (consumer_r05) in the driver base. A new database
is seeded with the new values; an existing database keeps its own drivers,
and nothing but a migration writes a driver's name or its baseline. This
migration brings the stored C-05 to the base's values, so that it equals the
C-05 of a new database: README.md in this folder is the runbook. Everything
happens in one transaction, so the database ends either fully migrated or
unchanged. While it runs it holds locks on the four driver tables that stop
every write but no read (PostgreSQL), or the write lock (SQLite).

c05.json holds C-05 twice: as release 2.12.0 shipped it (previous) and as
the driver base holds it (current). Each stored field is compared with both:

1. A field that holds the previous value gets the current one. One that
   already holds the current value (an admin entered the new values on the
   Drivers page) is left as it is.
2. A score, the force, the direction, the start year, the confidence, an
   exposure map or the source list that holds neither value was edited by an admin. The migration then
   changes nothing and lists every such field, since writing the base's
   values over it would discard a judgment; with --replace-edited it writes
   them anyway, and the archive keeps what was there.
3. The technical scope (drivers.name) and the description, when an admin or
   an SQL statement changed them, are left alone and reported, as migration
   0001 leaves an edited description. The previous description is known by
   the SHA-256 of every text shipped for it since release 2.11.0.
4. The baseline becomes the current scores and the driver is no longer
   marked as edited, so the Drivers page compares proposals and later edits
   with the new values. A baseline that holds neither the previous nor the
   current scores counts as an edited field (step 2).
5. The revision rises by one, so every running service reloads the driver,
   and every changed field is written to the audit log as an admin edit is,
   with the migration as the actor. Expert proposals are kept.
6. The migration is recorded in schema_migrations and in the audit log.

Before the commit the stored C-05 (its row, exposures and sources) is written
to a local archive, migrations/0002_c05_rescore/archive/<database>-<time>.json
(readable by the owner only, never committed).

    python3 migrations/0002_c05_rescore/migrate.py --dry-run      report what would change, change nothing
    python3 migrations/0002_c05_rescore/migrate.py --postgres     migrate the PostgreSQL database in .env
    python3 migrations/0002_c05_rescore/migrate.py --sqlite PATH  migrate a SQLite file

Without --sqlite the target is POSTGRES_URL or DATABASE_URL (from the shell or
.env), else the local SQLite file (PRISM_DB_PATH or data/prism.db). A run that
changes a PostgreSQL database needs --postgres; a dry run does not.

Exit codes: 0 migrated, previewed by a dry run, or already migrated; 1 refused
(no suitable database, migration 0001 not run, no C-05, --postgres missing, or
fields an admin edited); 2 failed and rolled back.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(REPO))

import prism.env_loader  # noqa: E402,F401  (loads .env; shell variables win)
from prism.config import CATEGORIES, REGIONS  # noqa: E402
from prism.database import describe_error  # noqa: E402
from prism.drivers import SCORE_FIELDS, Driver, simulation_problems  # noqa: E402
from prism.migration import Database, write_archive  # noqa: E402

MIGRATION = "0002_c05_rescore"
#: The migration that must have run first: this one changes drivers of the driver schema.
REQUIRES = "0001_driver_schema"
#: C-05 as release 2.12.0 shipped it and as the driver base holds it.
VALUES_FILE = HERE / "c05.json"
ARCHIVE_DIR = HERE / "archive"
#: The actor of the audit entries this migration writes.
ACTOR = "migration-0002"
#: The tables this migration reads and writes; locked against writes until the commit.
DRIVER_TABLES = ("drivers", "driver_category_exposure", "driver_regional_exposure", "driver_sources")
LOCK_TIMEOUT = "10s"
#: The columns of drivers an admin can change, compared with both values (step 2).
JUDGED_COLUMNS = ("force", "direction", "probability", "start_year", "peak_year", "diffusion_curve",
                  "gp1_pct_affected", "uncertainty", "vc_epicentre", "confidence")
#: The fields kept in tables of their own, compared the same way.
CHILD_FIELDS = ("category_exposure", "regional_exposure", "sources")
JUDGED_FIELDS = JUDGED_COLUMNS + CHILD_FIELDS
#: The texts left alone when an admin changed them (step 3).
TEXT_FIELDS = ("name", "description")


def sha256(text) -> str:
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


def load_values() -> dict:
    return json.loads(VALUES_FILE.read_text(encoding="utf-8"))


def scores_of(values: dict) -> dict:
    """The baseline a driver with these values gets: its SCORE_FIELDS."""
    return {name: values[name] for name in SCORE_FIELDS}


def same(a, b) -> bool:
    """Equal, with a stored floating-point share equal to the value it was written from."""
    if isinstance(a, float) or isinstance(b, float):
        try:
            return math.isclose(float(a), float(b), rel_tol=0, abs_tol=1e-12)
        except (TypeError, ValueError):
            return False
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(same(a[k], b[k]) for k in a)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(same(x, y) for x, y in zip(a, b))
    return a == b


def read_driver(db: Database, driver_id: str) -> dict | None:
    """The stored driver with its exposures and sources, or None."""
    p = db.p
    rows = db.rows(f"SELECT * FROM drivers WHERE id = {p}", (driver_id,))
    if not rows:
        return None
    row = rows[0]
    driver = {k: row[k] for k in ("id", *TEXT_FIELDS, *JUDGED_COLUMNS, "revision")}
    driver["gp1_pct_affected"] = float(driver["gp1_pct_affected"])
    baseline = row["baseline"]
    driver["baseline"] = json.loads(baseline) if isinstance(baseline, str) else baseline
    driver["scores_edited"] = bool(row["scores_edited"])
    for field, table, column in (("category_exposure", "driver_category_exposure", "category"),
                                 ("regional_exposure", "driver_regional_exposure", "region")):
        driver[field] = {r["k"]: int(r["exposure_score"]) for r in db.rows(
            f"SELECT {column} AS k, exposure_score FROM {table} WHERE driver_id = {p}", (driver_id,))}
    driver["sources"] = db.rows(f"SELECT title, url, tier, published FROM driver_sources WHERE driver_id = {p} "
                                "ORDER BY id", (driver_id,))
    driver["proposals"] = int(db.rows(f"SELECT COUNT(*) AS n FROM driver_score_proposals WHERE driver_id = {p}",
                                      (driver_id,))[0]["n"])
    return driver


class NeedsCorrection(ValueError):
    """The stored driver cannot be migrated as it is; the message lists every problem."""

    def __init__(self, problems: list):
        self.problems = list(problems)
        super().__init__("\n  ".join(["nothing changed:"] + self.problems))


class AlreadyRun(Exception):
    """Another run recorded the migration while this one waited for the lock."""


def describe(field: str, value) -> str:
    """A stored value in a problem line: a source list by its titles, anything else as JSON."""
    if field == "sources":
        return "; ".join(s["title"] for s in value) or "no sources"
    return json.dumps(value, ensure_ascii=False)


def plan(stored: dict, values: dict) -> dict:
    """What happens to each field: ``{field: (state, stored, current)}`` with state
    "previous" (it gets the current value), "current" (it has it already) or
    "edited" (it holds neither)."""
    previous, current = values["previous"], values["current"]
    out = {}
    for field in JUDGED_FIELDS + ("name",):
        value = stored[field]
        state = ("current" if same(value, current[field]) else
                 "previous" if same(value, previous[field]) else "edited")
        out[field] = (state, value, current[field])
    text = stored["description"]
    state = ("current" if text == current["description"] else
             "previous" if sha256(text) in previous["description_sha256"] else "edited")
    out["description"] = (state, text, current["description"])
    base_current, base_previous = scores_of(current), scores_of(previous)
    baseline = stored["baseline"]
    state = ("current" if same(baseline, base_current) else
             "previous" if same(baseline, base_previous) else "edited")
    out["baseline"] = (state, baseline, base_current)
    return out


def migrate(db: Database, replace_edited: bool = False, values: dict | None = None) -> dict:
    """Apply the migration inside the open transaction; returns the report and the archive."""
    values = values or load_values()
    driver_id, current = values["driver_id"], values["current"]
    p = db.p
    if db.postgres:
        # EXCLUSIVE stops every write to these tables until the commit, and no
        # read; a lock that cannot be had within the timeout fails the run.
        db.execute(f"SET LOCAL lock_timeout = '{LOCK_TIMEOUT}'")
        db.execute(f"LOCK TABLE {', '.join(DRIVER_TABLES)} IN EXCLUSIVE MODE")

    # A second run that waited for the lock finds the first one recorded.
    if db.has_run(MIGRATION):
        raise AlreadyRun()
    stored = read_driver(db, driver_id)
    if stored is None:
        raise NeedsCorrection([f"the database holds no driver {driver_id}"])
    fields = plan(stored, values)
    edited = [f for f in JUDGED_FIELDS + ("baseline",) if fields[f][0] == "edited"]
    if edited and not replace_edited:
        raise NeedsCorrection([f"{driver_id} {f} was edited: it holds {describe(f, fields[f][1])}, neither "
                               f"the previous nor the current value, {describe(f, fields[f][2])}"
                               for f in edited])

    # What is written: every judged field and the baseline at the current
    # value, a text unless an admin changed it.
    written = [f for f in JUDGED_FIELDS + ("baseline",) if fields[f][0] != "current"]
    written += [f for f in TEXT_FIELDS if fields[f][0] == "previous"]
    result = {f: (fields[f][2] if f in written else stored[f]) for f in fields}
    problems = simulation_problems([Driver(
        id=driver_id, force=result["force"], direction=result["direction"], probability=result["probability"],
        start_year=result["start_year"], gp1_pct_affected=result["gp1_pct_affected"],
        peak_year=result["peak_year"], diffusion_curve=result["diffusion_curve"],
        uncertainty=result["uncertainty"], vc_epicentre=result["vc_epicentre"],
        category_exposure={c: result["category_exposure"][c] for c in CATEGORIES},
        regional_exposure={r: result["regional_exposure"][r] for r in REGIONS})])
    if problems:
        raise RuntimeError(f"the current values of {driver_id} cannot be simulated: {problems}")
    # Every score now equals the new baseline, so the driver is no longer edited.
    if stored["scores_edited"]:
        written.append("scores_edited")

    report = {"database": db.where, "driver": driver_id,
              "updated": written,
              "already_current": [f for f in fields if fields[f][0] == "current"],
              "edited_replaced": edited,
              "edited_left_alone": [f for f in TEXT_FIELDS if fields[f][0] == "edited"],
              "proposals_kept": stored["proposals"],
              "revision": {"from": stored["revision"],
                           "to": stored["revision"] + 1 if written else stored["revision"]}}
    archive = {"migration": MIGRATION, "database": db.where, "driver": stored}

    if written:
        columns = [f for f in written if f in JUDGED_COLUMNS + TEXT_FIELDS]
        params = [result[c] for c in columns] + [json.dumps(current_baseline(values)), False]
        assignments = [f"{c} = {p}" for c in columns] + [f"baseline = {p}", f"scores_edited = {p}"]
        db.execute(f"UPDATE drivers SET {', '.join(assignments)}, revision = revision + 1, "
                   f"updated_at = CURRENT_TIMESTAMP WHERE id = {p} AND revision = {p}",
                   (*params, driver_id, stored["revision"]))
        if db.cur.rowcount != 1:   # cannot happen under the lock; refuse rather than guess
            raise RuntimeError(f"{driver_id} changed while the migration ran")
        if "category_exposure" in written:
            db.execute(f"DELETE FROM driver_category_exposure WHERE driver_id = {p}", (driver_id,))
            for category in CATEGORIES:
                db.execute(f"INSERT INTO driver_category_exposure (driver_id, category, exposure_score) "
                           f"VALUES ({p}, {p}, {p})", (driver_id, category, current["category_exposure"][category]))
        if "regional_exposure" in written:
            db.execute(f"DELETE FROM driver_regional_exposure WHERE driver_id = {p}", (driver_id,))
            for region in REGIONS:
                db.execute(f"INSERT INTO driver_regional_exposure (driver_id, region, exposure_score) "
                           f"VALUES ({p}, {p}, {p})", (driver_id, region, current["regional_exposure"][region]))
        if "sources" in written:
            db.execute(f"DELETE FROM driver_sources WHERE driver_id = {p}", (driver_id,))
            for s in current["sources"]:
                db.execute(f"INSERT INTO driver_sources (driver_id, title, url, tier, published) "
                           f"VALUES ({p}, {p}, {p}, {p}, {p})",
                           (driver_id, s["title"], s["url"], s["tier"], s["published"]))
        for field in written:
            old, new = (True, False) if field == "scores_edited" else (stored[field], result[field])
            db.execute("INSERT INTO audit_log (action, entity_type, entity_id, old_value, new_value, reason, "
                       f"user_id) VALUES ('driver_updated', 'driver', {p}, {p}, {p}, {p}, {p})",
                       (driver_id, json.dumps(old, default=str), json.dumps(new, default=str), field, ACTOR))

    db.execute(f"INSERT INTO schema_migrations (version) VALUES ({p})", (MIGRATION,))
    summary = (f"{driver_id}: {len(written)} fields updated, {len(report['edited_replaced'])} edited fields "
               f"replaced, {len(report['edited_left_alone'])} edited texts left alone")
    db.execute("INSERT INTO audit_log (action, entity_type, entity_id, new_value, reason, user_id) "
               f"VALUES ('schema_migrated', 'database', {p}, {p}, {p}, {p})",
               (MIGRATION, summary, "C-05 rescored by migrations/0002_c05_rescore/migrate.py", ACTOR))
    if not db.postgres:
        problems = db.rows("PRAGMA foreign_key_check")
        if problems:
            raise RuntimeError(f"foreign key check failed: {problems[:5]}")
    return {"report": report, "archive": archive}


def current_baseline(values: dict) -> dict:
    return scores_of(values["current"])


def main(argv: list | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="run inside a transaction, report, then roll back")
    parser.add_argument("--postgres", action="store_true", help="confirm that a PostgreSQL database may be changed")
    parser.add_argument("--sqlite", metavar="PATH", help="migrate this SQLite file instead of the configured database")
    parser.add_argument("--replace-edited", action="store_true",
                        help="write the current values over the fields an admin edited (step 2)")
    args = parser.parse_args(argv)

    try:
        db = Database(args.sqlite)
    except FileNotFoundError as e:
        print(f"Cannot open the database: {e}")
        return 1
    except Exception as e:  # noqa: BLE001 (reported by its category, never by its raw text)
        # A driver's message about a failed connection can quote part of the
        # URL, password included.
        print(f"Cannot open the database: {describe_error(e)}")
        return 1
    if db.has_run(MIGRATION):
        print(f"{db.where}: migration {MIGRATION} has already run; nothing to do.")
        return 0
    if "drivers" not in db.tables() or not db.has_run(REQUIRES):
        print(f"{db.where}: not a database of the driver schema with migration {REQUIRES} recorded. "
              f"Run migrations/{REQUIRES}/migrate.py first; a new database needs no migration.")
        return 1
    if db.postgres and not args.dry_run and not args.postgres:
        print(f"{db.where}: pass --postgres to migrate a PostgreSQL database (or --dry-run to preview).")
        return 1

    db.begin()
    try:
        result = migrate(db, args.replace_edited)
    except AlreadyRun:
        db.rollback()
        print(f"{db.where}: migration {MIGRATION} has already run; nothing to do.")
        return 0
    except NeedsCorrection as e:
        db.rollback()
        print(f"{db.where}: {e}")
        print("See README.md, If the migration refuses: set the field back on the Drivers page, or run again "
              "with --replace-edited to write the current values over it (the archive keeps it).")
        return 1
    except Exception as e:  # noqa: BLE001 (rolled back and reported)
        db.rollback()
        print(f"Migration FAILED and was rolled back; the database is unchanged.\n  {type(e).__name__}: {e}")
        return 2

    print(json.dumps(result["report"], indent=2, default=str))
    if args.dry_run:
        db.rollback()
        print("Dry run: rolled back, nothing changed.")
        return 0
    try:
        archive_file = write_archive(ARCHIVE_DIR, db.label, result["archive"])
        db.commit()
    except Exception as e:  # noqa: BLE001 (rolled back and reported)
        db.rollback()
        print(f"Migration FAILED at the commit and was rolled back; the database is unchanged.\n  {e}")
        return 2
    print(f"Migrated. Archive of the previous C-05: {archive_file}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
