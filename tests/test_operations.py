"""The operator's tools: the production run, its QA workbook and the analysis sync."""
import importlib.util
import json
import os
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]


def _load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def seeded(monkeypatch, tmp_path):
    """A fresh SQLite database holding the seed drivers."""
    monkeypatch.setenv("PRISM_DB_PATH", str(tmp_path / "prism.db"))
    import prism.database as dbm
    from prism.seed_drivers import get_seed_drivers
    dbm.init_db()
    dbm.save_drivers(get_seed_drivers())
    return dbm


@pytest.fixture
def production(monkeypatch, tmp_path):
    module = _load("run_production", REPO / "scripts" / "run_production.py")
    monkeypatch.setattr(module, "RUNS_DIR", tmp_path / "runs")
    return module


class TestProductionRun:
    def test_refuses_without_a_database(self, production, monkeypatch):
        monkeypatch.setattr(production, "USE_POSTGRES", False)
        assert production.main([]) == 1

    def test_refuses_a_database_of_the_previous_schema(self, production, monkeypatch, tmp_path):
        import sqlite3
        legacy = tmp_path / "legacy.db"
        sqlite3.connect(legacy).execute("CREATE TABLE trends (id TEXT PRIMARY KEY)").connection.close()
        monkeypatch.setenv("PRISM_DB_PATH", str(legacy))
        assert production.main(["--allow-sqlite"]) == 1

    def test_refuses_an_empty_database(self, production, monkeypatch, tmp_path):
        monkeypatch.setenv("PRISM_DB_PATH", str(tmp_path / "empty.db"))
        import prism.database as dbm
        dbm.init_db()
        assert production.main(["--allow-sqlite", "--iterations", "200"]) == 2

    def test_a_run_is_persisted_with_the_full_contract(self, production, seeded, tmp_path):
        from prism.api.runs import META_KEYS, REQUIRED_KEYS, run_status
        assert production.main(["--allow-sqlite", "--iterations", "300", "--chains", "2"]) == 0
        run = seeded.load_latest_run()
        assert run_status(run)["reason"] == "ok"
        assert set(REQUIRED_KEYS) <= set(run["results"])
        meta = run["results"]["meta"]
        assert set(META_KEYS) <= set(meta) and meta["driver_count"] == 51 and meta["chains"] == 2
        assert set(meta["driver_fingerprint"]) == {d.id for d in seeded.load_drivers()}
        assert run["iterations"] == 300
        assert run["results"]["integrity_events"] == []   # the first run has nothing to compare with
        workbook = list((tmp_path / "runs").glob(f"prism_run_{run['id']}_*.xlsx"))
        assert len(workbook) == 1

        assert production.main(["--allow-sqlite", "--iterations", "300", "--chains", "2"]) == 0
        events = seeded.load_latest_run()["results"]["integrity_events"]
        assert [e["type"] for e in events] == ["input_drift"]
        assert f"vs run #{run['id']}" in events[0]["message"] and "no changes" in events[0]["message"]

    def test_a_driver_that_cannot_be_simulated_is_exit_6(self, production, seeded, caplog):
        with seeded.get_db_connection() as conn:
            conn.cursor().execute("UPDATE drivers SET gp1_pct_affected = NULL WHERE id = 'consumer_r02'")
            conn.cursor().execute("UPDATE drivers SET direction = 'Sideways' WHERE id = 'technology_r01'")
        assert production.main(["--allow-sqlite", "--iterations", "200"]) == 6
        assert "driver consumer_r02: gp1_pct_affected None" in caplog.text
        assert "driver technology_r01: direction 'Sideways'" in caplog.text
        assert seeded.load_latest_run() is None

    def test_the_correlation_check_stops_the_run(self, production, seeded, monkeypatch):
        monkeypatch.setattr(production, "correlation_lambda_min", lambda *a: -0.01)
        assert production.main(["--allow-sqlite", "--iterations", "200"]) == 4
        assert seeded.load_latest_run() is None

    def test_a_failed_persist_is_exit_3(self, production, seeded, monkeypatch):
        def fail(*args, **kwargs):
            raise RuntimeError("database gone")
        monkeypatch.setattr(production, "save_simulation_run", fail)
        assert production.main(["--allow-sqlite", "--iterations", "200", "--chains", "1"]) == 3

    def test_a_bad_cell_weights_file_is_exit_5(self, production, seeded, tmp_path):
        bad = tmp_path / "weights.json"
        bad.write_text(json.dumps({"cells": {}}), encoding="utf-8")
        assert production.main(["--allow-sqlite", "--cell-weights", str(bad)]) == 5


