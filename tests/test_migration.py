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

import copy
import hashlib
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

from prism.config import CATEGORIES, VC_STAGES
from prism.input_drift import FINGERPRINT_KEYS, driver_fingerprint
from prism.seed_drivers import DRIVERS
from support import load_module

REPO = Path(__file__).resolve().parents[1]
MIGRATION_DIR = REPO / "migrations" / "0001_driver_schema"
SEED = {d.id: d for d in DRIVERS}
PREVIOUS_DESCRIPTION = "An earlier description."
ADMIN_DESCRIPTION = "Wording an admin chose."
#: The source list the previous editor saved for consumer_r02 as JSON in
#: data_source: the table rows as the dashboard showed them (the old "data"
#: field held the source_type), one tier changed and one source added, plus an
#: empty row that editor would have filtered out.
EDITOR_SOURCES = [
    *({"title": s["title"], "url": s["url"], "data": f"analyst report ({s['published']})" if s["published"] else "",
       "tier": "S" if i == 0 else s["tier"]} for i, s in enumerate(SEED["consumer_r02"].sources)),
    {"title": "Added in the editor", "url": "https://example.org/added", "data": "Company filing, FY2025"},
    {"title": "", "url": "  "},
]


def sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def previous_profile(stage: str) -> dict:
    """The eight value-chain scores the previous editor stored for a chosen stage:
    5 there, 3 one stage away, 1 two away, 0 elsewhere."""
    at = VC_STAGES.index(stage)
    return {name: {0: 5, 1: 3, 2: 1}.get(abs(i - at), 0) for i, name in enumerate(VC_STAGES)}


def previous_scores(d) -> dict:
    """A seed driver's scores as the previous schema's baseline (ai_suggestion) held them."""
    scores = d.scores()
    scores["vc_exposure"] = previous_profile(scores.pop("vc_epicentre"))
    return scores


# ── the previous schema ─────────────────────────────────────────────────────

def older_leftovers(serial: str) -> list:
    """What a database created by much older versions can still hold: the Delphi
    tables with their foreign keys (to trends and to each other) and a
    simulation_runs table with a foreign key to config_snapshots and columns
    since removed. Replaces the simulation_runs of previous_schema."""
    return [
        f"""CREATE TABLE simulation_runs (id {serial}, run_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            scenario TEXT, iterations INTEGER, model_type TEXT,
            config_snapshot_id INTEGER REFERENCES config_snapshots(id), results TEXT,
            causal_decomposition TEXT, allocation_recommendation TEXT, convergence_diagnostics TEXT)""",
        """CREATE TABLE delphi_sessions (id TEXT PRIMARY KEY, name TEXT NOT NULL)""",
        f"""CREATE TABLE delphi_rounds (id {serial}, round_number INTEGER, trend_id TEXT REFERENCES trends(id),
            scorer_id TEXT, session_id TEXT REFERENCES delphi_sessions(id))""",
        f"""CREATE TABLE delphi_calibration (id {serial}, session_id TEXT REFERENCES delphi_sessions(id),
            scorer_id TEXT NOT NULL)""",
        "CREATE INDEX idx_simulation_runs_date ON simulation_runs(run_date)",
    ]


def previous_schema(serial: str, json_type: str, older: bool = False) -> list:
    """The tables of the previous schema, and older leftovers (users, scanned_trends,
    simulation_runs.allocation_recommendation; with ``older``, those of
    older_leftovers too). user_roles is the dashboard's own table, which the
    migration must leave alone."""
    statements = [
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
    if not older:
        return statements
    # config_snapshots must exist before the older simulation_runs references it.
    kept = [st for st in statements if "CREATE TABLE simulation_runs" not in st
            and "idx_simulation_runs_date" not in st]
    config_first = sorted(kept, key=lambda st: "CREATE TABLE config_snapshots" not in st)
    return config_first + older_leftovers(serial)


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
    {"tile": "t.a", "field": "analysis", "previous_sha256": [sha("First read A."), sha("Earlier read A.")],
     "text": "Current read A."},
    {"tile": "t.b", "field": "analysis", "previous_sha256": [sha("Earlier read B.")], "text": "Current read B."},
    {"tile": "t.c", "field": "analysis", "previous_sha256": [sha("Earlier read C.")], "text": "Current read C."},
    {"tile": "t.d", "field": "driverNote", "previous_sha256": [sha("Earlier note D.")], "text": "Current note D."},
    {"stage": "wash", "field": "label", "previous_sha256": [sha("Wash")], "text": "Washing"},
]
DESCRIPTION_EDITS = {
    "consumer_r01": {"previous_sha256": [sha(PREVIOUS_DESCRIPTION)], "text": SEED["consumer_r01"].description},
    "consumer_r03": {"previous_sha256": [sha(PREVIOUS_DESCRIPTION)], "text": SEED["consumer_r03"].description},
    "consumer_r04": {"previous_sha256": [sha(PREVIOUS_DESCRIPTION)], "text": SEED["consumer_r04"].description},
}
STORED_DESCRIPTION = {"consumer_r01": PREVIOUS_DESCRIPTION, "consumer_r04": ADMIN_DESCRIPTION}
FIRST_RUN = {
    "meta": {"trend_count": 51, "model_version": "2.12.0", "trend_fingerprint": {
        "consumer_r01": {"p": 5, "ce": {"Hair: Color": 3, "LHC: HSC (old)": 2},
                         "re": {"Europe": 5.0, "North America": 0.0, "Asia": 0.0, "High Growth": 0.0}},
        "retired_r99": {"p": 2, "ce": {"Hair: Care": 1}}}},
    "integrity_events": [
        {"type": "input_drift", "message": "no changes", "detail": {"trend_ids": ["consumer_r01"]}},
        {"type": "vc_epicentre_coverage", "detail": {"unscored_trend_ids": ["technology_r01"]}},
        {"type": "other", "detail": None},
    ],
    "decompositions": {"force": {}, "dimensions": {"vc_steps": ["Raw Materials", "Consumer"], "regions": ["Europe"]}},
    "totals": {"portfolio": {"2035": {"median": -0.0558}}},
}


