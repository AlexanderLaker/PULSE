"""Migration 0002 (migrations/0002_c05_rescore): the stored C-05 takes the rescored values and their baseline.

Every test builds a database of the driver schema as production holds it
after migration 0001 (the base's drivers, C-05 at its previous values with
its previous baseline, revision 2), migrates it and checks the result against
a new database, which the seed fills with the current base. The previous
description is synthetic; the real values file is checked against the driver
base at the end.

A PostgreSQL run is enabled by PRISM_TEST_POSTGRES_URL (a database the tests
may create and drop schemas in).
"""
from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import stat
import subprocess
import sys
import uuid
from pathlib import Path
from urllib.parse import quote

import pytest

from prism.config import CATEGORIES, REGIONS
from prism.database import SCHEMA_MIGRATIONS, pending_migration, schema
from prism.driver_base import load_base
from prism.drivers import SCORE_FIELDS
from prism.seed_drivers import get_seed_drivers
from support import load_module

REPO = Path(__file__).resolve().parents[1]
MIGRATION_DIR = REPO / "migrations" / "0002_c05_rescore"
VALUES = json.loads((MIGRATION_DIR / "c05.json").read_text(encoding="utf-8"))
DRIVER_ID = VALUES["driver_id"]
PREVIOUS, CURRENT = VALUES["previous"], VALUES["current"]
PREVIOUS_DESCRIPTION = "An earlier description of C-05."
ADMIN_TEXT = "Wording an admin chose."
DRIVER_COLUMNS = ("id", "force", "name", "description", "direction", "probability", "start_year", "peak_year",
                  "diffusion_curve", "gp1_pct_affected", "uncertainty", "vc_epicentre", "confidence", "baseline",
                  "scores_edited", "revision")


def sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def scores(values: dict) -> dict:
    return {name: values[name] for name in SCORE_FIELDS}


def previous_c05(**changes) -> dict:
    """C-05 as production stores it before the migration, with any field changed."""
    values = {**PREVIOUS, "id": DRIVER_ID, "description": PREVIOUS_DESCRIPTION, "baseline": scores(PREVIOUS),
              "scores_edited": False, "revision": 2}
    values.pop("description_sha256")
    values.update(changes)
    return values


def fill(conn, p: str, postgres: bool, c05: dict | None = None, migrations=("0001_driver_schema",),
         proposals: int = 1) -> None:
    """The current schema holding the base's drivers, with C-05 replaced by ``c05`` (None: the current C-05)."""
    cur = conn.cursor()
    for statement in schema(postgres):
        cur.execute(statement)
    for version in migrations:
        cur.execute(f"INSERT INTO schema_migrations (version) VALUES ({p})", (version,))
    for d in get_seed_drivers():
        row = {**{c: getattr(d, c, None) for c in DRIVER_COLUMNS}, "category_exposure": d.category_exposure,
               "regional_exposure": d.regional_exposure, "sources": d.sources, "revision": 1}
        if d.id == DRIVER_ID and c05 is not None:
            row.update(c05)
        values = [json.dumps(row["baseline"]) if c == "baseline" else row[c] for c in DRIVER_COLUMNS]
        cur.execute(f"INSERT INTO drivers ({', '.join(DRIVER_COLUMNS)}) VALUES ({', '.join([p] * len(values))})",
                    values)
        for table, column, field in (("driver_category_exposure", "category", "category_exposure"),
                                     ("driver_regional_exposure", "region", "regional_exposure")):
            for name, score in row[field].items():
                cur.execute(f"INSERT INTO {table} (driver_id, {column}, exposure_score) VALUES ({p}, {p}, {p})",
                            (d.id, name, score))
        for s in row["sources"]:
            cur.execute(f"INSERT INTO driver_sources (driver_id, title, url, tier, published) "
                        f"VALUES ({p}, {p}, {p}, {p}, {p})", (d.id, s["title"], s["url"], s["tier"], s["published"]))
    for i in range(proposals):
        cur.execute(f"INSERT INTO driver_score_proposals (driver_id, user_id, user_name, probability) "
                    f"VALUES ({p}, {p}, {p}, 3)", (DRIVER_ID, f"expert-{i}", f"Expert {i}"))
    conn.commit()


