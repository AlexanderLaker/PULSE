"""Operational-path tests (M10/M4, July 2026 review).

CI previously never exercised the production entrypoint or the Excel
writer — an import-time break in scripts/run_50k_prod.py or a writer
regression only surfaced on run day, on the operator's machine.
"""
import importlib.util
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]


class TestProdEntrypoint:
    def test_run_50k_prod_imports(self):
        """The canonical prod script must import cleanly (M10).

        Importing executes module scope only (arg parsing and the run are
        inside main()); a missing dependency or a renamed symbol fails here
        instead of on run day.
        """
        spec = importlib.util.spec_from_file_location(
            "run_50k_prod", REPO / "scripts" / "run_50k_prod.py"
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        assert callable(mod.main)
        assert mod.EXPECTED_TREND_COUNT == 51  # 2.11.0 (O10): the 51-driver base

    def test_run_50k_refuses_wrong_db_mode(self, monkeypatch):
        """H1: a Postgres URL + SQLite fallback must abort with exit code 4."""
        spec = importlib.util.spec_from_file_location(
            "run_50k_prod_h1", REPO / "scripts" / "run_50k_prod.py"
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        monkeypatch.setenv("DATABASE_URL", "postgres://example.invalid/prod")
        # Force the observed mode to SQLite regardless of the test host.
        monkeypatch.setattr(mod, "USE_POSTGRES", False)
        assert mod.main([]) == 4

    def test_python_dash_m_pulse_helpers_import(self):
        """`python -m pulse` CLI module imports (L1 regression guard)."""
        import pulse.main  # noqa: F401
        parser = pulse.main.create_parser()
        args = parser.parse_args(["--seeds", "1", "2"])
        assert args.seeds == [1, 2]


class TestExcelWriterRoundTrip:
    def test_writer_produces_workbook(self, tmp_path, mock_model_config, mock_trends_database):
        """M10: engine result → xlsx → reopen → expected sheets + a value."""
        openpyxl = pytest.importorskip("openpyxl")
        from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine
        from pulse.excel_bridge.writer import ShiftMatrixWriter

        result = BayesianMonteCarloEngine(mock_model_config, seed=42).run(
            mock_trends_database, iterations=200
        )
        out = tmp_path / "roundtrip.xlsx"
        writer = ShiftMatrixWriter(mock_model_config)
        writer.write(str(out), result, allocation=None,
                     metadata={"model_version": result["model_version"],
                               "engine_name": result["engine_name"],
                               "iterations": 200})
        assert out.exists() and out.stat().st_size > 0

        wb = openpyxl.load_workbook(out, read_only=True)
        sheets = set(wb.sheetnames)
        assert any("Shift" in s for s in sheets), sheets
        assert any("Metadata" in s or "Meta" in s for s in sheets), sheets

    def test_cell_weight_sheet_carries_the_estimate_provenance(
            self, tmp_path, mock_model_config, mock_trends_database):
        """O14: a reader holding the QA workbook offline must be able to see
        that the default shares are an ESTIMATE and how each was reached. A
        source line alone invites them to be read as Henkel P&L."""
        openpyxl = pytest.importorskip("openpyxl")
        from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine
        from pulse.excel_bridge.writer import ShiftMatrixWriter

        result = BayesianMonteCarloEngine(mock_model_config, seed=42).run(
            mock_trends_database, iterations=200)
        out = tmp_path / "provenance.xlsx"
        ShiftMatrixWriter(mock_model_config).write(
            str(out), result, allocation=None,
            metadata={"model_version": result["model_version"],
                      "engine_name": result["engine_name"], "iterations": 200})

        wb = openpyxl.load_workbook(out)
        assert "Cell Weights" in wb.sheetnames
        text = "\n".join(
            str(c.value) for row in wb["Cell Weights"].iter_rows()
            for c in row if c.value is not None)
        assert "HOW THESE SHARES WERE BUILT" in text
        assert "NOT Henkel P&L" in text
        # the grade legend and at least one graded row of each input table
        for g in ("B", "E", "G"):
            assert f"\n{g}\n" in f"\n{text}\n" or f"\n{g}" in text, g
        assert "Share of block" in text and "Margin index" in text
        assert "run_50k_prod.py --cell-weights FILE" in text

    def test_cell_weight_provenance_is_omitted_for_other_matrices(
            self, tmp_path, mock_model_config, mock_trends_database):
        """It must describe the matrix the run actually used. Under the equal
        grid, or any loaded finance file, the derivation is not the story and
        printing it would be a provenance lie."""
        openpyxl = pytest.importorskip("openpyxl")
        from pulse.config import EQUAL_CELL_WEIGHTS, EQUAL_CELL_WEIGHTS_SOURCE
        from pulse.simulation.bayesian_mc import BayesianMonteCarloEngine
        from pulse.excel_bridge.writer import ShiftMatrixWriter

        cfg = mock_model_config.copy_with(cell_weights=EQUAL_CELL_WEIGHTS,
                                          cell_weights_source=EQUAL_CELL_WEIGHTS_SOURCE)
        result = BayesianMonteCarloEngine(cfg, seed=42).run(mock_trends_database, iterations=200)
        out = tmp_path / "equal.xlsx"
        ShiftMatrixWriter(cfg).write(str(out), result, allocation=None,
                                     metadata={"model_version": result["model_version"],
                                               "engine_name": result["engine_name"],
                                               "iterations": 200})
        wb = openpyxl.load_workbook(out)
        text = "\n".join(
            str(c.value) for row in wb["Cell Weights"].iter_rows()
            for c in row if c.value is not None)
        assert "HOW THESE SHARES WERE BUILT" not in text
        assert "Equal placeholder" in text


class TestReproducibilityContract:
    def test_load_trends_orders_by_id(self):
        """C2 upstream pin (adversarial re-review 2026-07-06): the engine-level
        order-sensitivity test proves order MATTERS; this guards the SQL that
        pins the order. If someone rewrites the query, this fails until the
        deterministic-order contract is preserved."""
        import inspect
        import pulse.database as pdb
        src = inspect.getsource(pdb.load_trends)
        assert "ORDER BY id" in src, (
            "load_trends() must return trends in a deterministic order — "
            "reproducibility depends on it (C2)."
        )


class TestSnapshotCap:
    def test_snapshot_cap_counts_name_and_notes(self):
        """M12 bypass regression (adversarial re-review 2026-07-06): the cap
        must count name/notes, not only shifts/trends — multi-MB free-text
        used to slip past it."""
        from fastapi.testclient import TestClient
        from pulse.api.app import app
        from pulse.api import auth as pauth

        client = TestClient(app, raise_server_exceptions=False)
        app.dependency_overrides[pauth.require_auth] = lambda: {
            "sub": "test-user", "email": "t@example.com", "role": "viewer",
        }
        try:
            resp = client.post("/api/v1/snapshots", json={
                "name": "x" * 199,
                "shifts": {},
                "trends": [],
                "notes": "y" * 3999,
            })
            # Within schema bounds and under the byte cap → not a 413/422.
            assert resp.status_code not in (413, 422), resp.text

            # Over the schema bound → rejected at validation.
            resp = client.post("/api/v1/snapshots", json={
                "name": "x" * 10_000, "shifts": {}, "trends": [],
            })
            assert resp.status_code == 422

            # Under the schema bounds but a huge shifts payload → 413.
            resp = client.post("/api/v1/snapshots", json={
                "name": "ok",
                "shifts": {"blob": "z" * (600 * 1024)},
                "trends": [],
            })
            assert resp.status_code == 413
        finally:
            app.dependency_overrides.pop(pauth.require_auth, None)


class TestDiagnosticsFailureBranch:
    def test_diagnostics_survives_db_outage(self, monkeypatch):
        """M4: /diagnostics must EXPLAIN a DB outage, not crash on it."""
        from fastapi.testclient import TestClient
        from pulse.api.app import app
        import pulse.database as pdb

        def _boom():
            raise RuntimeError("simulated Neon outage")

        monkeypatch.setattr(pdb, "diagnose_connection", _boom)
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/api/v1/diagnostics")
        assert resp.status_code == 200
        body = resp.json()
        assert body["simulation_reason"] == "db_error"
        assert body["db_reachable"] is False
        assert "simulated Neon outage" in (body.get("error") or "")