def previous_release_run() -> dict:
    """A results bundle as the previous release's production run stored it:
    every part over every category, region and year (a small engine run of
    the same recipe), under that release's key names, over the drivers
    fill_previous_database stores (consumer_r02 with the admin's probability)
    and fingerprinted as that release did: without the onset years."""
    from prism.config import ModelConfig
    from prism.drivers import DriverSet
    from prism.engine import MonteCarloEngine
    drivers = copy.deepcopy(DRIVERS)
    for d in drivers:
        if d.id == "consumer_r02":
            d.probability = 4
            d.recompute()
    config = ModelConfig()
    result = MonteCarloEngine(config, seed=42).run_multichain(DriverSet(drivers=drivers), iterations=100, n_chains=1)
    production = load_module("scripts/run_production.py")
    bundle = json.loads(json.dumps(production.results_bundle(result, config, len(drivers), driver_fingerprint(drivers)),
                                   default=float))
    meta, dimensions = bundle["meta"], bundle["decompositions"]["dimensions"]
    meta["trend_count"] = meta.pop("driver_count")
    meta["trend_fingerprint"] = {driver_id: {k: v for k, v in entry.items() if k != "s"}
                                 for driver_id, entry in meta.pop("driver_fingerprint").items()}
    dimensions["vc_steps"] = dimensions.pop("vc_stages")
    # parts the previous release stored besides
    meta.update(engine_fidelity="scipy", vc_attribution_basis="epicentre")
    bundle["vc_decomposition"] = {}
    return bundle


def fill_previous_database(conn, p: str, serial: str, json_type: str = "TEXT", older: bool = False) -> None:
    """Create the previous schema and fill it the way production holds it: the
    seed drivers with an earlier analysis text, one admin edit, expert proposals,
    stored runs, stored journey content and a row in each side table."""
    cur = conn.cursor()
    for statement in previous_schema(serial, json_type, older):
        cur.execute(statement)
    for d in DRIVERS:
        admin_edit = d.id == "consumer_r02"
        cur.execute(
            "INSERT INTO trends (id, force, sub_category, name, description, direction, probability, start_year, "
            "normalized_score, strategic_implication, data_source, source_type, confidence, ai_suggested, "
            "user_override, probability_posterior, gp1_pct_affected, peak_year, diffusion_curve, ai_suggestion, "
            f"uncertainty) VALUES ({', '.join([p] * 21)})",
            (d.id, d.force, "", d.name, STORED_DESCRIPTION.get(d.id, d.description), d.direction,
             4 if admin_edit else d.probability, d.start_year, d.expected_effect, f"Earlier analysis of {d.id}.",
             json.dumps(EDITOR_SOURCES) if admin_edit else "Circana (Apr 2026); YouGov (Jul 2026)", "",
             d.confidence, False, admin_edit, None, d.gp1_pct_affected, d.peak_year,
             d.diffusion_curve, None if d.id == "technology_r01" else json.dumps(previous_scores(d)), d.uncertainty))
        for table, key, values in (("trend_category_exposure", "category", d.category_exposure),
                                   ("trend_vc_exposure", "vc_step", previous_profile(d.vc_epicentre)),
                                   ("trend_regional_exposure", "region", d.regional_exposure)):
            for k, v in values.items():
                cur.execute(f"INSERT INTO {table} (trend_id, {key}, exposure_score) VALUES ({p}, {p}, {p})",
                            (d.id, k, v))
        for s in d.sources:
            kind = f"analyst report ({s['published']})" if s["published"] else "trade press"
            cur.execute(f"INSERT INTO trend_sources (trend_id, title, url, source_type, tier) "
                        f"VALUES ({p}, {p}, {p}, {p}, {p})", (d.id, s["title"], s["url"], kind, s["tier"]))
    cur.execute(f"INSERT INTO trend_score_proposals (trend_id, user_id, user_name, user_role, probability, "
                f"category_exposure, vc_exposure, comment) VALUES ({p}, {p}, {p}, {p}, {p}, {p}, {p}, {p})",
                ("consumer_r01", "ana", "Ana", "viewer", 4, json.dumps({"Hair: Care": 4}),
                 json.dumps(previous_profile("Marketing")), "Looks high"))
    cur.execute(f"INSERT INTO trend_score_proposals (trend_id, user_id, user_name, user_role, uncertainty) "
                f"VALUES ({p}, {p}, {p}, {p}, {p})", ("consumer_r02", "ben", "Ben", "viewer", 3))
    attribution = "causal_decomposition" if older else "force_attribution"   # renamed in the previous release
    cur.execute(f"INSERT INTO simulation_runs (iterations, model_type, results, {attribution}, "
                f"allocation_recommendation) VALUES ({p}, {p}, {p}, {p}, {p})",
                (50000, "bayesian", json.dumps(FIRST_RUN), '{"Consumer": 0.5}', '{"a": 1}'))
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
    if older:
        cur.execute("INSERT INTO delphi_sessions (id, name) VALUES ('s1', 'Round one')")
        cur.execute("INSERT INTO delphi_rounds (round_number, trend_id, scorer_id, session_id) "
                    "VALUES (1, 'consumer_r01', 'x', 's1')")
        cur.execute("INSERT INTO delphi_calibration (session_id, scorer_id) VALUES ('s1', 'x')")
        cur.execute("UPDATE simulation_runs SET scenario = 'base', config_snapshot_id = 1 WHERE iterations = 50000")
    conn.commit()


# ── fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def migration(monkeypatch, tmp_path):
    """The migration module, with its archive in tmp and the synthetic edit files."""
    module = load_module("migrations/0001_driver_schema/migrate.py", "migrate_0001")
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


@pytest.fixture
def older(tmp_path) -> Path:
    """A SQLite database of the previous schema that still holds older leftovers."""
    path = tmp_path / "older.db"
    conn = sqlite3.connect(path)
    fill_previous_database(conn, "?", "INTEGER PRIMARY KEY AUTOINCREMENT", older=True)
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


#: The tables the migration creates, with the constraints of the current schema.
CREATED_TABLES = ("drivers", "driver_category_exposure", "driver_regional_exposure", "driver_sources",
                  "driver_score_proposals", "schema_migrations")


def create_statement(path: Path, table: str) -> str:
    """The CREATE TABLE statement SQLite keeps for a table, whitespace collapsed."""
    conn = sqlite3.connect(path)
    try:
        [(sql,)] = conn.execute("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?", (table,)).fetchall()
    finally:
        conn.close()
    return " ".join(sql.split())


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
                 "peak_year", "diffusion_curve", "uncertainty", "confidence", "analysis",
                 "category_exposure", "regional_exposure", "vc_epicentre", "sources", "baseline", "scores_edited")
#: consumer_r02's sources after the migration: the list saved in the editor.
MIGRATED_EDITOR_SOURCES = [
    *({"title": s["title"], "url": s["url"], "tier": "S" if i == 0 else s["tier"], "published": s["published"]}
      for i, s in enumerate(SEED["consumer_r02"].sources)),
    {"title": "Added in the editor", "url": "https://example.org/added", "tier": "",
     "published": "Company filing, FY2025"},
]