def dump(conn) -> dict:
    """The driver tables of a database without timestamps and row ids, keyed by driver."""
    cur = conn.cursor()
    out: dict = {}
    cur.execute(f"SELECT {', '.join(DRIVER_COLUMNS)} FROM drivers ORDER BY id")
    for row in cur.fetchall():
        row = dict(zip(DRIVER_COLUMNS, row))
        row["baseline"] = json.loads(row["baseline"]) if isinstance(row["baseline"], str) else row["baseline"]
        row["scores_edited"] = bool(row["scores_edited"])
        out[row["id"]] = {**row, "category_exposure": {}, "regional_exposure": {}, "sources": []}
    for table, column, field in (("driver_category_exposure", "category", "category_exposure"),
                                 ("driver_regional_exposure", "region", "regional_exposure")):
        cur.execute(f"SELECT driver_id, {column}, exposure_score FROM {table}")
        for driver_id, name, score in cur.fetchall():
            out[driver_id][field][name] = score
    cur.execute("SELECT driver_id, title, url, tier, published FROM driver_sources ORDER BY id")
    for driver_id, *source in cur.fetchall():
        out[driver_id]["sources"].append(dict(zip(("title", "url", "tier", "published"), source)))
    return out


def audit(conn) -> list:
    cur = conn.cursor()
    cur.execute("SELECT action, entity_id, old_value, new_value, reason, user_id FROM audit_log ORDER BY id")
    return [dict(zip(("action", "entity_id", "old_value", "new_value", "reason", "user_id"), r))
            for r in cur.fetchall()]


def versions(conn) -> list:
    cur = conn.cursor()
    cur.execute("SELECT version FROM schema_migrations ORDER BY version")
    return [r[0] for r in cur.fetchall()]


def without_revision(tables: dict) -> dict:
    return {k: {f: v for f, v in d.items() if f != "revision"} for k, d in tables.items()}


# ── fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def migration(monkeypatch, tmp_path):
    """The migration module, with its archive in tmp and the synthetic previous description known."""
    module = load_module("migrations/0002_c05_rescore/migrate.py", "migrate_0002")
    values = json.loads(json.dumps(VALUES))
    values["previous"]["description_sha256"].append(sha(PREVIOUS_DESCRIPTION))
    path = tmp_path / "c05.json"
    path.write_text(json.dumps(values), encoding="utf-8")
    monkeypatch.setattr(module, "VALUES_FILE", path)
    monkeypatch.setattr(module, "ARCHIVE_DIR", tmp_path / "archive")
    return module


def sqlite_database(tmp_path: Path, name: str, **options) -> Path:
    path = tmp_path / f"{name}.db"
    conn = sqlite3.connect(path)
    fill(conn, "?", False, **options)
    conn.close()
    return path


@pytest.fixture
def production(tmp_path) -> Path:
    """A SQLite database holding C-05 as production does before the migration."""
    return sqlite_database(tmp_path, "production", c05=previous_c05())


@pytest.fixture
def fresh(tmp_path) -> Path:
    """A SQLite database as a new one is seeded: the current C-05, every migration recorded."""
    return sqlite_database(tmp_path, "fresh", migrations=SCHEMA_MIGRATIONS)


def run(migration, capsys, path: Path, *args) -> tuple:
    code = migration.main(["--sqlite", str(path), *args])
    return code, capsys.readouterr().out


def report_of(out: str) -> dict:
    return json.loads(out.split("\nMigrated.")[0].split("\nDry run:")[0])


def read(path: Path, fn):
    conn = sqlite3.connect(path)
    try:
        return fn(conn)
    finally:
        conn.close()


# ── SQLite ──────────────────────────────────────────────────────────────────