class TestCellWeightsFile:
    def _file(self, tmp_path, cells, basis="gp1_share", source="Finance FY2025"):
        path = tmp_path / "weights.json"
        path.write_text(json.dumps({"source": source, "basis": basis, "cells": cells}), encoding="utf-8")
        return path

    def test_shares_and_absolute_figures(self, production, tmp_path):
        from prism.config import CATEGORIES, REGIONS
        equal = {c: {r: 1.0 / 52 for r in REGIONS} for c in CATEGORIES}
        shares, source = production.load_cell_weights_file(self._file(tmp_path, equal))
        assert source == "Finance FY2025" and shares["LHC: IC"]["Asia"] == pytest.approx(1.0 / 52)
        euros = {c: {r: 250.0 for r in REGIONS} for c in CATEGORIES}
        shares, source = production.load_cell_weights_file(self._file(tmp_path, euros, basis="gp1_absolute"))
        assert shares["LHC: IC"]["Asia"] == pytest.approx(1.0 / 52)
        assert "no amount is stored" in source

    @pytest.mark.parametrize("mutate", [
        lambda cells: cells.pop("LHC: IC"),
        lambda cells: cells["Hair: Care"].pop("Asia"),
        lambda cells: cells["Hair: Care"].update({"Mars": 0.1}),
        lambda cells: cells["Hair: Care"].update({"Asia": -1}),
        lambda cells: cells["Hair: Care"].update({"Asia": 0.9}),   # no longer sums to 1
    ])
    def test_defects_are_refused(self, production, tmp_path, mutate):
        from prism.config import CATEGORIES, REGIONS
        cells = {c: {r: 1.0 / 52 for r in REGIONS} for c in CATEGORIES}
        mutate(cells)
        with pytest.raises(ValueError):
            production.load_cell_weights_file(self._file(tmp_path, cells))


class TestWorkbook:
    def _result(self, config, db):
        from prism.simulation.bayesian_mc import BayesianMonteCarloEngine
        return BayesianMonteCarloEngine(config, seed=42).run_multichain(db, n_chains=2, iterations=200)

    def test_sheets_and_read_back(self, tmp_path, mock_model_config, mock_drivers_database):
        import openpyxl
        from prism.workbook import write_workbook
        result = self._result(mock_model_config, mock_drivers_database)
        path = tmp_path / "run.xlsx"
        write_workbook(str(path), result, mock_model_config, run_id=7, driver_count=5)
        wb = openpyxl.load_workbook(path)
        assert wb.sheetnames == ["Shift Matrix", "Regional Shift", "Cell Weights", "Velocity", "Metadata"]
        meta = {row[0]: row[1] for row in wb["Metadata"].iter_rows(values_only=True) if row[0]}
        assert meta["Run id"] == 7 and meta["Drivers"] == 5 and meta["Iterations"] == 400
        assert meta["Model version"] == result["model_version"]
        assert "Reading note" in meta and "Confidentiality" in meta

        build = _load("build_driver_analysis", REPO / "scripts" / "build_driver_analysis.py")
        build.TERMINAL_YEAR = mock_model_config.path_years[-1]
        read = build.read_workbook(str(path))
        assert read["id"] == 7 and read["pooled_iterations"] == 400
        assert read["categories_terminal"]["LHC: FCN"]["median"] == pytest.approx(
            result["shift_matrix"]["LHC: FCN"]["path"][2030]["median"], abs=1e-6)

    def test_the_estimate_carries_its_derivation(self, tmp_path, mock_model_config, mock_drivers_database):
        import openpyxl
        from prism.workbook import write_workbook
        path = tmp_path / "estimate.xlsx"
        write_workbook(str(path), self._result(mock_model_config, mock_drivers_database), mock_model_config)
        text = "\n".join(str(c) for row in openpyxl.load_workbook(path)["Cell Weights"].iter_rows(values_only=True)
                         for c in row if c is not None)
        assert "How these shares were built" in text and "NOT Henkel P&L" in text
        assert "Share of block" in text and "Margin index" in text
        assert "run_production.py --cell-weights FILE" in text

    def test_other_weights_get_no_derivation(self, tmp_path, mock_model_config, mock_drivers_database):
        import openpyxl
        from prism.config import CATEGORIES, REGIONS
        from prism.workbook import write_workbook
        cfg = mock_model_config.copy_with(cell_weights={c: {r: 1.0 / 52 for r in REGIONS} for c in CATEGORIES},
                                          cell_weights_source="Finance FY2025")
        path = tmp_path / "finance.xlsx"
        write_workbook(str(path), self._result(cfg, mock_drivers_database), cfg)
        text = "\n".join(str(c) for row in openpyxl.load_workbook(path)["Cell Weights"].iter_rows(values_only=True)
                         for c in row if c is not None)
        assert "How these shares were built" not in text and "Source: Finance FY2025" in text