def expected_driver(d) -> dict:
    """A seed driver as the migrated database must hold it: its baseline in the
    driver schema's form, with the value-chain stage."""
    out = {f: getattr(d, f) for f in DRIVER_FIELDS}
    out.update(baseline=d.scores(), scores_edited=False)
    if d.id == "consumer_r02":
        out.update(probability=4, scores_edited=True, sources=MIGRATED_EDITOR_SOURCES)
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
        assert report["copied"] == {"drivers": 51, "sources": sum(len(d.sources) for d in DRIVERS) + 1, "proposals": 2}
        assert report["sources_from_editor"] == {
            "consumer_r02": {"saved_in_editor": len(SEED["consumer_r02"].sources) + 1,
                             "table_rows": len(SEED["consumer_r02"].sources)}}
        assert report["orphans_skipped"] == {} and report["source_tiers_outside_the_scale"] == {}
        assert report["source_links_that_are_not_web_addresses"] == {}
        assert report["sources_without_title_or_link_skipped"] == {}
        assert report["exposures"] == {"names_outside_the_taxonomy_dropped": {}, "missing_names_set_to_0": {}}
        # technology_r01 was stored without a baseline, so it takes its current scores
        assert report["baselines"] == {"from_the_current_scores": ["technology_r01"],
                                       "fields_from_the_current_scores": {}}
        assert report["proposals"] == {"with_a_value_chain_stage": 1, "scores_cleared": {}}
        assert report["analysis_updated"] == 51
        assert report["descriptions"] == {"updated": 1, "already_current": 1, "edited_left_alone": ["consumer_r04"]}
        assert report["runs"] == {"with_renamed_keys": 1, "with_the_fingerprint_completed": 1}

        monkeypatch.setenv("PRISM_DB_PATH", str(previous))
        import prism.database as dbm
        drivers = {d.id: {f: getattr(d, f) for f in DRIVER_FIELDS} for d in dbm.load_drivers()}
        check_migrated_drivers(json.loads(json.dumps(drivers)))
        ana = dbm.load_driver_proposals("consumer_r01")
        assert [(r["user_id"], r["probability"], r["category_exposure"], r["vc_epicentre"], r["comment"])
                for r in ana] == [("ana", 4, {"Hair: Care": 4}, "Marketing", "Looks high")]
        ben = dbm.load_driver_proposals("consumer_r02")[0]
        assert ben["uncertainty"] == 3 and ben["vc_epicentre"] is None

    def test_drivers_that_need_correcting_stop_the_migration(self, migration, previous, capsys):
        """The driver schema stores only drivers the engine can simulate; while one cannot be, nothing
        changes and every problem is listed."""
        conn = sqlite3.connect(previous)
        conn.execute("DELETE FROM trend_vc_exposure WHERE trend_id = 'government_r02'")
        conn.execute("UPDATE trend_vc_exposure SET exposure_score = 0 WHERE trend_id = 'consumer_r05'")
        conn.execute("UPDATE trend_regional_exposure SET exposure_score = 0 WHERE trend_id = 'consumer_r06'")
        conn.execute("UPDATE trends SET peak_year = 0 WHERE id = 'technology_r01'")
        conn.execute("UPDATE trends SET confidence = 'Certain', gp1_pct_affected = 0 WHERE id = 'customer_r01'")
        conn.execute("UPDATE trend_category_exposure SET exposure_score = 7 "
                     "WHERE trend_id = 'customer_r02' AND category = 'LHC: IC'")
        conn.commit()
        conn.close()
        before = dump(previous)
        assert migration.main(["--sqlite", str(previous)]) == 1
        out = capsys.readouterr().out
        assert "nothing changed" in out and "the dry run again" in out
        for line in ("government_r02: no value chain is stored", "consumer_r05: no value chain is stored",
                     "consumer_r06: no regional exposure is stored; the previous engine simulated such a driver "
                     "as present in every region",
                     "technology_r01: peak year 0 is not a year after the onset",
                     "customer_r01: confidence 'Certain' is not one of High, Medium, Low",
                     "customer_r01: gp1_pct_affected 0.0 is not a share in (0, 1]",
                     "customer_r02: category_exposure['LHC: IC'] = 7 is not a whole number from 0 to 5"):
            assert line in out, line
        assert "value-chain epicentre None" not in out
        assert dump(previous) == before and not migration.ARCHIVE_DIR.exists()

    def test_exposure_maps_are_put_on_the_taxonomy(self, migration, previous, capsys, monkeypatch):
        """A name outside the taxonomy goes and a missing name gets 0; the previous engine read both as
        0, so no number changes."""
        conn = sqlite3.connect(previous)
        conn.execute("INSERT INTO trend_category_exposure VALUES ('consumer_r03', 'Hair: Colour', 4)")
        conn.execute("DELETE FROM trend_regional_exposure WHERE trend_id = 'consumer_r03' AND region = 'Asia'")
        conn.commit()
        conn.close()
        assert migration.main(["--sqlite", str(previous)]) == 0
        report = json.loads(capsys.readouterr().out.split("\nMigrated.")[0])
        assert report["exposures"] == {"names_outside_the_taxonomy_dropped": {"consumer_r03": ["Hair: Colour"]},
                                       "missing_names_set_to_0": {"consumer_r03": ["Asia"]}}
        monkeypatch.setenv("PRISM_DB_PATH", str(previous))
        import prism.database as dbm
        driver = next(d for d in dbm.load_drivers() if d.id == "consumer_r03")
        assert set(driver.category_exposure) == set(SEED["consumer_r03"].category_exposure)
        assert driver.regional_exposure == {**SEED["consumer_r03"].regional_exposure, "Asia": 0}

    def test_a_proposal_keeps_what_the_api_accepts(self, migration, previous, capsys, monkeypatch):
        """A proposal is a draft: a score the API would refuse today is cleared and named, the rest kept."""
        conn = sqlite3.connect(previous)
        conn.execute("INSERT INTO trend_score_proposals (trend_id, user_id, user_name, probability, gp1_pct_affected, "
                     "peak_year, diffusion_curve, uncertainty, category_exposure, regional_exposure, comment) "
                     "VALUES ('government_r17', 'cy', NULL, 3, 0, 2028, 'exponential', 9, "
                     "'{\"Hair: Colour\": 3, \"Hair: Care\": 2}', '{\"Mars\": 5}', 'draft')")
        conn.commit()
        conn.close()
        assert migration.main(["--sqlite", str(previous)]) == 0
        report = json.loads(capsys.readouterr().out.split("\nMigrated.")[0])
        assert report["proposals"]["scores_cleared"] == {"government_r17/cy": [
            "gp1_pct_affected", "peak_year", "diffusion_curve", "uncertainty",
            "category_exposure (1 of 2 cells)", "regional_exposure"]}
        monkeypatch.setenv("PRISM_DB_PATH", str(previous))
        import prism.database as dbm
        [cy] = dbm.load_driver_proposals("government_r17")
        assert (cy["user_name"], cy["probability"], cy["gp1_pct_affected"], cy["peak_year"]) == ("", 3, None, None)
        assert cy["category_exposure"] == {"Hair: Care": 2} and cy["regional_exposure"] is None
        assert cy["comment"] == "draft"

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
        # the tables the migration creates carry the same constraints, word for word
        for table in CREATED_TABLES:
            assert create_statement(previous, table) == create_statement(fresh, table), table
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
        # each fingerprint entry gains the fields the previous one did not record: the onset year of a
        # driver still in the database, None (compares as changed) for anything else; the exposure maps
        # of a driver in the database move onto the taxonomy's names as the driver's own do
        unknown = {key: None for key in FINGERPRINT_KEYS}
        assert first["meta"] == {"driver_count": 51, "model_version": "2.12.0", "driver_fingerprint": {
            "consumer_r01": {**unknown, "p": 5, "s": 2025,
                             "ce": {c: (3.0 if c == "Hair: Color" else 0.0) for c in CATEGORIES},
                             "re": {"Asia": 0.0, "Europe": 5.0, "High Growth": 0.0, "North America": 0.0}},
            "retired_r99": {**unknown, "p": 2, "ce": {"Hair: Care": 1}}}}
        assert [e["detail"] for e in first["integrity_events"]] == [
            {"driver_ids": ["consumer_r01"]}, {"unscored_driver_ids": ["technology_r01"]}, None]
        assert first["decompositions"] == {
            "force": {}, "dimensions": {"vc_stages": ["Raw Materials", "Consumer"], "regions": ["Europe"]}}
        assert first["totals"] == FIRST_RUN["totals"]
        assert rows[1]["results"] == "{not json"
        assert json.loads(rows[2]["results"]) == {"meta": {"driver_count": 51}}

    def test_the_served_run_is_served_after_the_migration(self, migration, previous, monkeypatch):
        """The run production serves stays served, and the production run after the migration finds the
        drivers unchanged since that run."""
        conn = sqlite3.connect(previous)
        conn.execute("INSERT INTO simulation_runs (iterations, results) VALUES (?, ?)",
                     (50000, json.dumps(previous_release_run())))
        conn.commit()
        conn.close()
        assert migration.main(["--sqlite", str(previous)]) == 0

        monkeypatch.setenv("PRISM_DB_PATH", str(previous))
        import prism.database as dbm
        from prism.api.runs import run_status, simulation_payload
        from prism.input_drift import compare_with_run
        run, drivers = dbm.load_latest_run(), dbm.load_drivers()
        assert run_status(run)["has"] is True
        payload = simulation_payload(run, drivers)
        assert payload["inputs_since_run"] == {"changed": [], "added": [], "removed": []}
        assert payload["run_meta"]["driver_count"] == 51
        event = compare_with_run(driver_fingerprint(drivers), run)
        assert event["severity"] == "info" and event["message"].startswith(f"Input drift vs run #{run['id']}, ")
        assert event["message"].endswith(": no changes; the driver inputs are identical to that run's.")

    def test_a_source_tier_outside_the_scale_is_stored_unrated(self, migration, previous, capsys, monkeypatch):
        conn = sqlite3.connect(previous)
        conn.execute("UPDATE trend_sources SET tier = 'A+' WHERE id = (SELECT MIN(id) FROM trend_sources "
                     "WHERE trend_id = 'consumer_r01')")
        conn.commit()
        conn.close()
        assert migration.main(["--sqlite", str(previous)]) == 0
        report = json.loads(capsys.readouterr().out.split("\nMigrated.")[0])
        assert report["source_tiers_outside_the_scale"] == {"consumer_r01": ["A+"]}
        monkeypatch.setenv("PRISM_DB_PATH", str(previous))
        import prism.database as dbm
        first = next(d for d in dbm.load_drivers() if d.id == "consumer_r01").sources[0]
        assert first["tier"] == "" and first["title"] == SEED["consumer_r01"].sources[0]["title"]

    def test_every_source_is_stored_as_the_api_accepts_it(self, migration, previous, capsys, monkeypatch):
        """A link that is not an http(s) address (the API's rule: no scheme, a space) is kept as the title
        where there is none; a source with neither is skipped. Both are reported."""
        conn = sqlite3.connect(previous)
        rows = [r[0] for r in conn.execute("SELECT id FROM trend_sources WHERE trend_id = 'consumer_r03' ORDER BY id")]
        conn.execute("UPDATE trend_sources SET url = 'www.example.org/report', title = '' WHERE id = ?", (rows[0],))
        conn.execute("UPDATE trend_sources SET url = 'https://example.org/a report.pdf' WHERE id = ?", (rows[1],))
        conn.execute("UPDATE trend_sources SET url = '', title = ' ' WHERE id = ?", (rows[2],))
        conn.commit()
        conn.close()
        assert migration.main(["--sqlite", str(previous)]) == 0
        report = json.loads(capsys.readouterr().out.split("\nMigrated.")[0])
        assert report["source_links_that_are_not_web_addresses"] == {
            "consumer_r03": ["www.example.org/report", "https://example.org/a report.pdf"]}
        assert report["sources_without_title_or_link_skipped"] == {"consumer_r03": 1}
        monkeypatch.setenv("PRISM_DB_PATH", str(previous))
        import prism.database as dbm
        sources = next(d for d in dbm.load_drivers() if d.id == "consumer_r03").sources
        assert len(sources) == len(rows) - 1
        assert (sources[0]["title"], sources[0]["url"]) == ("www.example.org/report", "")
        assert sources[1]["url"] == "" and sources[1]["title"] == SEED["consumer_r03"].sources[1]["title"]
        from prism.api.schemas import SourceRef
        for source in sources:
            SourceRef(**source)

    def test_the_journey_content_is_saved_as_a_new_version(self, migration, previous, capsys):
        assert migration.main(["--sqlite", str(previous)]) == 0
        report = json.loads(capsys.readouterr().out.split("\nMigrated.")[0])["journey"]
        assert report == {"stored_content": True, "tiles_renamed": 3, "texts_updated": 3, "texts_already_current": 1,
                          "texts_edited_left_alone": ["t.c.analysis"], "texts_with_breaks_written_out": 0,
                          "codes_removed": {}, "new_version_saved": True}
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
        assert (content["lhc"][0]["label"], content["hair"][0]["label"]) == ("Sorting", "Washing")
        assert "trendCodes" not in json.dumps(content)

    def test_journey_codes_are_drivers_and_breaks_are_written_out(self, migration, previous, capsys):
        conn = sqlite3.connect(previous)
        stored = json.loads(json.dumps(STORED_JOURNEY))
        a = stored["lhc"][0]["benefiting"][0]
        a["trendCodes"] = ["C-01", "C-99", "T-06"]
        a["analysis"] = "**One.** First.\\n\\n**Two.** Second."
        del stored["hair"][0]["negativelyImpacted"][0]["trendCodes"]
        conn.execute("INSERT INTO journey_content (content, updated_by) VALUES (?, 'admin@example.com')",
                     (json.dumps(stored),))
        conn.commit()
        conn.close()
        assert migration.main(["--sqlite", str(previous)]) == 0
        report = json.loads(capsys.readouterr().out.split("\nMigrated.")[0])["journey"]
        assert report["codes_removed"] == {"t.a": ["C-99", "T-06"]} and report["texts_with_breaks_written_out"] == 1
        newest = query(previous, "SELECT content FROM journey_content ORDER BY id DESC LIMIT 1")[0]
        content = json.loads(newest["content"])
        a = content["lhc"][0]["benefiting"][0]
        assert a["driverCodes"] == ["C-01"] and a["analysis"] == "**One.** First.\n\n**Two.** Second."
        assert content["hair"][0]["negativelyImpacted"][0]["driverCodes"] == []

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

    def test_the_archive_is_readable_by_its_owner_only(self, migration, previous):
        assert migration.main(["--sqlite", str(previous)]) == 0
        [archive_file] = list(migration.ARCHIVE_DIR.glob("*.json"))
        assert archive_file.stat().st_mode & 0o077 == 0 and migration.ARCHIVE_DIR.stat().st_mode & 0o077 == 0

    def test_child_rows_without_their_driver_are_skipped_and_reported(self, migration, previous, capsys):
        conn = sqlite3.connect(previous)   # SQLite never enforced the previous foreign keys
        conn.execute("INSERT INTO trend_category_exposure VALUES ('gone_r01', 'Hair: Care', 3)")
        conn.execute("INSERT INTO trend_sources (trend_id, title, url) VALUES ('gone_r01', 'orphan', 'https://x')")
        conn.execute("INSERT INTO trend_score_proposals (trend_id, user_id, probability) VALUES ('gone_r01', 'z', 2)")
        conn.commit()
        conn.close()
        assert migration.main(["--sqlite", str(previous)]) == 0
        report = json.loads(capsys.readouterr().out.split("\nMigrated.")[0])
        assert report["orphans_skipped"] == {"trend_category_exposure": 1, "trend_sources": 1,
                                             "trend_score_proposals": 1}
        assert report["copied"]["proposals"] == 2
        for table in ("driver_category_exposure", "driver_sources", "driver_score_proposals"):
            assert query(previous, f"SELECT COUNT(*) AS n FROM {table} WHERE driver_id = 'gone_r01'") == [{"n": 0}]
        [archive_file] = list(migration.ARCHIVE_DIR.glob("*.json"))
        archive = json.loads(archive_file.read_text(encoding="utf-8"))
        assert any(r["trend_id"] == "gone_r01" for r in archive["tables"]["trend_score_proposals"])

    def test_older_leftovers_are_dropped_in_order(self, migration, older, capsys, monkeypatch, tmp_path):
        """Delphi tables with foreign keys, and a simulation_runs column that references config_snapshots."""
        assert migration.main(["--sqlite", str(older)]) == 0
        report = json.loads(capsys.readouterr().out.split("\nMigrated.")[0])
        assert {"delphi_rounds", "delphi_calibration", "delphi_sessions", "config_snapshots"} <= set(
            report["dropped_tables"])
        assert set(report["dropped_simulation_run_columns"]) == {
            "scenario", "model_type", "config_snapshot_id", "causal_decomposition", "allocation_recommendation",
            "convergence_diagnostics"}
        rows = query(older, "SELECT * FROM simulation_runs ORDER BY id")
        assert [r["iterations"] for r in rows] == [50000, 10, 20] and [r["id"] for r in rows] == [1, 2, 3]
        # the autoincrement counter carried over: a new run continues after the last id
        conn = sqlite3.connect(older)
        conn.execute("INSERT INTO simulation_runs (iterations, results) VALUES (5, '{}')")
        conn.commit()
        assert conn.execute("SELECT MAX(id) FROM simulation_runs").fetchone()[0] == 4
        conn.close()
        fresh = tmp_path / "fresh.db"
        monkeypatch.setenv("PRISM_DB_PATH", str(fresh))
        import prism.database as dbm
        dbm.init_db()
        migrated, new = sqlite_schema(older), sqlite_schema(fresh)
        assert migrated["simulation_runs"] == new["simulation_runs"]
        [archive_file] = list(migration.ARCHIVE_DIR.glob("*.json"))
        archive = json.loads(archive_file.read_text(encoding="utf-8"))
        assert archive["simulation_runs_columns"]["scenario"] == {"1": "base"}
        assert archive["tables"]["delphi_rounds"][0]["session_id"] == "s1"

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

    def test_a_connection_that_fails_is_named_by_its_category_only(self, migration, monkeypatch, capsys):
        """psycopg2's message about a malformed URL quotes part of it, password included."""
        monkeypatch.setenv("POSTGRES_URL", "postgresql://owner:s3cr%zzet@localhost/prism")
        assert migration.main(["--dry-run"]) == 1
        out = capsys.readouterr().out
        assert "Cannot open the database: the database URL is malformed" in out and "s3cr" not in out

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
    @pytest.mark.parametrize("old, published", [
        ("analyst report (Aug 2026)", "Aug 2026"), ("primary source (2026)", "2026"),
        ("trade_press (Jul 2026)", "Jul 2026"), ("trade press", ""), ("", ""), (None, ""),
        ("Company filing, FY2025", "Company filing, FY2025"),
    ])
    def test_the_publication_date_of_a_previous_source(self, migration, old, published):
        assert migration.published_from(old) == published

    def test_run_keys_are_renamed_only_where_needed(self, migration):
        results = json.loads(json.dumps(FIRST_RUN))
        assert migration.rename_run_keys(results) is True
        assert migration.rename_run_keys(results) is False
        assert migration.rename_run_keys({"meta": {"driver_count": 5, "trend_count": 4}}) is False
        assert migration.rename_run_keys({"integrity_events": ["not a dict"]}) is False
        assert migration.rename_run_keys({"decompositions": {"dimensions": {"vc_steps": [], "vc_stages": []}}}) is False
        assert migration.rename_run_keys({"decompositions": ["not a dict"]}) is False

    def test_a_proposal_vote_that_names_no_stage_is_reported(self, migration):
        values, cleared = migration.proposal_scores({"vc_exposure": json.dumps({"supply_chain": 5})}, 2025)
        assert values["vc_epicentre"] == "Supply Chain" and cleared == []
        for unreadable in (json.dumps({"Retail": 5}), "{not json"):
            values, cleared = migration.proposal_scores({"vc_exposure": unreadable}, 2025)
            assert values["vc_epicentre"] is None and cleared == ["vc_epicentre"], unreadable
        for unscored in (None, "{}", json.dumps({"Marketing": 0})):
            values, cleared = migration.proposal_scores({"vc_exposure": unscored}, 2025)
            assert values["vc_epicentre"] is None and cleared == [], unscored

    def test_editor_sources(self, migration):
        saved = [{"title": "A", "url": "https://a", "data": "analyst report (Aug 2026)", "tier": "A"},
                 {"title": "B", "url": "", "source_type": "trade press"},
                 {"title": " ", "url": ""}]
        assert migration.editor_sources(json.dumps(saved)) == [
            {"title": "A", "url": "https://a", "tier": "A", "published": "Aug 2026"},
            {"title": "B", "url": "", "tier": "", "published": ""}]
        for not_a_list in (None, "", "Circana (Apr 2026)", "[not json", '{"a": 1}', "[]", '["a"]',
                           json.dumps([{"title": "", "url": ""}])):
            assert migration.editor_sources(not_a_list) is None, not_a_list

    def test_a_stored_profile_reads_as_the_stage_it_centres_on(self, migration):
        """The rule the previous engine and dashboard read a profile with, so each
        driver keeps the stage it was shown with."""
        for stage in VC_STAGES:
            assert migration.epicentre_of(previous_profile(stage)) == stage, stage
        # the highest score of any profile
        assert migration.epicentre_of({"Manufacturing": 1, "Packaging": 1, "Supply Chain": 2, "Marketing": 4,
                                       "Commercial": 5, "Consumer": 4}) == "Commercial"
        # a tie goes to the stage nearest the score-weighted centre (here pulled downstream)
        assert migration.epicentre_of({"Raw Materials": 3, "Commercial": 2, "Consumer": 3}) == "Consumer"
        # a flat profile centres at 4.5; of the two equally near stages the earlier wins
        assert migration.epicentre_of({stage: 2 for stage in VC_STAGES}) == "Packaging"
        # names compare in lower case with spaces as underscores, as the previous rule read them
        assert migration.epicentre_of({"supply_chain": 5, "manufacturing": 2}) == "Supply Chain"
        assert migration.epicentre_of({"RAW MATERIALS": 1, "packaging": 4}) == "Packaging"
        # names outside the chain, and values that are not numbers, count as 0
        assert migration.epicentre_of({"Retail": 9, "Manufacturing": 2}) == "Manufacturing"
        assert migration.epicentre_of({"Marketing": "high", "Consumer": 1}) == "Consumer"
        for nothing in (None, {}, {"Marketing": 0, "Consumer": 0}, {"Retail": 5}, [5, 3, 1], "Marketing"):
            assert migration.epicentre_of(nothing) is None, nothing

    def test_a_baseline_carries_the_stage_and_every_score(self, migration):
        scores = SEED["consumer_r01"].scores()
        old = {**previous_scores(SEED["consumer_r01"]), "probability": 4}
        old["vc_exposure"] = previous_profile("Supply Chain")
        expected = {**scores, "probability": 4, "vc_epicentre": "Supply Chain"}
        assert migration.baseline_of(json.dumps(old), scores) == (expected, "suggestion", [])
        assert migration.baseline_of(old, scores) == (expected, "suggestion", [])   # a JSONB column
        # a field the suggestion lacks or leaves empty takes the current score
        partial = {"probability": 4, "uncertainty": None, "vc_exposure": {}}
        baseline, source, filled = migration.baseline_of(json.dumps(partial), scores)
        assert source == "suggestion" and baseline == {**scores, "probability": 4}
        assert filled == ["gp1_pct_affected", "peak_year", "diffusion_curve", "uncertainty", "category_exposure",
                          "regional_exposure", "vc_epicentre"]
        # exposure maps go onto the taxonomy's names
        odd = {**old, "category_exposure": {"Hair: Colour": 3, "Hair: Care": 2}}
        assert migration.baseline_of(odd, scores)[0]["category_exposure"] == {c: (2 if c == "Hair: Care" else 0)
                                                                              for c in scores["category_exposure"]}
        for unreadable in (None, "", "{not json", "[1, 2]"):
            assert migration.baseline_of(unreadable, scores) == (scores, "scores", []), unreadable

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

    def test_journey_edits_end_on_the_shipped_content(self):
        """Every entry ends on the text the dashboard ships: a tile's name, driver note or read, or a stage's
        label."""
        edits = json.loads((MIGRATION_DIR / "journey_edits.json").read_text(encoding="utf-8"))["edits"]
        journeys = shipped_journey().values()
        items = {s["id"]: s for journey in journeys for s in journey}
        items.update({t["id"]: t for journey in journeys for stage in journey
                      for side in ("benefiting", "negativelyImpacted") for t in stage.get(side, [])})
        assert edits
        for e in edits:
            key = e.get("tile") or e["stage"]
            assert e["field"] == "label" if "stage" in e else e["field"] in ("name", "driverNote", "analysis"), e
            assert key in items, key
            assert items[key][e["field"]] == e["text"], (key, e["field"])
            assert e["previous_sha256"] and all(re.fullmatch(r"[0-9a-f]{64}", h) for h in e["previous_sha256"])
            assert sha(e["text"]) not in e["previous_sha256"], (key, e["field"])
        assert len({(e.get("tile") or e["stage"], e["field"]) for e in edits}) == len(edits)

    def test_the_shipped_tiles_write_their_paragraph_breaks_out(self):
        """A Strategist Read separates its paragraphs with a blank line, never with
        an escaped one; the stored copy follows through journey_edits.json."""
        texts = [t.get("analysis") or "" for journey in shipped_journey().values() for stage in journey
                 for side in ("benefiting", "negativelyImpacted") for t in stage.get(side, [])]
        assert sum("\n\n" in t for t in texts) >= 250
        assert not any("\\n" in t for t in texts)


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
    cur.execute("SELECT table_name, column_name, data_type, is_nullable, column_default "
                "FROM information_schema.columns WHERE table_schema = %s ORDER BY table_name, ordinal_position",
                (schema,))
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