class TestMigration:
    def test_the_previous_c05_becomes_the_c05_of_a_new_database(self, migration, capsys, production, fresh):
        before = read(production, dump)
        code, out = run(migration, capsys, production)
        assert code == 0, out
        after, new = read(production, dump), read(fresh, dump)
        assert without_revision(after) == without_revision(new)
        assert after[DRIVER_ID]["revision"] == 3 and after[DRIVER_ID]["scores_edited"] is False
        assert after[DRIVER_ID]["baseline"] == scores(CURRENT)
        assert {k: v for k, v in after.items() if k != DRIVER_ID} == {k: v for k, v in before.items() if k != DRIVER_ID}
        report = report_of(out)
        assert report["revision"] == {"from": 2, "to": 3} and report["proposals_kept"] == 1
        assert set(report["updated"]) == {"gp1_pct_affected", "uncertainty", "confidence", "category_exposure",
                                          "regional_exposure", "sources", "name", "description", "baseline"}
        assert report["edited_replaced"] == [] and report["edited_left_alone"] == []
        assert read(production, versions) == sorted(SCHEMA_MIGRATIONS)
        conn = sqlite3.connect(production)
        conn.row_factory = sqlite3.Row
        assert pending_migration(conn.cursor()) is None
        assert conn.execute("SELECT COUNT(*) FROM driver_score_proposals").fetchone()[0] == 1
        conn.close()

    def test_every_change_is_audited_as_an_edit_by_the_migration(self, migration, capsys, production):
        run(migration, capsys, production)
        entries = read(production, audit)
        edits = {e["reason"]: e for e in entries if e["action"] == "driver_updated"}
        assert set(edits) == {"gp1_pct_affected", "uncertainty", "confidence", "category_exposure",
                              "regional_exposure", "sources", "name", "description", "baseline"}
        assert all(e["entity_id"] == DRIVER_ID and e["user_id"] == "migration-0002" for e in edits.values())
        assert json.loads(edits["gp1_pct_affected"]["old_value"]) == PREVIOUS["gp1_pct_affected"]
        assert json.loads(edits["gp1_pct_affected"]["new_value"]) == CURRENT["gp1_pct_affected"]
        assert json.loads(edits["baseline"]["new_value"]) == scores(CURRENT)
        assert [e["entity_id"] for e in entries if e["action"] == "schema_migrated"] == ["0002_c05_rescore"]

    def test_the_archive_keeps_the_previous_c05_for_the_owner_only(self, migration, capsys, production, tmp_path):
        run(migration, capsys, production)
        [archive] = (tmp_path / "archive").glob("sqlite-production-*.json")
        assert stat.S_IMODE(archive.stat().st_mode) == 0o600
        kept = json.loads(archive.read_text(encoding="utf-8"))["driver"]
        assert kept["gp1_pct_affected"] == PREVIOUS["gp1_pct_affected"] and kept["sources"] == PREVIOUS["sources"]
        assert kept["description"] == PREVIOUS_DESCRIPTION and kept["baseline"] == scores(PREVIOUS)

    def test_a_dry_run_changes_nothing(self, migration, capsys, production, tmp_path):
        before = read(production, dump), read(production, audit)
        code, out = run(migration, capsys, production, "--dry-run")
        assert code == 0 and "Dry run: rolled back" in out and report_of(out)["revision"]["to"] == 3
        assert (read(production, dump), read(production, audit)) == before
        assert read(production, versions) == ["0001_driver_schema"] and not (tmp_path / "archive").exists()

    def test_a_second_run_changes_nothing(self, migration, capsys, production):
        run(migration, capsys, production)
        before = read(production, dump), read(production, audit)
        code, out = run(migration, capsys, production)
        assert code == 0 and "has already run" in out
        assert (read(production, dump), read(production, audit)) == before

    def test_a_new_database_needs_nothing(self, migration, capsys, fresh):
        before = read(fresh, dump)
        code, out = run(migration, capsys, fresh)
        assert code == 0 and "has already run" in out and read(fresh, dump) == before

    def test_values_entered_on_the_drivers_page_keep_and_only_the_baseline_moves(self, migration, capsys, tmp_path,
                                                                                 fresh):
        """An admin entered the new values by hand: every field is current, the baseline is the previous
        scores and the driver is marked as edited. The migration moves the baseline and clears the mark."""
        entered = {**{f: CURRENT[f] for f in migration.JUDGED_FIELDS}, "description": CURRENT["description"]}
        path = sqlite_database(tmp_path, "entered", c05=previous_c05(**entered, scores_edited=True))
        code, out = run(migration, capsys, path)
        assert code == 0, out
        report = report_of(out)
        assert report["updated"] == ["baseline", "name", "scores_edited"]
        assert without_revision(read(path, dump)) == without_revision(read(fresh, dump))
        edits = [e for e in read(path, audit) if e["action"] == "driver_updated"]
        assert [e["reason"] for e in edits] == ["baseline", "name", "scores_edited"]

    def test_an_edited_score_stops_the_migration(self, migration, capsys, tmp_path):
        path = sqlite_database(tmp_path, "edited", c05=previous_c05(
            probability=3, regional_exposure={**PREVIOUS["regional_exposure"], "Asia": 1}, scores_edited=True))
        before = read(path, dump), read(path, audit)
        code, out = run(migration, capsys, path)
        assert code == 1
        assert f"{DRIVER_ID} probability was edited: it holds 3" in out
        assert f"{DRIVER_ID} regional_exposure was edited" in out and "--replace-edited" in out
        assert (read(path, dump), read(path, audit)) == before and read(path, versions) == ["0001_driver_schema"]

    def test_replace_edited_writes_the_current_values_over_an_edit(self, migration, capsys, tmp_path, fresh):
        path = sqlite_database(tmp_path, "edited", c05=previous_c05(
            probability=3, sources=[{"title": "An admin's source", "url": "https://example.org/a", "tier": "A",
                                     "published": "2026"}], scores_edited=True))
        code, out = run(migration, capsys, path, "--replace-edited")
        assert code == 0, out
        report = report_of(out)
        assert report["edited_replaced"] == ["probability", "sources"] and "scores_edited" in report["updated"]
        assert without_revision(read(path, dump)) == without_revision(read(fresh, dump))
        [archive] = (tmp_path / "archive").glob("sqlite-edited-*.json")
        assert json.loads(archive.read_text(encoding="utf-8"))["driver"]["probability"] == 3

    def test_a_baseline_set_by_sql_counts_as_an_edit(self, migration, capsys, tmp_path):
        path = sqlite_database(tmp_path, "rebased", c05=previous_c05(baseline={**scores(PREVIOUS), "probability": 2}))
        code, out = run(migration, capsys, path)
        assert code == 1 and f"{DRIVER_ID} baseline was edited" in out

    def test_edited_texts_are_left_alone_and_reported(self, migration, capsys, tmp_path):
        path = sqlite_database(tmp_path, "texts", c05=previous_c05(name=ADMIN_TEXT, description=ADMIN_TEXT))
        code, out = run(migration, capsys, path)
        assert code == 0, out
        assert report_of(out)["edited_left_alone"] == ["name", "description"]
        c05 = read(path, dump)[DRIVER_ID]
        assert c05["name"] == ADMIN_TEXT and c05["description"] == ADMIN_TEXT
        assert c05["gp1_pct_affected"] == CURRENT["gp1_pct_affected"] and c05["baseline"] == scores(CURRENT)

    def test_a_technical_scope_already_set_by_sql_is_kept(self, migration, capsys, tmp_path):
        path = sqlite_database(tmp_path, "named", c05=previous_c05(name=CURRENT["name"]))
        code, out = run(migration, capsys, path)
        assert code == 0 and "name" in report_of(out)["already_current"]
        assert read(path, dump)[DRIVER_ID]["name"] == CURRENT["name"]

    def test_a_database_without_c05_is_refused(self, migration, capsys, production):
        conn = sqlite3.connect(production)
        for table in ("driver_category_exposure", "driver_regional_exposure", "driver_sources",
                      "driver_score_proposals", "drivers"):
            conn.execute(f"DELETE FROM {table} WHERE {'id' if table == 'drivers' else 'driver_id'} = ?", (DRIVER_ID,))
        conn.commit()
        conn.close()
        code, out = run(migration, capsys, production)
        assert code == 1 and f"holds no driver {DRIVER_ID}" in out
        assert read(production, versions) == ["0001_driver_schema"]

    def test_a_database_before_migration_0001_is_refused(self, migration, capsys, tmp_path):
        old = tmp_path / "old.db"
        sqlite3.connect(old).execute("CREATE TABLE trends (id TEXT PRIMARY KEY)").connection.close()
        code, out = run(migration, capsys, old)
        assert code == 1 and "Run migrations/0001_driver_schema/migrate.py first" in out
        unrecorded = sqlite_database(tmp_path, "unrecorded", c05=previous_c05(), migrations=())
        code, out = run(migration, capsys, unrecorded)
        assert code == 1 and "migration 0001_driver_schema recorded" in out

    def test_a_missing_file_is_refused(self, migration, capsys, tmp_path):
        code, out = run(migration, capsys, tmp_path / "absent.db")
        assert code == 1 and "no SQLite database" in out

    def test_a_failure_rolls_everything_back(self, migration, capsys, production, monkeypatch):
        before = read(production, dump), read(production, audit)

        def fail(*args, **kwargs):
            raise OSError("disk full")
        monkeypatch.setattr(migration, "write_archive", fail)
        code, out = run(migration, capsys, production)
        assert code == 2 and "rolled back" in out and "disk full" in out
        assert (read(production, dump), read(production, audit)) == before
        assert read(production, versions) == ["0001_driver_schema"]

    def test_a_run_that_waited_for_the_lock_finds_the_first_recorded(self, migration, fresh):
        db = migration.Database(str(fresh))
        db.begin()
        try:
            with pytest.raises(migration.AlreadyRun):
                migration.migrate(db)
        finally:
            db.rollback()

    def test_the_api_waits_for_the_migration(self, production):
        """Until it has run, the API and the production run refuse the database, naming this migration."""
        conn = sqlite3.connect(production)
        conn.row_factory = sqlite3.Row
        assert pending_migration(conn.cursor()) == "0002_c05_rescore"
        conn.close()

    def test_the_migrated_database_loads_as_the_api_reads_it(self, migration, capsys, production):
        run(migration, capsys, production)
        code = ("import json; import prism.database as d; d.init_db(); "
                f"c = [x for x in d.load_drivers() if x.id == {DRIVER_ID!r}][0]; "
                "print(json.dumps({'gp1': c.gp1_pct_affected, 'edited': c.scores_edited, "
                "'baseline': c.baseline == c.scores(), 'revision': c.revision}))")
        env = {**os.environ, "PRISM_DB_PATH": str(production), "POSTGRES_URL": "", "DATABASE_URL": ""}
        result = subprocess.run([sys.executable, "-c", code], cwd=REPO, env=env, capture_output=True, text=True,
                                timeout=120)
        assert result.returncode == 0, result.stderr
        assert json.loads(result.stdout) == {"gp1": CURRENT["gp1_pct_affected"], "edited": False, "baseline": True,
                                             "revision": 3}


