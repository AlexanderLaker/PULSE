"""Migration 0001: move a PRISM database from the previous schema to the driver schema.

Run it once per database, right after deploying the code that expects the
driver schema; README.md in this folder is the runbook. Everything happens in
one transaction, so the database ends either fully migrated or unchanged.
While it runs it holds exclusive locks on the tables it touches (PostgreSQL)
or the write lock (SQLite), so nothing can write in between.

1. The driver tables are created and filled from the previous ones:
     trends                    -> drivers      (strategic_implication -> analysis,
                                                ai_suggestion -> baseline,
                                                user_override -> scores_edited)
     trend_category_exposure, trend_vc_exposure, trend_regional_exposure
                               -> driver_category_exposure, driver_vc_exposure,
                                  driver_regional_exposure
     trend_sources             -> driver_sources (source_type -> note: the publication
                                                  date where the old value read
                                                  "<kind> (<date>)", else the old text)
     trend_score_proposals     -> driver_score_proposals (without user_role, which
                                                         held "viewer" for everyone)
   The previous editor saved a driver's source list as JSON in trends.data_source
   while the sources table kept the rows the driver was created with. Where
   data_source holds such a list, that list (the one the admin last saved)
   becomes the driver's sources; the report names those drivers. The one-line
   data_source summary itself is not carried over: the dashboard derives it
   from the sources. Rows of the child tables whose driver no longer exists are
   not copied and are counted in the report (the archive keeps them).
2. Tables nothing reads any more are dropped (the trend tables, config_snapshots,
   triggers, ai_suggestions, session_snapshots, and older leftovers where a
   database still has them), and so is every column of simulation_runs beyond
   id, run_date, iterations and results. Nothing is dropped with CASCADE: if a
   table this migration does not know depends on one it drops, the migration
   stops and changes nothing. Tables it does not know, such as user_roles, are
   never touched.
3. The keys of the stored runs follow the new names: meta.trend_count ->
   meta.driver_count, meta.trend_fingerprint -> meta.driver_fingerprint, and
   trend_ids / unscored_trend_ids -> driver_ids / unscored_driver_ids in the
   integrity events. No number changes.
4. The content is brought up to date:
     - every driver of the seed gets its current PRISM Analysis text;
     - a description that still holds a previously shipped text gets the current
       one (descriptions.json); an edited description is left alone and reported;
     - the newest Consumer Journey content gets the key driverCodes instead of
       trendCodes and the current tile texts where a tile field still holds a
       previously shipped text (journey_edits.json); it is saved as a new version.
5. The migration is recorded in schema_migrations and in the audit log.

Before the commit, every dropped row and column is written to a local archive,
migrations/0001_driver_schema/archive/<database>-<time>.json (readable by the
owner only, never committed). The audit log is kept as it is.

    python3 migrations/0001_driver_schema/migrate.py --dry-run      report what would change, change nothing
    python3 migrations/0001_driver_schema/migrate.py --postgres     migrate the PostgreSQL database in .env
    python3 migrations/0001_driver_schema/migrate.py --sqlite PATH  migrate a SQLite file

Without --sqlite the target is POSTGRES_URL or DATABASE_URL (from the shell or
.env), else the local SQLite file (PRISM_DB_PATH or data/prism.db). A run that
changes a PostgreSQL database needs --postgres; a dry run does not.

Exit codes: 0 migrated or already migrated; 1 refused (no suitable database,
not the previous schema, or --postgres missing); 2 failed and rolled back.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(REPO))

import prism.env_loader  # noqa: E402,F401  (loads .env; shell variables win)

MIGRATION = "0001_driver_schema"
ARCHIVE_DIR = HERE / "archive"
#: The current descriptions, with the SHA-256 of each text shipped before them.
DESCRIPTIONS_FILE = HERE / "descriptions.json"
#: The current journey tile texts, with the SHA-256 of each text shipped before them.
JOURNEY_EDITS_FILE = HERE / "journey_edits.json"

#: Previous tables this migration removes, every table before the tables it
#: references (delphi_rounds references trends and delphi_sessions,
#: delphi_calibration references delphi_sessions). Only these are dropped; any
#: other table in the database is left alone.
DROP_TABLES = (
    "trend_score_proposals", "trend_sources", "trend_category_exposure", "trend_vc_exposure",
    "trend_regional_exposure", "trend_journey_exposure", "delphi_rounds", "delphi_calibration",
    "delphi_sessions", "trends", "config_snapshots", "triggers", "ai_suggestions", "session_snapshots",
    "scanned_trends", "backtest_results", "causal_edges", "competitors", "users",
)
#: The children of trends whose rows are copied into the driver tables.
CHILD_TABLES = ("trend_category_exposure", "trend_vc_exposure", "trend_regional_exposure",
                "trend_sources", "trend_score_proposals")
#: The columns simulation_runs keeps; any other is archived and dropped (older
#: databases also carry scenario, causal_decomposition and others). Dropping
#: config_snapshot_id first also removes its foreign key to config_snapshots.
SIMULATION_RUN_COLUMNS = ("id", "run_date", "iterations", "results")
#: Tables locked for the whole transaction besides DROP_TABLES.
LOCKED_TABLES = ("simulation_runs", "journey_content")
LOCK_TIMEOUT = "10s"
RUN_META_RENAMES = {"trend_count": "driver_count", "trend_fingerprint": "driver_fingerprint"}
EVENT_DETAIL_RENAMES = {"trend_ids": "driver_ids", "unscored_trend_ids": "unscored_driver_ids"}
SOURCE_KINDS = ("primary source", "analyst report", "trade press", "primary_source", "analyst_report", "trade_press")


def _ddl(postgres: bool) -> list:
    """The driver schema, as prism/database.py creates it on a new database."""
    serial = "SERIAL PRIMARY KEY" if postgres else "INTEGER PRIMARY KEY AUTOINCREMENT"
    return [
        """CREATE TABLE drivers (
            id TEXT PRIMARY KEY,
            force TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            direction TEXT,
            probability INTEGER,
            start_year INTEGER,
            peak_year INTEGER DEFAULT 0,
            diffusion_curve TEXT DEFAULT 's_curve',
            gp1_pct_affected REAL,
            uncertainty INTEGER,
            confidence TEXT DEFAULT 'Medium',
            analysis TEXT,
            baseline TEXT,
            scores_edited BOOLEAN DEFAULT FALSE,
            revision INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE driver_category_exposure (
            driver_id TEXT REFERENCES drivers(id) ON DELETE CASCADE,
            category TEXT NOT NULL,
            exposure_score INTEGER,
            PRIMARY KEY (driver_id, category)
        )""",
        """CREATE TABLE driver_vc_exposure (
            driver_id TEXT REFERENCES drivers(id) ON DELETE CASCADE,
            vc_step TEXT NOT NULL,
            exposure_score INTEGER,
            PRIMARY KEY (driver_id, vc_step)
        )""",
        """CREATE TABLE driver_regional_exposure (
            driver_id TEXT REFERENCES drivers(id) ON DELETE CASCADE,
            region TEXT NOT NULL,
            exposure_score INTEGER,
            PRIMARY KEY (driver_id, region)
        )""",
        f"""CREATE TABLE driver_sources (
            id {serial},
            driver_id TEXT REFERENCES drivers(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            tier TEXT DEFAULT '',
            note TEXT DEFAULT ''
        )""",
        f"""CREATE TABLE driver_score_proposals (
            id {serial},
            driver_id TEXT REFERENCES drivers(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL,
            user_name TEXT,
            probability INTEGER,
            gp1_pct_affected REAL,
            peak_year INTEGER,
            diffusion_curve TEXT,
            uncertainty INTEGER,
            category_exposure TEXT,
            regional_exposure TEXT,
            vc_exposure TEXT,
            comment TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (driver_id, user_id)
        )""",
        # These three exist in every database of the previous schema; the
        # statements only matter for one that somehow lacks them.
        f"""CREATE TABLE IF NOT EXISTS journey_content (
            id {serial},
            content TEXT NOT NULL,
            updated_by TEXT DEFAULT '',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        f"""CREATE TABLE IF NOT EXISTS simulation_runs (
            id {serial},
            run_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            iterations INTEGER,
            results TEXT
        )""",
        f"""CREATE TABLE IF NOT EXISTS audit_log (
            id {serial},
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            action TEXT NOT NULL,
            entity_type TEXT,
            entity_id TEXT,
            old_value TEXT,
            new_value TEXT,
            reason TEXT,
            user_id TEXT DEFAULT 'system'
        )""",
        """CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        "CREATE INDEX IF NOT EXISTS idx_drivers_force ON drivers(force)",
        "CREATE INDEX IF NOT EXISTS idx_driver_score_proposals_driver ON driver_score_proposals(driver_id)",
        "CREATE INDEX IF NOT EXISTS idx_simulation_runs_date ON simulation_runs(run_date)",
        "CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp)",
    ]


def sha256(text) -> str:
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


def source_note(old: str) -> str:
    """The note of a source from its previous source_type value."""
    text = (old or "").strip()
    m = re.fullmatch(r"(?:%s)\s*\((.+)\)" % "|".join(re.escape(k) for k in SOURCE_KINDS), text, re.I)
    if m:
        return m.group(1).strip()
    return "" if text.lower() in SOURCE_KINDS else text


def editor_sources(data_source):
    """The source list the previous editor saved as JSON in data_source, else None.

    That editor sent a driver's whole source list with every save and the
    previous API stored it in data_source as JSON, while the sources table kept
    the rows the driver was created with. Such a list is the one the admin
    last saved. Entries with neither a title nor a URL are skipped; the old
    "data" field becomes the note the way source_note reads it.
    """
    if not isinstance(data_source, str) or not data_source.lstrip().startswith("["):
        return None
    try:
        parsed = json.loads(data_source)
    except ValueError:
        return None
    if not isinstance(parsed, list) or not parsed or not all(isinstance(s, dict) for s in parsed):
        return None
    out = []
    for s in parsed:
        title, url = str(s.get("title") or ""), str(s.get("url") or "")
        if not (title.strip() or url.strip()):
            continue
        kind = s.get("data") if s.get("data") is not None else s.get("source_type")
        out.append({"title": title, "url": url, "tier": str(s.get("tier") or ""), "note": source_note(kind)})
    return out or None


def rename_run_keys(results: dict) -> bool:
    """Rename the trend-named keys of one stored results bundle in place; True if any changed."""
    changed = False
    meta = results.get("meta")
    if isinstance(meta, dict):
        for old, new in RUN_META_RENAMES.items():
            if old in meta and new not in meta:
                meta[new] = meta.pop(old)
                changed = True
    for event in results.get("integrity_events") or []:
        detail = event.get("detail") if isinstance(event, dict) else None
        if isinstance(detail, dict):
            for old, new in EVENT_DETAIL_RENAMES.items():
                if old in detail and new not in detail:
                    detail[new] = detail.pop(old)
                    changed = True
    return changed


class Database:
    """The connection and the few dialect differences the migration needs."""

    def __init__(self, sqlite_file=None):
        url = None if sqlite_file else (os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL"))
        self.postgres = bool(url)
        if self.postgres:
            import psycopg2
            import psycopg2.extras
            self.conn = psycopg2.connect(url, **({} if "sslmode=" in url else {"sslmode": "require"}))
            self.conn.autocommit = False
            self.conn.cursor_factory = psycopg2.extras.RealDictCursor
            self.label = f"postgres-{urlparse(url).hostname}"
            self.where = f"PostgreSQL at {urlparse(url).hostname}"
        else:
            path = Path(sqlite_file or os.environ.get("PRISM_DB_PATH") or REPO / "data" / "prism.db")
            if not path.exists():
                raise FileNotFoundError(f"no SQLite database at {path}")
            self.conn = sqlite3.connect(str(path), isolation_level=None)
            self.conn.row_factory = sqlite3.Row
            # Foreign keys are checked once, at the end (foreign_key_check), rather
            # than per statement, which the rebuild of simulation_runs needs.
            self.conn.execute("PRAGMA foreign_keys = OFF")
            self.label = f"sqlite-{path.stem}"
            self.where = f"SQLite at {path}"
        self.cur = self.conn.cursor()
        self.p = "%s" if self.postgres else "?"

    def begin(self):
        if not self.postgres:
            # IMMEDIATE takes the write lock now, so no other connection can
            # write between the archive and the commit.
            self.cur.execute("BEGIN IMMEDIATE")

    def commit(self):
        self.conn.commit() if self.postgres else self.cur.execute("COMMIT")

    def rollback(self):
        try:
            self.conn.rollback() if self.postgres else self.cur.execute("ROLLBACK")
        except Exception:  # noqa: BLE001 (nothing to roll back)
            pass

    def execute(self, sql: str, params=()):
        self.cur.execute(sql, params)
        return self.cur

    def rows(self, sql: str, params=()) -> list:
        self.cur.execute(sql, params)
        return [dict(r) for r in self.cur.fetchall()]

    def tables(self) -> set:
        if self.postgres:
            return {r["name"] for r in self.rows(
                "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = current_schema()")}
        return {r["name"] for r in self.rows("SELECT name FROM sqlite_master WHERE type = 'table'")}

    def columns(self, table: str) -> list:
        if self.postgres:
            return [r["name"] for r in self.rows(
                "SELECT column_name AS name FROM information_schema.columns "
                "WHERE table_schema = current_schema() AND table_name = %s ORDER BY ordinal_position", (table,))]
        return [r["name"] for r in self.rows(f"PRAGMA table_info({table})")]


def jsonable(value):
    return value.isoformat() if isinstance(value, datetime) else value


def json_text(value):
    """A JSON column's value as text: a JSONB column arrives decoded, a TEXT column as text."""
    if value is None or isinstance(value, str):
        return value
    return json.dumps(value)


def json_value(value):
    """A JSON column's value decoded, whether the column is TEXT or JSONB."""
    return json.loads(value) if isinstance(value, str) else value


def migrate(db: Database) -> dict:
    """Apply the migration inside the open transaction; returns the report and the archive."""
    report: dict = {"database": db.where}
    archive: dict = {"migration": MIGRATION, "database": db.where, "tables": {}, "simulation_runs_columns": {}}
    tables = db.tables()
    p = db.p

    if db.postgres:
        # Everything this transaction reads or changes is locked until the
        # commit; a lock that cannot be had within the timeout fails the run.
        db.execute(f"SET LOCAL lock_timeout = '{LOCK_TIMEOUT}'")
        locked = [t for t in DROP_TABLES + LOCKED_TABLES if t in tables]
        db.execute(f"LOCK TABLE {', '.join(locked)} IN ACCESS EXCLUSIVE MODE")

    # ── what is dropped, archived first ─────────────────────────────────────
    for table in DROP_TABLES:
        if table in tables:
            keep = [c for c in db.columns(table) if "password" not in c.lower()]
            archive["tables"][table] = [{k: jsonable(v) for k, v in r.items()}
                                        for r in db.rows(f"SELECT {', '.join(keep)} FROM {table}")]
    drop_columns = [c for c in db.columns("simulation_runs") if c not in SIMULATION_RUN_COLUMNS]
    for column in drop_columns:
        archive["simulation_runs_columns"][column] = {
            str(r["id"]): jsonable(r["v"]) for r in db.rows(
                f"SELECT id, {column} AS v FROM simulation_runs WHERE {column} IS NOT NULL")}

    # ── the driver tables ───────────────────────────────────────────────────
    for statement in _ddl(db.postgres):
        db.execute(statement)

    drivers = db.rows("SELECT * FROM trends ORDER BY id")
    from_editor: dict = {}
    for r in drivers:
        db.execute(
            "INSERT INTO drivers (id, force, name, description, direction, probability, start_year, peak_year, "
            "diffusion_curve, gp1_pct_affected, uncertainty, confidence, analysis, baseline, "
            f"scores_edited, created_at, updated_at) VALUES ({', '.join([p] * 17)})",
            (r["id"], r["force"], r["name"], r.get("description"), r.get("direction"), r.get("probability"),
             r.get("start_year"), r.get("peak_year") or 0, r.get("diffusion_curve") or "s_curve",
             r.get("gp1_pct_affected"), r.get("uncertainty"), r.get("confidence") or "Medium",
             r.get("strategic_implication"), json_text(r.get("ai_suggestion")),
             bool(r.get("user_override")), r.get("created_at"), r.get("updated_at")))
        saved = editor_sources(r.get("data_source"))
        if saved is not None:
            from_editor[r["id"]] = saved

    # Child rows are copied only where their driver exists; SQLite does not
    # enforce the previous foreign keys, so a database can hold orphans.
    owned = "trend_id IN (SELECT id FROM trends)"
    orphans = {}
    for child in CHILD_TABLES:
        if child in tables:
            n = db.rows(f"SELECT COUNT(*) AS n FROM {child} WHERE trend_id IS NULL OR NOT ({owned})")[0]["n"]
            if n:
                orphans[child] = int(n)
    for new, old, key in (("driver_category_exposure", "trend_category_exposure", "category"),
                          ("driver_vc_exposure", "trend_vc_exposure", "vc_step"),
                          ("driver_regional_exposure", "trend_regional_exposure", "region")):
        if old in tables:
            db.execute(f"INSERT INTO {new} (driver_id, {key}, exposure_score) "
                       f"SELECT trend_id, {key}, exposure_score FROM {old} WHERE {owned}")

    table_sources: dict = {}
    if "trend_sources" in tables:
        for r in db.rows(f"SELECT * FROM trend_sources WHERE {owned} ORDER BY id"):
            table_sources.setdefault(r["trend_id"], []).append(
                {"title": r["title"], "url": r["url"], "tier": r.get("tier") or "",
                 "note": source_note(r.get("source_type"))})
    source_count = 0
    for driver_id in sorted(set(table_sources) | set(from_editor)):
        for src in from_editor.get(driver_id, table_sources.get(driver_id, [])):
            db.execute(f"INSERT INTO driver_sources (driver_id, title, url, tier, note) "
                       f"VALUES ({p}, {p}, {p}, {p}, {p})",
                       (driver_id, src["title"], src["url"], src["tier"], src["note"]))
            source_count += 1
    report["sources_from_editor"] = {
        driver_id: {"saved_in_editor": len(saved), "table_rows": len(table_sources.get(driver_id, []))}
        for driver_id, saved in sorted(from_editor.items())}

    proposals = 0
    if "trend_score_proposals" in tables:
        present = set(db.columns("trend_score_proposals"))
        fields = ("user_id", "user_name", "probability", "gp1_pct_affected", "peak_year",
                  "diffusion_curve", "uncertainty", "category_exposure", "regional_exposure", "vc_exposure",
                  "comment", "updated_at")
        select = ", ".join(f if f in present else f"NULL AS {f}" for f in fields)
        db.execute(f"INSERT INTO driver_score_proposals (driver_id, {', '.join(fields)}) "
                   f"SELECT trend_id, {select} FROM trend_score_proposals WHERE {owned} ORDER BY id")
        proposals = db.rows("SELECT COUNT(*) AS n FROM driver_score_proposals")[0]["n"]
    report["copied"] = {"drivers": len(drivers), "sources": source_count, "proposals": int(proposals)}
    report["orphans_skipped"] = orphans

    # ── drop what nothing uses ──────────────────────────────────────────────
    drop_run_columns(db, drop_columns)
    dropped = [t for t in DROP_TABLES if t in tables]
    for table in dropped:
        db.execute(f"DROP TABLE {table}")
    report["dropped_tables"] = dropped
    report["dropped_simulation_run_columns"] = drop_columns

    # ── stored runs ─────────────────────────────────────────────────────────
    renamed_runs = 0
    for row in db.rows("SELECT id FROM simulation_runs ORDER BY id"):
        raw = db.rows(f"SELECT results FROM simulation_runs WHERE id = {p}", (row["id"],))[0]["results"]
        try:
            results = json_value(raw)
        except ValueError:
            continue
        if isinstance(results, dict) and rename_run_keys(results):
            db.execute(f"UPDATE simulation_runs SET results = {p} WHERE id = {p}", (json.dumps(results), row["id"]))
            renamed_runs += 1
    report["runs_with_renamed_keys"] = renamed_runs

    # ── content ─────────────────────────────────────────────────────────────
    from prism.seed_drivers import DRIVERS
    present = {r["id"]: r for r in db.rows("SELECT id, description, analysis FROM drivers")}
    analysis_updated = 0
    for d in DRIVERS:
        if d.id in present and (present[d.id]["analysis"] or "") != d.analysis:
            db.execute(f"UPDATE drivers SET analysis = {p}, revision = revision + 1, "
                       f"updated_at = CURRENT_TIMESTAMP WHERE id = {p}",
                       (d.analysis, d.id))
            analysis_updated += 1
    report["analysis_updated"] = analysis_updated

    descriptions = json.loads(DESCRIPTIONS_FILE.read_text(encoding="utf-8"))["descriptions"]
    moved, current, edited = [], [], []
    for driver_id, entry in descriptions.items():
        if driver_id not in present:
            continue
        stored = present[driver_id]["description"] or ""
        if stored == entry["text"]:
            current.append(driver_id)
        elif sha256(stored) in entry["previous_sha256"]:
            db.execute(f"UPDATE drivers SET description = {p}, revision = revision + 1, "
                       f"updated_at = CURRENT_TIMESTAMP WHERE id = {p}",
                       (entry["text"], driver_id))
            moved.append(driver_id)
        else:
            edited.append(driver_id)
    report["descriptions"] = {"updated": len(moved), "already_current": len(current), "edited_left_alone": edited}

    report["journey"] = migrate_journey(db)

    db.execute(f"INSERT INTO schema_migrations (version) VALUES ({p})", (MIGRATION,))
    summary = (f"{len(drivers)} drivers, {source_count} sources, {proposals} proposals copied; "
               f"{len(dropped)} tables dropped; {renamed_runs} runs renamed")
    db.execute("INSERT INTO audit_log (action, entity_type, entity_id, new_value, reason, user_id) "
               f"VALUES ('schema_migrated', 'database', {p}, {p}, {p}, 'migration-0001')",
               (MIGRATION, summary, "Moved to the driver schema by migrations/0001_driver_schema/migrate.py"))

    if not db.postgres:
        problems = db.rows("PRAGMA foreign_key_check")
        if problems:
            raise RuntimeError(f"foreign key check failed after the copy: {problems[:5]}")
    return {"report": report, "archive": archive}


def drop_run_columns(db: Database, columns: list) -> None:
    """Drop the given columns of simulation_runs, keeping every row and id.

    SQLite cannot drop a column that takes part in a foreign key (older
    databases have config_snapshot_id REFERENCES config_snapshots), so there
    the table is rebuilt with the kept columns; explicit ids carry the
    autoincrement counter over.
    """
    if not columns:
        return
    if db.postgres:
        for column in columns:
            db.execute(f"ALTER TABLE simulation_runs DROP COLUMN {column}")
        return
    db.execute("""CREATE TABLE simulation_runs_rebuilt (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            iterations INTEGER,
            results TEXT
        )""")
    db.execute("INSERT INTO simulation_runs_rebuilt (id, run_date, iterations, results) "
               "SELECT id, run_date, iterations, results FROM simulation_runs ORDER BY id")
    db.execute("DROP TABLE simulation_runs")
    db.execute("ALTER TABLE simulation_runs_rebuilt RENAME TO simulation_runs")
    db.execute("CREATE INDEX IF NOT EXISTS idx_simulation_runs_date ON simulation_runs(run_date)")


def migrate_journey(db: Database) -> dict:
    """Rename trendCodes and apply the tile text edits to the newest stored journey content."""
    p = db.p
    rows = db.rows("SELECT id, content FROM journey_content ORDER BY id DESC LIMIT 1")
    if not rows:
        return {"stored_content": False}
    content = json_value(rows[0]["content"])
    edits = json.loads(JOURNEY_EDITS_FILE.read_text(encoding="utf-8"))["edits"]
    by_tile: dict = {}
    for e in edits:
        by_tile.setdefault(e["tile"], []).append(e)
    renamed = applied = 0
    already, edited = [], []
    for journey in ("lhc", "hair"):
        for stage in content.get(journey) or []:
            for side in ("benefiting", "negativelyImpacted"):
                tiles = stage.get(side) or []
                for i, tile in enumerate(tiles):
                    if "trendCodes" in tile and "driverCodes" not in tile:
                        tile = {("driverCodes" if k == "trendCodes" else k): v for k, v in tile.items()}
                        tiles[i] = tile
                        renamed += 1
                    for e in by_tile.get(tile.get("id"), []):
                        stored = tile.get(e["field"])
                        if stored == e["text"]:
                            already.append(f"{tile['id']}.{e['field']}")
                        elif sha256(stored) in e["previous_sha256"]:
                            tile[e["field"]] = e["text"]
                            applied += 1
                        else:
                            edited.append(f"{tile['id']}.{e['field']}")
    if renamed or applied:
        db.execute(f"INSERT INTO journey_content (content, updated_by) VALUES ({p}, {p})",
                   (json.dumps(content), f"migration {MIGRATION}"))
    return {"stored_content": True, "tiles_renamed": renamed, "texts_updated": applied,
            "texts_already_current": len(already), "texts_edited_left_alone": edited,
            "new_version_saved": bool(renamed or applied)}


def main(argv: list | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="run inside a transaction, report, then roll back")
    parser.add_argument("--postgres", action="store_true", help="confirm that a PostgreSQL database may be changed")
    parser.add_argument("--sqlite", metavar="PATH", help="migrate this SQLite file instead of the configured database")
    args = parser.parse_args(argv)

    try:
        db = Database(args.sqlite)
    except Exception as e:  # noqa: BLE001 (reported, not raised)
        print(f"Cannot open the database: {e}")
        return 1
    tables = db.tables()
    if "drivers" in tables:
        done = "schema_migrations" in tables and db.rows(
            f"SELECT 1 AS x FROM schema_migrations WHERE version = {db.p}", (MIGRATION,))
        if done:
            print(f"{db.where}: already on the driver schema; nothing to do.")
            return 0
        print(f"{db.where}: has a drivers table but no record of this migration; refusing to guess.")
        return 1
    if "trends" not in tables:
        print(f"{db.where}: no trends table, so this is not a database of the previous schema. "
              "A new database needs no migration: the API creates the schema on first use.")
        return 1
    if db.postgres and not args.dry_run and not args.postgres:
        print(f"{db.where}: pass --postgres to migrate a PostgreSQL database (or --dry-run to preview).")
        return 1

    db.begin()
    try:
        result = migrate(db)
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
        ARCHIVE_DIR.mkdir(mode=0o700, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        archive_file = ARCHIVE_DIR / f"{db.label}-{stamp}.json"
        # Owner-only: the archive holds user emails and the previous content.
        fd = os.open(archive_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(json.dumps(result["archive"], indent=1, default=str))
        db.commit()
    except Exception as e:  # noqa: BLE001 (rolled back and reported)
        db.rollback()
        print(f"Migration FAILED at the commit and was rolled back; the database is unchanged.\n  {e}")
        return 2
    print(f"Migrated. Archive of everything dropped: {archive_file}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
