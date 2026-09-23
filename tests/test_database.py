"""Persistence: schema, drivers, proposals, runs, journey, audit.

The tests run on SQLite. With PRISM_TEST_POSTGRES_URL set, the last test runs
this whole module again in a fresh interpreter against an empty PostgreSQL
schema (prism.database fixes its backend when it is imported), so the SQL is
checked on both backends.
"""
import copy
import json
import os
import subprocess
import sys
import uuid
from pathlib import Path
from urllib.parse import quote

import pytest

from prism.config import CATEGORIES, REGIONS, beta_prior_for
from prism.drivers import Driver
from support import database_awaiting_a_migration

REPO = Path(__file__).resolve().parents[1]
POSTGRES_URL = os.environ.get("PRISM_TEST_POSTGRES_URL")
#: Set for the interpreter that re-runs this module on PostgreSQL.
ON_POSTGRES = os.environ.get("PRISM_TEST_DATABASE_ON_POSTGRES") == "1"


def _driver(driver_id="consumer_r01", **overrides) -> Driver:
    fields = dict(
        id=driver_id, force="Consumer", name="original name", description="original description",
        direction="Contraction", probability=3, gp1_pct_affected=0.10, start_year=2025, peak_year=2030,
        diffusion_curve="linear", confidence="Medium", uncertainty=2, analysis="the reading",
        category_exposure={c: 1 for c in CATEGORIES}, regional_exposure={r: 1 for r in REGIONS},
        vc_epicentre="Supply Chain",
        sources=[{"title": "original source", "url": "https://example.org/a", "tier": "A", "published": "Apr 2026"}],
    )
    fields.update(overrides)
    return Driver(**fields)


@pytest.fixture
def db(monkeypatch, tmp_path):
    """A fresh database holding one driver with two expert proposals."""
    import prism.database as dbm
    assert dbm.USE_POSTGRES == ON_POSTGRES
    if dbm.USE_POSTGRES:
        with dbm.get_db_connection() as conn:
            cursor = conn.cursor()
            for table in dbm.table_names(cursor):
                cursor.execute(f"DROP TABLE {table} CASCADE")
    else:
        monkeypatch.setenv("PRISM_DB_PATH", str(tmp_path / "prism.db"))
    dbm.init_db()
    d = _driver()
    d.baseline = d.scores()
    dbm.insert_drivers([d])
    dbm.upsert_driver_proposal("consumer_r01", "expert-a", {"probability": 2, "uncertainty": 4, "comment": "keep me"},
                               "Expert A")
    dbm.upsert_driver_proposal("consumer_r01", "expert-b", {"gp1_pct_affected": 0.30}, "Expert B")
    return dbm


def _values(row) -> tuple:
    """A row's values in column order (PostgreSQL rows arrive as dicts)."""
    return tuple(row.values()) if isinstance(row, dict) else tuple(row)


def _count(dbm, sql: str) -> int:
    with dbm.get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql)
        return _values(cursor.fetchone())[0]