class TestValuesFile:
    def test_current_is_c05_of_the_driver_base(self, migration):
        """The migration writes what a new database is seeded with; a later change to C-05 in the base
        retires this migration first (README.md)."""
        [entry] = [d for d in load_base() if d["id"] == DRIVER_ID]
        expected = {f: entry[f] for f in CURRENT if f != "sources"}
        expected["sources"] = [{k: s[k] for k in ("title", "url", "tier", "published")} for s in entry["sources"]]
        assert CURRENT == expected

    def test_both_values_are_complete_and_differ(self):
        fields = set(load_module("migrations/0002_c05_rescore/migrate.py", "migrate_0002_fields").JUDGED_FIELDS)
        assert fields | {"name"} <= set(PREVIOUS) and fields | {"name", "description"} <= set(CURRENT)
        assert list(PREVIOUS["category_exposure"]) == list(CATEGORIES) == list(CURRENT["category_exposure"])
        assert list(PREVIOUS["regional_exposure"]) == list(REGIONS) == list(CURRENT["regional_exposure"])
        assert scores(PREVIOUS) != scores(CURRENT)

    def test_the_current_description_was_never_a_previous_one(self):
        assert sha(CURRENT["description"]) not in PREVIOUS["description_sha256"]

    def test_migration_0001_writes_the_same_description(self):
        """A database found later on the previous schema gets the current text from migration 0001,
        then the rest of C-05 from this one."""
        descriptions = json.loads((REPO / "migrations" / "0001_driver_schema" / "descriptions.json")
                                  .read_text(encoding="utf-8"))["descriptions"]
        assert descriptions[DRIVER_ID]["text"] == CURRENT["description"]
        assert set(descriptions[DRIVER_ID]["previous_sha256"]) <= set(PREVIOUS["description_sha256"])