def fill_previous_postgres(schema: str, json_type: str = "TEXT", older: bool = False) -> None:
    """fill_previous_database on a PostgreSQL schema. The connection is closed
    even when filling fails, so the caller's DROP SCHEMA never waits on its locks."""
    import psycopg2
    conn = psycopg2.connect(schema_url(schema))
    try:
        fill_previous_database(conn, "%s", "SERIAL PRIMARY KEY", json_type, older)
    finally:
        conn.close()


@pytest.fixture
def pg_previous(request):
    """A fresh PostgreSQL schema holding a previous-schema database: (admin connection, schema name).

    Parametrise indirectly with {"json_type": ..., "older": ...} to vary it."""
    import psycopg2
    options = getattr(request, "param", {})
    name = f"m_previous_{uuid.uuid4().hex[:8]}"
    admin = psycopg2.connect(POSTGRES_URL)
    admin.autocommit = True
    admin.cursor().execute(f"CREATE SCHEMA {name}")
    try:
        fill_previous_postgres(name, options.get("json_type", "TEXT"), options.get("older", False))
        yield admin, name
    finally:
        admin.cursor().execute(f"DROP SCHEMA IF EXISTS {name} CASCADE")
        admin.close()


def pg_tables(admin, schema: str) -> set:
    cur = admin.cursor()
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = %s", (schema,))
    return {r[0] for r in cur.fetchall()}