class TestSchema:
    def test_init_is_idempotent_and_records_the_schema_version(self, db):
        db.init_db()
        db.init_db()
        assert _count(db, "SELECT COUNT(*) FROM schema_migrations WHERE version = '0001_driver_schema'") == 1
        with db.get_db_connection() as conn:
            tables = db.table_names(conn.cursor())
        assert {"drivers", "driver_category_exposure", "driver_regional_exposure",
                "driver_sources", "driver_score_proposals", "journey_content", "simulation_runs", "audit_log",
                "schema_migrations"} <= tables

    def test_instances_starting_on_a_new_database_at_once(self, db, monkeypatch, tmp_path):
        """Four instances creating the schema at the same moment all succeed; on PostgreSQL the
        catalogue refuses all but one of them unless they take turns."""
        import threading
        if db.USE_POSTGRES:
            with db.get_db_connection() as conn:
                cursor = conn.cursor()
                for table in db.table_names(cursor):
                    cursor.execute(f"DROP TABLE {table} CASCADE")
        else:
            monkeypatch.setenv("PRISM_DB_PATH", str(tmp_path / "new.db"))
        errors = []

        def start():
            try:
                db.init_db()
            except Exception as e:   # noqa: BLE001 (collected for the assertion)
                errors.append(e)
        threads = [threading.Thread(target=start) for _ in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(30)
        assert errors == []
        assert _count(db, "SELECT COUNT(*) FROM schema_migrations") == len(db.SCHEMA_MIGRATIONS)

    @pytest.mark.skipif(ON_POSTGRES, reason="builds a SQLite file")
    def test_a_database_awaiting_a_migration_is_refused(self, monkeypatch, tmp_path):
        import prism.database as dbm
        path = tmp_path / "awaiting.db"
        database_awaiting_a_migration(path)
        monkeypatch.setenv("PRISM_DB_PATH", str(path))
        with pytest.raises(dbm.MigrationPendingError, match="migrations/0001_driver_schema"):
            dbm.init_db()


class TestDrivers:
    def test_round_trip(self, db):
        loaded = db.load_drivers()[0]
        expected = _driver()
        for field in ("id", "force", "name", "description", "direction", "probability", "gp1_pct_affected",
                      "start_year", "peak_year", "diffusion_curve", "confidence", "uncertainty", "analysis",
                      "category_exposure", "regional_exposure", "vc_epicentre", "sources"):
            assert getattr(loaded, field) == getattr(expected, field), field
        assert loaded.baseline == expected.scores()
        assert loaded.scores_edited is False and loaded.revision == 1
        assert loaded.expected_effect == pytest.approx(expected.expected_effect)

    def test_a_gp1_share_is_stored_at_full_precision(self, db):
        """The engine multiplies by the share, so the database must return the value entered, not the
        nearest four-byte float (PostgreSQL's REAL)."""
        edit = copy.deepcopy(db.load_drivers()[0])
        edit.gp1_pct_affected = 0.123456789
        db.save_driver_edit(edit, edit.revision, {"gp1_pct_affected"})
        assert db.load_drivers()[0].gp1_pct_affected == 0.123456789
        proposal = db.upsert_driver_proposal("consumer_r01", "expert-c", {"gp1_pct_affected": 0.987654321}, "C")
        assert proposal["gp1_pct_affected"] == 0.987654321

    def test_the_drivers_are_read_from_one_snapshot(self, db, monkeypatch):
        """An edit committed while the drivers are read is seen whole or not at all: here another
        connection raises the probability and clears the exposures between the reads."""
        import sqlite3
        import threading
        connect = db._connect

        def concurrent_edit():
            other = (psycopg2_connect() if db.USE_POSTGRES else sqlite3.connect(str(db.sqlite_path()), timeout=0.2))
            try:
                cursor = other.cursor()
                cursor.execute("UPDATE drivers SET probability = 5, revision = revision + 1")
                cursor.execute("UPDATE driver_category_exposure SET exposure_score = 0")
                other.commit()
            except Exception:   # noqa: BLE001 (SQLite: the open read keeps the writer out until it ends)
                other.rollback()
            finally:
                other.close()

        def psycopg2_connect():
            import psycopg2
            return psycopg2.connect(db.POSTGRES_URL)

        class Cursor:
            def __init__(self, cursor):
                self._cursor = cursor

            def execute(self, sql, params=()):
                if "FROM driver_category_exposure" in sql:   # the driver rows have been read
                    writer = threading.Thread(target=concurrent_edit)
                    writer.start()
                    writer.join(10)
                return self._cursor.execute(sql, params)

            def __getattr__(self, name):
                return getattr(self._cursor, name)

        class Connection:
            def __init__(self, conn):
                self._conn = conn

            def cursor(self, *args, **kwargs):
                return Cursor(self._conn.cursor(*args, **kwargs))

            def __getattr__(self, name):
                return getattr(self._conn, name)

        monkeypatch.setattr(db, "_connect", lambda: Connection(connect()))
        [read] = db.load_drivers()
        assert (read.probability, sum(read.category_exposure.values())) == (3, len(CATEGORIES))

    def test_drivers_come_back_ordered_by_id(self, db):
        others = [_driver("technology_r01", force="Technology"), _driver("competitive_r15", force="Competitive")]
        for d in others:
            d.baseline = d.scores()
        db.insert_drivers(others)
        assert [d.id for d in db.load_drivers()] == ["competitive_r15", "consumer_r01", "technology_r01"]

    def test_an_edit_saves_every_field_it_changes(self, db):
        edited = _driver(description="edited description", direction="Expansion", probability=5,
                         gp1_pct_affected=0.42, peak_year=2033, diffusion_curve="front_loaded", confidence="High",
                         uncertainty=5, scores_edited=True,
                         category_exposure={c: (5 if c == "Hair: Care" else 0) for c in CATEGORIES},
                         sources=[{"title": "new source", "url": "https://example.org/b", "tier": "S",
                                   "published": ""}])
        edited.baseline = _driver().scores()
        db.save_driver_edit(edited, db.load_drivers()[0].revision, db.EDITABLE_FIELDS - {"regional_exposure"})
        loaded = db.load_drivers()[0]
        assert (loaded.description, loaded.direction, loaded.probability, loaded.peak_year) == (
            "edited description", "Expansion", 5, 2033)
        assert loaded.scores_edited is True and loaded.uncertainty == 5
        assert loaded.probability_prior == pytest.approx(beta_prior_for(5, 5))   # rebuilt from the stored scores
        assert loaded.category_exposure["Hair: Care"] == 5 and loaded.category_exposure["LHC: FCN"] == 0
        assert loaded.sources == [{"title": "new source", "url": "https://example.org/b", "tier": "S", "published": ""}]
        assert loaded.baseline == _driver().scores()

    def test_an_edit_leaves_the_fields_it_does_not_change_as_stored(self, db):
        """A copy of the driver loaded before a correction made directly in the database (a start year,
        a force) must not write the old values back with an unrelated edit."""
        loaded = db.load_drivers()[0]
        with db.get_db_connection() as conn:
            conn.cursor().execute("UPDATE drivers SET start_year = start_year + 1, name = 'corrected'")
        edit = copy.deepcopy(loaded)
        edit.description = "a new description"
        db.save_driver_edit(edit, loaded.revision, {"description"})
        after = db.load_drivers()[0]
        assert (after.start_year, after.name) == (loaded.start_year + 1, "corrected")
        assert after.description == "a new description" and after.revision == loaded.revision + 1
        with pytest.raises(ValueError, match="not editable: \\['name', 'start_year'\\]"):
            db.save_driver_edit(edit, after.revision, {"description", "name", "start_year"})

    def test_an_edit_keeps_the_expert_proposals(self, db):
        """An edit updates the row in place; proposals reference it with ON DELETE CASCADE."""
        for probability in (1, 4, 5):
            edit = _driver(probability=probability)
            edit.baseline = edit.scores()
            db.save_driver_edit(edit, db.load_drivers()[0].revision, {"probability"})
        rows = {r["user_id"]: r for r in db.load_driver_proposals("consumer_r01")}
        assert set(rows) == {"expert-a", "expert-b"}
        assert rows["expert-a"]["comment"] == "keep me" and rows["expert-a"]["uncertainty"] == 4

    def test_created_at_survives_and_updated_at_moves(self, db):
        with db.get_db_connection() as conn:
            conn.cursor().execute("UPDATE drivers SET created_at = '2020-01-01 00:00:00', "
                                  "updated_at = '2020-01-01 00:00:00'")
        before = db.drivers_stamp()
        edit = _driver(probability=4)
        edit.baseline = edit.scores()
        db.save_driver_edit(edit, db.load_drivers()[0].revision, {"probability"})
        with db.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT created_at, updated_at FROM drivers")
            created, updated = _values(cursor.fetchone())
        assert str(created).startswith("2020-01-01") and not str(updated).startswith("2020-01-01")
        assert db.drivers_stamp() != before

    def test_every_save_moves_the_stamp(self, db):
        """The API reloads its drivers when the stamp moves; saves in the same second must move it too."""
        stamps = [db.drivers_stamp()]
        for probability in (4, 5, 4):
            edit = _driver(probability=probability)
            edit.baseline = edit.scores()
            db.save_driver_edit(edit, db.load_drivers()[0].revision, {"probability"})
            stamps.append(db.drivers_stamp())
        assert len(set(stamps)) == 4 and stamps[-1] == (1, 4)

    def test_an_admin_edit_lands_only_on_the_revision_it_was_made_on(self, db):
        """Two edits from the same loaded state: the first lands, the second is refused and changes nothing."""
        loaded = db.load_drivers()[0]
        first, second = _driver(probability=5, baseline=loaded.baseline), _driver(probability=1, name="stale edit",
                                                                                  baseline=loaded.baseline)
        assert db.save_driver_edit(first, loaded.revision, {"probability"}) == loaded.revision + 1
        with pytest.raises(db.StaleRevisionError) as refused:
            db.save_driver_edit(second, loaded.revision, {"probability", "description"})
        assert (refused.value.expected, refused.value.current) == (loaded.revision, loaded.revision + 1)
        now = db.load_drivers()[0]
        assert (now.probability, now.name, now.revision) == (5, "original name", loaded.revision + 1)
        assert len(db.load_driver_proposals("consumer_r01")) == 2

    def test_an_admin_edit_rewrites_the_exposures_and_sources(self, db):
        loaded = db.load_drivers()[0]
        edit = _driver(category_exposure={c: (4 if c == "Hair: Care" else 0) for c in CATEGORIES}, sources=[],
                       baseline=loaded.baseline)
        db.save_driver_edit(edit, loaded.revision, {"category_exposure", "sources"})
        assert _count(db, "SELECT SUM(exposure_score) FROM driver_category_exposure") == 4
        assert _count(db, "SELECT COUNT(*) FROM driver_sources") == 0

    def test_a_driver_the_engine_could_not_simulate_is_not_stored(self, db):
        """Every stored driver scores every category and every region: the schema's constraints cannot say
        that, so the writes check it and store nothing when it fails."""
        incomplete = _driver("technology_r01", force="Technology",
                             regional_exposure={r: 1 for r in REGIONS if r != "Asia"})
        incomplete.baseline = incomplete.scores()
        with pytest.raises(db.InvalidDriversError, match="regional_exposure has no score for Asia"):
            db.insert_drivers([_driver("competitive_r15", force="Competitive", baseline={}), incomplete])
        assert [d.id for d in db.load_drivers()] == ["consumer_r01"]

        loaded = db.load_drivers()[0]
        edit = _driver(category_exposure={"Hair: Care": 5}, baseline=loaded.baseline)
        with pytest.raises(db.InvalidDriversError, match="category_exposure has no score for"):
            db.save_driver_edit(edit, loaded.revision, {"category_exposure"})
        after = db.load_drivers()[0]
        assert after.revision == loaded.revision and after.category_exposure == loaded.category_exposure

    def test_an_edit_of_a_missing_driver_is_refused(self, db):
        with pytest.raises(db.StaleRevisionError) as refused:
            db.save_driver_edit(_driver("technology_r99", force="Technology", baseline={}), 1, {"probability"})
        assert refused.value.current is None

    def test_deleting_a_driver_removes_its_proposals(self, db):
        with db.get_db_connection() as conn:
            conn.cursor().execute("DELETE FROM drivers WHERE id = 'consumer_r01'")
        assert db.load_driver_proposals("consumer_r01") == []

    @pytest.mark.parametrize("statement", [
        "UPDATE drivers SET gp1_pct_affected = NULL",
        "UPDATE drivers SET gp1_pct_affected = 0",
        "UPDATE drivers SET probability = 6",
        "UPDATE drivers SET uncertainty = NULL",
        "UPDATE drivers SET start_year = NULL",
        "UPDATE drivers SET force = 'Regulatory'",
        "UPDATE drivers SET diffusion_curve = 'jump'",
        "UPDATE drivers SET vc_epicentre = NULL",
        "UPDATE drivers SET confidence = 'Certain'",
        "UPDATE drivers SET baseline = NULL",
        "UPDATE driver_category_exposure SET exposure_score = 6",
        "UPDATE driver_regional_exposure SET region = 'Europa'",
        "UPDATE driver_sources SET tier = 'Z'",
        "UPDATE driver_score_proposals SET gp1_pct_affected = 0",
        "UPDATE driver_score_proposals SET vc_epicentre = 'Retail'",
    ])
    def test_the_database_refuses_a_driver_the_engine_could_not_simulate(self, db, statement):
        """Every score of a stored driver is present and on its scale; a proposal's scores may be empty but
        never off their scale."""
        with pytest.raises(Exception, match="(?i)constraint|null|check"):
            with db.get_db_connection() as conn:
                conn.cursor().execute(statement)
        assert db.load_drivers()[0].gp1_pct_affected == pytest.approx(0.10)


class TestProposals:
    def test_a_partial_proposal_merges(self, db):
        merged = db.upsert_driver_proposal("consumer_r01", "expert-a", {"peak_year": 2031}, "Expert A")
        assert (merged["probability"], merged["uncertainty"], merged["peak_year"]) == (2, 4, 2031)
        merged = db.upsert_driver_proposal("consumer_r01", "expert-a", {"vc_epicentre": "Marketing"}, "Expert A")
        assert (merged["peak_year"], merged["vc_epicentre"]) == (2031, "Marketing")
        row = next(r for r in db.load_driver_proposals("consumer_r01") if r["user_id"] == "expert-a")
        assert row["vc_epicentre"] == "Marketing" and row["comment"] == "keep me"

    def test_a_field_can_be_cleared(self, db):
        merged = db.upsert_driver_proposal("consumer_r01", "expert-a", {"probability": None}, "Expert A")
        assert merged["probability"] is None and merged["uncertainty"] == 4

    def test_maps_round_trip_and_can_be_cleared(self, db):
        db.upsert_driver_proposal("consumer_r01", "expert-c", {"category_exposure": {"Hair: Care": 4}}, "C")
        assert db.load_driver_proposals("consumer_r01")[-1]["category_exposure"] == {"Hair: Care": 4}
        db.upsert_driver_proposal("consumer_r01", "expert-c", {"category_exposure": None}, "C")
        row = next(r for r in db.load_driver_proposals("consumer_r01") if r["user_id"] == "expert-c")
        assert row["category_exposure"] is None

    def test_all_proposals_are_grouped_by_driver(self, db):
        grouped = db.load_all_driver_proposals()
        assert list(grouped) == ["consumer_r01"] and len(grouped["consumer_r01"]) == 2


class TestRunsJourneyAudit:
    def test_the_latest_run_wins(self, db):
        assert db.load_latest_run() is None and db.latest_run_summary() is None
        first = db.save_simulation_run(1000, {"meta": {"n": 1}})
        second = db.save_simulation_run(2000, {"meta": {"n": 2}})
        assert second > first
        latest = db.load_latest_run()
        assert latest["id"] == second and latest["iterations"] == 2000 and latest["results"] == {"meta": {"n": 2}}
        assert db.latest_run_summary()["id"] == second

    def test_numpy_values_are_stored_as_plain_json(self, db):
        np = pytest.importorskip("numpy")
        run_id = db.save_simulation_run(10, {"x": np.float64(0.5), "flag": np.bool_(True), "a": np.arange(3)})
        assert db.load_latest_run()["results"] == {"x": 0.5, "flag": True, "a": [0, 1, 2]}
        assert run_id == db.latest_run_summary()["id"]

    def test_journey_content_is_versioned(self, db):
        assert db.load_journey_content() == {"version": 0, "content": None}
        v1 = db.save_journey_content({"lhc": [], "hair": [], "v": 1}, "a@example.com", base_version=0)
        v2 = db.save_journey_content({"lhc": [], "hair": [], "v": 2}, "b@example.com", base_version=v1)
        assert v2 > v1 and db.load_journey_content() == {"version": v2, "content": {"lhc": [], "hair": [], "v": 2}}
        assert _count(db, "SELECT COUNT(*) FROM journey_content") == 2

    def test_a_journey_save_from_an_older_version_is_refused(self, db):
        v1 = db.save_journey_content({"lhc": [], "hair": [], "v": 1}, "a@example.com", base_version=0)
        with pytest.raises(db.StaleVersionError) as refused:
            db.save_journey_content({"lhc": [], "hair": [], "v": "stale"}, "b@example.com", base_version=0)
        assert (refused.value.expected, refused.value.current) == (0, v1)
        assert db.load_journey_content()["content"]["v"] == 1

    def test_an_edit_and_its_audit_entries_are_stored_together(self, db):
        """The audit entries go into the edit's transaction: stored with it, and never without it."""
        entry = db.AuditEntry("driver_updated", "driver", "consumer_r01", "admin-1", old_value="3", new_value="5",
                              reason="probability")
        loaded = db.load_drivers()[0]
        db.save_driver_edit(_driver(probability=5, baseline=loaded.baseline), loaded.revision, {"probability"}, [entry])
        with db.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT action, entity_id, old_value, new_value, reason, user_id FROM audit_log")
            assert [_values(r) for r in cursor.fetchall()] == [
                ("driver_updated", "consumer_r01", "3", "5", "probability", "admin-1")]
        with pytest.raises(db.StaleRevisionError):
            db.save_driver_edit(_driver(probability=1, baseline=loaded.baseline), loaded.revision, {"probability"},
                                [entry])
        assert _count(db, "SELECT COUNT(*) FROM audit_log") == 1

    def test_an_edit_whose_audit_entry_fails_is_not_stored(self, db, monkeypatch):
        """The other half of the rule: no edit without its audit entry."""
        loaded = db.load_drivers()[0]

        def failing(cursor, entries):
            raise RuntimeError("audit write failed")
        monkeypatch.setattr(db, "insert_audit", failing)
        entry = db.AuditEntry("driver_updated", "driver", "consumer_r01", "admin-1", reason="probability")
        with pytest.raises(RuntimeError, match="audit write failed"):
            db.save_driver_edit(_driver(probability=5, baseline=loaded.baseline), loaded.revision, {"probability"},
                                [entry])
        after = db.load_drivers()[0]
        assert (after.probability, after.revision) == (loaded.probability, loaded.revision)
        assert _count(db, "SELECT COUNT(*) FROM audit_log") == 0

    def test_a_journey_save_and_its_audit_entry_are_stored_together(self, db):
        def audit(version):
            return db.AuditEntry("journey_content_updated", "journey", "default", "admin-1",
                                 new_value=f"version {version}")
        v1 = db.save_journey_content({"lhc": [], "hair": []}, "a@example.com", base_version=0, audit=audit)
        with pytest.raises(db.StaleVersionError):
            db.save_journey_content({"lhc": [], "hair": []}, "b@example.com", base_version=0, audit=audit)
        with db.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT action, new_value, user_id FROM audit_log")
            assert [_values(r) for r in cursor.fetchall()] == [("journey_content_updated", f"version {v1}", "admin-1")]

    def test_diagnostics_never_raise(self, db, monkeypatch):
        diag = db.diagnose_connection()
        assert diag["db_reachable"] is True and diag["error"] is None
        assert set(diag) == {"db_reachable", "simulation_run_count", "latest_run_id", "error", "reason"}
        monkeypatch.setattr(db, "_connect", lambda: (_ for _ in ()).throw(RuntimeError("no route")))
        monkeypatch.setattr(db.time, "sleep", lambda s: None)
        broken = db.diagnose_connection()
        assert broken["db_reachable"] is False and broken["error"] == "database error (RuntimeError)"
        assert broken["reason"] == "db_error" and json.dumps(broken)

    @pytest.mark.parametrize("message, words", [
        ('FATAL: password authentication failed for user "owner"', "the database refused the credentials"),
        ('invalid percent-encoded token: "s3cr%t"', "the database URL is malformed"),
        ('could not translate host name "ep-secret.neon.tech" to address', "the database host name does not resolve"),
        ("connection timed out", "the database did not answer in time"),
    ])
    def test_errors_are_described_without_credentials(self, db, monkeypatch, caplog, message, words):
        """Not in the answer, not in the log, not in the error the API turns into a 503."""
        monkeypatch.setattr(db, "_connect", lambda: (_ for _ in ()).throw(RuntimeError(message)))
        monkeypatch.setattr(db.time, "sleep", lambda s: None)
        error = db.diagnose_connection()["error"]
        assert error.startswith(words)
        with pytest.raises(db.DatabaseUnavailableError) as refused:
            db.load_drivers()
        assert words in str(refused.value) and "attempt 2 failed" in caplog.text
        for text in (error, str(refused.value), caplog.text):
            assert not any(secret in text for secret in ("owner", "s3cr", "ep-secret")), text

    @pytest.mark.skipif(ON_POSTGRES, reason="the refusal concerns the SQLite fallback")
    def test_on_vercel_without_a_database_url_nothing_falls_back_to_sqlite(self, db, monkeypatch):
        monkeypatch.setenv("VERCEL", "1")
        with pytest.raises(db.DatabaseNotConfiguredError):
            db.load_drivers()
        diag = db.diagnose_connection()
        assert diag["reason"] == "no_database" and diag["error"] == "no database URL is set for this deployment"


@pytest.mark.skipif(not POSTGRES_URL or ON_POSTGRES, reason="PRISM_TEST_POSTGRES_URL is not set")
def test_the_same_tests_pass_on_postgres():
    """This module again, in a fresh interpreter, against an empty PostgreSQL schema."""
    import psycopg2
    schema = f"db_{uuid.uuid4().hex[:8]}"
    admin = psycopg2.connect(POSTGRES_URL)
    admin.autocommit = True
    admin.cursor().execute(f"CREATE SCHEMA {schema}")
    try:
        sep = "&" if "?" in POSTGRES_URL else "?"
        env = {**os.environ, "POSTGRES_URL": f"{POSTGRES_URL}{sep}options={quote(f'-c search_path={schema}')}",
               "DATABASE_URL": "", "PRISM_TEST_ALLOW_POSTGRES": "1", "PRISM_TEST_DATABASE_ON_POSTGRES": "1"}
        result = subprocess.run([sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", __file__],
                                cwd=REPO, env=env, capture_output=True, text=True, timeout=300)
        assert result.returncode == 0, result.stdout[-4000:] + result.stderr[-2000:]
        assert " passed" in result.stdout and " failed" not in result.stdout
    finally:
        admin.cursor().execute(f"DROP SCHEMA {schema} CASCADE")
        admin.close()