# ── PostgreSQL (PRISM_TEST_POSTGRES_URL) ────────────────────────────────────

POSTGRES_URL = os.environ.get("PRISM_TEST_POSTGRES_URL")


def schema_url(name: str) -> str:
    sep = "&" if "?" in POSTGRES_URL else "?"
    return f"{POSTGRES_URL}{sep}options={quote(f'-c search_path={name}')}"


@pytest.fixture
def pg_schemas():
    """Two fresh PostgreSQL schemas, (production, fresh), filled as the SQLite fixtures are."""
    import psycopg2
    tag = uuid.uuid4().hex[:8]
    names = (f"m2_production_{tag}", f"m2_fresh_{tag}")
    admin = psycopg2.connect(POSTGRES_URL)
    admin.autocommit = True
    try:
        for name in names:
            admin.cursor().execute(f"CREATE SCHEMA {name}")
        for name, options in zip(names, ({"c05": previous_c05()}, {"migrations": SCHEMA_MIGRATIONS})):
            conn = psycopg2.connect(schema_url(name))
            try:
                fill(conn, "%s", True, **options)
            finally:
                conn.close()
        yield names
    finally:
        for name in names:
            admin.cursor().execute(f"DROP SCHEMA IF EXISTS {name} CASCADE")
        admin.close()