class TestSyncAnalysis:
    def test_dry_run_then_sync(self, seeded, capsys):
        sync = _load("sync_analysis", REPO / "scripts" / "sync_analysis.py")
        with seeded.get_db_connection() as conn:
            conn.cursor().execute("UPDATE drivers SET analysis = 'outdated' WHERE id IN ('consumer_r01', 'technology_r01')")
        assert sync.main(["--dry-run"]) == 0
        assert "2 with an outdated analysis" in capsys.readouterr().out
        assert {d.id: d.analysis for d in seeded.load_drivers()}["consumer_r01"] == "outdated"
        assert sync.main([]) == 0
        from prism.seed_drivers import DRIVERS
        expected = {d.id: d.analysis for d in DRIVERS}
        assert {d.id: d.analysis for d in seeded.load_drivers()} == expected
        with seeded.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'analysis_synced'")
            assert cursor.fetchone()[0] == 2
        assert sync.main([]) == 0
        assert "0 with an outdated analysis" in capsys.readouterr().out

    def test_a_database_of_the_previous_schema_is_refused(self, monkeypatch, tmp_path, capsys):
        import sqlite3
        legacy = tmp_path / "legacy.db"
        sqlite3.connect(legacy).execute("CREATE TABLE trends (id TEXT PRIMARY KEY)").connection.close()
        monkeypatch.setenv("PRISM_DB_PATH", str(legacy))
        sync = _load("sync_analysis", REPO / "scripts" / "sync_analysis.py")
        assert sync.main(["--dry-run"]) == 1
        assert "migrations/0001_driver_schema" in capsys.readouterr().out


def test_the_admin_script_imports():
    module = _load("promote_admin", REPO / "scripts" / "promote_admin.py")
    assert callable(module.main)


@pytest.mark.skipif(not os.environ.get("PRISM_TEST_POSTGRES_URL"), reason="PRISM_TEST_POSTGRES_URL is not set")
def test_the_admin_script_changes_the_role_with_or_without_an_audit_log(capsys):
    """A database the API never started on has user_roles (the dashboard's) but no audit_log."""
    import uuid
    from urllib.parse import quote

    import psycopg2
    url = os.environ["PRISM_TEST_POSTGRES_URL"]
    schema = f"admin_{uuid.uuid4().hex[:8]}"
    admin = psycopg2.connect(url)
    admin.autocommit = True
    cur = admin.cursor()
    cur.execute(f"CREATE SCHEMA {schema}")
    try:
        cur.execute(f"CREATE TABLE {schema}.user_roles (clerk_user_id TEXT PRIMARY KEY, email TEXT, role TEXT, "
                    "updated_at TIMESTAMP)")
        cur.execute(f"INSERT INTO {schema}.user_roles VALUES ('u1', 'Ana@Example.com', 'viewer', NULL)")
        dsn = f"{url}{'&' if '?' in url else '?'}options={quote(f'-c search_path={schema}')}"
        module = _load("promote_admin", REPO / "scripts" / "promote_admin.py")
        assert module.main(["ana@example.com", "--dsn", dsn]) == 0
        assert "(no audit log yet, so not logged)" in capsys.readouterr().out
        cur.execute(f"SELECT role FROM {schema}.user_roles")
        assert cur.fetchone()[0] == "admin"

        cur.execute(f"CREATE TABLE {schema}.audit_log (id SERIAL PRIMARY KEY, action TEXT, entity_type TEXT, "
                    "entity_id TEXT, old_value TEXT, new_value TEXT, reason TEXT, user_id TEXT)")
        assert module.main(["ana@example.com", "--role", "viewer", "--dsn", dsn]) == 0
        cur.execute(f"SELECT action, old_value, new_value FROM {schema}.audit_log")
        assert cur.fetchall() == [("role_change", "admin", "viewer")]
        assert module.main(["nobody@example.com", "--dsn", dsn]) == 3
    finally:
        cur.execute(f"DROP SCHEMA {schema} CASCADE")
        admin.close()
