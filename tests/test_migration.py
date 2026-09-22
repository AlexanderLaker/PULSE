"""Migration 0001 (migrations/0001_driver_schema): a database of the previous schema moves onto the driver schema.

The previous schema is frozen below as the previous code created it, plus the
leftovers an older database can still hold. Every test builds such a database,
migrates it and checks the result against what a new database looks like.
The content edits run on small synthetic edit files; the real edit files are
checked against the shipped content at the end.

A PostgreSQL run of the same checks is enabled by PRISM_TEST_POSTGRES_URL (a
database the tests may create and drop schemas in).
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import re
import sqlite3
import subprocess
import sys
import uuid
from pathlib import Path
from urllib.parse import quote

import pytest

from prism.seed_drivers import DRIVERS

REPO = Path(__file__).resolve().parents[1]
MIGRATION_DIR = REPO / "migrations" / "0001_driver_schema"
SEED = {d.id: d for d in DRIVERS}
PREVIOUS_DESCRIPTION = "An earlier description."
ADMIN_DESCRIPTION = "Wording an admin chose."


def sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# ── the previous schema ─────────────────────────────────────────────────────

def previous_schema(serial: str, json_type: str) -> list:
    """The tables of the previous schema, and older leftovers (users, scanned_trends,
    simulation_runs.allocation_recommendation). user_roles is the dashboard's own
    table, which the migration must leave alone."""
    return [
        f"""CREATE TABLE trends (
            id TEXT PRIMARY KEY, force TEXT NOT NULL, sub_category TEXT, name TEXT NOT NULL,
            description TEXT, direction TEXT, probability INTEGER, start_year INTEGER,
            normalized_score REAL, strategic_implication TEXT, data_source TEXT, source_type TEXT,
            confidence TEXT DEFAULT 'Medium', ai_suggested BOOLEAN DEFAULT FALSE,
            user_override BOOLEAN DEFAULT FALSE, probability_posterior TEXT,
            gp1_pct_affected REAL DEFAULT 0.10, peak_year INTEGER DEFAULT 0,
            diffusion_curve TEXT DEFAULT 's_curve', ai_suggestion {json_type}, uncertainty INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""",
        """CREATE TABLE trend_category_exposure (trend_id TEXT REFERENCES trends(id) ON DELETE CASCADE,
            category TEXT NOT NULL, exposure_score INTEGER, PRIMARY KEY (trend_id, category))""",
        """CREATE TABLE trend_vc_exposure (trend_id TEXT REFERENCES trends(id) ON DELETE CASCADE,
            vc_step TEXT NOT NULL, exposure_score INTEGER, PRIMARY KEY (trend_id, vc_step))""",
        """CREATE TABLE trend_regional_exposure (trend_id TEXT REFERENCES trends(id) ON DELETE CASCADE,
            region TEXT NOT NULL, exposure_score INTEGER, PRIMARY KEY (trend_id, region))""",
        f"""CREATE TABLE trend_sources (id {serial}, trend_id TEXT REFERENCES trends(id) ON DELETE CASCADE,
            title TEXT NOT NULL, url TEXT NOT NULL, source_type TEXT DEFAULT '', tier TEXT DEFAULT '')""",
        f"""CREATE TABLE trend_score_proposals (id {serial}, trend_id TEXT REFERENCES trends(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL, user_name TEXT, user_role TEXT, probability INTEGER, gp1_pct_affected REAL,
            peak_year INTEGER, diffusion_curve TEXT, uncertainty INTEGER, category_exposure {json_type},
            regional_exposure {json_type}, vc_exposure {json_type}, comment TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE (trend_id, user_id))""",
        f"""CREATE TABLE journey_content (id {serial}, content {json_type} NOT NULL, updated_by TEXT DEFAULT '',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""",
        f"""CREATE TABLE simulation_runs (id {serial}, run_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            iterations INTEGER, model_type TEXT, config_snapshot_id INTEGER, results {json_type},
            force_attribution TEXT, convergence_diagnostics TEXT, allocation_recommendation TEXT)""",
        f"""CREATE TABLE config_snapshots (id {serial}, snapshot_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            region TEXT, attenuation REAL, attenuation_source TEXT, force_weights TEXT, vc_weights TEXT,
            category_names TEXT, path_years TEXT, materialization_schedule TEXT, config_json TEXT, label TEXT)""",
        f"""CREATE TABLE triggers (id {serial}, category TEXT NOT NULL, condition_type TEXT, threshold REAL,
            target_year INTEGER, action_text TEXT, status TEXT DEFAULT 'active', fired_date TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""",
        f"""CREATE TABLE ai_suggestions (id {serial}, suggestion_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            suggestion_type TEXT, content TEXT, source_urls TEXT, status TEXT DEFAULT 'pending',
            user_decision_date TIMESTAMP, user_notes TEXT)""",
        f"""CREATE TABLE audit_log (id {serial}, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            action TEXT NOT NULL, entity_type TEXT, entity_id TEXT, old_value TEXT, new_value TEXT,
            reason TEXT, user_id TEXT DEFAULT 'system')""",
        """CREATE TABLE session_snapshots (id TEXT PRIMARY KEY, name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, shifts TEXT NOT NULL, trends TEXT,
            trend_count INTEGER DEFAULT 0, net_shift REAL DEFAULT 0, notes TEXT,
            created_by TEXT DEFAULT 'system', model_version TEXT, iterations INTEGER)""",
        f"""CREATE TABLE users (id {serial}, email TEXT, password_hash TEXT, password_salt TEXT, role TEXT)""",
        f"""CREATE TABLE scanned_trends (id {serial}, title TEXT)""",
        """CREATE TABLE user_roles (clerk_user_id TEXT PRIMARY KEY, email TEXT, role TEXT, updated_at TIMESTAMP)""",
        "CREATE INDEX idx_trends_force ON trends(force)",
        "CREATE INDEX idx_trend_score_proposals_trend ON trend_score_proposals(trend_id)",
        "CREATE INDEX idx_simulation_runs_date ON simulation_runs(run_date)",
        "CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp)",
        "CREATE INDEX idx_session_snapshots_created_at ON session_snapshots(created_at)",
    ]


STORED_JOURNEY = {
    "lhc": [{"id": "sorting", "label": "Sorting",
             "benefiting": [
                 {"id": "t.a", "name": "A", "trendCodes": ["C-01"], "analysis": "Earlier read A."},
                 {"id": "t.b", "name": "B", "trendCodes": ["T-01"], "analysis": "Current read B."}],
             "negativelyImpacted": [
                 {"id": "t.c", "name": "C", "driverCodes": ["G-04"], "analysis": "Read an admin wrote."}]}],
    "hair": [{"id": "wash", "label": "Wash", "benefiting": [],
              "negativelyImpacted": [{"id": "t.d", "name": "D", "trendCodes": [], "driverNote": "Earlier note D."}]}],
}
JOURNEY_EDITS = [
    {"tile": "t.a", "field": "analysis", "previous_sha256": sha("Earlier read A."), "text": "Current read A."},
    {"tile": "t.b", "field": "analysis", "previous_sha256": sha("Earlier read B."), "text": "Current read B."},
    {"tile": "t.c", "field": "analysis", "previous_sha256": sha("Earlier read C."), "text": "Current read C."},
    {"tile": "t.d", "field": "driverNote", "previous_sha256": sha("Earlier note D."), "text": "Current note D."},
]
DESCRIPTION_EDITS = {
    "consumer_r01": {"previous_sha256": [sha(PREVIOUS_DESCRIPTION)], "text": SEED["consumer_r01"].description},
    "consumer_r03": {"previous_sha256": [sha(PREVIOUS_DESCRIPTION)], "text": SEED["consumer_r03"].description},
    "consumer_r04": {"previous_sha256": [sha(PREVIOUS_DESCRIPTION)], "text": SEED["consumer_r04"].description},
}
STORED_DESCRIPTION = {"consumer_r01": PREVIOUS_DESCRIPTION, "consumer_r04": ADMIN_DESCRIPTION}
FIRST_RUN = {
    "meta": {"trend_count": 51, "trend_fingerprint": {"consumer_r01": {"p": 5}}, "model_version": "2.12.0"},
    "integrity_events": [
        {"type": "input_drift", "message": "no changes", "detail": {"trend_ids": ["consumer_r01"]}},
        {"type": "vc_epicentre_coverage", "detail": {"unscored_trend_ids": ["technology_r01"]}},
        {"type": "other", "detail": None},
    ],
    "totals": {"portfolio": {"2035": {"median": -0.0558}}},
}


def fill_previous_database(conn, p: str, serial: str, json_type: str = "TEXT") -> None:
    """Create the previous schema and fill it the way production holds it: the
    seed drivers with an earlier analysis text, one admin edit, expert proposals,
    stored runs, stored journey content and a row in each side table."""
    cur = conn.cursor()
    for statement in previous_schema(serial, json_type):
        cur.execute(statement)
    for d in DRIVERS:
        admin_edit = d.id == "consumer_r02"
        cur.execute(
            "INSERT INTO trends (id, force, sub_category, name, description, direction, probability, start_year, "
            "normalized_score, strategic_implication, data_source, source_type, confidence, ai_suggested, "
            "user_override, probability_posterior, gp1_pct_affected, peak_year, diffusion_curve, ai_suggestion, "
            f"uncertainty) VALUES ({', '.join([p] * 21)})",
            (d.id, d.force, "", d.name, STORED_DESCRIPTION.get(d.id, d.description), d.direction,
             4 if admin_edit else d.probability, d.start_year, d.normalized_score, f"Earlier analysis of {d.id}.",
             d.data_source, "", d.confidence, False, admin_edit, None, d.gp1_pct_affected, d.peak_year,
             d.diffusion_curve, None if d.id == "technology_r01" else json.dumps(d.scores()), d.uncertainty))
        for table, key, values in (("trend_category_exposure", "category", d.category_exposure),
                                   ("trend_vc_exposure", "vc_step", d.vc_exposure),
                                   ("trend_regional_exposure", "region", d.regional_exposure)):
            for k, v in values.items():
                cur.execute(f"INSERT INTO {table} (trend_id, {key}, exposure_score) VALUES ({p}, {p}, {p})",
                            (d.id, k, v))
        for s in d.sources:
            kind = f"analyst report ({s['note']})" if s["note"] else "trade press"
            cur.execute(f"INSERT INTO trend_sources (trend_id, title, url, source_type, tier) "
                        f"VALUES ({p}, {p}, {p}, {p}, {p})", (d.id, s["title"], s["url"], kind, s["tier"]))
    cur.execute(f"INSERT INTO trend_score_proposals (trend_id, user_id, user_name, user_role, probability, "
                f"category_exposure, comment) VALUES ({p}, {p}, {p}, {p}, {p}, {p}, {p})",
                ("consumer_r01", "ana", "Ana", "viewer", 4, json.dumps({"Hair: Care": 4}), "Looks high"))
    cur.execute(f"INSERT INTO trend_score_proposals (trend_id, user_id, user_name, user_role, uncertainty) "
                f"VALUES ({p}, {p}, {p}, {p}, {p})", ("consumer_r02", "ben", "Ben", "viewer", 3))
    cur.execute(f"INSERT INTO simulation_runs (iterations, model_type, results, force_attribution, "
                f"allocation_recommendation) VALUES ({p}, {p}, {p}, {p}, {p})",
                (150000, "bayesian", json.dumps(FIRST_RUN), '{"Consumer": 0.5}', '{"a": 1}'))
    if json_type == "TEXT":   # a JSONB column cannot hold a malformed bundle
        cur.execute(f"INSERT INTO simulation_runs (iterations, results) VALUES ({p}, {p})", (10, "{not json"))
    cur.execute(f"INSERT INTO simulation_runs (iterations, results) VALUES ({p}, {p})",
                (20, json.dumps({"meta": {"driver_count": 51}})))
    cur.execute(f"INSERT INTO journey_content (content, updated_by) VALUES ({p}, {p})",
                (json.dumps(STORED_JOURNEY), "admin@example.com"))
    cur.execute("INSERT INTO triggers (category, condition_type, threshold) VALUES ('LHC: FCN', 'below', -0.05)")
    cur.execute("INSERT INTO session_snapshots (id, name, shifts) VALUES ('snap1', 'Board prep', '{}')")
    cur.execute("INSERT INTO config_snapshots (label, config_json) VALUES ('before', '{}')")
    cur.execute("INSERT INTO users (email, password_hash, password_salt, role) "
                "VALUES ('old@example.com', 'secret-hash', 'secret-salt', 'admin')")
    cur.execute("INSERT INTO scanned_trends (title) VALUES ('a scanned item')")
    cur.execute("INSERT INTO audit_log (action, entity_type, entity_id, user_id) "
                "VALUES ('trend_updated', 'trend', 'consumer_r02', 'admin-1')")
    cur.execute("INSERT INTO user_roles (clerk_user_id, email, role) VALUES ('user_1', 'a@example.com', 'admin')")
    conn.commit()


# ── fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def migration(monkeypatch, tmp_path):
    """The migration module, with its archive in tmp and the synthetic edit files."""
    spec = importlib.util.spec_from_file_location("migrate_0001", MIGRATION_DIR / "migrate.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    descriptions = tmp_path / "descriptions.json"
    descriptions.write_text(json.dumps({"descriptions": DESCRIPTION_EDITS}), encoding="utf-8")
    edits = tmp_path / "journey_edits.json"
    edits.write_text(json.dumps({"edits": JOURNEY_EDITS}), encoding="utf-8")
    monkeypatch.setattr(module, "DESCRIPTIONS_FILE", descriptions)
    monkeypatch.setattr(module, "JOURNEY_EDITS_FILE", edits)
    monkeypatch.setattr(module, "ARCHIVE_DIR", tmp_path / "archive")
    return module


@pytest.fixture
def previous(tmp_path) -> Path:
    """A SQLite database of the previous schema."""
    path = tmp_path / "previous.db"
    conn = sqlite3.connect(path)
    fill_previous_database(conn, "?", "INTEGER PRIMARY KEY AUTOINCREMENT")
    conn.close()
    return path


def dump(path: Path) -> list:
    conn = sqlite3.connect(path)
    try:
        return list(conn.iterdump())
    finally:
        conn.close()


def query(path: Path, sql: str, params=()) -> list:
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    try:
        return [dict(r) for r in conn.execute(sql, params).fetchall()]
    finally:
        conn.close()


def sqlite_schema(path: Path) -> dict:
    """Per table: columns, indexes and foreign keys, as SQLite reports them."""
    conn = sqlite3.connect(path)
    try:
        tables = [r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
        out = {}
        for t in tables:
            indexes = {}
            for idx in conn.execute(f"PRAGMA index_list({t})").fetchall():
                indexes[idx[1]] = (idx[2], tuple(r[2] for r in conn.execute(f"PRAGMA index_info({idx[1]})")))
            out[t] = {"columns": conn.execute(f"PRAGMA table_info({t})").fetchall(),
                      "indexes": sorted(indexes.values()),
                      "foreign_keys": conn.execute(f"PRAGMA foreign_key_list({t})").fetchall()}
        return out
    finally:
        conn.close()


DRIVER_FIELDS = ("force", "name", "description", "direction", "probability", "start_year", "gp1_pct_affected",
                 "peak_year", "diffusion_curve", "uncertainty", "confidence", "analysis", "data_source",
                 "category_exposure", "regional_exposure", "vc_exposure", "sources", "baseline", "scores_edited")


def expected_driver(d) -> dict:
    """A seed driver as the migrated database must hold it."""
    out = {f: getattr(d, f) for f in DRIVER_FIELDS}
    out.update(baseline=None if d.id == "technology_r01" else d.scores(), scores_edited=False)
    if d.id == "consumer_r02":
        out.update(probability=4, scores_edited=True)
    if d.id == "consumer_r04":
        out.update(description=ADMIN_DESCRIPTION)
    return out


def check_migrated_drivers(drivers: dict) -> None:
    assert sorted(drivers) == sorted(SEED)
    for driver_id, d in SEED.items():
        assert drivers[driver_id] == json.loads(json.dumps(expected_driver(d))), driver_id


# ── SQLite ──────────────────────────────────────────────────────────────────

class TestMigration:
    def test_a_dry_run_changes_nothing(self, migration, previous, capsys):
        before = dump(previous)
        assert migration.main(["--sqlite", str(previous), "--dry-run"]) == 0
        out = capsys.readouterr().out
        assert "Dry run: rolled back, nothing changed." in out and '"drivers": 51' in out
        assert dump(previous) == before
        assert not migration.ARCHIVE_DIR.exists()

    def test_the_database_is_migrated(self, migration, previous, capsys, monkeypatch):
        assert migration.main(["--sqlite", str(previous)]) == 0
        report = json.loads(capsys.readouterr().out.split("\nMigrated.")[0])
        assert report["copied"] == {"drivers": 51, "sources": sum(len(d.sources) for d in DRIVERS), "proposals": 2}
        assert report["analysis_updated"] == 51
        assert report["descriptions"] == {"updated": 1, "already_current": 1, "edited_left_alone": ["consumer_r04"]}
        assert report["runs_with_renamed_keys"] == 1

        monkeypatch.setenv("PRISM_DB_PATH", str(previous))
        import prism.database as dbm
        drivers = {d.id: {f: getattr(d, f) for f in DRIVER_FIELDS} for d in dbm.load_drivers()}
        check_migrated_drivers(json.loads(json.dumps(drivers)))
        ana = dbm.load_driver_proposals("consumer_r01")
        assert [(r["user_id"], r["probability"], r["category_exposure"], r["comment"]) for r in ana] == [
            ("ana", 4, {"Hair: Care": 4}, "Looks high")]
        assert dbm.load_driver_proposals("consumer_r02")[0]["uncertainty"] == 3

    def test_the_schema_is_the_schema_of_a_new_database(self, migration, previous, monkeypatch, tmp_path):
        assert migration.main(["--sqlite", str(previous)]) == 0
        fresh = tmp_path / "fresh.db"
        monkeypatch.setenv("PRISM_DB_PATH", str(fresh))
        import prism.database as dbm
        dbm.init_db()
        migrated, new = sqlite_schema(previous), sqlite_schema(fresh)
        assert set(migrated) == set(new) | {"user_roles"}
        for table in new:
            assert migrated[table] == new[table], table
        # the API's start-up check passes and leaves the schema as it is
        monkeypatch.setenv("PRISM_DB_PATH", str(previous))
        dbm.init_db()
        assert sqlite_schema(previous) == migrated
        assert query(previous, "SELECT version FROM schema_migrations") == [{"version": "0001_driver_schema"}]

    def test_stored_runs_follow_the_new_names(self, migration, previous):
        assert migration.main(["--sqlite", str(previous)]) == 0
        rows = query(previous, "SELECT * FROM simulation_runs ORDER BY id")
        assert [set(r) for r in rows] == [{"id", "run_date", "iterations", "results"}] * 3
        first = json.loads(rows[0]["results"])
        assert first["meta"] == {"driver_count": 51, "driver_fingerprint": {"consumer_r01": {"p": 5}},
                                 "model_version": "2.12.0"}
        assert [e["detail"] for e in first["integrity_events"]] == [
            {"driver_ids": ["consumer_r01"]}, {"unscored_driver_ids": ["technology_r01"]}, None]
        assert first["totals"] == FIRST_RUN["totals"]
        assert rows[1]["results"] == "{not json"
        assert json.loads(rows[2]["results"]) == {"meta": {"driver_count": 51}}

    def test_the_journey_content_is_saved_as_a_new_version(self, migration, previous, capsys):
        assert migration.main(["--sqlite", str(previous)]) == 0
        report = json.loads(capsys.readouterr().out.split("\nMigrated.")[0])["journey"]
        assert report == {"stored_content": True, "tiles_renamed": 3, "texts_updated": 2, "texts_already_current": 1,
                          "texts_edited_left_alone": ["t.c.analysis"], "new_version_saved": True}
        rows = query(previous, "SELECT content, updated_by FROM journey_content ORDER BY id")
        assert json.loads(rows[0]["content"]) == STORED_JOURNEY
        assert rows[1]["updated_by"] == "migration 0001_driver_schema"
        content = json.loads(rows[1]["content"])
        a, b = content["lhc"][0]["benefiting"]
        c = content["lhc"][0]["negativelyImpacted"][0]
        d = content["hair"][0]["negativelyImpacted"][0]
        assert list(a) == ["id", "name", "driverCodes", "analysis"] and a["driverCodes"] == ["C-01"]
        assert (a["analysis"], b["analysis"], c["analysis"], d["driverNote"]) == (
            "Current read A.", "Current read B.", "Read an admin wrote.", "Current note D.")
        assert "trendCodes" not in json.dumps(content)

    def test_without_stored_journey_content_nothing_is_written(self, migration, previous, capsys):
        conn = sqlite3.connect(previous)
        conn.execute("DELETE FROM journey_content")
        conn.commit()
        conn.close()
        assert migration.main(["--sqlite", str(previous)]) == 0
        assert json.loads(capsys.readouterr().out.split("\nMigrated.")[0])["journey"] == {"stored_content": False}
        assert query(previous, "SELECT COUNT(*) AS n FROM journey_content") == [{"n": 0}]

    def test_dropped_rows_go_to_the_archive_and_other_tables_stay(self, migration, previous):
        assert migration.main(["--sqlite", str(previous)]) == 0
        tables = {r["name"] for r in query(previous, "SELECT name FROM sqlite_master WHERE type = 'table'")}
        assert not tables & set(migration.DROP_TABLES)
        assert query(previous, "SELECT clerk_user_id, email, role FROM user_roles") == [
            {"clerk_user_id": "user_1", "email": "a@example.com", "role": "admin"}]
        assert [r["action"] for r in query(previous, "SELECT action FROM audit_log ORDER BY id")] == [
            "trend_updated", "schema_migrated"]

        [archive_file] = list(migration.ARCHIVE_DIR.glob("sqlite-previous-*.json"))
        text = archive_file.read_text(encoding="utf-8")
        assert "secret-hash" not in text and "secret-salt" not in text
        archive = json.loads(text)
        assert len(archive["tables"]["trends"]) == 51
        assert archive["tables"]["users"] == [{"id": 1, "email": "old@example.com", "role": "admin"}]
        assert {t: len(archive["tables"][t]) for t in ("triggers", "session_snapshots", "config_snapshots",
                                                        "ai_suggestions", "scanned_trends")} == {
            "triggers": 1, "session_snapshots": 1, "config_snapshots": 1, "ai_suggestions": 0, "scanned_trends": 1}
        assert archive["simulation_runs_columns"] == {
            "model_type": {"1": "bayesian"}, "config_snapshot_id": {}, "force_attribution": {"1": '{"Consumer": 0.5}'},
            "convergence_diagnostics": {}, "allocation_recommendation": {"1": '{"a": 1}'}}

    def test_a_second_run_does_nothing(self, migration, previous, capsys):
        assert migration.main(["--sqlite", str(previous)]) == 0
        after = dump(previous)
        capsys.readouterr()
        assert migration.main(["--sqlite", str(previous)]) == 0
        assert "already on the driver schema" in capsys.readouterr().out
        assert dump(previous) == after

    def test_a_failure_rolls_everything_back(self, migration, previous, monkeypatch, capsys):
        before = dump(previous)

        def fail(db):
            raise RuntimeError("disk full")
        monkeypatch.setattr(migration, "migrate_journey", fail)
        assert migration.main(["--sqlite", str(previous)]) == 2
        out = capsys.readouterr().out
        assert "rolled back" in out and "disk full" in out
        assert dump(previous) == before
        assert not migration.ARCHIVE_DIR.exists()

    def test_without_an_archive_nothing_is_committed(self, migration, previous, monkeypatch, tmp_path, capsys):
        before = dump(previous)
        blocker = tmp_path / "not-a-folder"
        blocker.write_text("x", encoding="utf-8")
        monkeypatch.setattr(migration, "ARCHIVE_DIR", blocker / "archive")
        assert migration.main(["--sqlite", str(previous)]) == 2
        assert "FAILED at the commit" in capsys.readouterr().out
        assert dump(previous) == before

    def test_what_is_refused(self, migration, tmp_path, capsys):
        assert migration.main(["--sqlite", str(tmp_path / "missing.db")]) == 1
        empty = tmp_path / "empty.db"
        sqlite3.connect(empty).close()
        assert migration.main(["--sqlite", str(empty)]) == 1
        assert "not a database of the previous schema" in capsys.readouterr().out
        odd = tmp_path / "odd.db"
        sqlite3.connect(odd).execute("CREATE TABLE drivers (id TEXT)").connection.close()
        assert migration.main(["--sqlite", str(odd)]) == 1
        assert "refusing to guess" in capsys.readouterr().out


class TestHelpers:
    @pytest.mark.parametrize("old, note", [
        ("analyst report (Aug 2026)", "Aug 2026"), ("primary source (2026)", "2026"),
        ("trade_press (Jul 2026)", "Jul 2026"), ("trade press", ""), ("", ""), (None, ""),
        ("Company filing, FY2025", "Company filing, FY2025"),
    ])
    def test_source_note(self, migration, old, note):
        assert migration.source_note(old) == note

    def test_run_keys_are_renamed_only_where_needed(self, migration):
        results = json.loads(json.dumps(FIRST_RUN))
        assert migration.rename_run_keys(results) is True
        assert migration.rename_run_keys(results) is False
        assert migration.rename_run_keys({"meta": {"driver_count": 5, "trend_count": 4}}) is False
        assert migration.rename_run_keys({"integrity_events": ["not a dict"]}) is False

    def test_json_columns_arrive_as_text_or_decoded(self, migration):
        assert migration.json_text({"a": 1}) == '{"a": 1}' and migration.json_text('{"a": 1}') == '{"a": 1}'
        assert migration.json_text(None) is None
        assert migration.json_value('{"a": 1}') == {"a": 1} == migration.json_value({"a": 1})


# ── the real edit files match the shipped content ───────────────────────────

def shipped_journey() -> dict:
    """LHC_JOURNEY and HAIR_JOURNEY from data/consumerJourney.ts (JSON-style literals)."""
    src = (REPO / "data" / "consumerJourney.ts").read_text(encoding="utf-8")

    def extract(name):
        start = src.index("[", src.index("=", src.index(f"export const {name}")))
        depth, in_string, escaped = 0, False, False
        for i in range(start, len(src)):
            ch = src[i]
            if in_string:
                if escaped:
                    escaped = False
                elif ch == "\\":
                    escaped = True
                elif ch == '"':
                    in_string = False
                continue
            if ch == '"':
                in_string = True
            elif ch in "[{":
                depth += 1
            elif ch in "]}":
                depth -= 1
                if depth == 0:
                    return json.loads(src[start:i + 1])
        raise AssertionError(f"{name} not found")
    return {"lhc": extract("LHC_JOURNEY"), "hair": extract("HAIR_JOURNEY")}


class TestShippedEditFiles:
    def test_descriptions_end_on_the_seed_texts(self):
        entries = json.loads((MIGRATION_DIR / "descriptions.json").read_text(encoding="utf-8"))["descriptions"]
        assert entries and set(entries) <= set(SEED)
        for driver_id, e in entries.items():
            assert e["text"] == SEED[driver_id].description, driver_id
            assert e["previous_sha256"] and all(re.fullmatch(r"[0-9a-f]{64}", h) for h in e["previous_sha256"])
            assert sha(e["text"]) not in e["previous_sha256"], driver_id

    def test_journey_edits_end_on_the_shipped_tiles(self):
        edits = json.loads((MIGRATION_DIR / "journey_edits.json").read_text(encoding="utf-8"))["edits"]
        tiles = {t["id"]: t for journey in shipped_journey().values() for stage in journey
                 for side in ("benefiting", "negativelyImpacted") for t in stage.get(side, [])}
        assert edits
        for e in edits:
            assert e["tile"] in tiles, e["tile"]
            assert tiles[e["tile"]][e["field"]] == e["text"], (e["tile"], e["field"])
            assert re.fullmatch(r"[0-9a-f]{64}", e["previous_sha256"]) and sha(e["text"]) != e["previous_sha256"]
        assert len({(e["tile"], e["field"]) for e in edits}) == len(edits)


# ── PostgreSQL (PRISM_TEST_POSTGRES_URL) ────────────────────────────────────

POSTGRES_URL = os.environ.get("PRISM_TEST_POSTGRES_URL")


def schema_url(schema: str) -> str:
    sep = "&" if "?" in POSTGRES_URL else "?"
    return f"{POSTGRES_URL}{sep}options={quote(f'-c search_path={schema}')}"


def in_prism(url: str, code: str) -> str:
    """Run code against prism.database on this URL in a fresh interpreter (the backend is fixed at import)."""
    env = {**os.environ, "POSTGRES_URL": url, "DATABASE_URL": "", "PRISM_TEST_ALLOW_POSTGRES": "1"}
    result = subprocess.run([sys.executable, "-c", code], cwd=REPO, env=env, capture_output=True, text=True,
                            timeout=120)
    assert result.returncode == 0, result.stderr
    return result.stdout


def postgres_schema(conn, schema: str) -> dict:
    """Columns, constraints and indexes of every table in one schema, schema names removed."""
    cur = conn.cursor()
    cur.execute("SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns "
                "WHERE table_schema = %s ORDER BY table_name, ordinal_position", (schema,))
    out: dict = {}
    for table, column, data_type, nullable, default in cur.fetchall():
        out.setdefault(table, {"columns": [], "constraints": [], "indexes": []})["columns"].append(
            (column, data_type, nullable, (default or "").replace(f"{schema}.", "")))
    cur.execute("SELECT rel.relname, con.contype, pg_get_constraintdef(con.oid) FROM pg_constraint con "
                "JOIN pg_class rel ON rel.oid = con.conrelid JOIN pg_namespace ns ON ns.oid = rel.relnamespace "
                "WHERE ns.nspname = %s ORDER BY 1, 2, 3", (schema,))
    for table, kind, definition in cur.fetchall():
        out[table]["constraints"].append((kind, definition.replace(f"{schema}.", "")))
    cur.execute("SELECT tablename, indexdef FROM pg_indexes WHERE schemaname = %s ORDER BY 1, 2", (schema,))
    for table, definition in cur.fetchall():
        out[table]["indexes"].append(definition.replace(f"{schema}.", ""))
    return out


@pytest.mark.skipif(not POSTGRES_URL, reason="PRISM_TEST_POSTGRES_URL is not set")
@pytest.mark.parametrize("json_type", ["TEXT", "JSONB"])
def test_postgres(migration, monkeypatch, capsys, json_type):
    """The same migration on PostgreSQL, with the JSON columns as TEXT or JSONB
    (a database created by an older version can hold either)."""
    import psycopg2
    tag = uuid.uuid4().hex[:8]
    previous_schema_name, fresh_schema_name = f"m_previous_{tag}", f"m_fresh_{tag}"
    admin = psycopg2.connect(POSTGRES_URL)
    admin.autocommit = True
    try:
        for name in (previous_schema_name, fresh_schema_name):
            admin.cursor().execute(f"CREATE SCHEMA {name}")
        conn = psycopg2.connect(schema_url(previous_schema_name))
        fill_previous_database(conn, "%s", "SERIAL PRIMARY KEY", json_type)
        conn.close()

        monkeypatch.setenv("POSTGRES_URL", schema_url(previous_schema_name))
        assert migration.main([]) == 1                        # a PostgreSQL database needs --postgres
        assert "pass --postgres" in capsys.readouterr().out
        assert migration.main(["--dry-run"]) == 0
        assert "Dry run: rolled back" in capsys.readouterr().out
        assert migration.main(["--postgres"]) == 0
        report = json.loads(capsys.readouterr().out.split("\nMigrated.")[0])
        assert report["copied"]["drivers"] == 51 and report["descriptions"]["edited_left_alone"] == ["consumer_r04"]
        assert report["journey"]["texts_updated"] == 2 and report["runs_with_renamed_keys"] == 1
        assert migration.main(["--postgres"]) == 0 and "already on the driver schema" in capsys.readouterr().out

        in_prism(schema_url(fresh_schema_name), "import prism.database as d; d.init_db()")
        migrated, new = postgres_schema(admin, previous_schema_name), postgres_schema(admin, fresh_schema_name)
        assert set(migrated) == set(new) | {"user_roles"}
        for table in new:
            if json_type == "JSONB" and table in ("journey_content", "simulation_runs"):
                continue   # these tables keep the column types they had
            assert migrated[table] == new[table], table

        drivers = json.loads(in_prism(schema_url(previous_schema_name), (
            "import json; import prism.database as d; "
            f"print(json.dumps({{x.id: {{f: getattr(x, f) for f in {DRIVER_FIELDS!r}}} for x in d.load_drivers()}}))")))
        check_migrated_drivers(drivers)
        served = json.loads(in_prism(schema_url(previous_schema_name), (
            "import json; import prism.database as d; r = d.load_latest_run(); c = d.load_journey_content(); "
            "print(json.dumps({'meta': r['results']['meta'], 'journey': c}))")))
        assert served["meta"] == {"driver_count": 51}
        assert served["journey"]["lhc"][0]["benefiting"][0]["analysis"] == "Current read A."
    finally:
        for name in (previous_schema_name, fresh_schema_name):
            admin.cursor().execute(f"DROP SCHEMA IF EXISTS {name} CASCADE")
        admin.close()