@pytest.mark.skipif(not POSTGRES_URL, reason="PRISM_TEST_POSTGRES_URL is not set")
@pytest.mark.parametrize("pg_previous", [{"older": True}], indirect=True)
def test_postgres_older_leftovers_need_no_cascade(migration, monkeypatch, capsys, pg_previous):
    """PostgreSQL enforces the Delphi and config_snapshots foreign keys; the drop order alone satisfies them."""
    admin, schema = pg_previous
    monkeypatch.setenv("POSTGRES_URL", schema_url(schema))
    assert migration.main(["--postgres"]) == 0
    report = json.loads(capsys.readouterr().out.split("\nMigrated.")[0])
    older = {"delphi_rounds", "delphi_calibration", "delphi_sessions", "config_snapshots"}
    assert older <= set(report["dropped_tables"])
    assert "config_snapshot_id" in report["dropped_simulation_run_columns"]
    assert not pg_tables(admin, schema) & set(migration.DROP_TABLES)


@pytest.mark.skipif(not POSTGRES_URL, reason="PRISM_TEST_POSTGRES_URL is not set")
def test_postgres_an_unknown_dependent_stops_the_migration(migration, monkeypatch, capsys, pg_previous):
    """A table this migration does not know references trends: nothing is dropped with CASCADE, so it stops."""
    admin, schema = pg_previous
    admin.cursor().execute(f"CREATE TABLE {schema}.notes (trend_id TEXT REFERENCES {schema}.trends(id))")
    before = pg_tables(admin, schema)
    monkeypatch.setenv("POSTGRES_URL", schema_url(schema))
    assert migration.main(["--postgres"]) == 2
    out = capsys.readouterr().out
    assert "rolled back" in out and "notes" in out
    assert pg_tables(admin, schema) == before and "drivers" not in before