def pg_read(name: str, fn):
    import psycopg2
    conn = psycopg2.connect(schema_url(name))
    try:
        return fn(conn)
    finally:
        conn.close()


@pytest.mark.skipif(not POSTGRES_URL, reason="PRISM_TEST_POSTGRES_URL is not set")
def test_postgres(migration, monkeypatch, capsys, pg_schemas):
    production, fresh = pg_schemas
    monkeypatch.setenv("POSTGRES_URL", schema_url(production))
    before = pg_read(production, dump)
    assert migration.main([]) == 1 and "pass --postgres" in capsys.readouterr().out
    assert migration.main(["--dry-run"]) == 0 and "Dry run: rolled back" in capsys.readouterr().out
    assert pg_read(production, dump) == before
    assert migration.main(["--postgres"]) == 0
    assert report_of(capsys.readouterr().out)["revision"] == {"from": 2, "to": 3}
    assert without_revision(pg_read(production, dump)) == without_revision(pg_read(fresh, dump))
    assert pg_read(production, versions) == sorted(SCHEMA_MIGRATIONS)
    assert pg_read(production, lambda c: pending_on_postgres(c)) is None
    assert migration.main(["--postgres"]) == 0 and "has already run" in capsys.readouterr().out


def pending_on_postgres(conn):
    """pending_migration's rule on a PostgreSQL connection (prism.database is fixed to SQLite here)."""
    cur = conn.cursor()
    cur.execute("SELECT version FROM schema_migrations")
    done = {r[0] for r in cur.fetchall()}
    return next((m for m in SCHEMA_MIGRATIONS if m not in done), None)


@pytest.mark.skipif(not POSTGRES_URL, reason="PRISM_TEST_POSTGRES_URL is not set")
def test_postgres_an_edited_score_stops_the_migration_until_replaced(migration, monkeypatch, capsys, pg_schemas,
                                                                    tmp_path):
    production, fresh = pg_schemas
    pg_read(production, lambda c: (c.cursor().execute(
        "UPDATE drivers SET probability = 3, scores_edited = TRUE WHERE id = %s", (DRIVER_ID,)), c.commit()))
    monkeypatch.setenv("POSTGRES_URL", schema_url(production))
    before = pg_read(production, dump)
    assert migration.main(["--postgres"]) == 1
    assert f"{DRIVER_ID} probability was edited" in capsys.readouterr().out
    assert pg_read(production, dump) == before and pg_read(production, versions) == ["0001_driver_schema"]
    assert migration.main(["--postgres", "--replace-edited"]) == 0
    assert report_of(capsys.readouterr().out)["edited_replaced"] == ["probability"]
    assert without_revision(pg_read(production, dump)) == without_revision(pg_read(fresh, dump))
    [archive] = (tmp_path / "archive").glob("postgres-*.json")
    assert json.loads(archive.read_text(encoding="utf-8"))["driver"]["probability"] == 3


@pytest.mark.skipif(not POSTGRES_URL, reason="PRISM_TEST_POSTGRES_URL is not set")
def test_postgres_a_busy_driver_table_times_out_instead_of_waiting(migration, monkeypatch, capsys, pg_schemas):
    """A write that holds a driver table makes the migration give up after the lock timeout rather
    than wait, and leaves the database unchanged."""
    import psycopg2
    production, _ = pg_schemas
    monkeypatch.setattr(migration, "LOCK_TIMEOUT", "1s")
    monkeypatch.setenv("POSTGRES_URL", schema_url(production))
    writer = psycopg2.connect(schema_url(production))
    try:
        writer.cursor().execute("UPDATE drivers SET revision = revision WHERE id = %s", (DRIVER_ID,))
        assert migration.main(["--postgres"]) == 2
        assert "lock timeout" in capsys.readouterr().out.lower()
    finally:
        writer.rollback()
        writer.close()
    assert pg_read(production, versions) == ["0001_driver_schema"]
