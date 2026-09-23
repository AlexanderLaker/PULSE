"""Persistence: schema, drivers, proposals, runs, journey, audit.

The tests run on SQLite. With PRISM_TEST_POSTGRES_URL set, the last test runs
this whole module again in a fresh interpreter against an empty PostgreSQL
schema (prism.database fixes its backend when it is imported), so the SQL is
checked on both backends.
"""
import json
import os
import subprocess
import sys
import uuid
from pathlib import Path
from urllib.parse import quote

import pytest

from prism.config import CATEGORIES, REGIONS, VC_STEPS
from prism.drivers import Driver

REPO = Path(__file__).resolve().parents[1]
POSTGRES_URL = os.environ.get("PRISM_TEST_POSTGRES_URL")
#: Set for the interpreter that re-runs this module on PostgreSQL.
ON_POSTGRES = os.environ.get("PRISM_TEST_DATABASE_ON_POSTGRES") == "1"


def _driver(driver_id="consumer_r01", **overrides) -> Driver:
    fields = dict(
        id=driver_id, force="Consumer", name="original name", description="original description",
        direction="Contraction", probability=3, gp1_pct_affected=0.10, start_year=2025, peak_year=2030,
        diffusion_curve="linear", confidence="Medium", uncertainty=2, analysis="the reading",
        data_source="Circana (Apr 2026)",
        category_exposure={c: 1 for c in CATEGORIES}, regional_exposure={r: 1 for r in REGIONS},
        vc_exposure={v: 1 for v in VC_STEPS},
        sources=[{"title": "original source", "url": "https://example.org/a", "tier": "A", "note": "Apr 2026"}],
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
    dbm.save_drivers([d])
    dbm.upsert_driver_proposal("consumer_r01", "expert-a", {"probability": 2, "uncertainty": 4, "comment": "keep me"},
                               "Expert A", "viewer")
    dbm.upsert_driver_proposal("consumer_r01", "expert-b", {"gp1_pct_affected": 0.30}, "Expert B", "viewer")
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
        assert {"drivers", "driver_category_exposure", "driver_vc_exposure", "driver_regional_exposure",
                "driver_sources", "driver_score_proposals", "journey_content", "simulation_runs", "audit_log",
                "schema_migrations"} <= tables

    @pytest.mark.skipif(ON_POSTGRES, reason="builds a SQLite file")
    def test_a_database_of_the_previous_schema_is_refused(self, monkeypatch, tmp_path):
        import sqlite3
        import prism.database as dbm
        path = tmp_path / "legacy.db"
        sqlite3.connect(path).execute("CREATE TABLE trends (id TEXT PRIMARY KEY)").connection.close()
        monkeypatch.setenv("PRISM_DB_PATH", str(path))
        with pytest.raises(dbm.LegacySchemaError, match="migrations/0001_driver_schema"):
            dbm.init_db()


class TestDrivers:
    def test_round_trip(self, db):
        loaded = db.load_drivers()[0]
        expected = _driver()
        for field in ("id", "force", "name", "description", "direction", "probability", "gp1_pct_affected",
                      "start_year", "peak_year", "diffusion_curve", "confidence", "uncertainty", "analysis",
                      "data_source", "category_exposure", "regional_exposure", "vc_exposure", "sources"):
            assert getattr(loaded, field) == getattr(expected, field), field
        assert loaded.baseline == expected.scores()
        assert loaded.scores_edited is False
        assert loaded.normalized_score == pytest.approx(expected.normalized_score)

    def test_drivers_come_back_ordered_by_id(self, db):
        db.save_drivers([_driver("technology_r01", force="Technology"), _driver("competitive_r15", force="Competitive")])
        assert [d.id for d in db.load_drivers()] == ["competitive_r15", "consumer_r01", "technology_r01"]

    def test_an_edit_is_saved_in_full(self, db):
        edited = _driver(name="edited name", description="edited description", direction="Expansion",
                         probability=5, gp1_pct_affected=0.42, start_year=2027, peak_year=2033,
                         diffusion_curve="front_loaded", confidence="High", uncertainty=5, scores_edited=True,
                         category_exposure={c: (5 if c == "Hair: Care" else 0) for c in CATEGORIES},
                         sources=[{"title": "new source", "url": "https://example.org/b", "tier": "S", "note": ""}])
        db.save_drivers([edited])
        loaded = db.load_drivers()[0]
        assert (loaded.name, loaded.direction, loaded.probability, loaded.peak_year) == ("edited name", "Expansion", 5, 2033)
        assert loaded.scores_edited is True and loaded.uncertainty == 5
        assert loaded.category_exposure["Hair: Care"] == 5
        assert loaded.sources == [{"title": "new source", "url": "https://example.org/b", "tier": "S", "note": ""}]

    def test_an_edit_keeps_the_expert_proposals(self, db):
        """The row is upserted, never deleted: proposals reference it with ON DELETE CASCADE."""
        for probability in (1, 4, 5):
            db.save_drivers([_driver(probability=probability)])
        rows = {r["user_id"]: r for r in db.load_driver_proposals("consumer_r01")}
        assert set(rows) == {"expert-a", "expert-b"}
        assert rows["expert-a"]["comment"] == "keep me" and rows["expert-a"]["uncertainty"] == 4

    def test_exposures_and_sources_are_replaced(self, db):
        db.save_drivers([_driver(category_exposure={"Hair: Care": 5}, regional_exposure={"Europe": 5},
                                 vc_exposure={VC_STEPS[0]: 5}, sources=[])])
        for table, n in (("driver_category_exposure", 1), ("driver_regional_exposure", 1),
                         ("driver_vc_exposure", 1), ("driver_sources", 0)):
            assert _count(db, f"SELECT COUNT(*) FROM {table}") == n, table

    def test_created_at_survives_and_updated_at_moves(self, db):
        with db.get_db_connection() as conn:
            conn.cursor().execute("UPDATE drivers SET created_at = '2020-01-01 00:00:00', "
                                  "updated_at = '2020-01-01 00:00:00'")
        before = db.drivers_stamp()
        db.save_drivers([_driver(probability=4)])
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
            db.save_drivers([_driver(probability=probability)])
            stamps.append(db.drivers_stamp())
        assert len(set(stamps)) == 4 and stamps[-1] == (1, 4)

    def test_deleting_a_driver_removes_its_proposals(self, db):
        with db.get_db_connection() as conn:
            conn.cursor().execute("DELETE FROM drivers WHERE id = 'consumer_r01'")
        assert db.load_driver_proposals("consumer_r01") == []

    def test_a_missing_gp1_share_stays_missing(self, db):
        """The engine refuses a driver without a GP1 share; the database never invents one."""
        with db.get_db_connection() as conn:
            conn.cursor().execute("UPDATE drivers SET gp1_pct_affected = NULL")
        assert db.load_drivers()[0].gp1_pct_affected is None


class TestProposals:
    def test_a_partial_proposal_merges(self, db):
        merged = db.upsert_driver_proposal("consumer_r01", "expert-a", {"peak_year": 2031}, "Expert A", "viewer")
        assert (merged["probability"], merged["uncertainty"], merged["peak_year"]) == (2, 4, 2031)

    def test_maps_round_trip_and_can_be_cleared(self, db):
        db.upsert_driver_proposal("consumer_r01", "expert-c", {"category_exposure": {"Hair: Care": 4}}, "C", "viewer")
        assert db.load_driver_proposals("consumer_r01")[-1]["category_exposure"] == {"Hair: Care": 4}
        db.upsert_driver_proposal("consumer_r01", "expert-c", {"category_exposure": None}, "C", "viewer")
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
        assert db.load_journey_content() is None
        db.save_journey_content({"lhc": [], "hair": [], "v": 1}, updated_by="a@example.com")
        db.save_journey_content({"lhc": [], "hair": [], "v": 2}, updated_by="b@example.com")
        assert db.load_journey_content()["v"] == 2
        assert _count(db, "SELECT COUNT(*) FROM journey_content") == 2

    def test_audit_entries_are_appended(self, db):
        db.log_audit("driver_updated", "driver", "consumer_r01", old_value="3", new_value="4",
                     reason="probability", user_id="admin-1")
        with db.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT action, entity_id, old_value, new_value, reason, user_id FROM audit_log")
            assert _values(cursor.fetchone()) == ("driver_updated", "consumer_r01", "3", "4", "probability", "admin-1")

    def test_diagnostics_never_raise(self, db, monkeypatch):
        diag = db.diagnose_connection()
        assert diag["db_reachable"] is True and diag["error"] is None
        assert diag["db_mode"] == ("postgres" if db.USE_POSTGRES else "sqlite")
        monkeypatch.setattr(db, "_connect", lambda: (_ for _ in ()).throw(RuntimeError("no route")))
        monkeypatch.setattr(db.time, "sleep", lambda s: None)
        broken = db.diagnose_connection()
        assert broken["db_reachable"] is False and "no route" in broken["error"]
        assert json.dumps(broken)


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