@pytest.mark.skipif(not POSTGRES_URL, reason="PRISM_TEST_POSTGRES_URL is not set")
def test_postgres_a_busy_table_times_out_instead_of_waiting(migration, monkeypatch, capsys, pg_previous):
    """Another session holding a lock on a table the migration needs: the run gives up after the lock timeout."""
    import psycopg2
    admin, schema = pg_previous
    other = psycopg2.connect(schema_url(schema))
    try:
        other.cursor().execute("LOCK TABLE journey_content IN ROW EXCLUSIVE MODE")   # an open write transaction
        monkeypatch.setattr(migration, "LOCK_TIMEOUT", "1s")
        monkeypatch.setenv("POSTGRES_URL", schema_url(schema))
        assert migration.main(["--postgres"]) == 2
        assert "lock timeout" in capsys.readouterr().out
    finally:
        other.rollback()
        other.close()
    assert "drivers" not in pg_tables(admin, schema)


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
        fill_previous_postgres(previous_schema_name, json_type)

        monkeypatch.setenv("POSTGRES_URL", schema_url(previous_schema_name))
        assert migration.main([]) == 1                        # a PostgreSQL database needs --postgres
        assert "pass --postgres" in capsys.readouterr().out
        assert migration.main(["--dry-run"]) == 0
        assert "Dry run: rolled back" in capsys.readouterr().out
        assert migration.main(["--postgres"]) == 0
        report = json.loads(capsys.readouterr().out.split("\nMigrated.")[0])
        assert report["copied"]["drivers"] == 51 and report["descriptions"]["edited_left_alone"] == ["consumer_r04"]
        assert report["journey"]["texts_updated"] == 3 and report["runs"]["with_renamed_keys"] == 1
        assert report["baselines"]["from_the_current_scores"] == ["technology_r01"]
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
        assert served["journey"]["content"]["lhc"][0]["benefiting"][0]["analysis"] == "Current read A."
    finally:
        for name in (previous_schema_name, fresh_schema_name):
            admin.cursor().execute(f"DROP SCHEMA IF EXISTS {name} CASCADE")
        admin.close()
